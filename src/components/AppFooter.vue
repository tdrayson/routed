<script setup>
import Icon from './Icon.vue'
</script>

<template>
  <footer class="flex items-center justify-between gap-4">
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
      <Icon name="github" :size="14" />
    </a>
  </footer>
</template>
