<script setup>
import { useRouteStore } from '../stores/route'
import { formatDistance, formatDuration } from '../lib/units'

defineProps({
  label: { type: String, required: true },
  distance: { type: Number, required: true },
  duration: { type: Number, required: true },
  unit: { type: String, default: 'mi' },
  selected: { type: Boolean, default: false },
  clickable: { type: Boolean, default: true },
})
defineEmits(['click'])

// eslint-disable-next-line no-unused-vars
const store = useRouteStore()
</script>

<template>
  <li
    class="route-card group bg-card border border-border rounded-xl transition-all duration-150 ease-out overflow-hidden hover:border-primary/30 hover:shadow-[var(--shadow-card)]"
    :class="{ '!border-primary bg-primary/5 shadow-[var(--shadow-card)]': selected }"
    @click="clickable && $emit('click')"
  >
    <div
      class="flex gap-2.5 px-4 py-3.5"
      :class="{ 'cursor-pointer': clickable }"
    >
      <div class="flex-1 min-w-0">
        <slot name="title">
          <div class="font-serif text-xl leading-tight mb-1 text-foreground break-words">
            {{ label }}
          </div>
        </slot>
        <div
          class="font-mono text-[13px] flex gap-2 tabular-nums"
          :class="selected ? 'text-primary' : 'text-muted-foreground'"
        >
          <span>{{ formatDistance(distance, unit) }}</span>
          <span class="opacity-40">·</span>
          <span>{{ formatDuration(duration) }}</span>
        </div>
        <slot name="meta" />
      </div>
      <div
        v-if="$slots.actions"
        class="flex gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        :class="{ '!opacity-100': selected }"
        @click.stop
      >
        <slot name="actions" />
      </div>
    </div>
  </li>
</template>
