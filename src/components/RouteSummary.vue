<script setup>
import { useRouteStore } from '../stores/route'
import { formatDistance, formatDuration } from '../lib/units'

defineProps({
  route: { type: Object, required: true },
  title: { type: String, default: '' },
  size: { type: String, default: 'md' }, // 'sm' | 'md' | 'lg'
})

const store = useRouteStore()
</script>

<template>
  <div class="min-w-0">
    <div
      :class="[
        'font-serif leading-tight text-foreground break-words',
        size === 'lg' ? 'text-[36px] mb-3' : 'text-xl mb-1',
      ]"
    >
      {{ title || route.label }}
    </div>
    <div
      :class="[
        'font-mono text-muted-foreground flex gap-2 tabular-nums',
        size === 'lg' ? 'text-sm' : 'text-[12px]',
      ]"
    >
      <span>{{ formatDistance(route.distance, store.unit) }}</span>
      <span class="opacity-40">·</span>
      <span>{{ formatDuration(route.duration) }}</span>
    </div>
  </div>
</template>
