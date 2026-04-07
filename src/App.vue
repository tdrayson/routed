<script setup>
import { onMounted } from 'vue'
import MapView from './components/MapView.vue'
import ControlsPanel from './components/ControlsPanel.vue'
import RouteSelectionPanel from './components/RouteSelectionPanel.vue'
import { useRouteStore } from './stores/route'

const store = useRouteStore()
onMounted(() => store.hydrateFromHash())
</script>

<template>
  <div class="app">
    <MapView />
    <ControlsPanel />
    <RouteSelectionPanel />
  </div>
</template>

<style scoped>
.app { position: relative; width: 100%; height: 100%; }
</style>
