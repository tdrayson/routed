// Smart route generation.
//
// Strategy: geometric seeding + adaptive binary search.
// Instead of spamming the Directions API with random points and hoping one
// lands near the target, we place candidate waypoints at a computed radius
// from the start, route once, then iteratively scale the radius by
// (target / actual) until convergence. This usually converges in 2–3 calls
// because road-network distance scales near-linearly with radius at the
// scale of a typical run/ride.

import { directions, profileFor, SPEED_MS } from '../lib/mapbox';
import {
  movePoint,
  bearingsAround,
  bearingBetween,
  midpoint,
  haversine,
  overlapStats,
} from '../lib/geometry';

// Drop routes with retraced segments ("spur" / dead-end appendages or
// U-turns that go out and immediately come back). Out-and-back trips are
// intentionally 100% overlap so we never apply this to them.
//
// We use an *absolute meters* threshold rather than a ratio so small spurs
// on long routes (e.g. a 100m dead-end on a 5km loop) still get caught.
// 60m of retraced road is roughly the smallest visible "go down then back"
// segment a user would notice and complain about.
const MAX_DOUBLED_METERS = 50;
function dropSpurs(routes) {
  const scored = routes.map((r) => {
    const doubled = overlapStats(r.geometry.coordinates).doubledMeters;
    return { route: { ...r, doubledMeters: doubled }, doubled };
  });
  const clean = scored.filter((s) => s.doubled <= MAX_DOUBLED_METERS);
  if (clean.length) return clean.map((s) => s.route);
  // Nothing passed — fall back to all candidates sorted by least doubling
  // so the user still has variety, with the cleanest one first.
  scored.sort((a, b) => a.doubled - b.doubled);
  return scored.map((s) => s.route);
}

const TOLERANCE = 0.08; // accept within ±8% of target
const MAX_ITERATIONS = 3;

// Pick the metric we're optimising for.
function measure(route, targetType) {
  return targetType === 'time' ? route.duration : route.distance;
}

// Run a single binary-search convergence loop.
// `seedFn(radius)` builds the waypoint list, returns { waypoints, totalScale }.
// `totalScale` is how the routed metric relates to a single leg's metric:
//   - loop: 1 (the routed result is the full perimeter)
//   - out-and-back: 2 (we route one leg, mirror for the other)
async function converge({
  initialRadius,
  target,
  targetType,
  seedFn,
  profile,
  totalScale = 1,
  continueStraight = false,
}) {
  let radius = initialRadius;
  let best = null;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const { waypoints } = seedFn(radius);
    let route;
    try {
      route = await directions(waypoints, profile, { continueStraight });
    } catch {
      radius *= 0.85; // shrink and retry — likely a routing dead end
      continue;
    }
    const observed = measure(route, targetType) * totalScale;
    const ratio = target / observed;
    best = { route, observed, radius };
    if (Math.abs(1 - ratio) <= TOLERANCE) break;
    // Damp the correction slightly to avoid oscillation on the final step.
    radius *= 0.5 + 0.5 * ratio;
  }
  return best;
}

// ---------- Loop ----------
// Triangular loop: three waypoints at bearings θ, θ+120°, θ+240° around the
// start, all at the same radius r. Equilateral perimeter ≈ 3·r·√3 in straight
// line; road network adds ~1.3x detour, so seed r = target / (3·√3·1.3) ≈ target/6.75.
async function generateLoopBearing(
  start,
  bearing,
  profile,
  target,
  targetType,
  speed,
) {
  const targetMeters = targetType === 'time' ? target * speed : target;
  const initialRadius = targetMeters / 6.75;

  const seedFn = (r) => {
    const a = movePoint(start, bearing, r);
    const b = movePoint(start, (bearing + 120) % 360, r);
    const c = movePoint(start, (bearing + 240) % 360, r);
    return { waypoints: [start, a, b, c, start] };
  };

  // continueStraight=true forbids U-turns at each waypoint, which is what
  // produces 99% of "go down a road and come back" spurs in loops.
  return converge({ initialRadius, target, targetType, seedFn, profile, continueStraight: true });
}

export async function generateLoops(
  start,
  profile,
  target,
  targetType,
  candidates = 8,
  activity = profile,
) {
  const speed = SPEED_MS[activity] || SPEED_MS[profile] || SPEED_MS.walking;
  const bearings = bearingsAround(candidates, true);
  const results = await Promise.all(
    bearings.map((b) =>
      generateLoopBearing(start, b, profile, target, targetType, speed).catch(
        () => null,
      ),
    ),
  );
  const built = results
    .filter(Boolean)
    .map((r, i) => buildRoute(r.route, `Loop ${i + 1}`));
  return dropSpurs(built);
}

