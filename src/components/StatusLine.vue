<template>
  <span class="status-line">
    <button
        class="status"
        :class="{'status--warn': tone === 'warn', 'status--loading': ratesStore.loading}"
        type="button"
        :disabled="ratesStore.loading"
        @click="ratesStore.refresh()"
    >
      <AppIcon class="status__icon" name="refresh" :size="11" :stroke-width="2.4"/>
      <span class="status__text">{{ text }}</span>
      <span class="visually-hidden"> · Refresh rates</span>
    </button>
    <!-- A button's content is presentational to ARIA, so the live region sits beside it. -->
    <span class="visually-hidden" role="status">{{ text }}</span>
  </span>
</template>

<script setup lang="ts">
import {computed} from 'vue'
import AppIcon from './AppIcon.vue'
import {useRatesStore} from '@/stores/rates'
import {formatChecked, formatUpdated} from '@/domain/time'

const ratesStore = useRatesStore()

const when = computed(() => (ratesStore.ratesTime === null ? '' : formatUpdated(ratesStore.ratesTime, ratesStore.now)))
// The provider time stays the same all day, so a manual refresh shows up only here.
const checked = computed(() => (ratesStore.snapshot ? formatChecked(ratesStore.snapshot.fetchedAt, ratesStore.now) : ''))

const text = computed(() => {
  const {loading, error, ratesTime, online, stale} = ratesStore
  if (ratesTime === null) return loading ? 'Loading rates…' : 'No rates yet'
  if (loading) return 'Updating…'
  if (!online || error?.kind === 'offline') return `Offline · rates from ${when.value}`
  if (error) return `Couldn't update · rates from ${when.value}`
  // Said in words, not only by colour.
  if (stale) return `Outdated · rates from ${when.value}`
  return `Rates ${when.value} · checked ${checked.value}`
})

const tone = computed(() => {
  const {error, ratesTime, stale, loading} = ratesStore
  if (ratesTime === null || loading) return 'normal'
  return error || stale || !ratesStore.online ? 'warn' : 'normal'
})
</script>

<style scoped lang="scss">
.status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin: 0 -6px;
  padding: 3px 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  font: inherit;
  font-size: 12px;
  color: var(--c-text-faint);
  cursor: pointer;
  text-align: left;

  &:hover:not(:disabled) {
    background: var(--c-muted-bg);
  }

  &:disabled {
    cursor: default;
  }

  &--warn {
    color: var(--c-warning);
  }
}

.status__icon {
  flex: none;
}

.status--loading .status__icon {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .status--loading .status__icon {
    animation: none;
  }
}
</style>
