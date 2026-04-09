<script setup>
import { computed, ref, watch } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({
  type: { type: String, required: true }, // 'distance' | 'time'
  value: { type: Number, required: true }, // distance in selected unit, or minutes
  unit: { type: String, required: true }, // 'mi' | 'km'
})
const emit = defineEmits(['update:value', 'update:unit'])

const timeUnit = ref('min') // 'min' | 'hr' — local display only
const display = ref(formatTarget(props.value))

function formatTarget(v) {
  const n = Math.max(0, Number(v) || 0)
  if (props.type === 'time') {
    return timeUnit.value === 'hr' ? (n / 60).toFixed(2) : String(Math.round(n))
  }
  return n.toFixed(2)
}

function parseTarget(raw) {
  const n = parseFloat(raw)
  if (!Number.isFinite(n) || n < 0) return 0
  if (props.type === 'time' && timeUnit.value === 'hr') return n * 60
  return n
}

function onInput(e) {
  display.value = e.target.value
  emit('update:value', parseTarget(e.target.value))
}
function onBlur() {
  display.value = formatTarget(props.value)
}
function step(dir) {
  const stepMinutes = props.type === 'time' && timeUnit.value === 'hr' ? 60 : 1
  const next = Math.max(0, (Number(props.value) || 0) + dir * stepMinutes)
  const rounded = props.type === 'time' ? Math.round(next) : Math.round(next * 100) / 100
  emit('update:value', rounded)
  display.value = formatTarget(rounded)
}
function onKey(e) {
  if (e.key === 'ArrowUp') { e.preventDefault(); step(1) }
  else if (e.key === 'ArrowDown') { e.preventDefault(); step(-1) }
}
// Input mask: digits (+ decimal for distance or time-in-hours).
function onBeforeInput(e) {
  if (!e.data) return
  const allowDecimal = props.type === 'distance' || (props.type === 'time' && timeUnit.value === 'hr')
  const allowed = allowDecimal ? /^[0-9.]+$/ : /^[0-9]+$/
  if (!allowed.test(e.data)) { e.preventDefault(); return }
  if (allowDecimal && e.data.includes('.') && String(e.target.value).includes('.')) {
    e.preventDefault()
  }
}

watch(() => props.type, () => (display.value = formatTarget(props.value)))
watch(() => props.value, (v) => {
  // Sync display if value changes externally and the input isn't mid-edit.
  if (document.activeElement?.tagName !== 'INPUT') display.value = formatTarget(v)
})
watch(timeUnit, () => (display.value = formatTarget(props.value)))

const unitBtnCls = computed(() => (active) => [
  'w-10 h-10 grid place-items-center rounded-lg border text-[13px] font-medium transition-all duration-150 ease-out',
  active
    ? 'bg-primary/10 border-primary/40 text-primary font-semibold'
    : 'bg-muted border-border text-muted-foreground hover:text-foreground',
])
</script>

<template>
  <div class="flex gap-2 items-center">
    <div class="flex-1 min-w-0 h-10 flex items-stretch bg-muted border border-border rounded-lg overflow-hidden focus-within:bg-card focus-within:border-primary transition-colors">
      <button
        type="button"
        class="w-9 grid place-items-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        @click="step(-1)"
        aria-label="Decrease"
      >
        <Icon name="minus" :size="14" :stroke-width="2.5" />
      </button>
      <input
        type="text"
        inputmode="decimal"
        :aria-label="type === 'distance' ? 'Target distance' : 'Target time'"
        :value="display"
        @input="onInput"
        @beforeinput="onBeforeInput"
        @blur="onBlur"
        @keydown="onKey"
        class="flex-1 min-w-0 bg-transparent text-center text-foreground outline-none font-serif text-2xl font-normal tabular-nums"
      />
      <button
        type="button"
        class="w-9 grid place-items-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        @click="step(1)"
        aria-label="Increase"
      >
        <Icon name="plus" :size="14" :stroke-width="2.5" />
      </button>
    </div>

    <div v-if="type === 'distance'" role="radiogroup" aria-label="Distance unit" class="shrink-0 flex gap-1">
      <button
        type="button"
        role="radio"
        :aria-checked="unit === 'mi'"
        :class="unitBtnCls(unit === 'mi')"
        @click="$emit('update:unit', 'mi')"
      >mi</button>
      <button
        type="button"
        role="radio"
        :aria-checked="unit === 'km'"
        :class="unitBtnCls(unit === 'km')"
        @click="$emit('update:unit', 'km')"
      >km</button>
    </div>
    <div v-else class="shrink-0 relative">
      <select
        v-model="timeUnit"
        aria-label="Time unit"
        class="h-10 w-[88px] pl-3.5 pr-8 bg-muted border border-border rounded-lg text-muted-foreground text-[13px] font-medium uppercase tracking-[0.08em] outline-none appearance-none cursor-pointer hover:text-foreground focus:border-primary"
      >
        <option value="min">mins</option>
        <option value="hr">hrs</option>
      </select>
      <Icon
        name="chevron-down"
        :size="12"
        :stroke-width="2.5"
        class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  </div>
</template>
