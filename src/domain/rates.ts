import {CURRENCY_CODE} from './currencies'

/** Units of each currency per 1 USD. */
export type Rates = Readonly<Record<string, number>>

export interface RatesSnapshot {
    rates: Rates
    /** When the provider last updated the rates, ms. Null if the payload did not say. */
    providerTime: number | null
    /** When this app received the payload, ms. */
    fetchedAt: number
}

export class RatesFormatError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'RatesFormatError'
    }
}

function isValidRate(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/**
 * Validates `GET /v4/latest/USD`. A single broken rate drops that currency only, the
 * UI then shows it as unavailable. Anything that makes every rate suspect throws.
 */
export function parseRatesPayload(payload: unknown, fetchedAt: number): RatesSnapshot {
    if (typeof payload !== 'object' || payload === null) {
        throw new RatesFormatError('Payload is not an object')
    }
    const {base, rates, time_last_updated: updated} = payload as Record<string, unknown>
    if (base !== 'USD') throw new RatesFormatError(`Unexpected base ${String(base)}`)
    if (typeof rates !== 'object' || rates === null || Array.isArray(rates)) {
        throw new RatesFormatError('No rates object')
    }
    if ('USD' in rates && (rates as Record<string, unknown>).USD !== 1) {
        throw new RatesFormatError('USD rate is not 1')
    }

    const valid: Record<string, number> = {USD: 1}
    for (const [code, value] of Object.entries(rates)) {
        if (CURRENCY_CODE.test(code) && isValidRate(value)) valid[code] = value
    }
    if (Object.keys(valid).length < 2) throw new RatesFormatError('No usable rates')

    const providerTime = typeof updated === 'number' && updated > 0 ? updated * 1000 : null
    return {rates: valid, providerTime, fetchedAt}
}

const isValidTime = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0

/** Guards what comes back from storage: same rules as the API, plus our own fields. */
export function reviveSnapshot(value: unknown): RatesSnapshot | null {
    if (typeof value !== 'object' || value === null) return null
    const {rates, providerTime, fetchedAt} = value as Record<string, unknown>
    if (!isValidTime(fetchedAt)) return null
    if (providerTime !== null && !isValidTime(providerTime)) return null
    try {
        const parsed = parseRatesPayload({base: 'USD', rates}, fetchedAt)
        return {...parsed, providerTime}
    } catch {
        return null
    }
}

/** Amount in `to`, or null when either rate is unknown. Never guesses. */
export function convert(amount: number, from: string, to: string, rates: Rates | null): number | null {
    if (!rates) return null
    const fromRate = rates[from]
    const toRate = rates[to]
    if (!isValidRate(fromRate) || !isValidRate(toRate)) return null
    if (from === to) return amount
    return (amount / fromRate) * toRate
}
