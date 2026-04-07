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

// Compute viewport padding so the route fits clear of the floating panels.
// Slightly heavier on the top-left where the overlay widgets sit.
// Controls: 16 gap + 320 width = 336.  Selection (when shown): + 16 + 240 = 592.
function fitPadding() {
  const left = (store.candidates.length ? 608 : 352) + 24
  return { top: 80, bottom: 48, left, right: 48 }
}

watch(
  () => store.candidates,
  (routes) => {
    if (!isReady.value) return
    if (!routes.length) {
      clearRoutes()
      return
    }
    setRoutes(routes, store.selectedIndex)
    if (DEBUG) setWaypoints(routes[store.selectedIndex].waypoints || [])
    fitToRoute(routes[store.selectedIndex].geometry, fitPadding())
  },
)

watch(
  () => store.selectedIndex,
  (i) => {
    if (!isReady.value || !store.candidates.length) return
    setRoutes(store.candidates, i)
    if (DEBUG) setWaypoints(store.candidates[i].waypoints || [])
    fitToRoute(store.candidates[i].geometry, fitPadding())
  },
)
</script>

<template>
  <div ref="container" class="map" />
</template>

<style scoped>
.map { position: absolute; inset: 0; }
</style>
