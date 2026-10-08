import {STORAGE_KEYS} from '../../src/services/storage'
import {amount, cachedSnapshot, expect, json, payload, RATES, seedStorage, test, values} from './fixtures'

const noNumbersExceptSource = async (page: import('@playwright/test').Page, source: string) => {
    const v = await values(page)
    for (const [code, value] of Object.entries(v)) if (code !== source) expect(value, code).toBe('')
    const others = page.locator(`.amount-card:not([data-code="${source}"]) input`)
    const placeholders = await others.evaluateAll((inputs) => inputs.map((i) => (i as HTMLInputElement).placeholder))
    expect(placeholders.length).toBeGreaterThan(0)
    expect(placeholders.every((p) => p === '—')).toBe(true)
}

test.describe('no cached rates', () => {
    test('HTTP 500 shows an error, no numbers, and Retry recovers', async ({page, api}) => {
        api.respond(json({error: 'boom'}, 500))
        await page.goto('./')
        await expect(page.getByRole('alert')).toContainText('The rates server returned an error. (HTTP 500)')
        await amount(page, 'USD').fill('100')
        await noNumbersExceptSource(page, 'USD')
        // The notice explains it; "No rate" on every card would blame the currencies.
        await expect(page.locator('.amount-card__warning')).toHaveCount(0)

        api.respond(json(payload()))
        await page.getByRole('button', {name: 'Retry'}).click()
        await expect(page.getByRole('alert')).toBeHidden()
        expect((await values(page)).RUB).toBe('8 000.00')
    })

    test('a dropped connection reads as a network problem', async ({page, api}) => {
        api.respond((route) => route.abort('internetdisconnected'))
        await page.goto('./')
        await expect(page.getByRole('alert')).toContainText("Can't reach the rates server")
    })

    test('broken JSON reads as a format problem', async ({page, api}) => {
        api.respond(json('{"rates": {'))
        await page.goto('./')
        await expect(page.getByRole('alert')).toContainText("sent data the app can't read")
    })

    test('an HTML error page with status 200 reads as a format problem', async ({page, api}) => {
        api.respond((route) => route.fulfill({status: 200, contentType: 'text/html', body: '<h1>Maintenance</h1>'}))
        await page.goto('./')
        await expect(page.getByRole('alert')).toContainText("sent data the app can't read")
    })

    test('a server that never answers times out', async ({page, api}) => {
        api.respond(() => new Promise(() => {}))
        await page.clock.install({time: new Date('2026-09-25T12:00:00Z')})
        await page.goto('./')
        await expect(page.getByRole('status')).toHaveText('Loading rates…')
        await page.clock.runFor(10_500)
        await expect(page.getByRole('alert')).toContainText("didn't respond in time")
    })

    test('offline on first launch says so instead of showing numbers', async ({page, api, context}) => {
        api.respond((route) => route.abort('internetdisconnected'))
        await page.goto('./')
        await context.setOffline(true)
        await expect(page.getByRole('alert')).toContainText("You're offline")
        await amount(page, 'RUB').fill('100')
        await noNumbersExceptSource(page, 'RUB')
    })

    test('typing while rates load converts once they arrive', async ({page, api}) => {
        let release!: () => void
        const gate = new Promise<void>((resolve) => (release = resolve))
        api.respond(async (route) => {
            await gate
            await json(payload())(route)
        })
        await page.goto('./')
        await expect(page.getByRole('status')).toHaveText('Loading rates…')
        await amount(page, 'USD').fill('10')
        await expect(amount(page, 'USD')).toHaveValue('10')
        release()
        await expect(amount(page, 'RUB')).toHaveValue('800.00')
    })
})

test.describe('contract problems in a 200 response', () => {
    test('a currency missing from the response is marked, the rest convert', async ({page, api}) => {
        const {VND: _drop, ...rest} = RATES
        void _drop
        api.respond(json(payload({...rest, THB: null})))
        await page.goto('./')
        await amount(page, 'USD').fill('10')
        const v = await values(page)
        expect(v).toMatchObject({RUB: '800.00', KRW: '14 000.00', VND: '', THB: ''})
        await expect(page.locator('.amount-card[data-code="VND"] .amount-card__warning')).toHaveText('No rate')
        await expect(page.locator('.amount-card[data-code="THB"] .amount-card__warning')).toHaveText('No rate')
        await expect(page.locator('.amount-card[data-code="RUB"] .amount-card__warning')).toHaveCount(0)
    })

    test('rates as strings are not trusted', async ({page, api}) => {
        api.respond(json(payload({USD: 1, RUB: '80', VND: '26000', THB: '32', KRW: '1400'})))
        await page.goto('./')
        await expect(page.getByRole('alert')).toContainText("can't read")
    })

    test('a response with another base is rejected', async ({page, api}) => {
        api.respond(json({...payload(), base: 'EUR'}))
        await page.goto('./')
        await expect(page.getByRole('alert')).toContainText("can't read")
    })
})

