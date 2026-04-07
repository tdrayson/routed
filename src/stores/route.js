import { defineStore } from 'pinia'
import { generateRoutes, rankByCloseness } from '../composables/useRouteGenerator'
import { toMeters, formatDistance, formatDuration } from '../lib/units'
import {
  buildShareUrl,
  readHashRoute,
  clearHash,
  listSaved,
  addSaved,
  removeSaved,
  deserializeRoute,
} from '../lib/share'

export const useRouteStore = defineStore('route', {
  state: () => ({
    // Settings
    activity: 'walking', // walking | running | cycling
    tripType: 'loop', // loop | outback | oneway
    targetType: 'distance', // distance | time
    targetValue: 5, // value in selected unit (or minutes if time)
    unit: 'mi', // mi | km

    // Locations: [lon, lat] or null
    start: null,
    end: null,
    startLabel: '',
    endLabel: '',

    // Results
    candidates: [],
    selectedIndex: 0,
    loading: false,
    error: '',

    // 'start' | 'end' | null — when set, the next map click sets that location.
    pickMode: null,

    // Saved routes (loaded from localStorage on first access).
    savedRoutes: listSaved(),
    shareToast: '',
  }),

  getters: {
    targetMeters: (s) => (s.targetType === 'distance' ? toMeters(s.targetValue, s.unit) : null),
    targetSeconds: (s) => (s.targetType === 'time' ? s.targetValue * 60 : null),
    selected: (s) => s.candidates[s.selectedIndex] || null,
  },

  actions: {
    setStart(coords, label = '') {
      this.start = coords
      this.startLabel = label
    },
    setEnd(coords, label = '') {
      this.end = coords
      this.endLabel = label
    },
    swapLocations() {
      ;[this.start, this.end] = [this.end, this.start]
      ;[this.startLabel, this.endLabel] = [this.endLabel, this.startLabel]
    },
    selectCandidate(i) {
      this.selectedIndex = i
    },
    togglePickMode(target) {
      this.pickMode = this.pickMode === target ? null : target
    },
    clearResults() {
      this.candidates = []
      this.selectedIndex = 0
      this.error = ''
    },

    // ---------- Sharing & saving ----------

    // Replace the current candidate list with a single restored route from
    // a serialised payload (used for both shared URLs and saved-route loads).
    hydrateFromPayload(payload) {
      this.activity = payload.activity || this.activity
      this.tripType = payload.tripType || this.tripType
      this.unit = payload.unit || this.unit
      this.start = payload.start || null
      this.end = payload.end || null
      this.startLabel = payload.startLabel || ''
      this.endLabel = payload.endLabel || ''
      this.candidates = [
        {
          label: payload.label,
          geometry: payload.geometry,
          distance: payload.distance,
          duration: payload.duration,
          waypoints: [],
        },
      ]
      this.selectedIndex = 0
      this.error = ''
    },

    hydrateFromHash() {
      const payload = readHashRoute()
      if (!payload) return false
      this.hydrateFromPayload(payload)
      clearHash()
      return true
    },

    shareUrlFor(route) {
      return route ? buildShareUrl(route, this) : ''
    },

    // Build a sensible default save name: "5.00mi loop from <start>".
    suggestedName(route) {
      if (!route) return 'My route'
      const dist = formatDistance(route.distance, this.unit)
      const kind =
        this.tripType === 'loop'
          ? 'loop'
          : this.tripType === 'outback'
            ? 'out & back'
            : 'route'
      const where = this.startLabel ? ` from ${this.startLabel.split(',')[0]}` : ''
      return `${dist} ${kind}${where}`
    },

    async copyShareLink(route) {
      if (!route) return
      const url = buildShareUrl(route, this)
      try {
        await navigator.clipboard.writeText(url)
        this.flashToast('Link copied to clipboard')
      } catch {
        location.hash = url.split('#')[1] || ''
        this.flashToast('Link is in your address bar')
      }
    },

    saveRoute(route, name) {
      if (!route || !name) return
      const entry = addSaved(name.trim(), route, this)
      this.savedRoutes = [entry, ...this.savedRoutes.filter((e) => e.id !== entry.id)]
      this.flashToast('Route saved')
    },

    deleteSaved(id) {
      removeSaved(id)
      this.savedRoutes = this.savedRoutes.filter((e) => e.id !== id)
    },

    loadSaved(id) {
      const entry = this.savedRoutes.find((e) => e.id === id)
      if (!entry) return
      this.hydrateFromPayload(deserializeRoute(entry.data))
    },

    flashToast(msg) {
      this.shareToast = msg
      setTimeout(() => {
        if (this.shareToast === msg) this.shareToast = ''
      }, 2200)
    },
    async generate() {
      if (!this.start) {
        this.error = 'Pick a start location'
        return
      }
      if (this.tripType === 'oneway' && !this.end) {
        this.error = 'Pick an end location'
        return
      }
      if (!this.targetValue || this.targetValue <= 0) {
        this.error = 'Enter a target distance or time'
        return
      }

      this.loading = true
      this.error = ''
      this.candidates = []
      this.selectedIndex = 0

      try {
        const target = this.targetType === 'time' ? this.targetSeconds : this.targetMeters
        const routes = await generateRoutes({
          tripType: this.tripType,
          start: this.start,
          end: this.end,
          activity: this.activity,
          target,
          targetType: this.targetType,
        })
        if (!routes.length) throw new Error('No routes could be generated. Try a different target or location.')
        const ranked = rankByCloseness(routes, target, this.targetType)
        // Re-number labels after ranking so "1" is always the best match.
        this.candidates = ranked.map((r, i) => ({
          ...r,
          label: r.label.replace(/\s*\d+$/, '') + ' ' + (i + 1),
        }))
        this.selectedIndex = 0
      } catch (e) {
        this.error = e.message || 'Failed to generate routes'
      } finally {
        this.loading = false
      }
    },
  },
})
