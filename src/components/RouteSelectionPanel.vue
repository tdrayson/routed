<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouteStore } from '../stores/route'
import { formatDistance, formatDuration } from '../lib/units'
import { downloadGpx, googleMapsUrl } from '../lib/gpx'

const store = useRouteStore()

const DEBUG =
  import.meta.env.DEV ||
  new URLSearchParams(location.search).has('debug')

// Tabs: only show 'saved' tab when there are saved routes.
const tab = ref('generated')
const hasGenerated = computed(() => store.candidates.length > 0)
const hasSaved = computed(() => store.savedRoutes.length > 0)

// When generation finishes, jump to the generated tab automatically.
function maybeAutoSwitch() {
  if (hasGenerated.value) tab.value = 'generated'
  else if (hasSaved.value) tab.value = 'saved'
}

// Inline UI state for each route card.
// Only one route at a time can have its save form or share popover open.
const openSaveFor = ref(null) // index | null
const openShareFor = ref(null) // index | null
const saveName = ref('')

function startSave(i, route) {
  openShareFor.value = null
  openSaveFor.value = i
  saveName.value = store.suggestedName(route)
}
function cancelSave() {
  openSaveFor.value = null
  saveName.value = ''
}
function confirmSave(route) {
  if (!saveName.value.trim()) return
  store.saveRoute(route, saveName.value)
  cancelSave()
}
function startShare(i) {
  openSaveFor.value = null
  openShareFor.value = openShareFor.value === i ? null : i
}
async function copyLink(route) {
  await store.copyShareLink(route)
  openShareFor.value = null
}
function openInMaps(route) {
  window.open(googleMapsUrl(route, store.activity), '_blank', 'noopener')
  openShareFor.value = null
}
function exportGpx(route) {
  downloadGpx(route, store.suggestedName(route), store.activity)
  openShareFor.value = null
}

// Click-outside closes any open popover/form.
function onDocClick(e) {
  if (!e.target.closest?.('.route-card')) {
    openShareFor.value = null
    openSaveFor.value = null
  }
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

function onSelectGenerated(i) {
  store.selectCandidate(i)
}
function onLoadSaved(entry) {
  store.loadSaved(entry.id)
  tab.value = 'generated'
}
function onDeleteSaved(id) {
  store.deleteSaved(id)
  if (!hasSaved.value) tab.value = 'generated'
}

// Auto-switch when generation populates the list.
import { watch } from 'vue'
watch(hasGenerated, (v) => v && (tab.value = 'generated'))
watch([hasGenerated, hasSaved], maybeAutoSwitch, { immediate: true })
</script>

<template>
  <div v-if="hasGenerated || hasSaved" class="panel selection">
    <header>
      <div class="tabs" v-if="hasSaved">
        <button :class="{ on: tab === 'generated' }" @click="tab = 'generated'" :disabled="!hasGenerated">
          Generated <span v-if="hasGenerated" class="count">{{ store.candidates.length }}</span>
        </button>
        <button :class="{ on: tab === 'saved' }" @click="tab = 'saved'">
          Saved <span class="count">{{ store.savedRoutes.length }}</span>
        </button>
      </div>
      <h2 v-else>{{ store.candidates.length === 1 ? 'Route' : `${store.candidates.length} routes found` }}</h2>
    </header>

    <ul v-if="tab === 'generated'">
      <li
        v-for="(r, i) in store.candidates"
        :key="i"
        class="route-card"
        :class="{ selected: i === store.selectedIndex }"
        @click="onSelectGenerated(i)"
      >
        <div class="card-main">
          <div class="info">
            <div class="title">{{ r.label }}</div>
            <div class="stats">
              <span>{{ formatDistance(r.distance, store.unit) }}</span>
              <span class="dot">·</span>
              <span>{{ formatDuration(r.duration) }}</span>
            </div>
            <div v-if="DEBUG && r.doubledMeters != null" class="debug">
              spurs: {{ Math.round(r.doubledMeters) }}m · waypoints: {{ r.waypoints?.length || 0 }}
            </div>
          </div>
          <div class="card-actions" @click.stop>
            <button class="icon-btn" @click="startSave(i, r)" title="Save route" aria-label="Save route">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
            <button class="icon-btn" @click="startShare(i)" title="Share route" aria-label="Share route">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
          </div>
        </div>

        <!-- Inline save form -->
        <div v-if="openSaveFor === i" class="inline-form" @click.stop>
          <input
            v-model="saveName"
            type="text"
            placeholder="Route name"
            @keyup.enter="confirmSave(r)"
            @keyup.escape="cancelSave"
            ref="saveInput"
            autofocus
          />
          <button class="primary" @click="confirmSave(r)">Save</button>
          <button class="ghost" @click="cancelSave">Cancel</button>
        </div>

        <!-- Inline share popover -->
        <div v-if="openShareFor === i" class="inline-form share" @click.stop>
          <button class="share-item" @click="copyLink(r)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            Copy link
          </button>
          <button class="share-item" @click="openInMaps(r)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Open in Google Maps
          </button>
          <button class="share-item" @click="exportGpx(r)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download GPX
          </button>
        </div>
      </li>
    </ul>

    <ul v-else>
      <li
        v-for="entry in store.savedRoutes"
        :key="entry.id"
        class="route-card saved-card"
      >
        <div class="card-main" @click="onLoadSaved(entry)">
          <div class="info">
            <div class="title">{{ entry.name }}</div>
            <div class="stats">
              <span>{{ formatDistance(entry.data.d, entry.data.u || 'mi') }}</span>
              <span class="dot">·</span>
              <span>{{ formatDuration(entry.data.s) }}</span>
            </div>
          </div>
          <div class="card-actions" @click.stop>
            <button class="icon-btn" @click="onDeleteSaved(entry.id)" title="Delete" aria-label="Delete saved route">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
            </button>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.selection {
  width: 100%;
  padding: 20px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);

  --c-text: #1a1c1a;
  --c-text-dim: #6b7280;
  --c-bg: rgba(255, 255, 255, 0.9);
  --c-input-bg: rgba(0, 0, 0, 0.045);
  --c-input-bg-focus: rgba(0, 0, 0, 0.075);
  --c-border: rgba(0, 0, 0, 0.08);

  background: transparent;
  color: var(--c-text);
}
header { margin-bottom: 10px; }
h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--c-text-dim); }

