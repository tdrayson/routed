// Route serialization for sharing (URL hash) and saving (localStorage).
//
// A "saved route" is a self-contained snapshot — start/end coords, labels,
// activity, distance/duration totals, and the encoded polyline geometry —
// so it can be re-displayed without re-running route generation.

import { encode, decode } from './polyline'

const STORAGE_KEY = 'routed.saved'

// Compact serialised form (kept short to keep URLs small):
//   v: schema version
//   l: label
//   a: activity
//   t: trip type
//   u: unit (mi|km)
//   d: distance (m)
//   s: duration (sec)
//   p: encoded polyline
//   sc: start coords [lon, lat]
//   ec: end coords (oneway only)
//   sl: start label
//   el: end label

export function serializeRoute(route, store) {
  return {
    v: 1,
    l: route.label,
    a: store.activity,
    t: store.tripType,
    u: store.unit,
    d: route.distance,
    s: route.duration,
    p: encode(route.geometry.coordinates),
    sc: store.start,
    ec: store.end || undefined,
    sl: store.startLabel || '',
    el: store.endLabel || '',
  }
}

export function deserializeRoute(data) {
  if (!data || data.v !== 1) throw new Error('Unsupported share format')
  return {
    label: data.l || 'Shared route',
    activity: data.a,
    tripType: data.t,
    unit: data.u,
    distance: data.d,
    duration: data.s,
    geometry: { type: 'LineString', coordinates: decode(data.p) },
    start: data.sc,
    end: data.ec || null,
    startLabel: data.sl || '',
    endLabel: data.el || '',
  }
}

// ---------- URL hash ----------

export function buildShareUrl(route, store) {
  const json = JSON.stringify(serializeRoute(route, store))
  return `${location.origin}${location.pathname}#r=${b64urlEncode(json)}`
}

export function readHashRoute() {
  const hash = location.hash
  if (!hash.startsWith('#r=')) return null
  try {
    const json = b64urlDecode(hash.slice(3))
    return deserializeRoute(JSON.parse(json))
  } catch {
    return null
  }
}

export function clearHash() {
  history.replaceState(null, '', location.pathname + location.search)
}

// ---------- localStorage ----------

export function listSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export function persistSaved(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function addSaved(name, route, store) {
  const list = listSaved()
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    savedAt: Date.now(),
    data: serializeRoute(route, store),
  }
  list.unshift(entry)
  persistSaved(list)
  return entry
}

export function removeSaved(id) {
  persistSaved(listSaved().filter((e) => e.id !== id))
}

// ---------- base64url ----------

function b64urlEncode(str) {
  // unescape/escape pair handles UTF-8 safely without TextEncoder.
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function b64urlDecode(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return decodeURIComponent(escape(atob(s)))
}
