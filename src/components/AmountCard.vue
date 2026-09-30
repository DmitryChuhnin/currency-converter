<template>
  <div
      class="amount-card"
      :class="{'amount-card--focused': focused}"
      :data-code="info.code"
      @click="onCardClick"
  >
    <span class="amount-card__flag" aria-hidden="true">{{ info.flag }}</span>
    <span class="amount-card__label">
      <span class="amount-card__code">{{ info.code }}</span>
      <span v-if="unavailable" :id="warningId" class="amount-card__warning">No rate</span>
    </span>
    <input
        ref="inputRef"
        class="amount-card__input"
        :class="{'amount-card__input--source': isSource}"
        :value="value"
        :placeholder="unavailable ? '—' : placeholder"
        :style="{fontSize: `${focused ? Math.max(fontSize, MIN_FOCUSED_FONT) : fontSize}px`}"
        :aria-label="`Amount in ${info.name}`"
        :aria-describedby="unavailable ? warningId : undefined"
        type="text"
        inputmode="decimal"
        enterkeyhint="done"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
        @beforeinput="onBeforeInput"
        @input="onInput"
        @compositionend="onCompositionEnd"
        @focus="onFocus"
        @mousedown="onMouseDown"
        @mouseup="onMouseUp"
        @blur="focused = false"
        @keydown.enter="inputRef?.blur()"
    />
    <button
        v-if="value"
        class="amount-card__clear"
        type="button"
        aria-label="Clear all amounts"
        @pointerdown.prevent
        @click="onClear"
    >
      <AppIcon name="close" :size="11" :stroke-width="2.6"/>
    </button>
  </div>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue'
import AppIcon from './AppIcon.vue'
import type {CurrencyInfo} from '@/domain/currencies'
import {caretAfterNormalize, groupDigits, normalizeInput, readPasted} from '@/domain/amount'

// iOS Safari zooms the page when a focused input's text is smaller than 16px.
const MIN_FOCUSED_FONT = 16
// Text arriving in one piece from elsewhere carries foreign grouping, see normalizeInput.
const PASTE_TYPES = new Set(['insertFromPaste', 'insertFromDrop', 'insertReplacementText', 'insertFromYank'])

const props = defineProps<{
  info: CurrencyInfo
  value: string
  placeholder: string
  unavailable: boolean
  isSource: boolean
  fontSize: number
}>()

