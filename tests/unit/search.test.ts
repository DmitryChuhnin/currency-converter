import {describe, expect, it} from 'vitest'
import {matchesQuery} from '@/domain/search'
import {CURRENCIES, currencyInfo} from '@/domain/currencies'

const find = (query: string) => [...CURRENCIES.values()].filter((info) => matchesQuery(info, query)).map((i) => i.code)

describe('matchesQuery', () => {
    it('matches everything for an empty or blank query', () => {
        expect(matchesQuery(currencyInfo('USD'), '')).toBe(true)
        expect(matchesQuery(currencyInfo('USD'), '   ')).toBe(true)
    })

    it('matches a code prefix in any case', () => {
        expect(find('eur')).toEqual(['EUR'])
        expect(find('KR')).toEqual(expect.arrayContaining(['KRW']))
    })

    it('matches the start of a name word, not the middle', () => {
        expect(find('rub')).toEqual(['BYN', 'RUB'])
        expect(find('rub')).not.toContain('AWG')
    })

    it('ignores accents and needs every word', () => {
        expect(find('cordoba')).toEqual(['NIO'])
        expect(find('south kor')).toEqual(['KRW'])
        expect(find('south dollar')).toEqual([])
    })

    it('matches a symbol exactly', () => {
        expect(find('₫')).toEqual(['VND'])
        expect(find('$').length).toBeGreaterThan(10)
    })

    it('finds nothing for junk', () => {
        expect(find('zzzz')).toEqual([])
        expect(find('.*')).toEqual([])
    })
})
