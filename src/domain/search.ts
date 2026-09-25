import type {CurrencyInfo} from './currencies'

const fold = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/**
 * Every word of the query has to start the code or a word of the name, or equal the
 * symbol. Plain substring search would match "rub" inside "Aruban".
 */
export function matchesQuery(info: CurrencyInfo, query: string): boolean {
    const tokens = fold(query).split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return true
    const code = info.code.toLowerCase()
    const words = fold(info.name).split(/[\s\-()&.,]+/).filter(Boolean)
    const symbol = fold(info.symbol)
    return tokens.every((token) =>
        code.startsWith(token) || words.some((word) => word.startsWith(token)) || (symbol !== '' && symbol === token))
}
