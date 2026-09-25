<template>
  <svg
      :width="size"
      :height="size"
      viewBox="0 0 24 24"
      :fill="filled ? 'currentColor' : 'none'"
      :stroke="filled ? 'none' : 'currentColor'"
      :stroke-width="strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
  >
    <template v-if="name === 'refresh'">
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8"/>
      <path d="M21 3v5h-5"/>
    </template>
    <template v-else-if="name === 'pencil'">
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
    </template>
    <path v-else-if="name === 'close'" d="M18 6 6 18M6 6l12 12"/>
    <path v-else-if="name === 'plus'" d="M5 12h14M12 5v14"/>
    <path v-else-if="name === 'minus'" d="M5 12h14"/>
    <path v-else-if="name === 'back'" d="m15 18-6-6 6-6"/>
    <template v-else-if="name === 'search'">
      <circle cx="11" cy="11" r="7"/>
      <path d="m21 21-4.3-4.3"/>
    </template>
    <template v-else-if="name === 'grip'">
      <circle cx="9" cy="6" r="1.6"/>
      <circle cx="15" cy="6" r="1.6"/>
      <circle cx="9" cy="12" r="1.6"/>
      <circle cx="15" cy="12" r="1.6"/>
      <circle cx="9" cy="18" r="1.6"/>
      <circle cx="15" cy="18" r="1.6"/>
    </template>
  </svg>
</template>

<script setup lang="ts">
export type IconName = 'refresh' | 'pencil' | 'close' | 'plus' | 'minus' | 'back' | 'search' | 'grip'

withDefaults(defineProps<{
  name: IconName
  size?: number
  strokeWidth?: number
  filled?: boolean
}>(), {size: 20, strokeWidth: 2, filled: false})
</script>
