<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRouteStore } from '../stores/route'
import PanelHeader from './PanelHeader.vue'
import RouteCard from './RouteCard.vue'
import Icon from './Icon.vue'

const emit = defineEmits(['back'])
const store = useRouteStore()

const vFocus = {
  mounted: (el) => { el.focus(); el.select?.() },
}

const DEBUG = import.meta.env.DEV || new URLSearchParams(location.search).has('debug')

const tab = ref('generated')
const hasGenerated = computed(() => store.candidates.length > 0)
const hasSaved = computed(() => store.savedRoutes.length > 0)

function maybeAutoSwitch() {
  if (hasGenerated.value) tab.value = 'generated'
  else if (hasSaved.value) tab.value = 'saved'
}

const editingSavedId = ref(null)
const editingName = ref('')
function startRename(entry) {
  editingSavedId.value = entry.id
  editingName.value = entry.name
}
function cancelRename() {
  editingSavedId.value = null
  editingName.value = ''
}
function confirmRename(entry) {
  const next = editingName.value.trim()
  if (next && next !== entry.name) store.renameSaved(entry.id, next)
  cancelRename()
}
function onDeleteSaved(id) {
  store.deleteSaved(id)
  if (!hasSaved.value) tab.value = 'generated'
}

watch(hasGenerated, (v) => v && (tab.value = 'generated'))
watch([hasGenerated, hasSaved], maybeAutoSwitch, { immediate: true })

// Arrow-key navigation for the tablist. Moves focus to the newly
// selected tab so the focus ring follows.
function onTabKey(e) {
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (!keys.includes(e.key)) return
  e.preventDefault()
  const buttons = Array.from(e.currentTarget.querySelectorAll('[role="tab"]'))
  const order = ['generated', 'saved']
  const cur = order.indexOf(tab.value)
  let next = cur
  if (e.key === 'ArrowRight') next = cur === order.length - 1 ? 0 : cur + 1
  else if (e.key === 'ArrowLeft') next = cur === 0 ? order.length - 1 : cur - 1
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = order.length - 1
  if (order[next] === 'generated' && !hasGenerated.value) next = order.indexOf('saved')
  tab.value = order[next]
  nextTick(() => buttons[next]?.focus())
}

const scroller = ref(null)
function scrollToTop() {
  nextTick(() => {
    scroller.value?.scrollTo?.({ top: 0, behavior: 'smooth' })
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  })
}
watch(() => store.candidates, scrollToTop, { deep: false })
watch(() => store.selectedIndex, scrollToTop)
watch(() => store.savedPreview?.id, scrollToTop)
watch(tab, scrollToTop)

// Saved entries are stored in compact form — adapt them to the RouteCard shape.
function savedDistance(entry) { return entry.data.d }
function savedDuration(entry) { return entry.data.s }
function savedUnit(entry) { return entry.data.u || 'mi' }

const tabBase =
  'flex-1 px-3 py-2 rounded-md text-xs font-medium uppercase tracking-[0.08em] transition-all duration-150 ease-out flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed'
const savedActionBtnCls =
  'w-[30px] h-[30px] grid place-items-center rounded-md text-muted-foreground transition-all duration-150 hover:bg-primary/10 hover:text-primary'
const savedDestructiveBtnCls =
  'w-[30px] h-[30px] grid place-items-center rounded-md text-muted-foreground transition-all duration-150 hover:bg-destructive/10 hover:text-destructive'
</script>

