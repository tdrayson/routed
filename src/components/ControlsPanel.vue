<script setup>
import { ref, watch } from 'vue'
import { useRouteStore } from '../stores/route'
import LocationInput from './LocationInput.vue'
import { reverseGeocode } from '../lib/mapbox'

const store = useRouteStore()

// Distance is always shown with 2 decimals; time stays integer minutes.
const targetDisplay = ref(formatTarget(store.targetValue))
function formatTarget(v) {
  if (store.targetType === 'time') return String(Math.max(0, Math.round(v || 0)))
  return (Math.max(0, Number(v) || 0)).toFixed(2)
}
function onTargetInput(e) {
  targetDisplay.value = e.target.value
  const n = parseFloat(e.target.value)
  store.targetValue = Number.isFinite(n) && n >= 0 ? n : 0
}
function onTargetBlur() {
  targetDisplay.value = formatTarget(store.targetValue)
}
// Reformat when switching between distance/time.
watch(
  () => store.targetType,
  () => (targetDisplay.value = formatTarget(store.targetValue)),
)

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
</script>

<template>
  <div class="panel controls">
    <header>
      <h1>Routed</h1>
    </header>

    <div class="body">
      <div class="field">
        <label>Start</label>
        <div class="row">
          <LocationInput
            v-model="store.startLabel"
            placeholder="Start location"
            @select="(p) => store.setStart(p.coords, p.label)"
          />
          <button
            class="icon"
            :class="{ active: store.pickMode === 'start' }"
            @click="store.togglePickMode('start')"
            title="Pick on map"
          >
            <img src="/assets/marker.svg" alt="Pick on map" />
          </button>
          <button class="icon" @click="useCurrentLocation" title="Use current location">
            <img src="/assets/gps.svg" alt="Current location" />
          </button>
        </div>
      </div>

      <div v-if="store.tripType === 'oneway'" class="field">
        <label>End</label>
        <div class="row">
          <LocationInput
            v-model="store.endLabel"
            placeholder="End location"
            @select="(p) => store.setEnd(p.coords, p.label)"
          />
          <button
            class="icon"
            :class="{ active: store.pickMode === 'end' }"
            @click="store.togglePickMode('end')"
            title="Pick on map"
          >
            <img src="/assets/marker.svg" alt="Pick on map" />
          </button>
          <button class="icon" @click="store.swapLocations" title="Swap">
            <img src="/assets/switch.svg" alt="Swap" />
          </button>
        </div>
      </div>

      <div class="field">
        <label>Activity</label>
        <div class="seg">
          <button :class="{ on: store.activity === 'walking' }" @click="store.activity = 'walking'">Walk</button>
          <button :class="{ on: store.activity === 'running' }" @click="store.activity = 'running'">Run</button>
          <button :class="{ on: store.activity === 'cycling' }" @click="store.activity = 'cycling'">Cycle</button>
        </div>
      </div>

      <div class="field">
        <label>Trip type</label>
        <div class="seg">
          <button :class="{ on: store.tripType === 'loop' }" @click="store.tripType = 'loop'">Loop</button>
          <button :class="{ on: store.tripType === 'outback' }" @click="store.tripType = 'outback'">Out &amp; back</button>
          <button :class="{ on: store.tripType === 'oneway' }" @click="store.tripType = 'oneway'">One-way</button>
        </div>
      </div>

      <div class="field">
        <label>Target</label>
        <div class="seg">
          <button :class="{ on: store.targetType === 'distance' }" @click="store.targetType = 'distance'">Distance</button>
          <button :class="{ on: store.targetType === 'time' }" @click="store.targetType = 'time'">Time</button>
        </div>
      </div>

      <div class="field">
        <div class="target-row">
          <input
            type="text"
            inputmode="decimal"
            :value="targetDisplay"
            @input="onTargetInput"
            @blur="onTargetBlur"
            class="target-input"
          />
          <div v-if="store.targetType === 'distance'" class="seg unit">
            <button :class="{ on: store.unit === 'mi' }" @click="store.unit = 'mi'">mi</button>
            <button :class="{ on: store.unit === 'km' }" @click="store.unit = 'km'">km</button>
          </div>
          <div v-else class="unit-label">min</div>
        </div>
      </div>

      <button class="generate" :disabled="store.loading" @click="store.generate">
        {{ store.loading ? 'Generating…' : 'Generate route' }}
      </button>

      <div v-if="store.error" class="error">{{ store.error }}</div>
    </div>

    <div v-if="store.shareToast" class="toast">{{ store.shareToast }}</div>
  </div>
