<script setup>
import { onMounted, ref, watch } from 'vue'
import { useMap } from '../composables/useMap'
import { useRouteStore } from '../stores/route'
import { reverseGeocode } from '../lib/mapbox'

const store = useRouteStore()
const container = ref(null)
const {
  map,
  init,
  isReady,
  setRoutes,
  clearRoutes,
  setWaypoints,
  setStartMarker,
  setEndMarker,
  flyTo,
  fitToRoute,
  onSelect,
  onClick,
} = useMap()

// Debug mode: show generator waypoints on the map in dev builds, or when
// ?debug=1 is present in any build.
const DEBUG =
  import.meta.env.DEV ||
  new URLSearchParams(location.search).has('debug')

onMounted(() => {
  init(container.value)
  const stop = watch(isReady, (ready) => {
    if (!ready) return
    onSelect((id) => store.selectCandidate(id))
    onClick(async (coords) => {
      if (!store.pickMode) return
      const target = store.pickMode
      store.pickMode = null
      const label = await reverseGeocode(coords).catch(() => '')
      if (target === 'start') store.setStart(coords, label)
      else store.setEnd(coords, label)
    })
    if (store.start) {
      setStartMarker(store.start)
      flyTo(store.start)
    }
    if (store.end) setEndMarker(store.end)
    // Draw any route that was already hydrated before the map became ready
    // (e.g. shared-link load).
    renderCurrent()
    stop()
  })
})

// Crosshair cursor while in pick mode.
watch(
  () => store.pickMode,
  (mode) => {
    if (!isReady.value) return
    map.value.getCanvas().style.cursor = mode ? 'crosshair' : ''
  },
)

watch(
  () => store.start,
  (c) => {
    if (!isReady.value) return
    setStartMarker(c)
    if (c) flyTo(c)
  },
)

watch(
  () => store.end,
  (c) => {
    if (!isReady.value) return
    setEndMarker(c)
  },
)

// Sidebar holds the controls now, so the map gets uniform padding.
function fitPadding() {
  return { top: 60, bottom: 60, left: 60, right: 60 }
}

function renderCurrent() {
  if (!isReady.value) return
  // Saved-route preview takes precedence over the generated list.
  if (store.savedPreview) {
    setRoutes([store.savedPreview], 0, store.savedPreview.tripType || store.tripType)
    if (DEBUG) setWaypoints([])
    fitToRoute(store.savedPreview.geometry, fitPadding())
    return
  }
  if (!store.candidates.length || store.selectedIndex < 0) {
    clearRoutes()
    return
  }
  setRoutes(store.candidates, store.selectedIndex, store.tripType)
  if (DEBUG) setWaypoints(store.candidates[store.selectedIndex].waypoints || [])
  fitToRoute(store.candidates[store.selectedIndex].geometry, fitPadding())
}

watch(() => store.candidates, renderCurrent)
watch(() => store.selectedIndex, renderCurrent)
watch(() => store.savedPreview, renderCurrent)

</script>

<template>
  <div
    ref="container"
    class="map"
    role="region"
    aria-label="Map"
  />
</template>

<style scoped>
.map {
  width: 100%;
  height: 100%;
  border-radius: 16px;
  overflow: hidden;
}
</style>
