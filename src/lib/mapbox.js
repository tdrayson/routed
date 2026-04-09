// Thin wrappers around the Mapbox HTTP APIs we use.

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

if (!TOKEN) {
  // eslint-disable-next-line no-console
  console.warn('VITE_MAPBOX_TOKEN is not set')
}

export const MAPBOX_TOKEN = TOKEN

export function profileFor(activity) {
  if (activity === 'cycling') return 'cycling'
  // Running uses Mapbox's walking profile (pedestrian paths) but a faster pace.
  return 'walking'
}

// Average speeds (m/s) for seeding distance from a time target.
export const SPEED_MS = {
  walking: 1.4,
  running: 3.1,
  cycling: 5.0,
}

export async function geocode(query) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${TOKEN}&types=address,place,poi&limit=5`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Geocoding failed')
  const data = await res.json()
  return data.features || []
}

export async function reverseGeocode([lon, lat]) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${TOKEN}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Reverse geocoding failed')
  const data = await res.json()
  return data.features?.[0]?.place_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`
}

// Request a route through a list of [lon,lat] waypoints.
// Returns { geometry, distance, duration, alternatives? }.
export async function directions(waypoints, profile, { alternatives = false, continueStraight = false } = {}) {
  const coords = waypoints.map((c) => c.join(',')).join(';')
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}` +
    `?access_token=${TOKEN}&geometries=geojson&overview=full` +
    `&alternatives=${alternatives}&continue_straight=${continueStraight}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Directions request failed')
  const data = await res.json()
  if (!data.routes?.length) throw new Error('No route found')

  const [primary, ...alts] = data.routes
  return {
    geometry: primary.geometry,
    distance: primary.distance,
    duration: primary.duration,
    waypoints,
    alternatives: alts.map((r) => ({
      geometry: r.geometry,
      distance: r.distance,
      duration: r.duration,
      waypoints,
    })),
  }
}
