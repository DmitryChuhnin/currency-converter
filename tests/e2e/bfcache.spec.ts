import {expect, test} from '@playwright/test'
import {API, NOW, payload} from './fixtures'
import {newWorkerTakesOver, openControlled, setVisibility} from './worker'

test.use({
    serviceWorkers: 'allow',
    // Playwright launches Chromium with the back/forward cache off, and its headless shell has
    // none. Both are worker options, hence a file of their own.
    channel: 'chromium',
    launchOptions: {ignoreDefaultArgs: ['--disable-back-forward-cache']},
})

test.skip(({browserName}) => browserName !== 'chromium', 'Service worker control in Playwright is reliable in Chromium only')

test.beforeEach(async ({context, page}) => {
    await context.route(API, (route) => route.fulfill({json: payload()}))
    await page.clock.setFixedTime(NOW)
})

test('a page waiting to reload for a new build lets the user leave for another app on the origin', async ({page, context, baseURL}) => {
    const elsewhere = new URL('/story-game/', baseURL).href
    await context.route(elsewhere, (route) => route.fulfill({contentType: 'text/html', body: '<title>Another app</title>'}))
    await openControlled(page)
    const usd = page.locator('.amount-card[data-code="USD"] input')
    await usd.click()
    await page.keyboard.type('1500')
    await newWorkerTakesOver(page)
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 200)))

    await page.goto(elsewhere)
    // A reload from the page left behind would take the tab back and destroy this context.
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)))
    expect(page.url()).toBe(elsewhere)

    // Restored from the cache with the amount; the reload is still due on the next hide.
    await page.goBack({waitUntil: 'commit'})
    await expect(usd).toHaveValue('1 500')
    await expect(page.locator('body[data-old-bundle]')).toHaveCount(1)
    const reloaded = page.waitForEvent('load')
    await setVisibility(page, 'hidden')
    await reloaded
    await expect(page.locator('body[data-old-bundle]')).toHaveCount(0)
})
