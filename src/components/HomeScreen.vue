<template>
  <div class="home">
    <header class="home__header">
      <div class="home__titles">
        <h1 class="home__title">Converter</h1>
        <StatusLine/>
      </div>
      <button
          ref="editButton"
          class="icon-button"
          type="button"
          aria-label="Edit currencies"
          @click="emit('edit', false)"
      >
        <AppIcon name="pencil" :size="19"/>
      </button>
    </header>

    <div v-if="failure" class="notice notice--error" role="alert">
      <span>{{ failure }}</span>
      <button class="notice__action" type="button" :disabled="ratesStore.loading" @click="ratesStore.refresh()">
        {{ ratesStore.loading ? 'Retrying…' : 'Retry' }}
      </button>
    </div>
    <p v-else-if="showHint" class="notice">
      Showing example values for <strong>$1.00</strong> — start typing in any field.
    </p>

    <main class="home__list">
      <AmountCard
          v-for="(row, index) in converter.rows"
          :key="row.info.code"
          :ref="(card) => setProbe(card, index)"
          :info="row.info"
          :value="row.value"
          :placeholder="row.placeholder"
          :unavailable="row.unavailable"
          :is-source="row.isSource"
          :font-size="fontSize"
          @input="(canonical) => converter.setInput(row.info.code, canonical)"
          @clear="converter.clear()"
      />
      <p v-if="converter.rows.length === 0" class="home__empty">
        No currencies yet. Add the ones you use.
      </p>
    </main>

    <footer class="home__footer">
      <button ref="addButton" class="outline-button" type="button" @click="emit('edit', true)">
        <AppIcon name="plus" :size="18" :stroke-width="2.2"/>
        Add currency
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import {computed, ref, shallowRef} from 'vue'
import AmountCard from './AmountCard.vue'
import AppIcon from './AppIcon.vue'
import StatusLine from './StatusLine.vue'
import {useConverterStore} from '@/stores/converter'
import {useRatesStore} from '@/stores/rates'
import {useFitFontSize} from '@/composables/useFitFontSize'
import type {RatesError} from '@/services/ratesApi'

const emit = defineEmits<{edit: [adding: boolean]}>()

const converter = useConverterStore()
const ratesStore = useRatesStore()

const editButton = ref<HTMLButtonElement | null>(null)
const addButton = ref<HTMLButtonElement | null>(null)
defineExpose({editButton, addButton})

const probe = shallowRef<HTMLInputElement | null>(null)

function setProbe(card: unknown, index: number) {
  if (index !== 0) return
  probe.value = (card as {input?: HTMLInputElement | null} | null)?.input ?? null
}

const texts = computed(() => converter.rows.map((row) => row.value || row.placeholder))
const fontSize = useFitFontSize(texts, probe)

const showHint = computed(() => converter.isEmpty && ratesStore.rates !== null && converter.rows.length > 0)

const REASONS: Record<RatesError['kind'], string> = {
  offline: "You're offline. Connect to the internet to load exchange rates.",
  network: "Can't reach the rates server. Check your connection.",
  timeout: "The rates server didn't respond in time.",
  http: 'The rates server returned an error.',
  format: "The rates server sent data the app can't read.",
}

// Only when there is nothing cached: with old rates the status line carries the problem.
const failure = computed(() => {
  const error = ratesStore.error
  if (ratesStore.rates !== null || !error) return null
  return error.kind === 'http' && error.status ? `${REASONS.http} (HTTP ${error.status})` : REASONS[error.kind]
})
</script>

<style scoped lang="scss">
.home {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.home__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 22px 16px;
}

.home__titles {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.home__title {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--c-text);
}

.notice {
  margin: 0 20px 12px;
  padding: 9px 12px;
  border-radius: 10px;
  background: var(--c-subtle-bg);
  font-size: 12px;
  line-height: 1.4;
  color: var(--c-text-faint);

  strong {
    color: var(--c-text-secondary);
    font-weight: 600;
  }

  &--error {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--c-danger-bg);
    color: var(--c-danger-text);
  }
}

.notice__action {
  flex: none;
  margin-left: auto;
  padding: 6px 12px;
  border: 0;
  border-radius: 8px;
  background: var(--c-danger-text);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
}

.home__list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 18px;
}

.home__empty {
  margin: 24px 4px;
  text-align: center;
  font-size: 14px;
  color: var(--c-text-faint);
}

.home__footer {
  position: sticky;
  bottom: 0;
  padding: 12px 18px calc(26px + env(safe-area-inset-bottom));
  background: linear-gradient(to bottom, transparent, var(--c-surface) 12px);
}
</style>
