// Spherical geometry helpers. Coordinates are [lon, lat] throughout.

const R = 6371000 // Earth radius in meters
const toRad = (d) => (d * Math.PI) / 180
const toDeg = (r) => (r * 180) / Math.PI

// Move a point along a bearing (degrees) by a distance (meters).
export function movePoint([lon, lat], bearingDeg, distanceMeters) {
  const φ1 = toRad(lat)
  const λ1 = toRad(lon)
  const θ = toRad(bearingDeg)
  const δ = distanceMeters / R

  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ))
  const λ2 = λ1 + Math.atan2(
    Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
    Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
  )
  return [toDeg(λ2), toDeg(φ2)]
}

// Bearing in degrees from a → b.
export function bearingBetween([lon1, lat1], [lon2, lat2]) {
  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const Δλ = toRad(lon2 - lon1)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

// Great-circle distance between two points (meters).
export function haversine([lon1, lat1], [lon2, lat2]) {
  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const Δφ = toRad(lat2 - lat1)
  const Δλ = toRad(lon2 - lon1)
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// Midpoint between two coordinates.
export function midpoint([lon1, lat1], [lon2, lat2]) {
  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const λ1 = toRad(lon1)
  const Δλ = toRad(lon2 - lon1)
  const Bx = Math.cos(φ2) * Math.cos(Δλ)
  const By = Math.cos(φ2) * Math.sin(Δλ)
  const φ3 = Math.atan2(
    Math.sin(φ1) + Math.sin(φ2),
    Math.sqrt((Math.cos(φ1) + Bx) ** 2 + By ** 2),
  )
  const λ3 = λ1 + Math.atan2(By, Math.cos(φ1) + Bx)
  return [toDeg(λ3), toDeg(φ3)]
}

// N evenly-spaced bearings around 360°, optionally rotated by a random offset.
export function bearingsAround(n, jitter = true) {
  const offset = jitter ? Math.random() * 360 : 0
  return Array.from({ length: n }, (_, i) => (offset + (360 / n) * i) % 360)
}

// Detect retraced ("spur") segments in a route geometry.
//
// Mapbox returns each leg of a multi-waypoint route as an independent
// polyline with its own interpolation, so exact edge matching misses
// retraces where the coordinates differ by a few cm. Instead, we detect
// overlap by *proximity*: for every pair of non-adjacent segments (i, j),
// we check if both endpoints of segment i are close (< 8m) to both
// endpoints of segment j — either matched in order (parallel, same
// direction) or swapped (anti-parallel, opposite direction). Either case
// means the same stretch of road is being traversed twice.
//
// Returns { ratio, doubledMeters } where doubledMeters is the total physical
// length of road retraced (not the sum of both passes).
export function overlapStats(coordinates) {
  const n = coordinates?.length || 0
  if (n < 4) return { ratio: 0, doubledMeters: 0 }

  const PROXIMITY_M = 8 // two segments within this distance are "the same road"
  const MIN_GAP = 3 // segments must be at least this far apart in the index

  // Precompute segment lengths and total.
  const segLen = new Array(n - 1)
  let total = 0
  for (let i = 0; i < n - 1; i++) {
    segLen[i] = haversine(coordinates[i], coordinates[i + 1])
    total += segLen[i]
  }

  // Mark each segment index that participates in an overlap.
  const flagged = new Uint8Array(n - 1)
  for (let i = 0; i < n - 1; i++) {
    const a1 = coordinates[i]
    const a2 = coordinates[i + 1]
    for (let j = i + MIN_GAP; j < n - 1; j++) {
      const b1 = coordinates[j]
      const b2 = coordinates[j + 1]
      const parallel =
        haversine(a1, b1) < PROXIMITY_M && haversine(a2, b2) < PROXIMITY_M
      const antiParallel =
        haversine(a1, b2) < PROXIMITY_M && haversine(a2, b1) < PROXIMITY_M
      if (parallel || antiParallel) {
        flagged[i] = 1
        flagged[j] = 1
      }
    }
  }

  // Each pair of flagged segments represents one physical stretch of road
  // traversed twice, so the "doubled" (extra) distance is half the summed
  // flagged length. Average i + j lengths by halving the total.
  let flaggedTotal = 0
  for (let i = 0; i < n - 1; i++) {
    if (flagged[i]) flaggedTotal += segLen[i]
  }
  const doubledMeters = flaggedTotal / 2

  return { ratio: total > 0 ? doubledMeters / total : 0, doubledMeters }
}

// Trim spur segments (out-and-back dead-ends) from a coordinate array.
//
// Uses the same proximity-based overlap detection as overlapStats, then groups
// the flagged segments into contiguous spur regions and splices each one out,
// keeping a single junction point where the spur branched off the main route.
//
// Returns { coordinates, trimmedMeters }.
export function trimSpurCoordinates(coordinates) {
  const n = coordinates?.length || 0
  if (n < 6) return { coordinates: coordinates || [], trimmedMeters: 0 }

  const PROXIMITY_M = 8
  const MIN_GAP = 3
  const MAX_TIP_GAP = 5      // unflagged segments allowed at the spur turnaround
  const JUNCTION_PROXIMITY_M = 40 // entry/exit must be within this distance

  const segLen = new Array(n - 1)
  for (let i = 0; i < n - 1; i++) {
    segLen[i] = haversine(coordinates[i], coordinates[i + 1])
  }

  const flagged = new Uint8Array(n - 1)
  for (let i = 0; i < n - 1; i++) {
    const a1 = coordinates[i]
    const a2 = coordinates[i + 1]
    for (let j = i + MIN_GAP; j < n - 1; j++) {
      const b1 = coordinates[j]
      const b2 = coordinates[j + 1]
      const parallel =
        haversine(a1, b1) < PROXIMITY_M && haversine(a2, b2) < PROXIMITY_M
      const antiParallel =
        haversine(a1, b2) < PROXIMITY_M && haversine(a2, b1) < PROXIMITY_M
      if (parallel || antiParallel) {
        flagged[i] = 1
        flagged[j] = 1
      }
    }
  }

  // Group flagged segments into contiguous runs, allowing small gaps for the
  // unflagged segments at the spur tip (turnaround point).
  const groups = []
  let groupStart = -1
  let lastFlagged = -1
  for (let i = 0; i < n - 1; i++) {
    if (flagged[i]) {
      if (groupStart === -1) {
        groupStart = i
      } else if (i - lastFlagged > MAX_TIP_GAP) {
        groups.push([groupStart, lastFlagged])
        groupStart = i
      }
      lastFlagged = i
    }
  }
  if (groupStart !== -1) {
    groups.push([groupStart, lastFlagged])
  }

  if (groups.length === 0) return { coordinates, trimmedMeters: 0 }

  const result = [...coordinates]
  let totalTrimmed = 0

  // Process in reverse so splicing high indices doesn't shift lower ones.
  for (let g = groups.length - 1; g >= 0; g--) {
    const [gStart, gEnd] = groups[g]
    const exitIdx = gEnd + 1

    // Don't trim if the spur touches the very last coordinate.
    if (exitIdx >= n - 1) continue

    const entryPoint = coordinates[gStart]
    const exitPoint = coordinates[exitIdx]

    // Confirm entry and exit are close — it really is a spur, not
    // coincidental road reuse in a different part of the route.
    if (haversine(entryPoint, exitPoint) > JUNCTION_PROXIMITY_M) continue

    let spurDist = 0
    for (let i = gStart; i <= gEnd; i++) {
      spurDist += segLen[i]
    }
    totalTrimmed += spurDist

    // Splice out the spur: keep the entry point, drop everything through the
    // exit point (entry ≈ exit so we only need one).
    result.splice(gStart + 1, exitIdx - gStart)
  }

  return { coordinates: result, trimmedMeters: totalTrimmed }
}

// Backward-compat alias.
export function overlapRatio(coordinates) {
  return overlapStats(coordinates).ratio
}
