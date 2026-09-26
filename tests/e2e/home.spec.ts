import {amount, expect, test, values} from './fixtures'

test.beforeEach(async ({page, api}) => {
    void api
    await page.goto('./')
    await expect(page.getByRole('status')).toHaveText('Updated 25 Sep, 00:00')
})

test('empty state shows 1 USD equivalents as placeholders', async ({page}) => {
    const placeholders = await page.locator('.amount-card input').evaluateAll((inputs) =>
        inputs.map((i) => (i as HTMLInputElement).placeholder))
    expect(placeholders).toEqual(['1.00', '80.00', '26 000.00', '32.00', '1 400.00'])
    expect(Object.values(await values(page)).every((v) => v === '')).toBe(true)
    await expect(page.locator('.amount-card__clear')).toHaveCount(0)
})

test('typing and clearing do not move the cards', async ({page}) => {
    const tops = () => page.locator('.amount-card').evaluateAll((cards) => cards.map((c) => c.getBoundingClientRect().top))
    const empty = await tops()
    await amount(page, 'USD').fill('10')
    expect(await tops()).toEqual(empty)
    await amount(page, 'USD').fill('')
    expect(await tops()).toEqual(empty)
})

test('typing in any field converts the rest', async ({page}) => {
    await amount(page, 'RUB').fill('8000')
    expect(await values(page)).toEqual({USD: '100.00', RUB: '8 000', VND: '2 600 000.00', THB: '3 200.00', KRW: '140 000.00'})

    await amount(page, 'USD').click()
    await page.keyboard.type('2')
    expect((await values(page)).RUB).toBe('160.00')
})

test('keystrokes: comma decimal, grouping, limits', async ({page}) => {
    const usd = amount(page, 'USD')
    await usd.click()
    await page.keyboard.type('1234,567')
    await expect(usd).toHaveValue('1 234.56')
    await usd.fill('')
    await page.keyboard.type('.5')
    await expect(usd).toHaveValue('0.5')
    await usd.fill('')
    await page.keyboard.type('0007')
    await expect(usd).toHaveValue('7')
    await usd.fill('')
    await page.keyboard.type('abc-+e')
    await expect(usd).toHaveValue('')
})

test('the 13th integer digit is ignored at the 1 trillion limit', async ({page}) => {
    const usd = amount(page, 'USD')
    await usd.click()
    await page.keyboard.type('10000000000000')
    await expect(usd).toHaveValue('1 000 000 000 000')
})

test('editing in the middle keeps the caret in place', async ({page}) => {
    const usd = amount(page, 'USD')
    await usd.click()
    await page.keyboard.type('12345')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.type('9')
    await expect(usd).toHaveValue('123 945')
    await page.keyboard.type('8')
    await expect(usd).toHaveValue('1 239 845')
    await page.keyboard.press('Backspace')
    await expect(usd).toHaveValue('123 945')
})

test('a second separator is ignored and the caret stays', async ({page}) => {
    const usd = amount(page, 'USD')
    await usd.click()
    await page.keyboard.type('1234.5')
    await usd.evaluate((i: HTMLInputElement) => i.setSelectionRange(3, 3))
    await page.keyboard.type(',')
    await expect(usd).toHaveValue('1 234.5')
    await page.keyboard.type('9')
    await expect(usd).toHaveValue('12 934.5')
})

test('Delete and Backspace step over a group space', async ({page}) => {
    const usd = amount(page, 'USD')
    await usd.fill('1234')
    await expect(usd).toHaveValue('1 234')
    await usd.evaluate((i: HTMLInputElement) => i.setSelectionRange(1, 1))
    await page.keyboard.press('Delete')
    await expect(usd).toHaveValue('134')

    await usd.fill('1234')
    await usd.evaluate((i: HTMLInputElement) => i.setSelectionRange(2, 2))
    await page.keyboard.press('Backspace')
    await expect(usd).toHaveValue('234')
})

test('dropped text is read like a paste', async ({page}) => {
    const usd = amount(page, 'USD')
    await usd.evaluate((i: HTMLInputElement) => {
        i.value = '1,234'
        i.dispatchEvent(new InputEvent('input', {inputType: 'insertFromDrop', data: '1,234', bubbles: true}))
    })
    await expect(usd).toHaveValue('1 234')
    expect((await values(page)).RUB).toBe('98 720.00')
})

test('paste understands foreign grouping', async ({page, browserName}) => {
    test.skip(browserName === 'webkit', 'WebKit in Playwright has no clipboard permission API')
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    const usd = amount(page, 'USD')
    await usd.click()
    await page.evaluate(() => navigator.clipboard.writeText('$1,234.56'))
    await page.keyboard.press('ControlOrMeta+V')
    await expect(usd).toHaveValue('1 234.56')
    expect((await values(page)).RUB).toBe('98 764.80')
})

test('paste reads grouping in the pasted text only', async ({page, browserName}) => {
    test.skip(browserName === 'webkit', 'WebKit in Playwright has no clipboard permission API')
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    const usd = amount(page, 'USD')
    await usd.click()
    await page.keyboard.type('5.')
    await page.evaluate(() => navigator.clipboard.writeText('1,234'))
    await page.keyboard.press('ControlOrMeta+V')
    await expect(usd).toHaveValue('5.12')

    await usd.fill('1000')
    await usd.selectText()
    await page.keyboard.press('ControlOrMeta+V')
    await expect(usd).toHaveValue('1 234')
})

