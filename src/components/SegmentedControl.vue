<script setup>
import { ref } from 'vue'

const props = defineProps({
  modelValue: { required: true },
  options: { type: Array, required: true }, // [{ value, label }]
  label: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const buttons = ref([])

function onKey(e, idx) {
  const last = props.options.length - 1
  let next = idx
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = idx === last ? 0 : idx + 1
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = idx === 0 ? last : idx - 1
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = last
  else return
  e.preventDefault()
  emit('update:modelValue', props.options[next].value)
  buttons.value[next]?.focus()
}
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label || undefined"
    class="flex bg-muted border border-border rounded-lg p-[3px] gap-[2px]"
  >
    <button
      v-for="(opt, i) in options"
      :key="opt.value"
      ref="buttons"
      type="button"
      role="radio"
      :aria-checked="modelValue === opt.value"
      :tabindex="modelValue === opt.value ? 0 : -1"
      :class="[
        'flex-1 px-3 py-2 rounded-md text-[13px] transition-all duration-150 ease-out whitespace-nowrap',
        modelValue === opt.value
          ? 'font-semibold text-primary bg-card shadow-[var(--shadow-card)]'
          : 'font-medium text-muted-foreground hover:text-foreground',
      ]"
      @click="$emit('update:modelValue', opt.value)"
      @keydown="onKey($event, i)"
      v-html="opt.label"
    />
  </div>
</template>