// ---------- Out-and-back ----------
// One waypoint at radius r along a bearing; route to it, then mirror the
// returned coordinates to form the return leg. Total ≈ 2·oneWay, road factor
// ~1.3, so seed r = target / 2.6.
async function generateOutBackBearing(
  start,
  bearing,
  profile,
  target,
  targetType,
  speed,
) {
  const targetMeters = targetType === 'time' ? target * speed : target;
  const initialRadius = targetMeters / 2.6;

  const seedFn = (r) => {
    const dest = movePoint(start, bearing, r);
    return { waypoints: [start, dest] };
  };

  const result = await converge({
    initialRadius,
    target,
    targetType,
    seedFn,
    profile,
    totalScale: 2,
  });
  if (!result) return null;

  const { route } = result;
  const out = route.geometry.coordinates;
  // Mirror, dropping the duplicated turnaround coordinate.
  const back = out.slice(0, -1).reverse();
  return buildRoute(
    {
      geometry: { type: 'LineString', coordinates: [...out, ...back] },
      distance: route.distance * 2,
      duration: route.duration * 2,
      waypoints: [route.waypoints[0], route.waypoints[1], route.waypoints[0]],
    },
    'Out & back',
  );
}

export async function generateOutBacks(
  start,
  profile,
  target,
  targetType,
  candidates = 6,
  activity = profile,
) {
  const speed = SPEED_MS[activity] || SPEED_MS[profile] || SPEED_MS.walking;
  const bearings = bearingsAround(candidates, true);
  const results = await Promise.all(
    bearings.map((b) =>
      generateOutBackBearing(
        start,
        b,
        profile,
        target,
        targetType,
        speed,
      ).catch(() => null),
    ),
  );
  return results
    .filter(Boolean)
    .map((r, i) => ({ ...r, label: `Out & back ${i + 1}` }));
}

// ---------- One-way ----------
// If the direct route already meets the target, surface it + alternatives.
// Otherwise, place a midpoint perpendicular to start→end and binary-search
// the offset distance. Perpendicular detour adds roughly 2× offset to total.
export async function generateOneWay(start, end, profile, target, targetType, activity = profile) {
  const speed = SPEED_MS[activity] || SPEED_MS[profile] || SPEED_MS.walking;
  const targetMeters = targetType === 'time' ? target * speed : target;

  const direct = await directions([start, end], profile, {
    alternatives: true,
    continueStraight: true,
  });
  const directObserved =
    targetType === 'time' ? direct.duration : direct.distance;

  if (directObserved >= targetMeters * (1 - TOLERANCE)) {
    const all = [direct, ...direct.alternatives].slice(0, 3);
    const built = all.map((r, i) =>
      buildRoute(r, i === 0 ? 'Direct' : `Alt ${i}`),
    );
    return dropSpurs(built);
  }

  // Detour required.
  const extraMeters = targetMeters - directObserved;
  const initialOffset = extraMeters / 2;
  const baseMid = midpoint(start, end);
  const lineBearing = bearingBetween(start, end);

  const trySide = async (side) => {
    const seedFn = (offset) => {
      const mid = movePoint(baseMid, (lineBearing + side + 360) % 360, offset);
      return { waypoints: [start, mid, end] };
    };
    return converge({
      initialRadius: initialOffset,
      target,
      targetType,
      seedFn,
      profile,
      continueStraight: true,
    });
  };

  const sides = await Promise.all([
    trySide(90).catch(() => null),
    trySide(-90).catch(() => null),
  ]);
  const built = sides
    .filter(Boolean)
    .map((r, i) =>
      buildRoute(r.route, i === 0 ? 'Detour (left)' : 'Detour (right)'),
    );
  return dropSpurs(built);
}

// ---------- Common ----------
function buildRoute(route, label) {
  return {
    label,
    geometry: route.geometry,
    distance: route.distance,
    duration: route.duration,
    waypoints: route.waypoints,
  };
}

// Top-level entry point: dispatches by trip type.
export async function generateRoutes({
  tripType,
  start,
  end,
  activity,
  target,
  targetType,
}) {
  const profile = profileFor(activity);

  if (tripType === 'loop') {
    return generateLoops(start, profile, target, targetType, undefined, activity);
  }
  if (tripType === 'outback') {
    return generateOutBacks(start, profile, target, targetType, undefined, activity);
  }
  if (tripType === 'oneway') {
    if (!end) throw new Error('End location required for one-way');
    return generateOneWay(start, end, profile, target, targetType, activity);
  }
  throw new Error(`Unknown trip type: ${tripType}`);
}

// Sort by closeness to target for ranking in the UI.
export function rankByCloseness(routes, target, targetType) {
  return [...routes].sort((a, b) => {
    const av = Math.abs(measure(a, targetType) - target);
    const bv = Math.abs(measure(b, targetType) - target);
    return av - bv;
  });
}
