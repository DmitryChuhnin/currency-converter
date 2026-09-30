import {describe, expect, it} from 'vitest'
import {fitFontSize} from '@/domain/fit'
import {dropIndex, moveItem} from '@/domain/reorder'
import {formatUpdated, isStale, REFRESH_AFTER_MS, retryDelay, STALE_AFTER_MS} from '@/domain/time'
import {CURRENCIES, currencyInfo, DEFAULT_SELECTION} from '@/domain/currencies'

// 10 px per character at the max size keeps the arithmetic readable
const measure = (text: string) => text.length * 10

describe('fitFontSize', () => {
    const opts = {max: 24, min: 16}

    it('keeps the max size while everything fits', () => {
        expect(fitFontSize(['1.00', '78.42'], 200, measure, opts)).toBe(24)
    })

    it('shrinks every row by the widest text', () => {
        // widest is 20 chars = 200 px at 24, available 150 → 18
        expect(fitFontSize(['1', 'x'.repeat(20)], 150, measure, opts)).toBe(18)
    })

    it('stops at the minimum', () => {
        expect(fitFontSize(['x'.repeat(100)], 100, measure, opts)).toBe(16)
    })

    it('ignores empty texts and survives a zero width container', () => {
        expect(fitFontSize(['', ''], 100, measure, opts)).toBe(24)
        expect(fitFontSize(['x'.repeat(100)], 0, measure, opts)).toBe(24)
    })
})

describe('moveItem', () => {
    const list = ['A', 'B', 'C', 'D']

    it('moves down and up', () => {
        expect(moveItem(list, 0, 2)).toEqual(['B', 'C', 'A', 'D'])
        expect(moveItem(list, 3, 0)).toEqual(['D', 'A', 'B', 'C'])
    })

    it('does not mutate the input and clamps the target', () => {
        expect(moveItem(list, 1, 99)).toEqual(['A', 'C', 'D', 'B'])
        expect(moveItem(list, 1, -5)).toEqual(['B', 'A', 'C', 'D'])
        expect(list).toEqual(['A', 'B', 'C', 'D'])
    })

    it('ignores an index out of range', () => {
        expect(moveItem(list, 7, 0)).toEqual(list)
        expect(moveItem(list, -1, 0)).toEqual(list)
    })
})

describe('dropIndex', () => {
    it('counts rows whose center is above the dragged one', () => {
        expect(dropIndex([25, 75, 125], 0)).toBe(0)
        expect(dropIndex([25, 75, 125], 80)).toBe(2)
        expect(dropIndex([25, 75, 125], 500)).toBe(3)
    })
})

describe('formatUpdated', () => {
    it('matches the mockup format in local time', () => {
        const t = new Date(2026, 6, 24, 14, 32).getTime()
        expect(formatUpdated(t, t)).toBe('24 Jul, 14:32')
        expect(formatUpdated(new Date(2026, 0, 5, 3, 7).getTime(), t)).toBe('5 Jan, 03:07')
    })

    it('adds the year when it is not this year', () => {
        const t = new Date(2025, 11, 31, 23, 59).getTime()
        expect(formatUpdated(t, new Date(2026, 0, 1).getTime())).toBe('31 Dec 2025, 23:59')
    })
})

describe('isStale', () => {
    it('flags rates older than 48 hours', () => {
        expect(isStale(0, STALE_AFTER_MS)).toBe(false)
        expect(isStale(0, STALE_AFTER_MS + 1)).toBe(true)
    })
})

describe('retryDelay', () => {
    it('doubles from a minute and stops at the refresh interval', () => {
        expect([0, 1, 2, 3, 4, 5, 6, 50].map(retryDelay)).toEqual(
            [60e3, 60e3, 120e3, 240e3, 480e3, 960e3, REFRESH_AFTER_MS, REFRESH_AFTER_MS])
    })
})

describe('currencies', () => {
    it('covers the defaults and has consistent rows', () => {
        for (const code of DEFAULT_SELECTION) expect(CURRENCIES.has(code)).toBe(true)
        for (const [code, info] of CURRENCIES) {
            expect(info.code).toBe(code)
            expect(info.name.length).toBeGreaterThan(1)
            expect(info.flag.length).toBeGreaterThan(0)
            expect(info.symbol).not.toBe(code)
        }
        expect(CURRENCIES.size).toBeGreaterThanOrEqual(150)
    })

    it('describes an unknown code without crashing', () => {
        const info = currencyInfo('QQQ')
        expect(info.code).toBe('QQQ')
        expect(info.name).toBeTruthy()
    })
})