const emit = defineEmits<{
  input: [canonical: string]
  clear: []
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const focused = ref(false)
const warningId = computed(() => `no-rate-${props.info.code}`)

defineExpose({input: inputRef})

let selectedOnFocus = false
// The field around the selection right before an insertion: tells the inserted text apart.
let pending: {inputType: string; before: string; after: string} | null = null

function onCardClick(event: MouseEvent) {
  // A tap anywhere on the card edits its amount, as on the mockup. Focus happens in a
  // click handler because iOS opens the keyboard only for focus inside a user gesture.
  if (event.target === inputRef.value || (event.target as Element).closest('button')) return
  inputRef.value?.focus()
}

function onFocus() {
  focused.value = true
  // A converted value is replaced by typing rather than appended to.
  selectedOnFocus = !props.isSource && props.value !== ''
  if (selectedOnFocus) inputRef.value?.select()
}

function onMouseDown() {
  // Focus by keyboard or by a tap on the card leaves the flag set; a press in a field
  // that already has focus is not the focusing click.
  if (document.activeElement === inputRef.value) selectedOnFocus = false
}

function onMouseUp(event: MouseEvent) {
  // The mouseup of the focusing click would collapse the selection to a caret.
  if (selectedOnFocus) event.preventDefault()
  selectedOnFocus = false
}

function onBeforeInput(event: Event) {
  const input = event.target as HTMLInputElement
  const start = input.selectionStart ?? input.value.length
  const end = input.selectionEnd ?? start
  pending = {inputType: (event as InputEvent).inputType, before: input.value.slice(0, start), after: input.value.slice(end)}
}

function takeInsertion(raw: string, inputType: string) {
  const snapshot = pending
  pending = null
  if (!snapshot || snapshot.inputType !== inputType) return null
  const {before, after} = snapshot
  if (raw.length < before.length + after.length || !raw.startsWith(before) || !raw.endsWith(after)) return null
  return {before, text: raw.slice(before.length, raw.length - after.length), after}
}

function onInput(event: Event) {
  const {inputType, isComposing} = event as InputEvent
  // Rewriting the value mid-composition breaks CJK IMEs; compositionend takes over.
  if (isComposing) return
  apply(event.target as HTMLInputElement, inputType ?? '')
}

function onCompositionEnd(event: CompositionEvent) {
  apply(event.target as HTMLInputElement, 'insertText')
}

function apply(input: HTMLInputElement, inputType: string) {
  const paste = PASTE_TYPES.has(inputType)
  const previous = props.value.replace(/ /g, '')
  let raw = input.value
  let at = input.selectionStart ?? raw.length
  const insertion = paste || inputType === 'insertText' ? takeInsertion(raw, inputType) : null

  // Deleting only a group space would be undone by regrouping and Delete would stall,
  // so the digit next to the space goes instead.
  if (raw.replace(/ /g, '') === previous) {
    if (inputType === 'deleteContentForward') {
      raw = raw.slice(0, at) + raw.slice(at + 1)
    } else if (inputType === 'deleteContentBackward' && at > 0) {
      raw = raw.slice(0, at - 1) + raw.slice(at)
      at -= 1
    }
  }
  let beforeCaret = raw.slice(0, at)
  let canonical: string
  if (insertion) {
    // Foreign grouping is read in the pasted text only, the rest of the field is ours.
    const text = paste ? readPasted(insertion.text) : insertion.text
    canonical = normalizeInput(insertion.before + text + insertion.after, previous)
    // A rejected insertion leaves the caret where it was.
    beforeCaret = canonical === previous ? insertion.before : insertion.before + text
  } else {
    canonical = normalizeInput(raw, previous, paste)
  }
  const formatted = groupDigits(canonical)

  // The parent may not re-render when the canonical value did not change (a rejected
  // keystroke), so the DOM is corrected here rather than waiting for props.
  if (input.value !== formatted) {
    input.value = formatted
    const caret = paste && !insertion ? formatted.length : caretAfterNormalize(beforeCaret, formatted)
    input.setSelectionRange(caret, caret)
  }
  // A rejected keystroke in a converted field must not make that field the source.
  if (canonical === previous && !props.isSource) return
  emit('input', canonical)
}

function onClear() {
  emit('clear')
  inputRef.value?.focus()
}
</script>

<style scoped lang="scss">
.amount-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 14px 16px 16px;
  border-radius: 16px;
  background: var(--c-surface);
  box-shadow: inset 0 0 0 1px var(--c-border);
  cursor: text;
  transition: box-shadow 0.12s;

  &--focused {
    box-shadow: inset 0 0 0 2px var(--c-text);
  }
}

.amount-card__flag {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--c-muted-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  line-height: 1;
}

.amount-card__label {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.amount-card__code {
  font-size: 15px;
  font-weight: 700;
  color: var(--c-text);
}

.amount-card__warning {
  font-size: 11px;
  font-weight: 600;
  color: var(--c-warning);
}

.amount-card__input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  text-align: right;
  font: inherit;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--c-text-secondary);
  caret-color: var(--c-text);

  &--source,
  &:focus {
    color: var(--c-text);
  }

  &::placeholder {
    color: var(--c-placeholder);
    opacity: 1;
  }
}

.amount-card__clear {
  flex: none;
  position: relative;
  width: 22px;
  height: 22px;
  margin-left: -6px;
  border: 0;
  border-radius: 50%;
  padding: 0;
  background: var(--c-muted-bg);
  color: var(--c-text-faint);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  // 22px is the mockup size; the invisible ring makes a 38px tap target.
  &::before {
    content: '';
    position: absolute;
    inset: -8px;
  }

  .amount-card--focused & {
    color: var(--c-text-muted);
  }

  &:hover {
    background: var(--c-border);
  }
}
</style>
