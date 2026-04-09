<script setup>
import { ref, watch } from 'vue'
import { geocode } from '../lib/mapbox'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Search location' },
})
const emit = defineEmits(['update:modelValue', 'select'])

const query = ref(props.modelValue)
const results = ref([])
const open = ref(false)
const highlight = ref(-1)
let debounceId = null

watch(
  () => props.modelValue,
  (v) => {
    if (v !== query.value) query.value = v
  },
)

function onInput(e) {
  query.value = e.target.value
  emit('update:modelValue', query.value)
  highlight.value = -1
  clearTimeout(debounceId)
  if (query.value.length < 3) {
    results.value = []
    open.value = false
    return
  }
  debounceId = setTimeout(async () => {
    try {
      results.value = await geocode(query.value)
      open.value = results.value.length > 0
    } catch {
      results.value = []
      open.value = false
    }
  }, 250)
}

function pick(r) {
  query.value = r.place_name
  emit('update:modelValue', r.place_name)
  emit('select', { coords: r.geometry.coordinates, label: r.place_name })
  open.value = false
  results.value = []
}

function onKey(e) {
  if (!open.value || !results.value.length) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlight.value = Math.min(highlight.value + 1, results.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlight.value = Math.max(highlight.value - 1, -1)
  } else if (e.key === 'Enter' && highlight.value >= 0) {
    e.preventDefault()
    pick(results.value[highlight.value])
  } else if (e.key === 'Escape') {
    open.value = false
  }
}
</script>

<template>
  <div class="relative w-full">
    <input
      type="text"
      :value="query"
      :placeholder="placeholder"
      class="w-full h-10 px-3 bg-muted border border-border rounded-lg text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground focus:bg-card focus:border-primary"
      @input="onInput"
      @keydown="onKey"
      @focus="open = results.length > 0"
      @blur="setTimeout(() => (open = false), 150)"
    />
    <ul
      v-if="open"
      class="absolute top-[calc(100%+4px)] left-0 right-0 bg-card border border-border rounded-lg max-h-60 overflow-y-auto z-10 shadow-[var(--shadow-elevated)]"
    >
      <li
        v-for="(r, i) in results"
        :key="r.id || i"
        :class="[
          'px-3 py-2.5 cursor-pointer text-[13px] text-foreground border-b border-border last:border-b-0 hover:bg-primary/10 hover:text-primary',
          i === highlight && 'bg-primary/10 text-primary'
        ]"
        @mousedown.prevent="pick(r)"
      >
        {{ r.place_name }}
      </li>
    </ul>
  </div>
</template>
