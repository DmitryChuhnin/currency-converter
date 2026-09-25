import {describe, expect, it} from 'vitest'
import {convert, parseRatesPayload, RatesFormatError, reviveSnapshot} from '@/domain/rates'

const valid = {base: 'USD', time_last_updated: 1790294401, rates: {USD: 1, RUB: 80, VND: 26000, EUR: 0.88}}

describe('parseRatesPayload', () => {
    it('accepts the documented shape', () => {
        const snap = parseRatesPayload(valid, 5)
        expect(snap.rates).toEqual({USD: 1, RUB: 80, VND: 26000, EUR: 0.88})
        expect(snap.providerTime).toBe(1790294401000)
        expect(snap.fetchedAt).toBe(5)
    })

    it('adds USD when the payload omits it', () => {
        const snap = parseRatesPayload({base: 'USD', rates: {RUB: 80}}, 0)
        expect(snap.rates.USD).toBe(1)
        expect(snap.providerTime).toBeNull()
    })

    it.each([
        ['null', null],
        ['a string', 'rates'],
        ['an array', []],
        ['no rates', {base: 'USD'}],
        ['rates null', {base: 'USD', rates: null}],
        ['rates array', {base: 'USD', rates: [1, 2]}],
        ['another base', {base: 'EUR', rates: {USD: 1.1, RUB: 90}}],
        ['no base', {rates: {USD: 1, RUB: 90}}],
        ['USD not 1', {base: 'USD', rates: {USD: 0.5, RUB: 90}}],
        ['only broken rates', {base: 'USD', rates: {RUB: null, VND: '26000', THB: -1}}],
        ['empty rates', {base: 'USD', rates: {}}],
    ])('throws on %s', (_name, payload) => {
        expect(() => parseRatesPayload(payload, 0)).toThrow(RatesFormatError)
    })

    it('drops single broken rates instead of turning them into 0', () => {
        const snap = parseRatesPayload({
            base: 'USD',
            rates: {USD: 1, RUB: 80, VND: null, THB: '33', KRW: 0, JPY: -1, CHF: Infinity, GBP: NaN, xx1: 5, EUR: 0.9},
        }, 0)
        expect(snap.rates).toEqual({USD: 1, RUB: 80, EUR: 0.9})
    })

    it('ignores a bogus timestamp', () => {
        expect(parseRatesPayload({...valid, time_last_updated: 'yesterday'}, 0).providerTime).toBeNull()
        expect(parseRatesPayload({...valid, time_last_updated: -1}, 0).providerTime).toBeNull()
    })
})

describe('reviveSnapshot', () => {
    const good = {rates: {USD: 1, RUB: 80}, providerTime: 1000, fetchedAt: 2000}

    it('restores a stored snapshot', () => {
        expect(reviveSnapshot(good)).toEqual(good)
        expect(reviveSnapshot({...good, providerTime: null})).toEqual({...good, providerTime: null})
    })

    it.each([
        ['null', null],
        ['number', 42],
        ['no fetchedAt', {rates: {USD: 1, RUB: 80}, providerTime: 1}],
        ['string fetchedAt', {...good, fetchedAt: '2000'}],
        ['string providerTime', {...good, providerTime: '1000'}],
        ['no rates', {providerTime: 1, fetchedAt: 2}],
        ['zero rates', {...good, rates: {USD: 1, RUB: 0}}],
    ])('rejects %s', (_name, value) => {
        expect(reviveSnapshot(value)).toBeNull()
    })
})

describe('convert', () => {
    const rates = {USD: 1, RUB: 80, VND: 26000}

    it('goes through USD', () => {
        expect(convert(100, 'USD', 'RUB', rates)).toBe(8000)
        expect(convert(8000, 'RUB', 'USD', rates)).toBe(100)
        expect(convert(80, 'RUB', 'VND', rates)).toBeCloseTo(26000)
    })

    it('returns the amount for the same currency', () => {
        expect(convert(5, 'RUB', 'RUB', rates)).toBe(5)
    })

    it('returns null, not 0, when a rate is unknown', () => {
        expect(convert(100, 'USD', 'THB', rates)).toBeNull()
        expect(convert(100, 'THB', 'USD', rates)).toBeNull()
        expect(convert(100, 'USD', 'RUB', null)).toBeNull()
        expect(convert(100, 'USD', 'RUB', {USD: 1, RUB: 0})).toBeNull()
    })
})
