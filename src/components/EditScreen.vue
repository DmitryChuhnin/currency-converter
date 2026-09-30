<template>
  <div class="edit">
    <header class="edit__header">
      <button class="edit__nav edit__nav--back" type="button" @click="emit('close')">
        <AppIcon name="back" :stroke-width="2.2"/>
        Back
      </button>
      <h1 ref="heading" class="edit__title" tabindex="-1">Edit currencies</h1>
      <button class="edit__nav edit__nav--done" type="button" @click="emit('close')">Done</button>
    </header>

    <section class="edit__section" aria-labelledby="selected-label">
      <h2 id="selected-label" class="edit__label">Your currencies · drag to reorder</h2>
      <p v-if="selected.length === 0" class="edit__empty">No currencies yet. Add some below.</p>
      <ul ref="list" class="edit__list">
        <li
            v-for="(info, index) in selected"
            :key="info.code"
            class="edit-row edit-row--selected"
            :class="{'edit-row--dragging': dragging === index, 'edit-row--settling': dragging !== null && dragging !== index}"
            :style="shiftStyle(index)"
            :data-code="info.code"
        >
          <button
              class="edit-row__handle"
              type="button"
              :aria-label="`Reorder ${info.name}. Use arrow keys to move.`"
              @pointerdown="(event) => start(event, index)"
              @keydown.up.prevent="moveBy(index, -1)"
              @keydown.down.prevent="moveBy(index, 1)"
          >
            <AppIcon name="grip" :size="15" filled/>
          </button>
          <CurrencyLabel :info="info"/>
          <button
              class="round-button round-button--remove"
              type="button"
              :aria-label="`Remove ${info.name}`"
              @click="remove(info.code, index)"
          >
            <AppIcon name="minus" :size="14" :stroke-width="3"/>
          </button>
        </li>
      </ul>
    </section>

    <section class="edit__section" aria-labelledby="available-label">
      <h2 id="available-label" class="edit__label edit__label--available">Available</h2>
      <label class="search">
        <AppIcon name="search" :size="17" class="search__icon"/>
        <span class="visually-hidden">Search currencies</span>
        <input
            ref="searchInput"
            v-model="query"
            class="search__input"
            type="search"
            :placeholder="`Search ${roundedCount}+ currencies`"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            enterkeyhint="search"
        />
        <button v-if="query" class="search__clear" type="button" aria-label="Clear search" @click="clearSearch">
          <AppIcon name="close" :size="11" :stroke-width="2.6"/>
        </button>
      </label>

      <p v-if="full" class="edit__empty">You can keep up to {{ MAX_SELECTED }} currencies.</p>
      <p v-if="available.length === 0" class="edit__empty">No currencies match “{{ query.trim() }}”.</p>
      <ul class="edit__list">
        <li v-for="info in available" :key="info.code" class="edit-row edit-row--available" :data-code="info.code">
          <CurrencyLabel :info="info"/>
          <button
              class="round-button round-button--add"
              type="button"
              :disabled="full"
              :aria-label="`Add ${info.name}`"
              @click="add(info.code)"
          >
            <AppIcon name="plus" :size="14" :stroke-width="3"/>
          </button>
        </li>
      </ul>
    </section>

    <p class="visually-hidden" aria-live="polite">{{ announcement }}</p>
  </div>
</template>

<script setup lang="ts">
import {computed, nextTick, onMounted, ref} from 'vue'
import AppIcon from './AppIcon.vue'
import CurrencyLabel from './CurrencyLabel.vue'
import {useConverterStore, MAX_SELECTED} from '@/stores/converter'
import {useRatesStore} from '@/stores/rates'
import {CURRENCIES, currencyInfo, POPULAR, type CurrencyInfo} from '@/domain/currencies'
import {matchesQuery} from '@/domain/search'
import {useReorder} from '@/composables/useReorder'

const props = defineProps<{focusSearch: boolean}>()
const emit = defineEmits<{close: []}>()

const converter = useConverterStore()
const ratesStore = useRatesStore()

const heading = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const list = ref<HTMLElement | null>(null)
const query = ref('')
const announcement = ref('')

const selected = computed(() => converter.selection.map(currencyInfo))
const full = computed(() => converter.selection.length >= MAX_SELECTED)

// Known codes plus whatever the API returns that the table does not know yet.
const allCodes = computed(() => new Set([...CURRENCIES.keys(), ...ratesStore.codes]))
const roundedCount = computed(() => Math.floor(allCodes.value.size / 10) * 10)

const available = computed<CurrencyInfo[]>(() => {
  const picked = new Set(converter.selection)
  return [...allCodes.value]
      .filter((code) => !picked.has(code))
      .map(currencyInfo)
      .filter((info) => matchesQuery(info, query.value))
      .sort((a, b) => rank(a.code) - rank(b.code) || a.name.localeCompare(b.name, 'en'))
})

