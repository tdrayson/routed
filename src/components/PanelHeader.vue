<script setup>
defineProps({
  title: { type: String, required: true },
  tagline: { type: String, default: '' },
  compact: { type: Boolean, default: false },
})
</script>

<template>
  <div class="flex justify-between items-start gap-4">
    <div class="min-w-0">
      <h1
        :class="[
          'font-serif leading-[1] text-foreground',
          compact ? 'text-[36px] truncate' : 'text-[44px]',
        ]"
      >{{ title }}</h1>
      <p
        v-if="tagline"
        class="font-sans text-xs text-muted-foreground tracking-[0.04em] mt-1.5"
      >{{ tagline }}</p>
    </div>
    <slot name="action" />
  </div>
</template>
