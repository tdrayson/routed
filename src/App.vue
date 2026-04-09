<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import MapView from './components/MapView.vue'
import MapActions from './components/MapActions.vue'
import SharedRouteView from './components/SharedRouteView.vue'
import ControlsPanel from './components/ControlsPanel.vue'
import RouteSelectionPanel from './components/RouteSelectionPanel.vue'
import { useRouteStore } from './stores/route'
import { useMap } from './composables/useMap'
import { formatDistance, formatDuration } from './lib/units'

const store = useRouteStore()
const view = ref('controls') // 'controls' | 'routes'
const transitionName = ref('slide-forward')

function goTo(next) {
  const order = { controls: 0, routes: 1 }
  transitionName.value = order[next] > order[view.value] ? 'slide-forward' : 'slide-back'
  view.value = next
}

const { fitToRoute } = useMap()
function recenterShared() {
  const r = store.selected
  if (!r?.geometry) return
  fitToRoute(r.geometry, { top: 60, bottom: 60, left: 60, right: 60 })
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
  <div
    v-if="store.sharedView"
    class="flex flex-col w-full h-full overflow-hidden bg-background p-6 gap-6 max-md:px-4 max-md:pt-8 max-md:pb-4 max-md:gap-4"
  >
    <!-- Mobile-only inline title -->
    <div class="shrink-0 md:hidden">
      <SharedRouteView />
    </div>
    <div class="flex-1 min-h-0 relative overflow-hidden">
      <MapView />
      <!-- Desktop overlay title -->
      <div class="hidden md:block absolute top-6 left-6 z-10 max-w-[420px] bg-card/95 backdrop-blur border border-border rounded-xl shadow-[var(--shadow-card)] px-5 py-4 pointer-events-none">
        <SharedRouteView />
      </div>
      <button
        class="absolute top-6 right-6 max-md:top-3 max-md:right-3 z-10 w-10 h-10 grid place-items-center bg-card/95 backdrop-blur border border-border rounded-lg shadow-[var(--shadow-card)] text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/10 transition-colors"
        @click="recenterShared"
        title="Center on route"
        aria-label="Center on route"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>
      </button>
    </div>
    <footer class="shrink-0 flex items-center justify-between gap-4">
      <p class="text-[10px] uppercase tracking-widest text-muted-foreground">
        Routed · Built by
        <a
          href="https://taylordrayson.com"
          target="_blank"
          rel="noopener"
          class="text-muted-foreground hover:text-foreground transition-colors"
        >Taylor Drayson</a>
      </p>
      <a
        href="https://github.com/tdrayson/routed"
        target="_blank"
        rel="noopener"
        aria-label="Open GitHub repo (opens in a new tab)"
        class="text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
      </a>
    </footer>
  </div>
  <div v-else class="flex w-full h-full overflow-hidden bg-background p-6 gap-6 max-md:flex-col max-md:h-auto max-md:min-h-full max-md:overflow-visible max-md:px-4 max-md:pt-8 max-md:pb-0 max-md:gap-4">
    <header class="hidden max-md:block max-md:order-1">
      <Transition :name="transitionName" mode="out-in">
        <div
          v-if="view === 'controls'"
          key="controls"
          class="flex justify-between items-start gap-4"
        >
          <div class="min-w-0">
            <h1 class="font-serif text-[36px] leading-[1] text-foreground">Routed</h1>
            <p class="font-sans text-xs text-muted-foreground tracking-[0.04em] mt-1.5">Fresh routes around your neighbourhood, so you never run the same loop twice.</p>
          </div>
          <button
            v-if="hasRoutes"
            class="shrink-0 flex items-center gap-1 h-7 rounded-md text-muted-foreground text-xs font-medium uppercase tracking-[0.08em] hover:text-foreground transition-colors"
            @click="goTo('routes')"
          >
            Routes
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        <div
          v-else
          key="routes"
          class="flex justify-between items-start gap-4 min-w-0"
        >
          <div class="min-w-0">
            <h1 class="font-serif text-[36px] leading-[1] text-foreground truncate">Your Routes</h1>
            <p class="font-sans text-xs text-muted-foreground tracking-[0.04em] mt-1.5">Tap a route to preview it on the map, then save, share, or export the one you like.</p>
          </div>
          <button
            class="shrink-0 flex items-center gap-1 h-7 rounded-md text-muted-foreground text-xs font-medium uppercase tracking-[0.08em] hover:text-foreground transition-colors"
            @click="goTo('controls')"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
        </div>
      </Transition>
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
      <footer class="shrink-0 pt-8 flex items-center justify-between max-md:order-4 max-md:pb-4">
        <p class="text-[10px] uppercase tracking-widest text-muted-foreground">
          Routed · Built by
          <a
            href="https://taylordrayson.com"
            target="_blank"
            rel="noopener"
            class="text-muted-foreground hover:text-foreground transition-colors"
          >Taylor Drayson</a>
        </p>
        <a
          href="https://github.com/tdrayson/routed"
          target="_blank"
          rel="noopener"
          aria-label="Open GitHub repo (opens in a new tab)"
          class="text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
        </a>
      </footer>
    </aside>
    <div class="flex-1 min-w-0 h-full relative max-md:flex-none max-md:h-auto max-md:order-2 max-md:border max-md:border-border max-md:rounded-2xl max-md:overflow-hidden max-md:bg-card max-md:shadow-[var(--shadow-card)]">
      <div class="h-full overflow-hidden max-md:h-[42vh] max-md:rounded-none">
        <MapView />
      </div>
      <!-- Map actions sit directly on top of the map, independent of the active-route card -->
      <div class="absolute top-6 right-6 max-md:top-3 max-md:right-3 z-10">
        <MapActions />
      </div>
      <!-- Active route label: absolute over the map on md+, inline strip inside the card on mobile -->
      <div
        v-if="activeRoute"
        class="md:absolute md:top-6 md:left-6 md:max-w-[360px] md:pointer-events-none max-md:px-4 max-md:py-3 max-md:border-t max-md:border-border"
      >
        <div
          class="md:px-4 md:py-3 md:bg-card/95 md:backdrop-blur md:border md:border-border md:rounded-xl md:shadow-[var(--shadow-card)]"
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
