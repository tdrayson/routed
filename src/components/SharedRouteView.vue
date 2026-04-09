<script setup>
import { computed } from 'vue'
import { useRouteStore } from '../stores/route'
import RouteSummary from './RouteSummary.vue'

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
  <div v-if="route" class="min-w-0">
    <div class="font-sans text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground mb-1.5">
      {{ activityLabel }}
    </div>
    <RouteSummary :route="route" :title="store.sharedTitle" size="lg" />
  </div>
</template>
