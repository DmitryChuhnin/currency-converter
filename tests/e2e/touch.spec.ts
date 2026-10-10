import {amount, expect, test} from './fixtures'
import type {Locator} from '@playwright/test'

test.beforeEach(async ({page, api}) => {
    void api
    await page.goto('./')
    await expect(page.getByRole('status')).toHaveText('Rates 25 Sep, 00:00 · checked 12:00')
})

// WebKit may report only the prefixed property.
const userSelect = (locator: Locator) =>
    locator.evaluate((el) => {
        const style = getComputedStyle(el)
        return style.userSelect || style.getPropertyValue('-webkit-user-select')
    })

test('a double tap does not zoom, a pinch still can', async ({page}) => {
    await expect(page.locator('html')).toHaveCSS('touch-action', 'manipulation')
    await expect(page.locator('body')).toHaveCSS('touch-action', 'manipulation')
    expect(await page.locator('meta[name="viewport"]').getAttribute('content')).not.toMatch(/user-scalable|maximum-scale/)

    // The drag handle keeps none: with manipulation the page would pan and cancel the drag.
    await page.getByRole('button', {name: 'Edit currencies'}).click()
    await expect(page.getByRole('button', {name: /^Reorder US Dollar/})).toHaveCSS('touch-action', 'none')
})

test('page text cannot be selected, the amounts and the search can', async ({page}) => {
    expect(await userSelect(page.locator('body'))).toBe('none')
    expect(await userSelect(amount(page, 'USD'))).toBe('text')

    await page.getByRole('heading', {name: 'Converter'}).dblclick()
    expect(await page.evaluate(() => getSelection()?.toString())).toBe('')

    const usd = amount(page, 'USD')
    await usd.fill('500')
    const box = (await usd.boundingBox())!
    await usd.dblclick({position: {x: box.width - 4, y: box.height / 2}})
    expect(await usd.evaluate((i: HTMLInputElement) => i.value.slice(i.selectionStart!, i.selectionEnd!))).toBe('500')

    await page.getByRole('button', {name: 'Add currency'}).click()
    expect(await userSelect(page.getByRole('searchbox'))).toBe('text')
})
