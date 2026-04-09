<script setup>
import { ref, computed, watch } from 'vue'
import { useRouteStore } from '../stores/route'
import LocationInput from './LocationInput.vue'
import { reverseGeocode } from '../lib/mapbox'

const emit = defineEmits(['show-routes'])
const store = useRouteStore()
const hasRoutes = computed(() => store.candidates.length > 0 || store.savedRoutes.length > 0)

// Local display unit for time targets. Underlying store.targetValue stays in minutes.
const timeUnit = ref('min') // 'min' | 'hr'

const targetDisplay = ref(formatTarget(store.targetValue))
function formatTarget(v) {
  const n = Math.max(0, Number(v) || 0)
  if (store.targetType === 'time') {
    return timeUnit.value === 'hr' ? (n / 60).toFixed(2) : String(Math.round(n))
  }
  return n.toFixed(2)
}
function parseTarget(raw) {
  const n = parseFloat(raw)
  if (!Number.isFinite(n) || n < 0) return 0
  if (store.targetType === 'time' && timeUnit.value === 'hr') return n * 60
  return n
}
function onTargetInput(e) {
  targetDisplay.value = e.target.value
  store.targetValue = parseTarget(e.target.value)
}
function onTargetBlur() {
  targetDisplay.value = formatTarget(store.targetValue)
}
function stepTarget(dir) {
  // Step by 1 in the currently displayed unit.
  const stepMinutes = store.targetType === 'time' && timeUnit.value === 'hr' ? 60 : 1
  const next = Math.max(0, (Number(store.targetValue) || 0) + dir * stepMinutes)
  store.targetValue = store.targetType === 'time' ? Math.round(next) : Math.round(next * 100) / 100
  targetDisplay.value = formatTarget(store.targetValue)
}
function onTargetKey(e) {
  if (e.key === 'ArrowUp') { e.preventDefault(); stepTarget(1) }
  else if (e.key === 'ArrowDown') { e.preventDefault(); stepTarget(-1) }
}
// Input mask: digits (+ decimal for distance or time-in-hours).
function onTargetBeforeInput(e) {
  if (!e.data) return
  const allowDecimal = store.targetType === 'distance' || (store.targetType === 'time' && timeUnit.value === 'hr')
  const allowed = allowDecimal ? /^[0-9.]+$/ : /^[0-9]+$/
  if (!allowed.test(e.data)) { e.preventDefault(); return }
  if (allowDecimal && e.data.includes('.') && String(e.target.value).includes('.')) {
    e.preventDefault()
  }
}
watch(
  () => store.targetType,
  () => (targetDisplay.value = formatTarget(store.targetValue)),
)
watch(timeUnit, () => (targetDisplay.value = formatTarget(store.targetValue)))

async function useCurrentLocation() {
  if (!navigator.geolocation) {
    store.error = 'Geolocation not available'
    return
  }
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const coords = [pos.coords.longitude, pos.coords.latitude]
      const label = await reverseGeocode(coords).catch(() => '')
      store.setStart(coords, label)
    },
    () => (store.error = 'Could not get current location'),
  )
}

const labelCls =
  'font-sans text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground'
const iconBtnCls =
  'shrink-0 w-10 h-10 grid place-items-center bg-muted border border-border rounded-lg text-muted-foreground transition-all duration-150 ease-out hover:bg-primary/10 hover:border-primary/30 hover:text-primary'
const segCls =
  'flex bg-muted border border-border rounded-lg p-[3px] gap-[2px]'
const segBtnCls =
  'flex-1 px-3 py-2 rounded-md text-[13px] font-medium text-muted-foreground transition-all duration-150 ease-out whitespace-nowrap hover:text-foreground'
const segBtnOnCls =
  'flex-1 px-3 py-2 rounded-md text-[13px] font-semibold text-primary bg-card shadow-[var(--shadow-card)] whitespace-nowrap'
</script>

