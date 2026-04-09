<script setup>
import { computed, useId } from 'vue'
import { useRouteStore } from '../stores/route'
import { reverseGeocode } from '../lib/mapbox'
import LocationInput from './LocationInput.vue'
import PanelHeader from './PanelHeader.vue'
import SegmentedControl from './SegmentedControl.vue'
import TargetInput from './TargetInput.vue'
import Icon from './Icon.vue'

const emit = defineEmits(['show-routes'])
const store = useRouteStore()
const hasRoutes = computed(() => store.candidates.length > 0 || store.savedRoutes.length > 0)

const startLabelId = useId()
const endLabelId = useId()
const activityLabelId = useId()
const tripTypeLabelId = useId()
const targetLabelId = useId()

async function onGenerate() {
  window.scrollTo?.({ top: 0, behavior: 'smooth' })
  await store.generate()
}

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

const ACTIVITY_OPTIONS = [
  { value: 'running', label: 'Run' },
  { value: 'walking', label: 'Walk' },
  { value: 'cycling', label: 'Cycle' },
]
const TRIP_TYPE_OPTIONS = [
  { value: 'loop', label: 'Loop' },
  { value: 'outback', label: 'Out &amp; back' },
  { value: 'oneway', label: 'One-way' },
]
const TARGET_TYPE_OPTIONS = [
  { value: 'distance', label: 'Distance' },
  { value: 'time', label: 'Time' },
]

const labelCls = 'font-sans text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground'
const iconBtnCls =
  'shrink-0 w-10 h-10 grid place-items-center bg-muted border border-border rounded-lg text-muted-foreground transition-all duration-150 ease-out hover:bg-primary/10 hover:border-primary/30 hover:text-primary'
</script>

<template>
  <div class="w-full h-full overflow-y-auto overflow-x-hidden text-foreground relative max-md:h-auto max-md:overflow-visible">
    <header class="mb-8 max-md:hidden">
      <PanelHeader
        title="Routed"
        tagline="Fresh routes around your neighbourhood, so you never run the same loop twice."
      >
        <template #action>
          <button
            v-if="hasRoutes"
            type="button"
            class="flex items-center gap-1 h-7 rounded-md text-muted-foreground text-xs font-medium uppercase tracking-[0.08em] hover:text-foreground transition-colors"
            @click="emit('show-routes')"
          >
            Routes
            <Icon name="chevron-right" :size="12" :stroke-width="2.5" />
          </button>
        </template>
      </PanelHeader>
    </header>

    <form class="flex flex-col gap-6" @submit.prevent="onGenerate">
      <div class="flex flex-col gap-2.5">
        <span :id="startLabelId" :class="labelCls">Start</span>
        <div class="flex gap-2 items-center">
          <LocationInput
            v-model="store.startLabel"
            placeholder="Start location"
            label="Start location"
            @select="(p) => store.setStart(p.coords, p.label)"
          />
          <button
            type="button"
            :class="[iconBtnCls, store.pickMode === 'start' && 'bg-primary/10 border-primary/40 text-primary']"
            :aria-pressed="store.pickMode === 'start'"
            aria-label="Pick start on map"
            @click="store.togglePickMode('start')"
          >
            <img src="/assets/marker.svg" alt="" aria-hidden="true" class="w-4 h-4 opacity-70" />
          </button>
          <button
            type="button"
            :class="iconBtnCls"
            aria-label="Use current location"
            @click="useCurrentLocation"
          >
            <img src="/assets/gps.svg" alt="" aria-hidden="true" class="w-4 h-4 opacity-70" />
          </button>
        </div>
      </div>

      <div v-if="store.tripType === 'oneway'" class="flex flex-col gap-2.5">
        <span :id="endLabelId" :class="labelCls">End</span>
        <div class="flex gap-2 items-center">
          <LocationInput
            v-model="store.endLabel"
            placeholder="End location"
            label="End location"
            @select="(p) => store.setEnd(p.coords, p.label)"
          />
          <button
            type="button"
            :class="[iconBtnCls, store.pickMode === 'end' && 'bg-primary/10 border-primary/40 text-primary']"
            :aria-pressed="store.pickMode === 'end'"
            aria-label="Pick end on map"
            @click="store.togglePickMode('end')"
          >
            <img src="/assets/marker.svg" alt="" aria-hidden="true" class="w-4 h-4 opacity-70" />
          </button>
          <button
            type="button"
            :class="iconBtnCls"
            aria-label="Swap start and end"
            @click="store.swapLocations"
          >
            <img src="/assets/switch.svg" alt="" aria-hidden="true" class="w-4 h-4 opacity-70" />
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-2.5">
        <span :id="activityLabelId" :class="labelCls">Activity</span>
        <SegmentedControl
          v-model="store.activity"
          :options="ACTIVITY_OPTIONS"
          label="Activity"
        />
      </div>

      <div class="flex flex-col gap-2.5">
        <span :id="tripTypeLabelId" :class="labelCls">Trip type</span>
        <SegmentedControl
          v-model="store.tripType"
          :options="TRIP_TYPE_OPTIONS"
          label="Trip type"
        />
      </div>

      <div class="flex flex-col gap-2.5">
        <span :id="targetLabelId" :class="labelCls">Target</span>
        <SegmentedControl
          v-model="store.targetType"
          :options="TARGET_TYPE_OPTIONS"
          label="Target type"
        />
      </div>

      <TargetInput
        :type="store.targetType"
        :value="store.targetValue"
        :unit="store.unit"
        @update:value="(v) => (store.targetValue = v)"
        @update:unit="(u) => (store.unit = u)"
      />

      <button
        type="submit"
        class="px-4 py-3.5 bg-primary text-card rounded-lg font-semibold text-sm mt-2 transition-colors duration-150 ease-out hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="store.loading"
        :aria-busy="store.loading"
      >
        {{ store.loading ? 'Generating…' : 'Generate route' }}
      </button>

      <div
        v-if="store.error"
        role="alert"
        class="px-3.5 py-3 bg-destructive/10 border border-destructive/25 rounded-lg text-destructive text-[13px]"
      >
        {{ store.error }}
      </div>
    </form>

    <div
      v-if="store.shareToast"
      class="absolute -bottom-12 left-0 right-0 mx-auto w-fit px-4 py-2.5 bg-foreground text-background text-[13px] rounded-lg shadow-[var(--shadow-elevated)] whitespace-nowrap"
    >
      {{ store.shareToast }}
    </div>
  </div>
</template>
