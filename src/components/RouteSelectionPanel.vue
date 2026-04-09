<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useRouteStore } from '../stores/route'
import { formatDistance, formatDuration } from '../lib/units'

const emit = defineEmits(['back'])
const store = useRouteStore()

const vFocus = {
  mounted: (el) => { el.focus(); el.select?.() },
}

const DEBUG =
  import.meta.env.DEV ||
  new URLSearchParams(location.search).has('debug')

const tab = ref('generated')
const hasGenerated = computed(() => store.candidates.length > 0)
const hasSaved = computed(() => store.savedRoutes.length > 0)

function maybeAutoSwitch() {
  if (hasGenerated.value) tab.value = 'generated'
  else if (hasSaved.value) tab.value = 'saved'
}

function onSelectGenerated(i) {
  store.selectCandidate(i)
}
function onLoadSaved(entry) {
  store.loadSaved(entry.id)
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

const scroller = ref(null)
function scrollToTop() {
  nextTick(() => {
    scroller.value?.scrollTo?.({ top: 0, behavior: 'smooth' })
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  })
}
// Fresh generation → reset scroll.
watch(() => store.candidates, scrollToTop, { deep: false })
// Selecting a route → reset scroll.
watch(() => store.selectedIndex, scrollToTop)
watch(() => store.savedPreview?.id, scrollToTop)
// Switching tabs → reset scroll.
watch(tab, scrollToTop)

const tabBase =
  'flex-1 px-3 py-2 rounded-md text-xs font-medium uppercase tracking-[0.08em] transition-all duration-150 ease-out flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed'
</script>

<template>
  <div class="w-full h-full flex flex-col text-foreground gap-8 max-md:h-auto">
    <div class="flex justify-between items-start gap-4 max-md:hidden">
      <div class="min-w-0">
        <h1 class="font-serif text-[44px] leading-[1] text-foreground">Your Routes</h1>
        <p class="font-sans text-xs text-muted-foreground tracking-[0.04em] mt-1.5">Tap a route to preview it on the map, then save, share, or export the one you like.</p>
      </div>
      <button
        class="shrink-0 flex items-center gap-1 h-7 rounded-md text-muted-foreground text-xs font-medium uppercase tracking-[0.08em] hover:text-foreground transition-colors"
        @click="emit('back')"
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>
    </div>
    <div v-if="hasGenerated || hasSaved" class="flex-1 min-h-0 flex flex-col gap-4">
    <header class="shrink-0">
      <div v-if="hasSaved" class="flex bg-muted border border-border rounded-lg p-[3px] gap-[2px]">
        <button
          :class="[tabBase, tab === 'generated' ? 'bg-card text-foreground shadow-[var(--shadow-card)]' : 'text-muted-foreground']"
          @click="tab = 'generated'"
          :disabled="!hasGenerated"
        >
          Generated
          <span
            v-if="hasGenerated"
            :class="[
              'font-mono text-[10px] rounded-full px-1.5 py-px font-medium tabular-nums',
              tab === 'generated' ? 'bg-primary/12 text-primary' : 'bg-border text-muted-foreground'
            ]"
          >{{ store.candidates.length }}</span>
        </button>
        <button
          :class="[tabBase, tab === 'saved' ? 'bg-card text-foreground shadow-[var(--shadow-card)]' : 'text-muted-foreground']"
          @click="tab = 'saved'"
        >
          Saved
          <span
            :class="[
              'font-mono text-[10px] rounded-full px-1.5 py-px font-medium tabular-nums',
              tab === 'saved' ? 'bg-primary/12 text-primary' : 'bg-border text-muted-foreground'
            ]"
          >{{ store.savedRoutes.length }}</span>
        </button>
      </div>
      <h2 v-else class="font-sans text-sm font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {{ store.candidates.length === 1 ? 'Route' : `${store.candidates.length} routes found` }}
      </h2>
    </header>

    <div ref="scroller" class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden max-md:overflow-visible">
    <ul v-if="tab === 'generated'" class="flex flex-col gap-3">
      <li
        v-for="(r, i) in store.candidates"
        :key="i"
        class="route-card group bg-card border border-border rounded-xl transition-all duration-150 ease-out overflow-hidden hover:border-primary/30 hover:shadow-[var(--shadow-card)]"
        :class="{ '!border-primary bg-primary/5 shadow-[var(--shadow-card)]': i === store.selectedIndex }"
        @click="onSelectGenerated(i)"
      >
        <div class="flex gap-2.5 px-4 py-3.5 cursor-pointer">
          <div class="flex-1 min-w-0">
            <div class="font-serif text-xl leading-tight mb-1 text-foreground break-words">{{ r.label }}</div>
            <div
              class="font-mono text-[13px] flex gap-2 tabular-nums"
              :class="i === store.selectedIndex ? 'text-primary' : 'text-muted-foreground'"
            >
              <span>{{ formatDistance(r.distance, store.unit) }}</span>
              <span class="opacity-40">·</span>
              <span>{{ formatDuration(r.duration) }}</span>
            </div>
            <div v-if="DEBUG && r.doubledMeters != null" class="font-mono text-[11px] text-muted-foreground mt-1 tabular-nums">
              spurs: {{ Math.round(r.doubledMeters) }}m · waypoints: {{ r.waypoints?.length || 0 }}
            </div>
          </div>
        </div>
      </li>
    </ul>

    <ul v-else class="flex flex-col gap-3">
      <li
        v-for="entry in store.savedRoutes"
        :key="entry.id"
        class="route-card group bg-card border border-border rounded-xl transition-all duration-150 ease-out overflow-hidden hover:border-primary/30 hover:shadow-[var(--shadow-card)]"
        :class="{ '!border-primary bg-primary/5 shadow-[var(--shadow-card)]': store.savedPreview?.id === entry.id }"
      >
        <div class="flex gap-2.5 px-4 py-3.5 cursor-pointer" @click="editingSavedId !== entry.id && onLoadSaved(entry)">
          <div class="flex-1 min-w-0">
            <input
              v-if="editingSavedId === entry.id"
              v-model="editingName"
              type="text"
              class="w-full bg-transparent border-0 outline-none font-serif text-xl leading-tight mb-1 text-foreground p-0"
              @click.stop
              @keyup.enter="confirmRename(entry)"
              @keyup.escape="cancelRename"
              @blur="confirmRename(entry)"
              v-focus
            />
            <div v-else class="font-serif text-xl leading-tight mb-1 text-foreground break-words">{{ entry.name }}</div>
            <div
              class="font-mono text-[13px] flex gap-2 tabular-nums"
              :class="store.savedPreview?.id === entry.id ? 'text-primary' : 'text-muted-foreground'"
            >
              <span>{{ formatDistance(entry.data.d, entry.data.u || 'mi') }}</span>
              <span class="opacity-40">·</span>
              <span>{{ formatDuration(entry.data.s) }}</span>
            </div>
          </div>
          <div
            class="flex gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            :class="{ '!opacity-100': store.savedPreview?.id === entry.id }"
            @click.stop
          >
            <button
              class="w-[30px] h-[30px] grid place-items-center rounded-md text-muted-foreground transition-all duration-150 hover:bg-primary/10 hover:text-primary"
              @click="startRename(entry)"
              title="Rename"
              aria-label="Rename"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button
              class="w-[30px] h-[30px] grid place-items-center rounded-md text-muted-foreground transition-all duration-150 hover:bg-destructive/10 hover:text-destructive"
              @click="onDeleteSaved(entry.id)"
              title="Delete"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
            </button>
          </div>
        </div>
      </li>
    </ul>
    </div>
    </div>
    <div v-if="!hasGenerated && !hasSaved" class="flex-1 grid place-items-center">
      <p class="font-serif text-lg text-muted-foreground text-center">No routes yet.<br/>Generate one from the previous step.</p>
    </div>
  </div>
</template>
