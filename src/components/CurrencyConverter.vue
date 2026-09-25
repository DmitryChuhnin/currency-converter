<template>
  <div class="converter-container">
    <div class="converter-header">
      <h1>💱 Currency Converter</h1>
      <div class="header-info">
        <span v-if="loading" class="loader">⏳ Loading...</span>
        <span v-else class="last-update">Updated: {{ formattedLastUpdate }}</span>
        <button 
          @click="fetchRates" 
          class="refresh-btn"
          :disabled="loading || !isOnline"
          title="Refresh rates"
        >
          🔄
        </button>
      </div>
    </div>
    
    <div v-if="!isOnline" class="offline-notice">
      ⚠️ You are offline. Please check your internet connection.
    </div>
    
    <div v-if="error && isOnline" class="error-notice">
      ⚠️ {{ error }}
    </div>

    <div class="currency-grid">
      <CurrencyBlock
          v-for="curr in currencies"
          :key="curr.code"
          :currency="curr"
          :model-value="values[curr.code]"
          :placeholder-value="placeholders[curr.code]"
          :is-online="isOnline"
          @update:model-value="(value) => handleValueChange(curr.code, value)"
          @focus="activeCurrency = curr.code"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import CurrencyBlock from './CurrencyBlock.vue'
import { useCurrencyStore } from '@/stores/currency'
import type { Currency, CurrencyCode } from '@/types/currency'

const currencies: Currency[] = [
  { code: 'USD', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'RUB', name: 'Russian Ruble', flag: '🇷🇺' },
  { code: 'VND', name: 'Vietnamese Dong', flag: '🇻🇳' },
  { code: 'THB', name: 'Thai Baht', flag: '🇹🇭' },
  { code: 'KRW', name: 'South Korean Won', flag: '🇰🇷' }
]

const store = useCurrencyStore()
const { 
  values,
  placeholders,
  activeCurrency, 
  loading, 
  error, 
  isOnline, 
  formattedLastUpdate 
} = storeToRefs(store)

const { fetchRates, convertFrom, setOnlineStatus } = store

function handleValueChange(currency: CurrencyCode, value: string) {
  convertFrom(currency, value)
}

function handleOnlineStatus() {
  setOnlineStatus(navigator.onLine)
  if (navigator.onLine && !loading.value) {
    fetchRates()
  }
}

onMounted(() => {
  // Fetch rates on mount
  fetchRates()
  
  // Listen for online/offline events
  window.addEventListener('online', handleOnlineStatus)
  window.addEventListener('offline', handleOnlineStatus)
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnlineStatus)
  window.removeEventListener('offline', handleOnlineStatus)
})
</script>

<style scoped lang="scss">
.converter-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 18px;
}

.converter-header {
  margin-bottom: 24px;
  
  h1 {
    font-size: 28px;
    margin: 0 0 4px 0;
    color: #333;
    text-align: center;
  }
}

.header-info {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #666;
}

.loader {
  color: #4CAF50;
  font-weight: 500;
}

.last-update {
  opacity: 0.7;
}

.refresh-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
  
  &:hover:not(:disabled) {
    background: #f0f0f0;
    transform: rotate(180deg);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.offline-notice,
.error-notice {
  background: #fff3cd;
  border: 1px solid #ffc107;
  color: #856404;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 20px;
  text-align: center;
  font-size: 14px;
}

.error-notice {
  background: #f8d7da;
  border-color: #dc3545;
  color: #721c24;
}

.currency-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
}
</style>
