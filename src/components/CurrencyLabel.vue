<template>
  <span class="currency-label">
    <span class="currency-label__flag" aria-hidden="true">{{ info.flag }}</span>
    <span class="currency-label__name">{{ info.name }}</span>
    <span class="currency-label__code">{{ info.code }}</span>
    <span v-if="info.symbol" class="currency-label__symbol" aria-hidden="true">{{ info.symbol }}</span>
  </span>
</template>

<script setup lang="ts">
import type {CurrencyInfo} from '@/domain/currencies'

defineProps<{info: CurrencyInfo}>()
</script>

<style scoped lang="scss">
.currency-label {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 11px;
}

.currency-label__flag {
  flex: none;
  font-size: 20px;
  line-height: 1;
  align-self: center;
}

.currency-label__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  color: var(--c-text);
}

.currency-label__code {
  flex: none;
  font-size: 13px;
  font-weight: 600;
  color: var(--c-text-faint);
}

.currency-label__symbol {
  flex: none;
  margin-left: 2px;
  font-size: 15px;
  font-weight: 600;
  color: var(--c-text-muted);
  white-space: nowrap;
}
</style>
