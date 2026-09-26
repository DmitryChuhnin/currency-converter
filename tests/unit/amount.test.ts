import {describe, expect, it} from 'vitest'
import {
    caretAfterNormalize,
    caretIndex,
    formatAmount,
    groupDigits,
    MAX_AMOUNT,
    normalizeInput,
    parseCanonical,
    readPasted,
} from '@/domain/amount'

describe('normalizeInput: typing', () => {
    it.each([
        ['123', '123'],
        ['12.5', '12.5'],
        ['12,5', '12.5'],
        ['1 234.56', '1234.56'],
        ['0', '0'],
        ['0.', '0.'],
        ['0,0', '0.0'],
        ['', ''],
    ])('%j → %j', (raw, expected) => {
        expect(normalizeInput(raw)).toBe(expected)
    })

    it.each([
        ['.', '0.'],
        [',', '0.'],
        ['00', '0'],
        ['0005', '5'],
        ['000.5', '0.5'],
        ['1.2.3', '1.23'],
        ['1..', '1.'],
        ['12,5,', '12.5'],
        ['1.999', '1.99'],
        ['-5', '5'],
        ['abc', ''],
        ['1e5', '15'],
        ['$12', '12'],
        ['12 345 678', '12345678'],
    ])('rejects junk: %j → %j', (raw, expected) => {
        expect(normalizeInput(raw)).toBe(expected)
    })

    it('keeps the previous value when a keystroke would exceed the limit', () => {
        expect(normalizeInput('1000000000000', '100000000000')).toBe('1000000000000')
        expect(normalizeInput('10000000000000', '1000000000000')).toBe('1000000000000')
        expect(normalizeInput('1000000000000.01', '1000000000000.0')).toBe('1000000000000.0')
        expect(Number(normalizeInput('999999999999.99'))).toBeLessThanOrEqual(MAX_AMOUNT)
    })

    it.each([
        ['12.34.5', '1234.5'],
        ['12,34.5', '1234.5'],
        ['1.,5', '1.5'],
        ['1.5,', '1.5'],
        ['1.5.', '1.5'],
        ['12．34.5', '1234.5'],
        ['0.00.0038', '0.000038'],
    ])('ignores a second separator: %j stays %j', (raw, previous) => {
        expect(normalizeInput(raw, previous)).toBe(previous)
    })

    it('accepts a separator that replaces the existing one', () => {
        expect(normalizeInput('1,', '1.5')).toBe('1.')
        expect(normalizeInput('12,5', '1.5')).toBe('12.5')
    })

    it('lets Backspace shorten a converted amount that is above the limit', () => {
        const vnd = '26000000000000000'
        expect(normalizeInput('2600000000000000', vnd)).toBe('2600000000000000')
        expect(normalizeInput('260000000000000005', vnd)).toBe(vnd)
        expect(normalizeInput('126000000000000000', vnd)).toBe(vnd)
    })

    it.each([
        ['１２３．４５', '123.45'],
        ['１２，５', '12.5'],
        ['١٢٣٫٥', '123.5'],
        ['۱۲۳', '123'],
        ['1٬234', '1234'],
    ])('reads digits from other keyboards: %j → %j', (raw, expected) => {
        expect(normalizeInput(raw)).toBe(expected)
    })
})

