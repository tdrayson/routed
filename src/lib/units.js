// Distance + duration formatting and conversions.

export const MI_PER_M = 0.000621371
export const M_PER_MI = 1609.344
export const M_PER_KM = 1000

export function toMeters(value, unit) {
  if (unit === 'mi') return value * M_PER_MI
  if (unit === 'km') return value * M_PER_KM
  return value
}

export function fromMeters(meters, unit) {
  if (unit === 'mi') return meters * MI_PER_M
  if (unit === 'km') return meters / M_PER_KM
  return meters
}

export function formatDistance(meters, unit = 'mi') {
  if (unit === 'km') {
    return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`
  }
  const mi = meters * MI_PER_M
  return mi >= 0.1 ? `${mi.toFixed(2)} mi` : `${Math.round(mi * 5280)} ft`
}

export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
