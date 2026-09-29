import {defineStore} from 'pinia'
import {computed, ref, shallowRef} from 'vue'
import {reviveSnapshot, type RatesSnapshot} from '@/domain/rates'
import {isStale, REFRESH_AFTER_MS, retryDelay} from '@/domain/time'
import {fetchRates, RatesError} from '@/services/ratesApi'
import {readJson, STORAGE_KEYS, writeJson} from '@/services/storage'

// A timer can fire a few ms before Date.now() reaches its deadline; the slack keeps a
// retry on its tick instead of the next one.
const TIMER_SLACK_MS = 1000

const navigatorOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine)

export const useRatesStore = defineStore('rates', () => {
    // The last good payload survives restarts, so the converter works offline.
    const snapshot = shallowRef<RatesSnapshot | null>(readJson(STORAGE_KEYS.rates, reviveSnapshot))
    const error = shallowRef<RatesError | null>(null)
    const loading = ref(false)
    const online = ref(navigatorOnline())
    const now = ref(Date.now())

    let inFlight: Promise<void> | null = null
    // Failed requests in a row. Retries back off, so a 429 or a broken API is not hit
    // every minute.
    let failures = 0
    let lastAttemptAt = 0

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
        lastAttemptAt = Date.now()
        inFlight = fetchRates()
            .then((next) => {
                snapshot.value = next
                error.value = null
                failures = 0
                writeJson(STORAGE_KEYS.rates, next)
            })
            .catch((err: unknown) => {
                error.value = err instanceof RatesError ? err : new RatesError('network', String(err))
                failures++
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

    /** Timer entry point: refreshes old rates and retries a failed update when its pause is over. */
    function refreshIfDue(time = Date.now()): Promise<void> {
        tick(time)
        // Offline no request is made, so checking often costs nothing.
        const due = error.value
            ? error.value.kind === 'offline' || time - lastAttemptAt + TIMER_SLACK_MS >= retryDelay(failures)
            : time - (snapshot.value?.fetchedAt ?? 0) > REFRESH_AFTER_MS
        return due ? refresh() : Promise.resolve()
    }

    return {snapshot, rates, codes, ratesTime, stale, error, loading, online, now, refresh, refreshIfDue, setOnline, tick}
})