</template>

<style scoped>
.controls {
  width: 100%;
  padding: 20px;

  /* Light theme overrides — only affect this panel */
  --c-text: #1a1c1a;
  --c-text-dim: #6b7280;
  --c-bg: rgba(255, 255, 255, 0.9);
  --c-input-bg: rgba(0, 0, 0, 0.045);
  --c-input-bg-focus: rgba(0, 0, 0, 0.075);
  --c-border: rgba(0, 0, 0, 0.08);

  background: transparent;
  color: var(--c-text);
}
header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
h1 { font-size: 18px; font-weight: 600; letter-spacing: -0.01em; color: var(--primary-dim); }
.body { display: flex; flex-direction: column; gap: 12px; }
.field { display: flex; flex-direction: column; gap: 6px; }
label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--c-text-dim); }
.row { display: flex; gap: 6px; align-items: stretch; }
.icon {
  flex-shrink: 0;
  width: 38px;
  background: var(--c-input-bg);
  color: var(--c-text-dim);
  border-radius: 8px;
  display: grid; place-items: center;
  font-size: 16px;
}
.icon:hover { background: var(--c-input-bg-focus); color: var(--primary-dim); }
.icon.active { background: rgba(225, 29, 72, 0.1); color: var(--primary-dim); }
.icon img { width: 16px; height: 16px; opacity: 0.7; }
.icon:hover img { opacity: 1; }
.icon.active img { opacity: 1; }

/* Light-mode inputs inside this panel */
.controls :deep(input) {
  background: var(--c-input-bg);
  color: var(--c-text);
}
.controls :deep(input:focus) {
  background: var(--c-input-bg-focus);
  border-color: var(--primary-dim);
}
.controls :deep(.results) {
  background: rgba(255, 255, 255, 0.98);
  border-color: var(--c-border);
}
.controls :deep(.results li) {
  border-color: var(--c-border);
  color: var(--c-text);
}

.seg {
  display: flex;
  background: var(--c-input-bg);
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}
.seg button {
  flex: 1;
  padding: 7px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--c-text-dim);
  transition: all 0.15s;
  white-space: nowrap;
}
.seg button.on { background: rgba(225, 29, 72, 0.1); color: var(--primary-dim); font-weight: 600; }
.seg button:not(.on):hover { color: var(--c-text); }

.target-row { display: flex; gap: 8px; align-items: stretch; }
.target-input {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  background: var(--c-input-bg);
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--c-text);
  outline: none;
  font-size: 16px;
  font-weight: 600;
  -moz-appearance: textfield;
}
.target-input::-webkit-outer-spin-button,
.target-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.target-input:focus { background: var(--c-input-bg-focus); border-color: var(--primary-dim); }

.seg.unit {
  flex-shrink: 0;
  width: auto;
}
.seg.unit button { padding: 7px 14px; flex: 0 0 auto; }
.unit-label {
  flex-shrink: 0;
  display: grid; place-items: center;
  padding: 0 16px;
  background: var(--c-input-bg);
  border-radius: 8px;
  color: var(--c-text-dim);
  font-size: 13px;
}

.generate {
  padding: 12px;
  background: var(--primary-dim);
  color: #fff;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  margin-top: 4px;
  transition: background 0.15s;
}
.generate:hover:not(:disabled) { background: #be123c; }
.generate:disabled { opacity: 0.6; cursor: not-allowed; }
.error {
  padding: 10px;
  background: rgba(198, 40, 40, 0.08);
  border: 1px solid rgba(198, 40, 40, 0.25);
  border-radius: 8px;
  color: #c62828;
  font-size: 13px;
}

.toast {
  position: absolute;
  bottom: -44px;
  left: 0; right: 0;
  margin: 0 auto;
  width: fit-content;
  padding: 8px 14px;
  background: rgba(26, 28, 26, 0.92);
  color: #fff;
  font-size: 13px;
  border-radius: 8px;
  box-shadow: var(--shadow);
  white-space: nowrap;
  animation: toastIn 0.2s ease-out;
}
@keyframes toastIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
