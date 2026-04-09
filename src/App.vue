<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouteStore } from './stores/route'
import { useMap } from './composables/useMap'
import MapView from './components/MapView.vue'
import MapActions from './components/MapActions.vue'
import SharedRouteView from './components/SharedRouteView.vue'
import ControlsPanel from './components/ControlsPanel.vue'
import RouteSelectionPanel from './components/RouteSelectionPanel.vue'
import AppFooter from './components/AppFooter.vue'
import PanelHeader from './components/PanelHeader.vue'
import RouteSummary from './components/RouteSummary.vue'
import Icon from './components/Icon.vue'

const store = useRouteStore()
const { recenterRoute } = useMap()

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
// If every route is cleared, drop back to controls.
watch(
  () => store.candidates.length + store.savedRoutes.length,
  (n) => {
    if (n === 0) goTo('controls')
  },
)

const recenterBtnCls =
  'absolute top-6 right-6 max-md:top-3 max-md:right-3 z-10 w-10 h-10 grid place-items-center bg-card/95 backdrop-blur border border-border rounded-lg shadow-[var(--shadow-card)] text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/10 transition-colors'
</script>

<template>
  <!-- Shared-link single-instance view -->
  <main
    v-if="store.sharedView"
    class="flex flex-col w-full h-full overflow-hidden bg-background p-6 gap-6 max-md:px-4 max-md:pt-8 max-md:pb-4 max-md:gap-4"
  >
    <div class="shrink-0">
      <SharedRouteView />
    </div>
    <div class="flex-1 min-h-0 relative overflow-hidden">
      <MapView />
      <button
        type="button"
        :class="recenterBtnCls"
        aria-label="Center map on route"
        @click="recenterRoute(store.selected)"
      >
        <Icon name="recenter" />
      </button>
    </div>
    <AppFooter class="shrink-0" />
  </main>

  <!-- Main app: sidebar + map -->
  <main
    v-else
    class="flex w-full h-full overflow-hidden bg-background p-6 gap-6 max-md:flex-col max-md:h-auto max-md:min-h-full max-md:overflow-visible max-md:px-4 max-md:pt-8 max-md:pb-0 max-md:gap-4"
  >
    <!-- Mobile-only header above the map -->
    <header class="hidden max-md:block max-md:order-1">
      <Transition :name="transitionName" mode="out-in">
        <PanelHeader
          v-if="view === 'controls'"
          key="controls"
          compact
          title="Routed"
          tagline="Fresh routes around your neighbourhood, so you never run the same loop twice."
        >
          <template #action>
            <button
              v-if="hasRoutes"
              type="button"
              class="shrink-0 flex items-center gap-1 h-7 rounded-md text-muted-foreground text-xs font-medium uppercase tracking-[0.08em] hover:text-foreground transition-colors"
              @click="goTo('routes')"
            >
              Routes
              <Icon name="chevron-right" :size="12" :stroke-width="2.5" />
            </button>
          </template>
        </PanelHeader>
        <PanelHeader
          v-else
          key="routes"
          compact
          title="Your Routes"
          tagline="Tap a route to preview it on the map, then save, share, or export the one you like."
        >
          <template #action>
            <button
              type="button"
              class="shrink-0 flex items-center gap-1 h-7 rounded-md text-muted-foreground text-xs font-medium uppercase tracking-[0.08em] hover:text-foreground transition-colors"
              @click="goTo('controls')"
            >
              <Icon name="chevron-left" :size="12" :stroke-width="2.5" />
              Back
            </button>
          </template>
        </PanelHeader>
      </Transition>
    </header>

    <!-- Sidebar -->
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
      <AppFooter class="shrink-0 pt-8 max-md:order-4 max-md:pb-4" />
    </aside>

    <!-- Map and overlays -->
    <div class="flex-1 min-w-0 h-full relative max-md:flex-none max-md:h-auto max-md:order-2 max-md:border max-md:border-border max-md:rounded-2xl max-md:overflow-hidden max-md:bg-card max-md:shadow-[var(--shadow-card)]">
      <div class="h-full overflow-hidden max-md:h-[42vh] max-md:rounded-none">
        <MapView />
      </div>

      <!-- Map actions sit on top of the map, independent of the active-route card -->
      <div class="absolute top-6 right-6 max-md:top-3 max-md:right-3 z-10">
        <MapActions />
      </div>

      <!-- Active route label: absolute over the map on md+, inline strip on mobile -->
      <div
        v-if="activeRoute"
        class="md:absolute md:top-6 md:left-6 md:max-w-[360px] md:pointer-events-none max-md:px-4 max-md:py-3 max-md:border-t max-md:border-border"
      >
        <RouteSummary
          :route="activeRoute"
          class="md:px-4 md:py-3 md:bg-card/95 md:backdrop-blur md:border md:border-border md:rounded-xl md:shadow-[var(--shadow-card)]"
        />
      </div>
    </div>

    <!-- Toast -->
    <Transition name="toast">
      <div
        v-if="store.shareToast"
        role="status"
        aria-live="polite"
        class="fixed bottom-6 right-6 px-4 py-2.5 bg-foreground text-background text-[13px] font-medium rounded-lg shadow-[var(--shadow-elevated)] whitespace-nowrap z-50"
      >
        {{ store.shareToast }}
      </div>
    </Transition>
  </main>
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
