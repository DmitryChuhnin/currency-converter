import {defineStore} from 'pinia'
import {computed, ref, shallowRef} from 'vue'
import {reviveSnapshot, type RatesSnapshot} from '@/domain/rates'
import {isStale} from '@/domain/time'
import {fetchRates, RatesError} from '@/services/ratesApi'
import {readJson, STORAGE_KEYS, writeJson} from '@/services/storage'

const navigatorOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine)

export const useRatesStore = defineStore('rates', () => {
    // The last good payload survives restarts, so the converter works offline.
    const snapshot = shallowRef<RatesSnapshot | null>(readJson(STORAGE_KEYS.rates, reviveSnapshot))
    const error = shallowRef<RatesError | null>(null)
    const loading = ref(false)
    const online = ref(navigatorOnline())
    const now = ref(Date.now())

    let inFlight: Promise<void> | null = null

    const rates = computed(() => snapshot.value?.rates ?? null)
    /** Provider time when known, otherwise when we fetched. */
    const ratesTime = computed(() => snapshot.value ? (snapshot.value.providerTime ?? snapshot.value.fetchedAt) : null)
    const stale = computed(() => ratesTime.value !== null && isStale(ratesTime.value, now.value))
    const codes = computed(() => (rates.value ? Object.keys(rates.value) : []))

    /** One request at a time: a second tap while loading joins the first. */
    function refresh(): Promise<void> {
        if (inFlight) return inFlight
        // The online event can be missed while a PWA is suspended; the flag is current.
        if (!online.value && navigatorOnline()) online.value = true
        if (!online.value) {
            error.value = new RatesError('offline', 'Browser reports no network')
            return Promise.resolve()
        }
        loading.value = true
        inFlight = fetchRates()
            .then((next) => {
                snapshot.value = next
                error.value = null
                writeJson(STORAGE_KEYS.rates, next)
            })
            .catch((err: unknown) => {
                error.value = err instanceof RatesError ? err : new RatesError('network', String(err))
            })
            .finally(() => {
                loading.value = false
                inFlight = null
                now.value = Date.now()
            })
        return inFlight
    }

    function setOnline(value: boolean) {
        online.value = value
        // A request started on the dying connection may still fail; try once more then.
        if (value) return inFlight ? inFlight.then(() => (error.value ? refresh() : undefined)) : refresh()
        if (!loading.value) error.value = new RatesError('offline', 'Browser reports no network')
    }

    function tick(time = Date.now()) {
        now.value = time
    }

    return {snapshot, rates, codes, ratesTime, stale, error, loading, online, now, refresh, setOnline, tick}
})
