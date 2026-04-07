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
  <div class="loc-input">
    <input
      type="text"
      :value="query"
      :placeholder="placeholder"
      @input="onInput"
      @keydown="onKey"
      @focus="open = results.length > 0"
      @blur="setTimeout(() => (open = false), 150)"
    />
    <ul v-if="open" class="results">
      <li
        v-for="(r, i) in results"
        :key="r.id || i"
        :class="{ active: i === highlight }"
        @mousedown.prevent="pick(r)"
      >
        {{ r.place_name }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.loc-input { position: relative; width: 100%; }
input {
  width: 100%;
  padding: 10px 12px;
  background: var(--input-bg);
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--text);
  outline: none;
  transition: background 0.15s, border-color 0.15s;
}
input:focus { background: var(--input-bg-focus); border-color: var(--primary); }
.results {
  position: absolute;
  top: calc(100% + 4px);
  left: 0; right: 0;
  background: var(--panel);
  backdrop-filter: blur(16px);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  max-height: 240px;
  overflow-y: auto;
  z-index: 10;
  box-shadow: var(--shadow);
}
.results li {
  padding: 9px 12px;
  cursor: pointer;
  font-size: 13px;
  border-bottom: 1px solid var(--panel-border);
}
.results li:last-child { border-bottom: 0; }
.results li:hover, .results li.active {
  background: rgba(225, 29, 72, 0.1);
  color: var(--primary-dim);
}
</style>
