import {defineStore} from 'pinia'
import {computed, ref} from 'vue'
import type {CurrencyCode, CurrencyRates, CurrencyValues} from '@/types/currency'
import {CurrencyService} from '@/services/currencyService'
import {formatNumber, parseNumber} from '@/utils/formatters'

export const useCurrencyStore = defineStore('currency', () => {
    // State
    const rates = ref<CurrencyRates>({
        USD: 1,
        RUB: 98.5,
        VND: 25350,
        THB: 35.8,
        KRW: 1350
    })

    const values = ref<CurrencyValues>({
        USD: '',
        RUB: '',
        VND: '',
        THB: '',
        KRW: ''
    })

    const placeholders = ref<CurrencyValues>({
        USD: '1.00',
        RUB: '85.00',
        VND: '26500.00',
        THB: '33.00',
        KRW: '1300.00'
    })

    const activeCurrency = ref<CurrencyCode | null>(null)
    const lastUpdate = ref<Date | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)
    const isOnline = ref(navigator.onLine)

    // Computed
    const formattedLastUpdate = computed(() => {
        if (!lastUpdate.value) return 'Never'
        return lastUpdate.value.toLocaleTimeString()
    })

    // Actions
    async function fetchRates() {
        if (!isOnline.value) {
            error.value = 'You are offline'
            return
        }

        loading.value = true
        error.value = null

        try {
            rates.value = await CurrencyService.fetchRates()
            lastUpdate.value = new Date()

            // Update placeholders with new rates
            updatePlaceholders()

            // Update values based on current active currency or default USD
            if (activeCurrency.value) {
                convertFrom(activeCurrency.value, values.value[activeCurrency.value])
            }
        } catch (err) {
            error.value = 'Failed to fetch exchange rates'
            console.error('Error fetching rates:', err)
        } finally {
            loading.value = false
        }
    }

    function updatePlaceholders() {
        placeholders.value = {
            USD: formatNumber(1 * rates.value.USD),
            RUB: formatNumber(1 * rates.value.RUB),
            VND: formatNumber(1 * rates.value.VND),
            THB: formatNumber(1 * rates.value.THB),
            KRW: formatNumber(1 * rates.value.KRW)
        }
    }

    function convertFrom(currency: CurrencyCode, value: string) {
        activeCurrency.value = currency

        if (!value || value === '') {
            // Clear all values
            values.value = {
                USD: '',
                RUB: '',
                VND: '',
                THB: '',
                KRW: ''
            }
            return
        }

        const numericValue = parseNumber(value)
        
        // If it's just a 0 or a decimal point prefix, don't format other values to 0.00 yet
        // to allow user to continue typing (e.g., "0.2")
        if (value === '0' || value === '0.' || value === '0.0' || value === '.') {
            const newValues: CurrencyValues = {
                USD: '',
                RUB: '',
                VND: '',
                THB: '',
                KRW: ''
            }
            newValues[currency] = value
            values.value = newValues
            return
        }

        if (numericValue === 0 && value !== '') {
            values.value = {
                USD: '0.00',
                RUB: '0.00',
                VND: '0.00',
                THB: '0.00',
                KRW: '0.00'
            }
            values.value[currency] = value
            return
        }

        // Convert to USD first
        const usdValue = numericValue / rates.value[currency]

        // Then convert to all currencies
        const newValues: CurrencyValues = {
            USD: formatNumber(usdValue * rates.value.USD),
            RUB: formatNumber(usdValue * rates.value.RUB),
            VND: formatNumber(usdValue * rates.value.VND),
            THB: formatNumber(usdValue * rates.value.THB),
            KRW: formatNumber(usdValue * rates.value.KRW)
        }

        // Keep the original input value for the active currency
        newValues[currency] = value

        values.value = newValues
    }

    function updateAllValues(baseCurrency: CurrencyCode, value: string) {
        convertFrom(baseCurrency, value)
    }

    function setOnlineStatus(status: boolean) {
        isOnline.value = status
        if (!status) {
            error.value = 'You are offline'
        } else {
            error.value = null
        }
    }

    return {
        // State
        rates,
        values,
        placeholders,
        activeCurrency,
        lastUpdate,
        loading,
        error,
        isOnline,

        // Computed
        formattedLastUpdate,

        // Actions
        fetchRates,
        convertFrom,
        updateAllValues,
        setOnlineStatus
    }
})
