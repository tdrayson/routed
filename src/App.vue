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
    <aside class="sidebar">
      <ControlsPanel />
      <RouteSelectionPanel />
    </aside>
    <div class="map-wrap">
      <MapView />
    </div>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.sidebar {
  flex: 0 0 360px;
  width: 360px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  overflow-y: auto;
  z-index: 5;
}
.map-wrap {
  flex: 1 1 auto;
  position: relative;
  min-width: 0;
  height: 100%;
}
@media (max-width: 768px) {
  .app { flex-direction: column; }
  .sidebar { flex: 0 0 auto; width: 100%; height: auto; max-height: 50%; border-right: none; border-bottom: 1px solid rgba(0, 0, 0, 0.08); }
  .map-wrap { flex: 1 1 auto; }
}
</style>