function rank(code: string): number {
  const index = POPULAR.indexOf(code)
  return index === -1 ? POPULAR.length : index
}

const {dragging, start, shift} = useReorder(list, (from, to) => {
  converter.move(from, to)
  announce(from, to)
})

function shiftStyle(index: number) {
  const y = shift(index)
  return y ? {transform: `translateY(${y}px)`} : undefined
}

function announce(from: number, to: number) {
  const info = selected.value[to]
  if (info && from !== to) announcement.value = `${info.name} moved to position ${to + 1} of ${selected.value.length}`
}

// A drag holds indices from its start; changing the list under it moves the wrong row.
const dragActive = () => dragging.value !== null

async function moveBy(index: number, delta: number) {
  if (dragActive()) return
  const to = index + delta
  if (to < 0 || to >= converter.selection.length) return
  const code = converter.selection[index]
  converter.move(index, to)
  announce(index, to)
  await nextTick()
  list.value?.querySelector<HTMLElement>(`[data-code="${code}"] .edit-row__handle`)?.focus()
}

async function remove(code: string, index: number) {
  if (dragActive()) return
  const name = currencyInfo(code).name
  converter.remove(code)
  announcement.value = `${name} removed`
  await nextTick()
  // Keep keyboard focus in the list instead of dropping it to the page.
  const rows = list.value?.querySelectorAll<HTMLElement>('.round-button--remove')
  const next = rows?.[Math.min(index, rows.length - 1)]
  ;(next ?? searchInput.value)?.focus()
}

function add(code: string) {
  converter.add(code)
  announcement.value = `${currencyInfo(code).name} added`
}

function clearSearch() {
  query.value = ''
  searchInput.value?.focus()
}

onMounted(() => {
  if (props.focusSearch) searchInput.value?.focus()
  else heading.value?.focus({preventScroll: true})
})
</script>

<style scoped lang="scss">
.edit {
  padding: 0 18px calc(24px + env(safe-area-inset-bottom));
  animation: enter 0.18s ease-out;
}

@keyframes enter {
  from {
    opacity: 0;
    transform: translateX(12px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .edit {
    animation: none;
  }
}

.edit__header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 14px 2px 14px;
}

.edit__nav {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 4px;
  border: 0;
  background: transparent;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;

  &--back {
    justify-self: start;
    color: var(--c-text-secondary);
    margin-left: -6px;
  }

  &--done {
    justify-self: end;
    color: var(--c-text);
  }
}

.edit__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--c-text);

  &:focus {
    outline: none;
  }
}

.edit__label {
  margin: 0;
  padding: 10px 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--c-text-faint);

  &--available {
    padding-top: 20px;
  }
}

.edit__empty {
  margin: 4px 6px 12px;
  font-size: 14px;
  color: var(--c-text-faint);
}

.edit__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-row {
  display: flex;
  align-items: center;
  gap: 11px;
  min-height: 48px;
  padding: 11px 12px;
  border-radius: 12px;

  &--selected {
    background: var(--c-surface);
    box-shadow: inset 0 0 0 1px var(--c-border);
  }

  &--available {
    background: var(--c-subtle-bg);
  }

  &--settling {
    transition: transform 0.15s ease;
  }

  &--dragging {
    position: relative;
    z-index: 1;
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.14), inset 0 0 0 1px var(--c-border-strong);
    scale: 1.015;
  }
}

.edit-row__handle {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 36px;
  margin: -8px -8px -8px -10px;
  border: 0;
  background: transparent;
  color: var(--c-placeholder);
  cursor: grab;
  touch-action: none;

  .edit-row--dragging & {
    color: var(--c-text-faint);
    cursor: grabbing;
  }
}

.round-button {
  flex: none;
  position: relative;
  width: 26px;
  height: 26px;
  margin-left: auto;
  border: 0;
  border-radius: 50%;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  cursor: pointer;

  &::before {
    content: '';
    position: absolute;
    inset: -9px;
  }

  &--remove {
    background: var(--c-danger);
  }

  &--add {
    background: var(--c-text);
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;
  }
}

.search {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 42px;
  margin-bottom: 12px;
  padding: 0 12px;
  border-radius: 10px;
  box-shadow: inset 0 0 0 1px var(--c-border);

  &:focus-within {
    box-shadow: inset 0 0 0 2px var(--c-text);
  }
}

.search__icon {
  flex: none;
  color: var(--c-text-faint);
}

.search__input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  // 16px keeps iOS Safari from zooming in on focus
  font-size: 16px;

  &::placeholder {
    color: var(--c-text-faint);
  }

  &::-webkit-search-cancel-button {
    display: none;
  }
}

.search__clear {
  flex: none;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 50%;
  padding: 0;
  background: var(--c-muted-bg);
  color: var(--c-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
</style>
