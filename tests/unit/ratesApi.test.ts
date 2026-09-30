import {afterEach, describe, expect, it, vi} from 'vitest'
import {fetchRates, RATES_URL, RatesError} from '@/services/ratesApi'

const payload = {base: 'USD', time_last_updated: 1790294401, rates: {USD: 1, RUB: 80}}

function respond(body: string, status = 200): typeof fetch {
    return vi.fn(async () => new Response(body, {status, headers: {'content-type': 'application/json'}}))
}

async function kindOf(promise: Promise<unknown>) {
    const err = await promise.then(() => null, (e: unknown) => e)
    expect(err).toBeInstanceOf(RatesError)
    return (err as RatesError).kind
}

afterEach(() => {
    vi.useRealTimers()
})

describe('fetchRates', () => {
    it('requests the USD endpoint and returns a snapshot', async () => {
        const fetchImpl = respond(JSON.stringify(payload))
        const snap = await fetchRates({fetchImpl, now: () => 42})
        expect(fetchImpl).toHaveBeenCalledWith(RATES_URL, expect.objectContaining({cache: 'no-cache'}))
        expect(snap).toEqual({rates: {USD: 1, RUB: 80}, providerTime: 1790294401000, fetchedAt: 42})
    })

    it('reports a failed fetch as network', async () => {
        const fetchImpl = vi.fn(async () => {
            throw new TypeError('Failed to fetch')
        })
        expect(await kindOf(fetchRates({fetchImpl}))).toBe('network')
    })

    it.each([500, 502, 404, 429])('reports HTTP %i as http with the status', async (status) => {
        const err = await fetchRates({fetchImpl: respond('{}', status)}).catch((e: RatesError) => e)
        expect(err).toBeInstanceOf(RatesError)
        expect((err as RatesError).kind).toBe('http')
        expect((err as RatesError).status).toBe(status)
    })

    it.each([
        ['broken JSON', '{"rates": {'],
        ['HTML', '<!doctype html><title>Error</title>'],
        ['empty body', ''],
        ['JSON of the wrong shape', '{"result":"error","error_type":"unsupported_code"}'],
        ['JSON null', 'null'],
    ])('reports %s as format', async (_name, body) => {
        expect(await kindOf(fetchRates({fetchImpl: respond(body)}))).toBe('format')
    })

    it('aborts after the timeout and reports it as timeout', async () => {
        vi.useFakeTimers()
        const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }))
        const pending = kindOf(fetchRates({fetchImpl: fetchImpl as typeof fetch, timeoutMs: 1000}))
        await vi.advanceTimersByTimeAsync(1000)
        expect(await pending).toBe('timeout')
    })

    it('does not report a timeout for a fast failure', async () => {
        vi.useFakeTimers()
        const fetchImpl = vi.fn(async () => {
            throw new TypeError('Load failed')
        })
        const pending = kindOf(fetchRates({fetchImpl, timeoutMs: 1000}))
        await vi.advanceTimersByTimeAsync(5000)
        expect(await pending).toBe('network')
    })
})
