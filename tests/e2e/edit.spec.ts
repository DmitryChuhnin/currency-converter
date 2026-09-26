import {STORAGE_KEYS} from '../../src/services/storage'
import {amount, expect, seedStorage, test, values} from './fixtures'
import type {Page} from '@playwright/test'

const homeCodes = (page: Page) => page.locator('.amount-card').evaluateAll((cards) => cards.map((c) => c.getAttribute('data-code')))
const selectedCodes = (page: Page) => page.locator('.edit-row--selected').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-code')))

async function openEdit(page: Page) {
    await page.getByRole('button', {name: 'Edit currencies'}).click()
    await expect(page.getByRole('heading', {name: 'Edit currencies'})).toBeVisible()
}

test.beforeEach(async ({page, api}) => {
    void api
    await page.goto('./')
    await expect(page.getByRole('status')).toHaveText('Updated 25 Sep, 00:00')
})

test('Back, Done and the system back all return home', async ({page}) => {
    await openEdit(page)
    await page.getByRole('button', {name: 'Back', exact: true}).click()
    await expect(page.getByRole('heading', {name: 'Converter'})).toBeVisible()
    await expect(page.getByRole('button', {name: 'Edit currencies'})).toBeFocused()

    await openEdit(page)
    await page.getByRole('button', {name: 'Done', exact: true}).click()
    await expect(page.getByRole('heading', {name: 'Converter'})).toBeVisible()

    await openEdit(page)
    await page.goBack()
    await expect(page.getByRole('heading', {name: 'Converter'})).toBeVisible()
    // The app is still here: back did not leave the page.
    expect(page.url()).toContain('/converter/')
})

test('a double tap on Back does not leave the app', async ({page}) => {
    await openEdit(page)
    // Both taps land before popstate, as a fast double tap does on a phone.
    await page.getByRole('button', {name: 'Back', exact: true}).evaluate((b: HTMLElement) => {
        b.click()
        b.click()
    })
    await expect(page.getByRole('heading', {name: 'Converter'})).toBeVisible()
    // A second history.back() would navigate away a moment later.
    await page.waitForTimeout(500)
    expect(page.url()).toContain('/converter/')
    await expect(page.getByRole('heading', {name: 'Converter'})).toBeVisible()
    await openEdit(page)
})

test('the typed amount survives a trip to the edit screen', async ({page}) => {
    await amount(page, 'USD').fill('10')
    await openEdit(page)
    await page.getByRole('button', {name: 'Done', exact: true}).click()
    expect((await values(page)).RUB).toBe('800.00')
})

test('Add currency opens the edit screen with the search focused', async ({page}) => {
    await page.getByRole('button', {name: 'Add currency'}).click()
    await expect(page.getByRole('searchbox')).toBeFocused()
    await expect(page.getByRole('searchbox')).toHaveAttribute('placeholder', /Search 1[5-9]0\+ currencies/)
})

test('search by code, name and without accents; no match says so', async ({page}) => {
    await openEdit(page)
    const search = page.getByRole('searchbox')
    const available = page.locator('.edit-row--available')

    await search.fill('eur')
    await expect(available.first()).toHaveAttribute('data-code', 'EUR')
    await search.fill('pound')
    await expect(available.filter({hasText: 'British Pound'})).toHaveCount(1)
    await search.fill('cordoba')
    await expect(available).toHaveCount(1)
    await expect(available.first()).toHaveAttribute('data-code', 'NIO')
    await search.fill('rub')
    // RUB is already selected, only the Belarusian ruble is left
    await expect(available).toHaveCount(1)
    await expect(available.first()).toHaveAttribute('data-code', 'BYN')

    await search.fill('zzzz')
    await expect(available).toHaveCount(0)
    await expect(page.getByText('No currencies match “zzzz”.')).toBeVisible()
    await page.getByRole('button', {name: 'Clear search'}).click()
    await expect(search).toHaveValue('')
    await expect(search).toBeFocused()
})

test('popular currencies come first in the add list', async ({page}) => {
    await openEdit(page)
    const first = await page.locator('.edit-row--available').evaluateAll((rows) => rows.slice(0, 3).map((r) => r.getAttribute('data-code')))
    expect(first).toEqual(['EUR', 'GBP', 'JPY'])
})

test('add and remove show up on the home screen and survive a reload', async ({page}) => {
    await openEdit(page)
    await page.getByRole('button', {name: 'Add Euro'}).click()
    await page.getByRole('button', {name: 'Remove Russian Ruble'}).click()
    expect(await selectedCodes(page)).toEqual(['USD', 'VND', 'THB', 'KRW', 'EUR'])
    await expect(page.getByRole('button', {name: 'Add Euro'})).toHaveCount(0)
    await expect(page.getByRole('button', {name: 'Add Russian Ruble'})).toHaveCount(1)

    await page.getByRole('button', {name: 'Done', exact: true}).click()
    expect(await homeCodes(page)).toEqual(['USD', 'VND', 'THB', 'KRW', 'EUR'])
    await amount(page, 'USD').fill('10')
    expect((await values(page)).EUR).toBe('9.00')

    await page.reload()
    expect(await homeCodes(page)).toEqual(['USD', 'VND', 'THB', 'KRW', 'EUR'])
})

