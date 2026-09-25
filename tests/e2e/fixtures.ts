import {test as base, expect, type Page, type Route} from '@playwright/test'

export const API = 'https://api.exchangerate-api.com/v4/latest/USD'

// 2026-09-25 00:00:01 UTC, the timezone of every test
export const PROVIDER_TIME = 1790294401
export const NOW = new Date('2026-09-25T12:00:00Z')

export const RATES = {USD: 1, RUB: 80, VND: 26000, THB: 32, KRW: 1400, EUR: 0.9, GBP: 0.75, JPY: 150}

export function payload(rates: Record<string, unknown> = RATES) {
    return {base: 'USD', date: '2026-09-25', time_last_updated: PROVIDER_TIME, rates}
}

export type Responder = (route: Route) => Promise<void> | void

export const json = (body: unknown, status = 200): Responder => (route) =>
    route.fulfill({status, contentType: 'application/json', body: typeof body === 'string' ? body : JSON.stringify(body)})

export class RatesApi {
    calls = 0
    private responder: Responder = json(payload())

    constructor(private page: Page) {}

    async install() {
        await this.page.route(API, async (route) => {
            this.calls++
            await this.responder(route)
        })
    }

    respond(responder: Responder) {
        this.responder = responder
    }
}

export const test = base.extend<{api: RatesApi}>({
    api: async ({page}, use) => {
        const api = new RatesApi(page)
        await api.install()
        await page.clock.setFixedTime(NOW)
        await use(api)
    },
})

export {expect}

export const amount = (page: Page, code: string) => page.locator(`.amount-card[data-code="${code}"] input`)

export async function values(page: Page): Promise<Record<string, string>> {
    const cards = page.locator('.amount-card')
    const result: Record<string, string> = {}
    for (const card of await cards.all()) {
        result[(await card.getAttribute('data-code'))!] = await card.locator('input').inputValue()
    }
    return result
}

export async function seedStorage(page: Page, entries: Record<string, unknown>) {
    await page.addInitScript((data) => {
        // Only on the first load, so a reload sees what the app itself saved.
        if (sessionStorage.getItem('seeded')) return
        sessionStorage.setItem('seeded', '1')
        for (const [key, value] of Object.entries(data)) localStorage.setItem(key, JSON.stringify(value))
    }, entries)
}

export const cachedSnapshot = (rates: Record<string, number> = RATES) => ({
    rates,
    providerTime: PROVIDER_TIME * 1000 - 24 * 3600e3,
    fetchedAt: NOW.getTime() - 24 * 3600e3,
})
