// Mapbox map lifecycle, sources, layers, and marker management.

import mapboxgl from 'mapbox-gl'
import { ref, shallowRef } from 'vue'
import { MAPBOX_TOKEN } from '../lib/mapbox'

mapboxgl.accessToken = MAPBOX_TOKEN

const SELECTED_COLOR = '#e11d48'
const UNSELECTED_COLOR = '#6d6d6d'
const BORDER_COLOR = '#ffffff'

const map = shallowRef(null)
const isReady = ref(false)
let startMarker = null
let endMarker = null

export function useMap() {
  function init(container) {
    map.value = new mapboxgl.Map({
      container,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: [-0.1276, 51.5074],
      zoom: 12,
    })

    map.value.on('load', () => {
      const m = map.value

      m.addSource('routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      m.addSource('debug-waypoints', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      // Unselected border + line
      m.addLayer({
        id: 'routes-border-unselected',
        type: 'line',
        source: 'routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': BORDER_COLOR, 'line-width': 9, 'line-opacity': 0.5 },
        filter: ['!=', ['get', 'selected'], true],
      })
      m.addLayer({
        id: 'routes-line-unselected',
        type: 'line',
        source: 'routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': UNSELECTED_COLOR, 'line-width': 5, 'line-opacity': 0.55 },
        filter: ['!=', ['get', 'selected'], true],
      })

      // Selected border + line (rendered on top)
      m.addLayer({
        id: 'routes-border-selected',
        type: 'line',
        source: 'routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': BORDER_COLOR, 'line-width': 11 },
        filter: ['==', ['get', 'selected'], true],
      })
      m.addLayer({
        id: 'routes-line-selected',
        type: 'line',
        source: 'routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': SELECTED_COLOR, 'line-width': 6 },
        filter: ['==', ['get', 'selected'], true],
      })

      // Debug waypoints (dev-only, toggled via setWaypoints()).
      m.addLayer({
        id: 'debug-waypoints-circle',
        type: 'circle',
        source: 'debug-waypoints',
        paint: {
          'circle-radius': 10,
          'circle-color': '#facc15',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#1a1c1a',
        },
      })
      m.addLayer({
        id: 'debug-waypoints-label',
        type: 'symbol',
        source: 'debug-waypoints',
        layout: {
          'text-field': ['get', 'index'],
          'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: { 'text-color': '#1a1c1a' },
      })

      // Click an unselected route to promote it.
      m.on('click', 'routes-line-unselected', (e) => {
        const id = e.features?.[0]?.id
        if (id != null) m.fire('routed:select', { id })
      })
      m.on('mouseenter', 'routes-line-unselected', () => (m.getCanvas().style.cursor = 'pointer'))
      m.on('mouseleave', 'routes-line-unselected', () => (m.getCanvas().style.cursor = ''))

      isReady.value = true
    })
  }

  function setRoutes(routes, selectedIndex) {
    if (!isReady.value) return
    const features = routes.map((r, i) => ({
      type: 'Feature',
      id: i,
      properties: { selected: i === selectedIndex },
      geometry: r.geometry,
    }))
    map.value.getSource('routes').setData({ type: 'FeatureCollection', features })
  }

  function clearRoutes() {
    if (!isReady.value) return
    map.value.getSource('routes').setData({ type: 'FeatureCollection', features: [] })
    setWaypoints([])
  }

  function setWaypoints(coords) {
    if (!isReady.value) return
    const features = (coords || []).map((c, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: c },
      properties: { index: String(i + 1) },
    }))
    map.value.getSource('debug-waypoints').setData({
      type: 'FeatureCollection',
      features,
    })
  }

  function setStartMarker(coords) {
    if (!coords) {
      startMarker?.remove()
      startMarker = null
      return
    }
    if (startMarker) startMarker.setLngLat(coords)
    else startMarker = new mapboxgl.Marker({ color: '#e11d48' }).setLngLat(coords).addTo(map.value)
  }

  function setEndMarker(coords) {
    if (!coords) {
      endMarker?.remove()
      endMarker = null
      return
    }
    if (endMarker) endMarker.setLngLat(coords)
    else endMarker = new mapboxgl.Marker({ color: '#c62828' }).setLngLat(coords).addTo(map.value)
  }

  function flyTo(coords, zoom = 14) {
    if (!isReady.value) return
    // On desktop the sidebar covers the left ~380px of the viewport, so we
    // offset the center to keep the point visually centred over the map.
    // On mobile the map is full-width, so no offset is needed.
    const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
    map.value.flyTo({ center: coords, zoom, offset: isDesktop ? [-180, 0] : [0, 0] })
  }

  function fitToRoute(geometry, padding = { top: 60, bottom: 60, left: 380, right: 60 }) {
    if (!isReady.value || !geometry?.coordinates?.length) return
    const bounds = new mapboxgl.LngLatBounds()
    geometry.coordinates.forEach((c) => bounds.extend(c))
    map.value.fitBounds(bounds, { padding, duration: 800 })
  }

  function onSelect(handler) {
    if (!map.value) return
    map.value.on('routed:select', (e) => handler(e.id))
  }

  function onClick(handler) {
    if (!map.value) return
    map.value.on('click', (e) => handler([e.lngLat.lng, e.lngLat.lat]))
  }

  return {
    map,
    isReady,
    init,
    setRoutes,
    clearRoutes,
    setWaypoints,
    setStartMarker,
    setEndMarker,
    flyTo,
    fitToRoute,
    onSelect,
    onClick,
  }
}