test('removing everything leaves a way back', async ({page}) => {
    await openEdit(page)
    for (const name of ['US Dollar', 'Russian Ruble', 'Vietnamese Dong', 'Thai Baht', 'South Korean Won']) {
        await page.getByRole('button', {name: `Remove ${name}`}).click()
    }
    await expect(page.getByText('No currencies yet. Add some below.')).toBeVisible()
    await page.getByRole('button', {name: 'Done', exact: true}).click()
    await expect(page.getByText('No currencies yet. Add the ones you use.')).toBeVisible()
    await page.getByRole('button', {name: 'Add currency'}).click()
    await page.getByRole('button', {name: 'Add Japanese Yen'}).click()
    await page.getByRole('button', {name: 'Done', exact: true}).click()
    expect(await homeCodes(page)).toEqual(['JPY'])
})

test('reorder with the keyboard', async ({page}) => {
    await openEdit(page)
    const handle = page.getByRole('button', {name: /^Reorder US Dollar/})
    await handle.focus()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    expect(await selectedCodes(page)).toEqual(['RUB', 'VND', 'USD', 'THB', 'KRW'])
    await expect(page.getByRole('button', {name: /^Reorder US Dollar/})).toBeFocused()
    await page.keyboard.press('ArrowUp')
    expect(await selectedCodes(page)).toEqual(['RUB', 'USD', 'VND', 'THB', 'KRW'])
    // Past the ends nothing happens.
    await page.getByRole('button', {name: /^Reorder Russian Ruble/}).focus()
    await page.keyboard.press('ArrowUp')
    expect(await selectedCodes(page)).toEqual(['RUB', 'USD', 'VND', 'THB', 'KRW'])
})

test('reorder by dragging the handle', async ({page}) => {
    await openEdit(page)
    const handle = page.getByRole('button', {name: /^Reorder US Dollar/})
    const target = page.locator('.edit-row--selected[data-code="THB"]')
    const from = (await handle.boundingBox())!
    const to = (await target.boundingBox())!

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    for (let i = 1; i <= 10; i++) {
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + ((to.y + to.height / 2 + 4 - from.y - from.height / 2) * i) / 10)
    }
    await expect(page.locator('.edit-row--dragging')).toHaveAttribute('data-code', 'USD')
    await page.mouse.up()

    expect(await selectedCodes(page)).toEqual(['RUB', 'VND', 'THB', 'USD', 'KRW'])
    await expect(page.locator('.edit-row--dragging')).toHaveCount(0)
    await page.getByRole('button', {name: 'Done', exact: true}).click()
    expect(await homeCodes(page)).toEqual(['RUB', 'VND', 'THB', 'USD', 'KRW'])
})

test('arrow keys during a drag do not scramble the order', async ({page}) => {
    await openEdit(page)
    const handle = page.getByRole('button', {name: /^Reorder US Dollar/})
    await handle.focus()
    const from = (await handle.boundingBox())!
    const to = (await page.locator('.edit-row--selected[data-code="THB"]').boundingBox())!
    const x = from.x + from.width / 2
    const y0 = from.y + from.height / 2
    const y1 = to.y + to.height / 2 + 4

    await page.mouse.move(x, y0)
    await page.mouse.down()
    for (let i = 1; i <= 10; i++) await page.mouse.move(x, y0 + ((y1 - y0) * i) / 10)
    await handle.press('ArrowDown')
    await page.mouse.up()
    expect(await selectedCodes(page)).toEqual(['RUB', 'VND', 'THB', 'USD', 'KRW'])
})

test('the dragged row follows the page when the wheel scrolls it', async ({page, isMobile}) => {
    test.skip(isMobile, 'mouse wheel only')
    await page.setViewportSize({width: 800, height: 500})
    await openEdit(page)
    const box = (await page.getByRole('button', {name: /^Reorder US Dollar/}).boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y + 10)
    const dragged = page.locator('.edit-row--dragging')
    await expect(dragged).toHaveAttribute('data-code', 'USD')

    await page.mouse.wheel(0, 120)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
    const scrolled = await page.evaluate(() => window.scrollY)
    // Without a mouse move the row still sits under the pointer: 10px plus the scroll.
    await expect(dragged).toHaveCSS('transform', `matrix(1, 0, 0, 1, 0, ${10 + scrolled})`)
    await page.mouse.up()
})

test('a drag released where it started changes nothing', async ({page}) => {
    await openEdit(page)
    const box = (await page.getByRole('button', {name: /^Reorder Thai Baht/}).boundingBox())!
    await page.mouse.move(box.x + 10, box.y + 10)
    await page.mouse.down()
    await page.mouse.move(box.x + 10, box.y + 40)
    await page.mouse.move(box.x + 10, box.y + 10)
    await page.mouse.up()
    expect(await selectedCodes(page)).toEqual(['USD', 'RUB', 'VND', 'THB', 'KRW'])
})

test.describe('saved selection', () => {
    test.beforeEach(async ({page}) => {
        await seedStorage(page, {[STORAGE_KEYS.selection]: ['KRW', 'QQQ', 'USD']})
        await page.goto('./')
    })

    test('an unknown code from storage is shown, not dropped or converted', async ({page}) => {
        expect(await homeCodes(page)).toEqual(['KRW', 'QQQ', 'USD'])
        await amount(page, 'USD').fill('1')
        expect(await values(page)).toEqual({KRW: '1 400.00', QQQ: '', USD: '1'})
        await expect(page.locator('.amount-card[data-code="QQQ"] .amount-card__warning')).toHaveText('No rate')
    })
})