<template>
  <div class="w-full h-full flex flex-col text-foreground gap-8 max-md:h-auto">
    <div class="max-md:hidden">
      <PanelHeader
        title="Your Routes"
        tagline="Tap a route to preview it on the map, then save, share, or export the one you like."
      >
        <template #action>
          <button
            type="button"
            class="shrink-0 flex items-center gap-1 h-7 rounded-md text-muted-foreground text-xs font-medium uppercase tracking-[0.08em] hover:text-foreground transition-colors"
            @click="emit('back')"
          >
            <Icon name="chevron-left" :size="12" :stroke-width="2.5" />
            Back
          </button>
        </template>
      </PanelHeader>
    </div>

    <div v-if="hasGenerated || hasSaved" class="flex-1 min-h-0 flex flex-col gap-4">
      <header class="shrink-0">
        <div
          v-if="hasSaved"
          role="tablist"
          aria-label="Route lists"
          class="flex bg-muted border border-border rounded-lg p-[3px] gap-[2px]"
          @keydown="onTabKey"
        >
          <button
            type="button"
            role="tab"
            :aria-selected="tab === 'generated'"
            :tabindex="tab === 'generated' ? 0 : -1"
            :class="[tabBase, tab === 'generated' ? 'bg-card text-foreground shadow-[var(--shadow-card)]' : 'text-muted-foreground']"
            @click="tab = 'generated'"
            :disabled="!hasGenerated"
          >
            Generated
            <span
              v-if="hasGenerated"
              :class="[
                'font-mono text-[10px] rounded-full px-1.5 py-px font-medium tabular-nums',
                tab === 'generated' ? 'bg-primary/12 text-primary' : 'bg-border text-muted-foreground',
              ]"
            >{{ store.candidates.length }}</span>
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="tab === 'saved'"
            :tabindex="tab === 'saved' ? 0 : -1"
            :class="[tabBase, tab === 'saved' ? 'bg-card text-foreground shadow-[var(--shadow-card)]' : 'text-muted-foreground']"
            @click="tab = 'saved'"
          >
            Saved
            <span
              :class="[
                'font-mono text-[10px] rounded-full px-1.5 py-px font-medium tabular-nums',
                tab === 'saved' ? 'bg-primary/12 text-primary' : 'bg-border text-muted-foreground',
              ]"
            >{{ store.savedRoutes.length }}</span>
          </button>
        </div>
        <h2 v-else class="font-sans text-sm font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {{ store.candidates.length === 1 ? 'Route' : `${store.candidates.length} routes found` }}
        </h2>
      </header>

      <div ref="scroller" class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden max-md:overflow-visible">
        <ul
          v-if="tab === 'generated'"
          role="tabpanel"
          aria-label="Generated routes"
          class="flex flex-col gap-3"
        >
          <RouteCard
            v-for="(r, i) in store.candidates"
            :key="i"
            :label="r.label"
            :distance="r.distance"
            :duration="r.duration"
            :unit="store.unit"
            :selected="i === store.selectedIndex"
            @click="store.selectCandidate(i)"
          >
            <template v-if="DEBUG && r.doubledMeters != null" #meta>
              <div class="font-mono text-[11px] text-muted-foreground mt-1 tabular-nums">
                spurs: {{ Math.round(r.doubledMeters) }}m · waypoints: {{ r.waypoints?.length || 0 }}
              </div>
            </template>
          </RouteCard>
        </ul>

        <ul v-else role="tabpanel" aria-label="Saved routes" class="flex flex-col gap-3">
          <RouteCard
            v-for="entry in store.savedRoutes"
            :key="entry.id"
            :label="entry.name"
            :distance="savedDistance(entry)"
            :duration="savedDuration(entry)"
            :unit="savedUnit(entry)"
            :selected="store.savedPreview?.id === entry.id"
            @click="editingSavedId !== entry.id && store.loadSaved(entry.id)"
          >
            <template v-if="editingSavedId === entry.id" #title>
              <input
                v-model="editingName"
                type="text"
                class="w-full bg-transparent border-0 outline-none font-serif text-xl leading-tight mb-1 text-foreground p-0"
                @click.stop
                @keyup.enter="confirmRename(entry)"
                @keyup.escape="cancelRename"
                @blur="confirmRename(entry)"
                v-focus
              />
            </template>
            <template #actions>
              <button
                type="button"
                :class="savedActionBtnCls"
                :aria-label="`Rename ${entry.name}`"
                @click="startRename(entry)"
              >
                <Icon name="edit" />
              </button>
              <button
                type="button"
                :class="savedDestructiveBtnCls"
                :aria-label="`Delete ${entry.name}`"
                @click="onDeleteSaved(entry.id)"
              >
                <Icon name="trash" />
              </button>
            </template>
          </RouteCard>
        </ul>
      </div>
    </div>

    <div v-if="!hasGenerated && !hasSaved" class="flex-1 grid place-items-center">
      <p class="font-serif text-lg text-muted-foreground text-center">No routes yet.<br />Generate one from the previous step.</p>
    </div>
  </div>
</template>