.tabs {
  display: flex;
  background: var(--c-input-bg);
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}
.tabs button {
  flex: 1;
  padding: 7px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--c-text-dim);
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.tabs button:disabled { opacity: 0.4; cursor: not-allowed; }
.tabs button.on { background: rgba(225, 29, 72, 0.1); color: var(--primary-dim); }
.tabs .count {
  font-size: 10px;
  background: rgba(0, 0, 0, 0.08);
  border-radius: 999px;
  padding: 1px 6px;
  font-weight: 700;
}
.tabs button.on .count { background: rgba(225, 29, 72, 0.15); color: var(--primary-dim); }

ul { display: flex; flex-direction: column; gap: 6px; }

.route-card {
  background: var(--c-input-bg);
  border-radius: 8px;
  border: 1px solid transparent;
  transition: all 0.15s;
  overflow: hidden;
}
.route-card:hover { background: var(--c-input-bg-focus); }
.route-card.selected { border-color: var(--primary-dim); background: rgba(225, 29, 72, 0.1); }

.card-main {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
}
.info { flex: 1; min-width: 0; }
.title { font-size: 13px; font-weight: 600; margin-bottom: 2px; color: var(--c-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stats { font-size: 12px; color: var(--c-text-dim); display: flex; gap: 6px; }
.dot { opacity: 0.5; }
.route-card.selected .stats { color: var(--primary-dim); }
.debug { font-size: 11px; color: #a16207; margin-top: 3px; font-family: ui-monospace, monospace; }

.card-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}
.route-card:hover .card-actions,
.route-card.selected .card-actions { opacity: 1; }
.icon-btn {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  color: var(--c-text-dim);
  transition: all 0.15s;
}
.icon-btn:hover { background: rgba(225, 29, 72, 0.12); color: var(--primary-dim); }

.inline-form {
  display: flex;
  gap: 6px;
  padding: 8px 12px 12px 12px;
  border-top: 1px solid var(--c-border);
}
.inline-form input {
  flex: 1;
  min-width: 0;
  padding: 7px 10px;
  background: #fff;
  border: 1px solid var(--c-border);
  border-radius: 6px;
  font-size: 13px;
  color: var(--c-text);
  outline: none;
}
.inline-form input:focus { border-color: var(--primary-dim); }
.inline-form .primary {
  padding: 7px 12px;
  background: var(--primary-dim);
  color: #fff;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}
.inline-form .ghost {
  padding: 7px 10px;
  background: transparent;
  color: var(--c-text-dim);
  border-radius: 6px;
  font-size: 12px;
}
.inline-form .ghost:hover { color: var(--c-text); }

.inline-form.share {
  flex-direction: column;
  gap: 2px;
  padding: 6px;
}
.share-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: transparent;
  border-radius: 6px;
  font-size: 13px;
  color: var(--c-text);
  text-align: left;
}
.share-item:hover { background: rgba(225, 29, 72, 0.1); color: var(--primary-dim); }

</style>
