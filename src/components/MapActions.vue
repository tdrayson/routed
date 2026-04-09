<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouteStore } from '../stores/route'
import { downloadGpx, googleMapsUrl } from '../lib/gpx'
import { useMap } from '../composables/useMap'

const store = useRouteStore()
const { fitToRoute } = useMap()
const route = computed(() => store.savedPreview || store.selected)

function recenter() {
  if (!route.value?.geometry) return
  fitToRoute(route.value.geometry, { top: 60, bottom: 60, left: 60, right: 60 })
}

const showSave = ref(false)
const showShare = ref(false)
const saveName = ref('')
const shareTitle = ref('')

function toggleSave() {
  if (!route.value) return
  showShare.value = false
  showSave.value = !showSave.value
  if (showSave.value) saveName.value = store.suggestedName(route.value)
}
function toggleShare() {
  if (!route.value) return
  showSave.value = false
  showShare.value = !showShare.value
  if (showShare.value) shareTitle.value = store.suggestedName(route.value)
}
function confirmSave() {
  if (!saveName.value.trim() || !route.value) return
  store.saveRoute(route.value, saveName.value)
  showSave.value = false
  saveName.value = ''
}
async function copyLink() {
  await store.copyShareLink(route.value, shareTitle.value.trim())
  showShare.value = false
}
function openInMaps() {
  window.open(googleMapsUrl(route.value, store.activity), '_blank', 'noopener')
  showShare.value = false
}
function clearRoute() {
  showSave.value = false
  showShare.value = false
  store.savedPreview = null
  store.selectedIndex = -1
  store.setStart(null, '')
  store.setEnd(null, '')
}
function exportGpx() {
  downloadGpx(route.value, store.suggestedName(route.value), store.activity)
  showShare.value = false
}

function onDocClick(e) {
  if (!e.target.closest?.('.map-actions')) {
    showSave.value = false
    showShare.value = false
  }
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div v-if="route" class="map-actions flex flex-col items-end gap-2">
    <div class="flex gap-1.5 bg-card/95 backdrop-blur border border-border rounded-lg p-1 shadow-[var(--shadow-card)]">
      <button
        class="w-9 h-9 grid place-items-center rounded-md text-muted-foreground transition-all duration-150 hover:bg-primary/10 hover:text-primary"
        @click.stop="recenter"
        title="Center on route"
        aria-label="Center on route"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>
      </button>
      <button
        class="w-9 h-9 grid place-items-center rounded-md text-muted-foreground transition-all duration-150 hover:bg-primary/10 hover:text-primary"
        :class="{ 'bg-primary/10 text-primary': showSave }"
        @click.stop="toggleSave"
        title="Save route"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
      </button>
      <button
        class="w-9 h-9 grid place-items-center rounded-md text-muted-foreground transition-all duration-150 hover:bg-primary/10 hover:text-primary"
        :class="{ 'bg-primary/10 text-primary': showShare }"
        @click.stop="toggleShare"
        title="Share route"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      </button>
      <button
        class="w-9 h-9 grid place-items-center rounded-md text-muted-foreground transition-all duration-150 hover:bg-destructive/10 hover:text-destructive"
        @click.stop="clearRoute"
        title="Clear route"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div
      v-if="showSave"
      class="flex gap-2 bg-card/95 backdrop-blur border border-border rounded-lg p-2 shadow-[var(--shadow-card)]"
      @click.stop
    >
      <input
        v-model="saveName"
        type="text"
        placeholder="Route name"
        @keyup.enter="confirmSave"
        @keyup.escape="showSave = false"
        class="w-56 px-3 py-2 bg-background border border-border rounded-md text-[13px] text-foreground outline-none focus:border-primary"
        autofocus
      />
      <button class="px-3.5 py-2 bg-primary text-card rounded-md text-xs font-semibold" @click="confirmSave">Save</button>
    </div>

    <div
      v-if="showShare"
      class="flex flex-col gap-1 bg-card/95 backdrop-blur border border-border rounded-lg p-2 shadow-[var(--shadow-card)] min-w-[260px]"
      @click.stop
    >
      <label class="flex flex-col gap-1 px-1 pt-1 pb-2">
        <span class="font-sans text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Title</span>
        <input
          v-model="shareTitle"
          type="text"
          placeholder="Route title"
          @keyup.enter="copyLink"
          class="w-full px-3 py-2 bg-background border border-border rounded-md text-[13px] text-foreground outline-none focus:border-primary"
        />
      </label>
      <div class="h-px bg-border mx-1 my-1" />
      <button
        class="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] text-foreground text-left hover:bg-primary/10 hover:text-primary"
        @click="copyLink"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        Copy link
      </button>
      <button
        class="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] text-foreground text-left hover:bg-primary/10 hover:text-primary"
        @click="openInMaps"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        Open in Google Maps
      </button>
      <button
        class="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] text-foreground text-left hover:bg-primary/10 hover:text-primary"
        @click="exportGpx"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download GPX
      </button>
    </div>
  </div>
</template>
