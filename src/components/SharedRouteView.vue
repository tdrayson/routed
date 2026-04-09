<script setup>
import { computed } from 'vue'
import { useRouteStore } from '../stores/route'
import { formatDistance, formatDuration } from '../lib/units'

const store = useRouteStore()
const route = computed(() => store.selected)

const activityLabel = computed(() => {
  switch (store.activity) {
    case 'running': return 'Running'
    case 'cycling': return 'Cycling'
    default: return 'Walking'
  }
})
</script>

<template>
  <div v-if="route" class="absolute top-6 left-6 z-10 max-w-[420px] bg-card/95 backdrop-blur border border-border rounded-xl shadow-[var(--shadow-card)] px-5 py-4">
    <div class="font-sans text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground mb-1.5">
      {{ activityLabel }}
    </div>
    <h1 class="font-serif text-[28px] leading-[1.1] text-foreground mb-3">
      {{ store.sharedTitle || route.label }}
    </h1>
    <div class="font-mono text-sm text-muted-foreground flex gap-2 tabular-nums">
      <span>{{ formatDistance(route.distance, store.unit) }}</span>
      <span class="opacity-40">·</span>
      <span>{{ formatDuration(route.duration) }}</span>
    </div>
  </div>
</template>
