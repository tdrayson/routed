import { onBeforeUnmount, onMounted } from 'vue'

// Calls `handler` when a click happens outside any element matching `selector`.
// Use a stable selector string (class) that uniquely identifies the root
// element(s) you want to consider "inside".
export function useOutsideClick(selector, handler) {
  function onDocClick(e) {
    if (!e.target.closest?.(selector)) handler(e)
  }
  onMounted(() => document.addEventListener('click', onDocClick))
  onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
}
