import {expect, type Page} from '@playwright/test'

// What the worker of a new build does with skipWaiting and clientsClaim. A real second build
// is out of reach: Playwright does not route the worker script.
export const newWorkerTakesOver = (page: Page) =>
    page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event('controllerchange')))

// Headless pages never get hidden on their own.
export const setVisibility = (page: Page, state: DocumentVisibilityState) =>
    page.evaluate((state) => {
        Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => state})
        document.dispatchEvent(new Event('visibilitychange'))
    }, state)

export async function openControlled(page: Page) {
    await page.goto('./')
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
    await page.reload()
    await expect(page.getByRole('status')).toHaveText('Rates 25 Sep, 00:00 · checked 12:00')
    await page.evaluate(() => document.body.setAttribute('data-old-bundle', ''))
}
