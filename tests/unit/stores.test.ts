import {beforeEach, describe, expect, it, vi} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import {nextTick} from 'vue'
import {STORAGE_KEYS} from '@/services/storage'
import {DEFAULT_SELECTION} from '@/domain/currencies'

const ratesApi = vi.hoisted(() => ({fetchRates: vi.fn()}))
vi.mock('@/services/ratesApi', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/services/ratesApi')>()
    return {...actual, fetchRates: ratesApi.fetchRates}
})

import {RatesError} from '@/services/ratesApi'
import {useRatesStore} from '@/stores/rates'
import {reviveSelection, useConverterStore} from '@/stores/converter'

const snapshot = {rates: {USD: 1, RUB: 80, VND: 26000, THB: 32, KRW: 1400}, providerTime: 1000, fetchedAt: 2000}

function deferred<T>() {
    let resolve!: (v: T) => void
    let reject!: (e: unknown) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return {promise, resolve, reject}
}

function setOnLine(value: boolean) {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
}

beforeEach(() => {
    localStorage.clear()
    ratesApi.fetchRates.mockReset()
    setActivePinia(createPinia())
})

describe('rates store', () => {
    it('starts from the cached snapshot', () => {
        localStorage.setItem(STORAGE_KEYS.rates, JSON.stringify(snapshot))
        const store = useRatesStore()
        expect(store.rates).toEqual(snapshot.rates)
        expect(store.ratesTime).toBe(1000)
    })

    it('ignores a corrupted cache', () => {
        localStorage.setItem(STORAGE_KEYS.rates, JSON.stringify({rates: {USD: 1, RUB: 0}, fetchedAt: 1, providerTime: null}))
        expect(useRatesStore().rates).toBeNull()
    })

    it('stores a fresh snapshot and clears the error', async () => {
        ratesApi.fetchRates.mockResolvedValue(snapshot)
        const store = useRatesStore()
        await store.refresh()
        expect(store.rates).toEqual(snapshot.rates)
        expect(store.error).toBeNull()
        expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.rates)!)).toEqual(snapshot)
    })

    it('keeps the old rates when a refresh fails', async () => {
        localStorage.setItem(STORAGE_KEYS.rates, JSON.stringify(snapshot))
        ratesApi.fetchRates.mockRejectedValue(new RatesError('http', 'HTTP 500', 500))
        const store = useRatesStore()
        await store.refresh()
        expect(store.rates).toEqual(snapshot.rates)
        expect(store.error?.kind).toBe('http')
        expect(store.loading).toBe(false)
    })

    it('wraps an unexpected exception instead of losing it', async () => {
        ratesApi.fetchRates.mockRejectedValue('boom')
        const store = useRatesStore()
        await store.refresh()
        expect(store.error).toBeInstanceOf(RatesError)
    })

    it('makes one request for a double tap', async () => {
        const pending = deferred<typeof snapshot>()
        ratesApi.fetchRates.mockReturnValue(pending.promise)
        const store = useRatesStore()
        const a = store.refresh()
        const b = store.refresh()
        expect(store.loading).toBe(true)
        pending.resolve(snapshot)
        await Promise.all([a, b])
        expect(ratesApi.fetchRates).toHaveBeenCalledTimes(1)
        await store.refresh()
        expect(ratesApi.fetchRates).toHaveBeenCalledTimes(2)
    })

    it('does not call the API offline and says so', async () => {
        setOnLine(false)
        const store = useRatesStore()
        await store.refresh()
        expect(ratesApi.fetchRates).not.toHaveBeenCalled()
        expect(store.error?.kind).toBe('offline')
    })

    it('refreshes when the network comes back', async () => {
        setOnLine(false)
        ratesApi.fetchRates.mockResolvedValue(snapshot)
        const store = useRatesStore()
        store.setOnline(false)
        expect(store.error?.kind).toBe('offline')
        await store.setOnline(true)
        expect(ratesApi.fetchRates).toHaveBeenCalledTimes(1)
        expect(store.error).toBeNull()
    })

    it('recovers when the online event was missed', async () => {
        setOnLine(false)
        ratesApi.fetchRates.mockResolvedValue(snapshot)
        const store = useRatesStore()
        await store.refresh()
        expect(store.error?.kind).toBe('offline')
        setOnLine(true) // no event, as after a suspended PWA resumes
        await store.refresh()
        expect(ratesApi.fetchRates).toHaveBeenCalledTimes(1)
        expect(store.error).toBeNull()
        expect(store.online).toBe(true)
    })

    it('retries when the network returns during a request that then fails', async () => {
        const pending = deferred<typeof snapshot>()
        ratesApi.fetchRates.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(snapshot)
        const store = useRatesStore()
        void store.refresh()
        const back = store.setOnline(true)
        pending.reject(new RatesError('network', 'reset'))
        await back
        expect(ratesApi.fetchRates).toHaveBeenCalledTimes(2)
        expect(store.error).toBeNull()
    })

    it('does not retry after the network returns if the pending request succeeds', async () => {
        const pending = deferred<typeof snapshot>()
        ratesApi.fetchRates.mockReturnValueOnce(pending.promise)
        const store = useRatesStore()
        void store.refresh()
        const back = store.setOnline(true)
        pending.resolve(snapshot)
        await back
        expect(ratesApi.fetchRates).toHaveBeenCalledTimes(1)
    })

    it('marks rates older than 48 hours as stale', () => {
        localStorage.setItem(STORAGE_KEYS.rates, JSON.stringify(snapshot))
        const store = useRatesStore()
        store.tick(1000 + 47 * 3600e3)
        expect(store.stale).toBe(false)
        store.tick(1000 + 49 * 3600e3)
        expect(store.stale).toBe(true)
    })
})

