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

test('one service worker; the app reloads offline with cached rates', async ({page, context, baseURL}) => {
    await page.goto('./')
    await expect(page.getByRole('status')).toHaveText('Rates 25 Sep, 00:00 · checked 12:00')
    await page.evaluate(async () => {
        await navigator.serviceWorker.ready
    })
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(1)
    // Exactly the app's path: a wider scope would take over the site and the other apps.
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations())[0].scope)).toBe(baseURL)

    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', {name: 'Converter'})).toBeVisible()
    await expect(page.getByRole('status')).toHaveText('Offline · rates from 25 Sep, 00:00')
    await page.locator('.amount-card[data-code="USD"] input').fill('10')
    await expect(page.locator('.amount-card[data-code="RUB"] input')).toHaveValue('800.00')
})

test('a page the worker serves reloads when a new worker takes it over', async ({page}) => {
    await page.goto('./')
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
    await page.reload()
    await page.evaluate(() => document.body.setAttribute('data-old-bundle', ''))
    const reloaded = page.waitForEvent('load')
    // What the worker of a new build does with skipWaiting and clientsClaim. A real second
    // build is out of reach: Playwright does not route the worker script.
    await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange')))
    await reloaded
    await expect(page.locator('body[data-old-bundle]')).toHaveCount(0)
    await expect(page.getByRole('heading', {name: 'Converter'})).toBeVisible()
})

test('caches carry the app id; only its own outdated precache is deleted', async ({page, baseURL}) => {
    const {origin, href: scope} = new URL(baseURL!)
    const outdated = `workbox-precache-v2-${scope}`
    const foreign = ['api-cache', `workbox-precache-v2-${origin}/other-app/`]
    // Left by the previous build of this app and by other apps on the origin.
    await page.addInitScript((names) => {
        if (sessionStorage.getItem('seeded')) return
        sessionStorage.setItem('seeded', '1')
        for (const name of names) void caches.open(name)
    }, [outdated, ...foreign])
    await page.goto('./')
    await page.evaluate(async () => {
        await navigator.serviceWorker.ready
    })
    await expect.poll(async () => (await page.evaluate(() => caches.keys())).sort())
        .toEqual([`converter-precache-v2-${scope}`, ...foreign].sort())
})

// Width x height from the PNG header.
const pngSize = (png: Uint8Array) => {
    const header = new DataView(png.buffer, png.byteOffset, 24)
    return `${header.getUint32(16)}x${header.getUint32(20)}`
}

test('manifest and icons are served under the base path', async ({page, request}) => {
    await page.goto('./')
    const href = await page.locator('link[rel="manifest"]').getAttribute('href')
    expect(href).toBe('/converter/manifest.webmanifest')
    const manifest = await (await request.get(href!)).json()
    expect(manifest).toMatchObject({
        id: '/converter/',
        start_url: '/converter/',
        scope: '/converter/',
        display: 'standalone',
        name: 'Currency Converter',
        short_name: 'Converter',
        lang: await page.locator('html').getAttribute('lang'),
        theme_color: await page.locator('meta[name="theme-color"]').getAttribute('content'),
    })
    // Separate files: a rounded "any" icon would get cropped again by a maskable launcher.
    const maskable = manifest.icons.filter((icon: {purpose?: string}) => icon.purpose === 'maskable')
    expect(maskable.map((icon: {src: string}) => icon.src)).toEqual(['/converter/icon-maskable-512.png'])
    const sizes: string[] = []
    for (const icon of manifest.icons) {
        const res = await request.get(icon.src)
        expect(res.status(), icon.src).toBe(200)
        expect(res.headers()['content-type']).toBe('image/png')
        expect(pngSize(await res.body()), icon.src).toBe(icon.sizes)
        if (icon.purpose !== 'maskable') sizes.push(icon.sizes)
    }
    expect(sizes).toEqual(['192x192', '512x512'])
    expect((await request.get((await page.locator('link[rel="icon"]').getAttribute('href'))!)).status()).toBe(200)
    const appleIcon = await request.get((await page.locator('link[rel="apple-touch-icon"]').getAttribute('href'))!)
    expect(appleIcon.status()).toBe(200)
    expect(pngSize(await appleIcon.body())).toBe('180x180')
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes')
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', manifest.short_name)
    // The pre-redesign main.ts registered the worker a second time by hand.
    const registerScripts = await page.locator('script[src*="registerSW"]').count()
    expect(registerScripts).toBe(1)
})