describe('normalizeInput: paste', () => {
    it.each([
        ['1,234.56', '1234.56'],
        ['1.234,56', '1234.56'],
        ['1,234,567', '1234567'],
        ['1.234.567', '1234567'],
        ['$1,234.56', '1234.56'],
        ['1 234,56 ₽', '1234.56'],
        ["1'234.50", '1234.50'],
        ['12,5', '12.5'],
        ['  42  ', '42'],
        ['1,234', '1234'],
        ['$1,234', '1234'],
        ['1,234 ₽', '1234'],
        ['12,345', '12345'],
    ])('%j → %j', (raw, expected) => {
        expect(normalizeInput(raw, '', true)).toBe(expected)
    })

    it.each([
        // KWD, BHD and OMR have three decimals, so a lone dot stays decimal.
        ['1.234', '1.23'],
        ['0,125', '0.12'],
        [',125', '0.12'],
        ['1,2345', '1.23'],
        ['1,23', '1.23'],
    ])('keeps a lone separator decimal when grouping is unlikely: %j → %j', (raw, expected) => {
        expect(normalizeInput(raw, '', true)).toBe(expected)
    })

    it('treats a typed comma as decimal even before three digits', () => {
        expect(normalizeInput('1,234')).toBe('1.23')
    })

    it('reads the pasted part only, so the field keeps its own decimal point', () => {
        expect(normalizeInput(`5.${readPasted('1,234')}`, '5.')).toBe('5.12')
        expect(normalizeInput(`12${readPasted('1,000')}`, '12')).toBe('121000')
        expect(normalizeInput(readPasted('1,234'), '1000')).toBe('1234')
    })

    it('ignores a pasted decimal when the field already has one', () => {
        expect(normalizeInput(`5.5${readPasted('1.5')}`, '5.5')).toBe('5.5')
        expect(normalizeInput(`5.5${readPasted('1.234,5')}`, '5.5')).toBe('5.5')
    })

    it('ignores a paste that is over the limit', () => {
        expect(normalizeInput('99,999,999,999,999', '5', true)).toBe('5')
    })
})

describe('groupDigits', () => {
    it.each([
        ['', ''],
        ['0', '0'],
        ['123', '123'],
        ['1234', '1 234'],
        ['1234567.5', '1 234 567.5'],
        ['1000000000000', '1 000 000 000 000'],
        ['0.', '0.'],
        ['12345.', '12 345.'],
    ])('%j → %j', (canonical, expected) => {
        expect(groupDigits(canonical)).toBe(expected)
    })
})

describe('parseCanonical', () => {
    it('returns null for nothing to convert', () => {
        expect(parseCanonical('')).toBeNull()
        expect(parseCanonical('.')).toBeNull()
    })
    it('parses zero and partial decimals', () => {
        expect(parseCanonical('0')).toBe(0)
        expect(parseCanonical('0.')).toBe(0)
        expect(parseCanonical('12.5')).toBe(12.5)
    })
})

describe('formatAmount', () => {
    it.each([
        [0, '0.00'],
        [1, '1.00'],
        [0.919, '0.92'],
        [78.415, '78.42'],
        [1234567.891, '1 234 567.89'],
        [999999999.994, '999 999 999.99'],
        [1e9, '1 000 000 000'],
        [32407407113.4, '32 407 407 113'],
        [0.01, '0.01'],
        [0.0000381, '0.000038'],
        [0.00999, '0.01'],
    ])('%d → %j', (value, expected) => {
        expect(formatAmount(value)).toBe(expected)
    })

    it('never switches to exponent notation for huge values', () => {
        const text = formatAmount(3.7e18)
        expect(text).not.toMatch(/e/i)
        expect(text.replace(/ /g, '')).toMatch(/^\d{19}$/)
    })

    it('throws instead of printing NaN or Infinity', () => {
        expect(() => formatAmount(NaN)).toThrow(RangeError)
        expect(() => formatAmount(Infinity)).toThrow(RangeError)
    })
})

describe('caret helpers', () => {
    it.each([
        // [raw text before the caret, formatted result, expected caret]
        ['.', '0.', 2],
        ['1239', '123 945', 5],
        ['12,', '12.', 3],
        ['1.5', '1.59', 3],
        ['0', '5', 0],
        ['', '1 234', 0],
        ['1 2', '12 345', 2],
    ])('after normalizing %j into %j the caret is at %i', (before, formatted, expected) => {
        expect(caretAfterNormalize(before, formatted)).toBe(expected)
    })

    it('puts the caret after the same digit once regrouped', () => {
        // typed "1234" with caret at end → "1 234", caret after the 4th digit
        expect(caretIndex('1 234', 4)).toBe(5)
        // caret after "12" in "1 234" stays after "2"
        expect(caretIndex('1 234', 2)).toBe(3)
        expect(caretIndex('1 234', 0)).toBe(0)
        expect(caretIndex('12', 10)).toBe(2)
    })
})
