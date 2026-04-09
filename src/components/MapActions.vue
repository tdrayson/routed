<script setup>
import { computed, ref } from 'vue'
import { useRouteStore } from '../stores/route'
import { useMap } from '../composables/useMap'
import { useOutsideClick } from '../composables/useOutsideClick'
import { downloadGpx, googleMapsUrl } from '../lib/gpx'
import Icon from './Icon.vue'

const store = useRouteStore()
const { recenterRoute } = useMap()
const route = computed(() => store.savedPreview || store.selected)

const showSave = ref(false)
const showShare = ref(false)
const saveName = ref('')
const shareTitle = ref('')

function closePopups() {
  showSave.value = false
  showShare.value = false
}
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
function exportGpx() {
  downloadGpx(route.value, store.suggestedName(route.value), store.activity)
  showShare.value = false
}
function clearRoute() {
  closePopups()
  store.savedPreview = null
  store.selectedIndex = -1
  store.setStart(null, '')
  store.setEnd(null, '')
}

useOutsideClick('.map-actions', closePopups)

// Button style shared by every action icon.
const iconBtnCls =
  'w-9 h-9 grid place-items-center rounded-md text-muted-foreground transition-all duration-150 hover:bg-primary/10 hover:text-primary'
const destructiveBtnCls =
  'w-9 h-9 grid place-items-center rounded-md text-muted-foreground transition-all duration-150 hover:bg-destructive/10 hover:text-destructive'
const popupCls =
  'bg-card/95 backdrop-blur border border-border rounded-lg shadow-[var(--shadow-card)]'
</script>

<template>
  <div v-if="route" class="map-actions flex flex-col items-end gap-2">
    <div :class="[popupCls, 'flex gap-1.5 p-1']">
      <button :class="iconBtnCls" @click.stop="recenterRoute(route)" title="Center on route" aria-label="Center on route">
        <Icon name="recenter" />
      </button>
      <button
        :class="[iconBtnCls, { 'bg-primary/10 text-primary': showSave }]"
        @click.stop="toggleSave"
        title="Save route"
      >
        <Icon name="save" />
      </button>
      <button
        :class="[iconBtnCls, { 'bg-primary/10 text-primary': showShare }]"
        @click.stop="toggleShare"
        title="Share route"
      >
        <Icon name="share" />
      </button>
      <button :class="destructiveBtnCls" @click.stop="clearRoute" title="Clear route">
        <Icon name="close" />
      </button>
    </div>

    <div v-if="showSave" :class="[popupCls, 'flex gap-2 p-2']" @click.stop>
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

    <div v-if="showShare" :class="[popupCls, 'flex flex-col gap-1 p-2 min-w-[260px]']" @click.stop>
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
        <Icon name="link" :size="14" />
        Copy link
      </button>
      <button
        class="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] text-foreground text-left hover:bg-primary/10 hover:text-primary"
        @click="openInMaps"
      >
        <Icon name="map-pin" :size="14" />
        Open in Google Maps
      </button>
      <button
        class="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] text-foreground text-left hover:bg-primary/10 hover:text-primary"
        @click="exportGpx"
      >
        <Icon name="download" :size="14" />
        Download GPX
      </button>
    </div>
  </div>
</template>