test.describe('with cached rates', () => {
    test.beforeEach(async ({page}) => {
        await seedStorage(page, {[STORAGE_KEYS.rates]: cachedSnapshot({...RATES, RUB: 70})})
    })

    test('a failed update keeps converting with the old rates and says so', async ({page, api}) => {
        api.respond(json({}, 503))
        await page.goto('./')
        await expect(page.getByRole('status')).toHaveText("Couldn't update · rates from 24 Sep, 00:00")
        await expect(page.getByRole('alert')).toHaveCount(0)
        await amount(page, 'USD').fill('1')
        expect((await values(page)).RUB).toBe('70.00')
    })

    test('offline and back online', async ({page, api, context}) => {
        await page.goto('./')
        await expect(page.getByRole('status')).toHaveText('Rates 25 Sep, 00:00 · checked 12:00')
        await context.setOffline(true)
        await expect(page.getByRole('status')).toHaveText('Offline · rates from 25 Sep, 00:00')
        await amount(page, 'USD').fill('2')
        expect((await values(page)).RUB).toBe('160.00')

        const before = api.calls
        await context.setOffline(false)
        await expect(page.getByRole('status')).toHaveText('Rates 25 Sep, 00:00 · checked 12:00')
        expect(api.calls).toBeGreaterThan(before)
    })

    test('the cache is used before the network answers', async ({page, api}) => {
        api.respond(() => new Promise(() => {}))
        await page.goto('./')
        await expect(page.getByRole('status')).toHaveText('Updating…')
        await amount(page, 'USD').fill('1')
        expect((await values(page)).RUB).toBe('70.00')
    })
})

test.describe('broken local storage', () => {
    test('garbage in storage falls back to defaults', async ({page, api}) => {
        void api
        await page.addInitScript((keys) => {
            localStorage.setItem(keys.rates, '{"rates":{"USD":1,"RUB":0}')
            localStorage.setItem(keys.selection, '"USD"')
        }, STORAGE_KEYS)
        await page.goto('./')
        await expect(page.locator('.amount-card')).toHaveCount(5)
        await expect(page.getByRole('status')).toHaveText('Rates 25 Sep, 00:00 · checked 12:00')
    })

    test('storage that throws does not break the app', async ({page, api}) => {
        void api
        await page.addInitScript(() => {
            const deny = () => {
                throw new DOMException('denied', 'SecurityError')
            }
            Storage.prototype.getItem = deny
            Storage.prototype.setItem = deny
        })
        await page.goto('./')
        await amount(page, 'USD').fill('3')
        expect((await values(page)).RUB).toBe('240.00')
    })
})

test.describe('a tab that stays open', () => {
    test('refreshes rates after half an hour without a visibility change', async ({page, api}) => {
        await page.clock.install({time: new Date('2026-09-25T12:00:00Z')})
        await page.goto('./')
        await expect(page.getByRole('status')).toHaveText('Rates 25 Sep, 00:00 · checked 12:00')
        await page.clock.runFor(29 * 60_000)
        expect(api.calls).toBe(1)
        await page.clock.runFor(2 * 60_000)
        await expect.poll(() => api.calls).toBe(2)
    })

    test('retries a failed update a minute later', async ({page, api}) => {
        api.respond(json({error: 'boom'}, 503))
        await page.clock.install({time: new Date('2026-09-25T12:00:00Z')})
        await page.goto('./')
        await expect(page.getByRole('alert')).toContainText('(HTTP 503)')
        api.respond(json(payload()))
        await page.clock.runFor(61_000)
        await expect(page.getByRole('alert')).toBeHidden()
        expect(api.calls).toBe(2)
    })

    test('spaces out retries while the API keeps refusing', async ({page, api}) => {
        api.respond(json({error: 'rate limited'}, 429))
        await page.clock.install({time: new Date('2026-09-25T12:00:00Z')})
        await page.goto('./')
        await expect(page.getByRole('alert')).toContainText('(HTTP 429)')
        await page.clock.runFor(61_000)
        await expect.poll(() => api.calls).toBe(2)
        // calls counts the request, not its handling: moving the clock before the 429 lands
        // fires the 10 s timeout instead.
        await expect(page.getByRole('alert').getByRole('button', {name: 'Retry', exact: true})).toBeEnabled()
        // The second failure doubles the pause to two minutes.
        await page.clock.runFor(61_000)
        await expect(page.getByRole('alert')).toContainText('(HTTP 429)')
        expect(api.calls).toBe(2)
        await page.clock.runFor(60_000)
        await expect.poll(() => api.calls).toBe(3)
    })
})
