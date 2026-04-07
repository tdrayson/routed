<script setup>
import { useRouteStore } from '../stores/route'
import { formatDistance, formatDuration } from '../lib/units'

const store = useRouteStore()

const DEBUG =
  import.meta.env.DEV ||
  new URLSearchParams(location.search).has('debug')

function onSave() {
  const name = window.prompt('Name this route', store.selected?.label || 'My route')
  if (name) store.saveSelected(name)
}
</script>

<template>
  <div v-if="store.candidates.length" class="panel selection">
    <header>
      <h2>{{ store.candidates.length === 1 ? 'Route' : `${store.candidates.length} routes found` }}</h2>
    </header>
    <ul>
      <li
        v-for="(r, i) in store.candidates"
        :key="i"
        :class="{ selected: i === store.selectedIndex }"
        @click="store.selectCandidate(i)"
      >
        <div class="title">{{ r.label }}</div>
        <div class="stats">
          <span>{{ formatDistance(r.distance, store.unit) }}</span>
          <span class="dot">·</span>
          <span>{{ formatDuration(r.duration) }}</span>
        </div>
        <div v-if="DEBUG && r.doubledMeters != null" class="debug">
          spurs: {{ Math.round(r.doubledMeters) }}m · waypoints: {{ r.waypoints?.length || 0 }}
        </div>
      </li>
    </ul>
    <footer>
      <button class="action" @click="onSave" title="Save route">Save</button>
      <button class="action" @click="store.shareSelected" title="Copy share link">Share</button>
    </footer>
  </div>
</template>

<style scoped>
.selection {
  position: absolute;
  top: 16px;
  left: 352px;
  width: 240px;
  padding: 14px;
  z-index: 5;
  max-height: calc(100vh - 32px);
  overflow-y: auto;

  --c-text: #1a1c1a;
  --c-text-dim: #6b7280;
  --c-bg: rgba(255, 255, 255, 0.9);
  --c-input-bg: rgba(0, 0, 0, 0.045);
  --c-input-bg-focus: rgba(0, 0, 0, 0.075);
  --c-border: rgba(0, 0, 0, 0.08);

  background: var(--c-bg);
  border: 1px solid var(--c-border);
  color: var(--c-text);
}
header { margin-bottom: 10px; }
h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--c-text-dim); }
ul { display: flex; flex-direction: column; gap: 6px; }
li {
  padding: 10px 12px;
  background: var(--c-input-bg);
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
}
li:hover { background: var(--c-input-bg-focus); }
li.selected { border-color: var(--primary-dim); background: rgba(225, 29, 72, 0.1); }
.title { font-size: 13px; font-weight: 600; margin-bottom: 2px; color: var(--c-text); }
.stats { font-size: 12px; color: var(--c-text-dim); display: flex; gap: 6px; }
.dot { opacity: 0.5; }
li.selected .stats { color: var(--primary-dim); }
.debug { font-size: 11px; color: #a16207; margin-top: 3px; font-family: ui-monospace, monospace; }

footer {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--c-border);
}
.action {
  flex: 1;
  padding: 8px;
  background: var(--c-input-bg);
  color: var(--c-text);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s;
}
.action:hover {
  background: rgba(225, 29, 72, 0.1);
  color: var(--primary-dim);
}

@media (max-width: 768px) {
  .selection { left: 16px; top: auto; bottom: 16px; width: calc(100vw - 32px); }
}
</style>
