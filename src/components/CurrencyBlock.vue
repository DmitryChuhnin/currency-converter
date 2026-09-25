<template>
  <div class="currency-block">
    <div class="currency-header">
      <span class="currency-flag">{{ currency.flag }}</span>
      <span class="currency-code">{{ currency.code }}</span>
    </div>
    <div class="input-wrapper">
      <input
          ref="inputRef"
          :value="displayValue"
          @input="handleInput"
          @focus="handleFocus"
          type="text"
          inputmode="decimal"
          class="currency-input"
          :placeholder="placeholderValue"
          :disabled="!isOnline"
      />
      <button
          v-if="modelValue"
          @click="clearInput"
          class="clear-btn"
          type="button"
          aria-label="Clear input"
      >
        ✕
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue'
import type {Currency} from '@/types/currency'
import {validateInput, formatWithSpaces, removeSpaces} from '@/utils/formatters'

interface Props {
  currency: Currency
  modelValue: string
  isOnline: boolean
  placeholderValue?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholderValue: '0.00'
})
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'focus': []
}>()

const inputRef = ref<HTMLInputElement | null>(null)

const displayValue = computed(() => {
  return formatWithSpaces(props.modelValue)
})

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  const cursorPosition = target.selectionStart || 0
  const oldValue = target.value

  // Remove spaces and validate
  const cleanValue = removeSpaces(target.value).replace(',', '.')
  const validated = validateInput(cleanValue)

  // Emit the clean value
  emit('update:modelValue', validated)

  const digitsBeforeCursor = removeSpaces(oldValue.substring(0, cursorPosition)).length
  setTimeout(() => {
    if (inputRef.value) {
      const newFormattedValue = formatWithSpaces(validated)
      let newPosition = 0
      let digitCount = 0

      // Find position after the same number of digits
      for (let i = 0; i < newFormattedValue.length; i++) {
        if (newFormattedValue[i] !== ' ') {
          digitCount++
        }
        if (digitCount >= digitsBeforeCursor) {
          newPosition = i + 1
          break
        }
      }

      inputRef.value.setSelectionRange(newPosition, newPosition)
    }
  }, 0)
}

function handleFocus() {
  emit('focus')
}

function clearInput() {
  emit('update:modelValue', '')
}
</script>

<style scoped lang="scss">
.currency-block {
  background: #f5f5f5;
  border-radius: 16px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: background-color 0.2s;

  &:hover {
    background: #eeeeee;
  }
}

.currency-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.currency-flag {
  font-size: 24px;
}

.currency-code {
  font-weight: 600;
  font-size: 14px;
  color: #333;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.currency-input {
  width: 100%;
  padding: 12px;
  padding-right: 36px;
  font-size: 18px;
  border: 2px solid #ddd;
  border-radius: 8px;
  background: white;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #4CAF50;
  }

  &:disabled {
    background: #f0f0f0;
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.clear-btn {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  font-size: 20px;
  color: #999;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  transition: all 0.2s;

  &:hover {
    background: #e0e0e0;
    color: #666;
  }

  &:active {
    transform: scale(0.95);
  }
}
</style>