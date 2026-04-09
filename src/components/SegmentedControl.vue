<script setup>
defineProps({
  modelValue: { required: true },
  options: { type: Array, required: true }, // [{ value, label }]
})
defineEmits(['update:modelValue'])
</script>

<template>
  <div class="flex bg-muted border border-border rounded-lg p-[3px] gap-[2px]">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      :class="[
        'flex-1 px-3 py-2 rounded-md text-[13px] transition-all duration-150 ease-out whitespace-nowrap',
        modelValue === opt.value
          ? 'font-semibold text-primary bg-card shadow-[var(--shadow-card)]'
          : 'font-medium text-muted-foreground hover:text-foreground',
      ]"
      @click="$emit('update:modelValue', opt.value)"
      v-html="opt.label"
    />
  </div>
</template>
