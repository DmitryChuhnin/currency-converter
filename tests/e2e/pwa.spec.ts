import {test as base, expect} from '@playwright/test'
import {API, NOW, payload} from './fixtures'

// A real service worker, so no page-level mocks: requests are routed on the context.
const test = base.extend({})
test.use({serviceWorkers: 'allow'})

test.skip(({browserName}) => browserName !== 'chromium', 'Service worker control in Playwright is reliable in Chromium only')

test.beforeEach(async ({context, page}) => {
    await context.route(API, (route) => route.fulfill({json: payload()}))
    await page.clock.setFixedTime(NOW)
})

test('one service worker; the app reloads offline with cached rates', async ({page, context}) => {
    await page.goto('./')
    await expect(page.getByRole('status')).toHaveText('Updated 25 Sep, 00:00')
    await page.evaluate(async () => {
        await navigator.serviceWorker.ready
    })
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(1)
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations())[0].scope)).toMatch(/\/converter\/$/)

    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', {name: 'Converter'})).toBeVisible()
    await expect(page.getByRole('status')).toHaveText('Offline · rates from 25 Sep, 00:00')
    await page.locator('.amount-card[data-code="USD"] input').fill('10')
    await expect(page.locator('.amount-card[data-code="RUB"] input')).toHaveValue('800.00')
})

test('manifest and icons are served under the base path', async ({page, request}) => {
    await page.goto('./')
    const href = await page.locator('link[rel="manifest"]').getAttribute('href')
    expect(href).toBe('/converter/manifest.webmanifest')
    const manifest = await (await request.get(href!)).json()
    expect(manifest.start_url).toBe('/converter/')
    expect(manifest.scope).toBe('/converter/')
    for (const icon of manifest.icons) {
        const res = await request.get(icon.src)
        expect(res.status(), icon.src).toBe(200)
        expect(res.headers()['content-type']).toBe('image/png')
    }
    for (const selector of ['link[rel="icon"]', 'link[rel="apple-touch-icon"]']) {
        const url = await page.locator(selector).getAttribute('href')
        expect((await request.get(url!)).status(), selector).toBe(200)
    }
    // The pre-redesign main.ts registered the worker a second time by hand.
    const registerScripts = await page.locator('script[src*="registerSW"]').count()
    expect(registerScripts).toBe(1)
})
