<script setup>
import { computed } from 'vue'
import { useRouteStore } from '../stores/route'
import { useMap } from '../composables/useMap'
import { formatDistance, formatDuration } from '../lib/units'

const store = useRouteStore()
const { fitToRoute } = useMap()
const route = computed(() => store.selected)

function recenter() {
  if (!route.value?.geometry) return
  fitToRoute(route.value.geometry, { top: 60, bottom: 60, left: 60, right: 60 })
}

const activityLabel = computed(() => {
  switch (store.activity) {
    case 'running': return 'Running'
    case 'cycling': return 'Cycling'
    default: return 'Walking'
  }
})
</script>

<template>
  <div v-if="route" class="min-w-0">
    <div class="font-sans text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground mb-1.5">
      {{ activityLabel }}
    </div>
    <h1 class="font-serif text-[36px] leading-[1] text-foreground mb-3 break-words">
      {{ store.sharedTitle || route.label }}
    </h1>
    <div class="font-mono text-sm text-muted-foreground flex gap-2 tabular-nums">
      <span>{{ formatDistance(route.distance, store.unit) }}</span>
      <span class="opacity-40">·</span>
      <span>{{ formatDuration(route.duration) }}</span>
    </div>
  </div>
</template>