<template>
  <div class="w-full h-full overflow-y-auto overflow-x-hidden text-foreground relative max-md:h-auto max-md:overflow-visible">
    <header class="flex justify-between items-start mb-8 max-md:hidden">
      <div>
        <h1 class="font-serif text-[44px] leading-[1] text-foreground">Routed</h1>
        <p class="font-sans text-xs text-muted-foreground tracking-[0.04em] mt-1.5">Fresh routes around your neighbourhood, so you never run the same loop twice.</p>
      </div>
      <button
        v-if="hasRoutes"
        class="flex items-center gap-1 h-7 rounded-md text-muted-foreground text-xs font-medium uppercase tracking-[0.08em] hover:text-foreground transition-colors"
        @click="emit('show-routes')"
      >
        Routes
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </header>

    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-2.5">
        <label :class="labelCls">Start</label>
        <div class="flex gap-2 items-center">
          <LocationInput
            v-model="store.startLabel"
            placeholder="Start location"
            @select="(p) => store.setStart(p.coords, p.label)"
          />
          <button
            :class="[iconBtnCls, store.pickMode === 'start' && 'bg-primary/10 border-primary/40 text-primary']"
            @click="store.togglePickMode('start')"
            title="Pick on map"
          >
            <img src="/assets/marker.svg" alt="Pick" class="w-4 h-4 opacity-70" />
          </button>
          <button :class="iconBtnCls" @click="useCurrentLocation" title="Use current location">
            <img src="/assets/gps.svg" alt="Current" class="w-4 h-4 opacity-70" />
          </button>
        </div>
      </div>

      <div v-if="store.tripType === 'oneway'" class="flex flex-col gap-2.5">
        <label :class="labelCls">End</label>
        <div class="flex gap-2 items-center">
          <LocationInput
            v-model="store.endLabel"
            placeholder="End location"
            @select="(p) => store.setEnd(p.coords, p.label)"
          />
          <button
            :class="[iconBtnCls, store.pickMode === 'end' && 'bg-primary/10 border-primary/40 text-primary']"
            @click="store.togglePickMode('end')"
            title="Pick on map"
          >
            <img src="/assets/marker.svg" alt="Pick" class="w-4 h-4 opacity-70" />
          </button>
          <button :class="iconBtnCls" @click="store.swapLocations" title="Swap">
            <img src="/assets/switch.svg" alt="Swap" class="w-4 h-4 opacity-70" />
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-2.5">
        <label :class="labelCls">Activity</label>
        <div :class="segCls">
          <button :class="store.activity === 'walking' ? segBtnOnCls : segBtnCls" @click="store.activity = 'walking'">Walk</button>
          <button :class="store.activity === 'running' ? segBtnOnCls : segBtnCls" @click="store.activity = 'running'">Run</button>
          <button :class="store.activity === 'cycling' ? segBtnOnCls : segBtnCls" @click="store.activity = 'cycling'">Cycle</button>
        </div>
      </div>

      <div class="flex flex-col gap-2.5">
        <label :class="labelCls">Trip type</label>
        <div :class="segCls">
          <button :class="store.tripType === 'loop' ? segBtnOnCls : segBtnCls" @click="store.tripType = 'loop'">Loop</button>
          <button :class="store.tripType === 'outback' ? segBtnOnCls : segBtnCls" @click="store.tripType = 'outback'">Out &amp; back</button>
          <button :class="store.tripType === 'oneway' ? segBtnOnCls : segBtnCls" @click="store.tripType = 'oneway'">One-way</button>
        </div>
      </div>

      <div class="flex flex-col gap-2.5">
        <label :class="labelCls">Target</label>
        <div :class="segCls">
          <button :class="store.targetType === 'distance' ? segBtnOnCls : segBtnCls" @click="store.targetType = 'distance'">Distance</button>
          <button :class="store.targetType === 'time' ? segBtnOnCls : segBtnCls" @click="store.targetType = 'time'">Time</button>
        </div>
      </div>

      <div class="flex gap-2 items-center">
        <div class="flex-1 min-w-0 h-10 flex items-stretch bg-muted border border-border rounded-lg overflow-hidden focus-within:bg-card focus-within:border-primary transition-colors">
          <button
            type="button"
            class="w-9 grid place-items-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            @click="stepTarget(-1)"
            aria-label="Decrease"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <input
            type="text"
            inputmode="decimal"
            :value="targetDisplay"
            @input="onTargetInput"
            @beforeinput="onTargetBeforeInput"
            @blur="onTargetBlur"
            @keydown="onTargetKey"
            class="flex-1 min-w-0 bg-transparent text-center text-foreground outline-none font-serif text-2xl font-normal tabular-nums"
          />
          <button
            type="button"
            class="w-9 grid place-items-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            @click="stepTarget(1)"
            aria-label="Increase"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
        <div v-if="store.targetType === 'distance'" class="shrink-0 flex gap-1">
          <button
            :class="[
              'w-10 h-10 grid place-items-center rounded-lg border text-[13px] font-medium transition-all duration-150 ease-out',
              store.unit === 'mi'
                ? 'bg-primary/10 border-primary/40 text-primary font-semibold'
                : 'bg-muted border-border text-muted-foreground hover:text-foreground'
            ]"
            @click="store.unit = 'mi'"
          >mi</button>
          <button
            :class="[
              'w-10 h-10 grid place-items-center rounded-lg border text-[13px] font-medium transition-all duration-150 ease-out',
              store.unit === 'km'
                ? 'bg-primary/10 border-primary/40 text-primary font-semibold'
                : 'bg-muted border-border text-muted-foreground hover:text-foreground'
            ]"
            @click="store.unit = 'km'"
          >km</button>
        </div>
        <div v-else class="shrink-0 relative">
          <select
            v-model="timeUnit"
            class="h-10 w-[88px] pl-3.5 pr-8 bg-muted border border-border rounded-lg text-muted-foreground text-[13px] font-medium uppercase tracking-[0.08em] outline-none appearance-none cursor-pointer hover:text-foreground focus:border-primary"
          >
            <option value="min">mins</option>
            <option value="hr">hrs</option>
          </select>
          <svg
            class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
          ><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      <button
        class="px-4 py-3.5 bg-primary text-card rounded-lg font-semibold text-sm mt-2 transition-colors duration-150 ease-out hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="store.loading"
        @click="store.generate"
      >
        {{ store.loading ? 'Generating…' : 'Generate route' }}
      </button>

      <div
        v-if="store.error"
        class="px-3.5 py-3 bg-destructive/10 border border-destructive/25 rounded-lg text-destructive text-[13px]"
      >
        {{ store.error }}
      </div>
    </div>

    <div
      v-if="store.shareToast"
      class="absolute -bottom-12 left-0 right-0 mx-auto w-fit px-4 py-2.5 bg-foreground text-background text-[13px] rounded-lg shadow-[var(--shadow-elevated)] whitespace-nowrap"
    >
      {{ store.shareToast }}
    </div>
  </div>
</template>
