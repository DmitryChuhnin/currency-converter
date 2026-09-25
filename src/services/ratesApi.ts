import {parseRatesPayload, RatesFormatError, type RatesSnapshot} from '@/domain/rates'

// Open endpoint without a key, rates per 1 USD. Contract and sample: docs/architecture.md.
export const RATES_URL = 'https://api.exchangerate-api.com/v4/latest/USD'
export const TIMEOUT_MS = 10_000

export type RatesErrorKind = 'offline' | 'network' | 'timeout' | 'http' | 'format'

export class RatesError extends Error {
    constructor(
        readonly kind: RatesErrorKind,
        message: string,
        readonly status?: number,
    ) {
        super(message)
        this.name = 'RatesError'
    }
}

export interface FetchRatesOptions {
    fetchImpl?: typeof fetch
    timeoutMs?: number
    now?: () => number
}

export async function fetchRates({
    fetchImpl = (...args) => fetch(...args),
    timeoutMs = TIMEOUT_MS,
    now = Date.now,
}: FetchRatesOptions = {}): Promise<RatesSnapshot> {
    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
        timedOut = true
        controller.abort()
    }, timeoutMs)

    try {
        let response: Response
        try {
            response = await fetchImpl(RATES_URL, {signal: controller.signal, cache: 'no-cache'})
        } catch (err) {
            if (timedOut) throw new RatesError('timeout', `No response in ${timeoutMs} ms`)
            throw new RatesError('network', err instanceof Error ? err.message : String(err))
        }
        if (!response.ok) {
            throw new RatesError('http', `HTTP ${response.status}`, response.status)
        }

        let payload: unknown
        try {
            payload = await response.json()
        } catch {
            if (timedOut) throw new RatesError('timeout', `No response in ${timeoutMs} ms`)
            throw new RatesError('format', 'Response is not JSON')
        }
        try {
            return parseRatesPayload(payload, now())
        } catch (err) {
            if (err instanceof RatesFormatError) throw new RatesError('format', err.message)
            throw err
        }
    } finally {
        clearTimeout(timer)
    }
}
