// Google encoded polyline algorithm (precision 5).
// Compresses an array of [lon, lat] coordinates into a compact ASCII string
// suitable for embedding in URLs. Typical 5km route ≈ 400–700 chars.

const PRECISION = 5
const FACTOR = 10 ** PRECISION

export function encode(coordinates) {
  let lastLat = 0
  let lastLng = 0
  let result = ''
  for (const [lng, lat] of coordinates) {
    const latI = Math.round(lat * FACTOR)
    const lngI = Math.round(lng * FACTOR)
    result += encodeSigned(latI - lastLat)
    result += encodeSigned(lngI - lastLng)
    lastLat = latI
    lastLng = lngI
  }
  return result
}

export function decode(str) {
  const coordinates = []
  let lat = 0
  let lng = 0
  let index = 0
  while (index < str.length) {
    let result = 0
    let shift = 0
    let b
    do {
      b = str.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1

    result = 0
    shift = 0
    do {
      b = str.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1

    coordinates.push([lng / FACTOR, lat / FACTOR])
  }
  return coordinates
}

function encodeSigned(value) {
  let v = value < 0 ? ~(value << 1) : value << 1
  let result = ''
  while (v >= 0x20) {
    result += String.fromCharCode((0x20 | (v & 0x1f)) + 63)
    v >>= 5
  }
  result += String.fromCharCode(v + 63)
  return result
}