describe('converter store', () => {
    function withRates() {
        localStorage.setItem(STORAGE_KEYS.rates, JSON.stringify(snapshot))
        return useConverterStore()
    }

    const values = (store: ReturnType<typeof useConverterStore>) =>
        Object.fromEntries(store.rows.map((r) => [r.info.code, r.value]))

    it('uses the dev defaults on first run', () => {
        expect(useConverterStore().selection).toEqual([...DEFAULT_SELECTION])
    })

    it('shows 1 USD equivalents as placeholders when empty', () => {
        const store = withRates()
        expect(store.isEmpty).toBe(true)
        expect(store.rows.map((r) => r.placeholder)).toEqual(['1.00', '80.00', '26 000.00', '32.00', '1 400.00'])
        expect(store.rows.every((r) => r.value === '')).toBe(true)
    })

    it('converts from whichever field was typed in', () => {
        const store = withRates()
        store.setInput('RUB', '8000')
        expect(values(store)).toEqual({USD: '100.00', RUB: '8 000', VND: '2 600 000.00', THB: '3 200.00', KRW: '140 000.00'})
        store.setInput('USD', '1.5')
        expect(values(store).RUB).toBe('120.00')
        expect(store.rows.find((r) => r.isSource)?.info.code).toBe('USD')
    })

    it('shows zero for "0" and "0." instead of blanking the rest', () => {
        const store = withRates()
        store.setInput('USD', '0.')
        expect(values(store).RUB).toBe('0.00')
        expect(store.isEmpty).toBe(false)
    })

    it('goes back to the empty state on clear and on an empty input', () => {
        const store = withRates()
        store.setInput('USD', '5')
        store.clear()
        expect(store.isEmpty).toBe(true)
        store.setInput('USD', '5')
        store.setInput('USD', '')
        expect(store.isEmpty).toBe(true)
        expect(store.source).toBeNull()
    })

    it('shows no number at all when there are no rates', () => {
        const store = useConverterStore()
        expect(store.rows.every((r) => r.placeholder === '' && !r.unavailable)).toBe(true)
        store.setInput('USD', '100')
        for (const row of store.rows.filter((r) => !r.isSource)) {
            expect(row.value).toBe('')
            expect(row.placeholder).toBe('—')
            // The error notice explains a total absence; "No rate" is per currency.
            expect(row.unavailable).toBe(false)
        }
    })

    it('marks the source, not the others, when the source has no rate', () => {
        localStorage.setItem(STORAGE_KEYS.selection, JSON.stringify(['QQQ', 'USD', 'RUB']))
        const store = withRates()
        store.setInput('QQQ', '5')
        const byCode = Object.fromEntries(store.rows.map((r) => [r.info.code, r]))
        expect(byCode.QQQ.unavailable).toBe(true)
        expect(byCode.USD).toMatchObject({value: '', placeholder: '—', unavailable: false})
        expect(byCode.RUB).toMatchObject({value: '', placeholder: '—', unavailable: false})
    })

    it('marks only the currency the API dropped as unavailable', () => {
        localStorage.setItem(STORAGE_KEYS.rates, JSON.stringify({...snapshot, rates: {USD: 1, RUB: 80}}))
        const store = useConverterStore()
        store.setInput('USD', '10')
        const byCode = Object.fromEntries(store.rows.map((r) => [r.info.code, r]))
        expect(byCode.RUB.value).toBe('800.00')
        expect(byCode.VND.unavailable).toBe(true)
        expect(byCode.VND.value).toBe('')
    })

    it('recalculates when fresh rates arrive while the user has typed', async () => {
        ratesApi.fetchRates.mockResolvedValue({...snapshot, rates: {...snapshot.rates, RUB: 90}})
        const store = withRates()
        store.setInput('USD', '10')
        expect(values(store).RUB).toBe('800.00')
        await useRatesStore().refresh()
        expect(values(store).RUB).toBe('900.00')
        expect(values(store).USD).toBe('10')
    })

    it('adds, removes and reorders, and persists the selection', async () => {
        const store = withRates()
        store.add('EUR')
        store.add('EUR')
        store.add('nope')
        expect(store.selection).toEqual([...DEFAULT_SELECTION, 'EUR'])
        store.move(5, 0)
        store.remove('THB')
        expect(store.selection).toEqual(['EUR', 'USD', 'RUB', 'VND', 'KRW'])
        await nextTick()
        expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.selection)!)).toEqual(['EUR', 'USD', 'RUB', 'VND', 'KRW'])
    })

    it('drops the input when its currency is removed', () => {
        const store = withRates()
        store.setInput('RUB', '100')
        store.remove('RUB')
        expect(store.isEmpty).toBe(true)
    })

    it('allows removing everything', async () => {
        const store = withRates()
        for (const code of [...store.selection]) store.remove(code)
        expect(store.rows).toEqual([])
        await nextTick()
        setActivePinia(createPinia())
        expect(useConverterStore().selection).toEqual([])
    })

    it('restores a saved selection after restart', async () => {
        localStorage.setItem(STORAGE_KEYS.selection, JSON.stringify(['KRW', 'USD']))
        expect(useConverterStore().selection).toEqual(['KRW', 'USD'])
    })
})

describe('reviveSelection', () => {
    it.each([
        ['not an array', {USD: true}],
        ['numbers', [1, 2]],
        ['lower case', ['usd']],
        ['duplicates', ['USD', 'USD']],
        ['too many', Array.from({length: 51}, (_, i) => `A${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`)],
    ])('rejects %s', (_name, value) => {
        expect(reviveSelection(value)).toBeNull()
    })

    it('accepts an empty list', () => {
        expect(reviveSelection([])).toEqual([])
    })
})