test('clear ✕ empties every field and keeps focus for the next number', async ({page}) => {
    await amount(page, 'THB').fill('320')
    await page.locator('.amount-card[data-code="VND"] .amount-card__clear').click()
    expect(Object.values(await values(page)).every((v) => v === '')).toBe(true)
    await expect(amount(page, 'VND')).toBeFocused()
    await page.keyboard.type('26000')
    expect((await values(page)).USD).toBe('1.00')
})

test('a tap on the card focuses its amount', async ({page}) => {
    await page.locator('.amount-card[data-code="KRW"] .amount-card__code').click()
    await expect(amount(page, 'KRW')).toBeFocused()
    await expect(page.locator('.amount-card[data-code="KRW"]')).toHaveClass(/amount-card--focused/)
})

test('focusing a converted value selects it, so typing replaces it', async ({page}) => {
    await amount(page, 'USD').fill('10')
    await amount(page, 'RUB').click()
    await page.keyboard.type('5')
    expect(await values(page)).toMatchObject({RUB: '5', USD: '0.06'})
})

for (const how of ['card', 'keyboard'] as const) {
    test(`a click after focus by ${how} places the caret in a selected converted value`, async ({page}) => {
        await amount(page, 'USD').fill('10')
        const rub = amount(page, 'RUB')
        if (how === 'card') await page.locator('.amount-card[data-code="RUB"] .amount-card__code').click()
        else await rub.focus()
        await expect(rub).toBeFocused()
        expect(await rub.evaluate((i: HTMLInputElement) => [i.selectionStart, i.selectionEnd])).toEqual([0, 6])
        const box = (await rub.boundingBox())!
        await page.mouse.click(box.x + box.width - 2, box.y + box.height / 2)
        expect(await rub.evaluate((i: HTMLInputElement) => i.selectionStart === i.selectionEnd)).toBe(true)
    })
}

test('a digit that does not fit a converted value leaves the source alone', async ({page}) => {
    await amount(page, 'USD').fill('10')
    const rub = amount(page, 'RUB')
    await rub.focus()
    await rub.evaluate((i: HTMLInputElement) => i.setSelectionRange(i.value.length, i.value.length))
    await page.keyboard.type('5')
    // "800.005" keeps two decimals, so nothing changes and USD stays the source.
    expect(await values(page)).toMatchObject({USD: '10', RUB: '800.00', VND: '260 000.00'})
    await expect(amount(page, 'USD')).toHaveClass(/amount-card__input--source/)
})

test('Backspace shortens a converted amount above the input limit', async ({page}) => {
    await amount(page, 'USD').fill('999999999999')
    const vnd = amount(page, 'VND')
    await expect(vnd).toHaveValue('25 999 999 999 974 000')
    await vnd.focus()
    await vnd.evaluate((i: HTMLInputElement) => i.setSelectionRange(i.value.length, i.value.length))
    await page.keyboard.press('Backspace')
    await expect(vnd).toHaveValue('2 599 999 999 997 400')
    expect((await values(page)).USD).toBe('100 000 000 000')
})

test('zero converts to zero instead of blanking the rest', async ({page}) => {
    await amount(page, 'USD').fill('0')
    expect((await values(page)).RUB).toBe('0.00')
})

test('tiny results keep significant digits', async ({page}) => {
    await amount(page, 'VND').fill('1')
    expect((await values(page)).USD).toBe('0.000038')
})

test('huge values share one smaller font and never widen the page', async ({page}) => {
    const size = () => page.locator('.amount-card input').evaluateAll((inputs) =>
        inputs.map((i) => parseFloat(getComputedStyle(i).fontSize)))
    const before = await size()
    expect(new Set(before).size).toBe(1)

    await amount(page, 'USD').fill('999999999999')
    await page.locator('h1').click()
    const after = await size()
    expect(new Set(after).size).toBe(1)
    expect(after[0]).toBeLessThan(before[0])
    expect((await values(page)).VND).toBe('25 999 999 999 974 000')

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    // Every non-focused amount is fully visible in its field.
    const clipped = await page.locator('.amount-card input').evaluateAll((inputs) =>
        inputs.filter((i) => i.scrollWidth > i.clientWidth + 1).map((i) => (i as HTMLInputElement).value))
    expect(clipped).toEqual([])
})

test('refresh: a double tap sends one request', async ({page, api}) => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    api.respond(async (route) => {
        await gate
        await route.fulfill({json: {base: 'USD', time_last_updated: 1790294401, rates: {USD: 1, RUB: 90}}})
    })
    const callsBefore = api.calls
    const status = page.getByRole('button', {name: /Refresh rates$/})
    await status.click()
    await status.click({force: true})
    await expect(page.getByRole('status')).toHaveText('Updating…')
    release()
    await expect(page.getByRole('status')).toHaveText('Updated 25 Sep, 00:00')
    expect(api.calls - callsBefore).toBe(1)
})
