// Build a GPX 1.1 track file from a route and trigger a browser download.
// Routes are stored as GeoJSON LineStrings ([lon, lat] pairs) — GPX expects
// lat/lon attributes, so we swap per point.

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  }[c]))
}

// Map our internal activity names to the sport/type strings Strava (and
// most other GPX importers) recognise in the <trk><type> element.
const GPX_TYPE = {
  walking: 'walking',
  running: 'running',
  cycling: 'cycling',
}

export function routeToGpx(route, { name = 'Routed', activity = 'walking' } = {}) {
  const coords = route.geometry?.coordinates || []
  // Strava requires timestamps on trackpoints to accept the file as an
  // activity. Synthesize a fake time series by spacing points evenly across
  // the route's expected duration (falling back to 1s spacing).
  const total = route.duration && route.duration > 0 ? route.duration : coords.length
  const step = coords.length > 1 ? total / (coords.length - 1) : 0
  const startTime = Date.now() - Math.round(total * 1000)
  const points = coords
    .map(([lon, lat], i) => {
      const t = new Date(startTime + Math.round(step * i * 1000)).toISOString()
      return `      <trkpt lat="${lat}" lon="${lon}"><time>${t}</time></trkpt>`
    })
    .join('\n')
  const safeName = escapeXml(name)
  const type = GPX_TYPE[activity] || 'walking'
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Routed" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${safeName}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${safeName}</name>
    <type>${type}</type>
    <trkseg>
${points}
    </trkseg>
  </trk>
</gpx>
`
}

export function downloadGpx(route, name, activity) {
  const filename = (name || route.label || 'route').replace(/[^a-z0-9-_]+/gi, '_') + '.gpx'
  const blob = new Blob([routeToGpx(route, { name: name || route.label, activity })], {
    type: 'application/gpx+xml',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Build a Google Maps directions URL that walks through a sampling of the
// route's coordinates. Google caps the number of waypoints in a URL, so we
// downsample aggressively.
export function googleMapsUrl(route, activity = 'walking') {
  const coords = route.geometry?.coordinates || []
  if (coords.length < 2) return ''
  const MAX = 10
  const step = Math.max(1, Math.floor(coords.length / MAX))
  const picked = []
  for (let i = 0; i < coords.length; i += step) picked.push(coords[i])
  if (picked[picked.length - 1] !== coords[coords.length - 1]) {
    picked.push(coords[coords.length - 1])
  }
  const travelmode = activity === 'cycling' ? 'bicycling' : 'walking'
  const path = picked.map(([lon, lat]) => `${lat},${lon}`).join('/')
  return `https://www.google.com/maps/dir/${path}/?travelmode=${travelmode}`
}
