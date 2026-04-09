<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import MapView from './components/MapView.vue'
import MapActions from './components/MapActions.vue'
import SharedRouteView from './components/SharedRouteView.vue'
import ControlsPanel from './components/ControlsPanel.vue'
import RouteSelectionPanel from './components/RouteSelectionPanel.vue'
import { useRouteStore } from './stores/route'
import { formatDistance, formatDuration } from './lib/units'

const store = useRouteStore()
const view = ref('controls') // 'controls' | 'routes'
const transitionName = ref('slide-forward')

function goTo(next) {
  const order = { controls: 0, routes: 1 }
  transitionName.value = order[next] > order[view.value] ? 'slide-forward' : 'slide-back'
  view.value = next
}

const activeRoute = computed(
  () => store.savedPreview || store.candidates[store.selectedIndex] || null,
)
const hasRoutes = computed(
  () => store.candidates.length > 0 || store.savedRoutes.length > 0,
)

onMounted(() => store.hydrateFromHash())

// Auto-advance to the routes step when a generation finishes.
watch(
  () => store.candidates.length,
  (n, prev) => {
    if (n > 0 && (prev || 0) === 0) goTo('routes')
  },
)
// If all routes are cleared, drop back to controls.
watch(
  () => store.candidates.length + store.savedRoutes.length,
  (n) => {
    if (n === 0) goTo('controls')
  },
)
</script>

<template>
  <div v-if="store.sharedView" class="relative w-full h-full overflow-hidden bg-card">
    <MapView />
    <SharedRouteView />
  </div>
  <div v-else class="flex w-full h-full overflow-hidden bg-background p-6 gap-6 max-md:flex-col max-md:h-auto max-md:min-h-full max-md:overflow-visible max-md:p-4 max-md:gap-4">
    <header class="hidden max-md:flex justify-between items-start gap-4 max-md:order-1">
      <div v-if="view === 'controls'" class="min-w-0">
        <h1 class="font-serif text-[36px] leading-[1] text-foreground">Routed</h1>
        <p class="font-sans text-xs text-muted-foreground tracking-[0.04em] mt-1.5">Fresh routes around your neighbourhood, so you never run the same loop twice.</p>
      </div>
      <div v-else class="flex items-start gap-3 min-w-0">
        <button
          class="shrink-0 mt-1 w-9 h-9 grid place-items-center rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/10 transition-colors"
          @click="goTo('controls')"
          aria-label="Back"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="min-w-0">
          <h1 class="font-serif text-[36px] leading-[1] text-foreground truncate">Routes</h1>
          <p class="font-sans text-xs text-muted-foreground tracking-[0.04em] mt-1.5">Tap a route to preview it on the map, then save, share, or export the one you like.</p>
        </div>
      </div>
      <button
        v-if="hasRoutes && view === 'controls'"
        class="shrink-0 flex items-center gap-1 h-7 rounded-md text-muted-foreground text-xs font-medium uppercase tracking-[0.08em] hover:text-foreground transition-colors"
        @click="goTo('routes')"
      >
        Routes
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </header>
    <aside
      class="flex-none w-[380px] h-full flex flex-col overflow-hidden max-md:w-full max-md:h-auto max-md:order-3 max-md:overflow-visible"
    >
      <Transition :name="transitionName" mode="out-in">
        <ControlsPanel
          v-if="view === 'controls'"
          key="controls"
          @show-routes="goTo('routes')"
        />
        <RouteSelectionPanel
          v-else
          key="routes"
          @back="goTo('controls')"
        />
      </Transition>
    </aside>
    <div class="flex-1 min-w-0 h-full relative max-md:flex-none max-md:h-auto max-md:order-2 max-md:border max-md:border-border max-md:rounded-2xl max-md:overflow-hidden max-md:bg-card max-md:shadow-[var(--shadow-card)]">
      <div class="h-full overflow-hidden max-md:h-[42vh] max-md:rounded-none">
        <MapView />
      </div>
      <!-- Overlay widgets: absolute over the map on md+, inline strip inside the card on mobile. Hidden entirely when no route is active. -->
      <div
        v-if="activeRoute"
        class="md:absolute md:top-6 md:left-6 md:right-6 md:flex md:justify-between md:items-start md:gap-4 md:pointer-events-none max-md:flex max-md:flex-row max-md:items-start max-md:justify-between max-md:gap-3 max-md:px-4 max-md:py-3 max-md:border-t max-md:border-border"
      >
        <div
          class="md:px-4 md:py-3 md:bg-card/95 md:backdrop-blur md:border md:border-border md:rounded-xl md:shadow-[var(--shadow-card)] md:pointer-events-none md:max-w-[360px] max-md:flex-1 max-md:min-w-0"
        >
          <div class="font-serif text-xl leading-tight text-foreground truncate">
            {{ activeRoute.label }}
          </div>
          <div class="font-mono text-[12px] text-muted-foreground flex gap-2 tabular-nums mt-0.5">
            <span>{{ formatDistance(activeRoute.distance, store.unit) }}</span>
            <span class="opacity-40">·</span>
            <span>{{ formatDuration(activeRoute.duration) }}</span>
          </div>
        </div>
        <div class="md:pointer-events-auto max-md:self-end">
          <MapActions />
        </div>
      </div>
    </div>
    <Transition name="toast">
      <div
        v-if="store.shareToast"
        class="fixed bottom-6 right-6 px-4 py-2.5 bg-foreground text-background text-[13px] font-medium rounded-lg shadow-[var(--shadow-elevated)] whitespace-nowrap z-50"
      >
        {{ store.shareToast }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.slide-forward-enter-active,
.slide-forward-leave-active,
.slide-back-enter-active,
.slide-back-leave-active {
  transition: transform 0.25s ease-out, opacity 0.25s ease-out;
}
.slide-forward-enter-from { transform: translateX(24px); opacity: 0; }
.slide-forward-leave-to { transform: translateX(-24px); opacity: 0; }
.slide-back-enter-from { transform: translateX(-24px); opacity: 0; }
.slide-back-leave-to { transform: translateX(24px); opacity: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease-out; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s ease-out, transform 0.2s ease-out; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(8px); }
</style>
