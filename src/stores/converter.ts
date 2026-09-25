import {defineStore} from 'pinia'
import {computed, ref, watch} from 'vue'
import {CURRENCY_CODE, currencyInfo, DEFAULT_SELECTION, type CurrencyInfo} from '@/domain/currencies'
import {convert} from '@/domain/rates'
import {formatAmount, groupDigits, parseCanonical} from '@/domain/amount'
import {moveItem} from '@/domain/reorder'
import {readJson, STORAGE_KEYS, writeJson} from '@/services/storage'
import {useRatesStore} from './rates'

export const MAX_SELECTED = 50
export const EXAMPLE_AMOUNT = 1
export const EXAMPLE_CODE = 'USD'

export interface Row {
    info: CurrencyInfo
    /** Text in the field: the user's input for the source row, a conversion for the rest. */
    value: string
    /** Grey hint when the field is empty: the 1 USD equivalent. */
    placeholder: string
    /** Rates cannot produce a number for this row right now. */
    unavailable: boolean
    isSource: boolean
}

export function reviveSelection(value: unknown): string[] | null {
    if (!Array.isArray(value) || value.length > MAX_SELECTED) return null
    if (!value.every((code) => typeof code === 'string' && CURRENCY_CODE.test(code))) return null
    if (new Set(value).size !== value.length) return null
    return value as string[]
}

export const useConverterStore = defineStore('converter', () => {
    const ratesStore = useRatesStore()

    const selection = ref<string[]>(readJson(STORAGE_KEYS.selection, reviveSelection) ?? [...DEFAULT_SELECTION])
    /** The field the user last typed in, holds canonical input ("1234.5"). */
    const source = ref<{code: string; input: string} | null>(null)

    watch(selection, (codes) => writeJson(STORAGE_KEYS.selection, codes), {deep: true})

    const sourceAmount = computed(() => (source.value ? parseCanonical(source.value.input) : null))
    const isEmpty = computed(() => sourceAmount.value === null)

    const rows = computed<Row[]>(() => {
        const rates = ratesStore.rates
        return selection.value.map((code) => {
            const info = currencyInfo(code)
            const example = convert(EXAMPLE_AMOUNT, EXAMPLE_CODE, code, rates)
            const placeholder = example === null ? '' : formatAmount(example)
            const isSource = source.value?.code === code
            // Only a currency missing from loaded rates is marked; no rates at all is the
            // error notice's job, and a source without a rate blanks the others silently.
            const unavailable = rates !== null && !(code in rates)

            if (isSource) {
                return {info, value: groupDigits(source.value!.input), placeholder, unavailable, isSource}
            }
            if (sourceAmount.value === null) {
                return {info, value: '', placeholder, unavailable, isSource}
            }
            const converted = convert(sourceAmount.value, source.value!.code, code, rates)
            return {
                info,
                value: converted === null ? '' : formatAmount(converted),
                placeholder: converted === null ? '—' : '',
                unavailable,
                isSource,
            }
        })
    })

    function setInput(code: string, canonical: string) {
        source.value = canonical === '' ? null : {code, input: canonical}
    }

    function clear() {
        source.value = null
    }

    function add(code: string) {
        if (!CURRENCY_CODE.test(code) || selection.value.includes(code)) return
        if (selection.value.length >= MAX_SELECTED) return
        selection.value = [...selection.value, code]
    }

    function remove(code: string) {
        selection.value = selection.value.filter((c) => c !== code)
        if (source.value?.code === code) source.value = null
    }

    function move(from: number, to: number) {
        selection.value = moveItem(selection.value, from, to)
    }

    return {selection, source, rows, isEmpty, setInput, clear, add, remove, move}
})
