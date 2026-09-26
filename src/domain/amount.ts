export const MAX_AMOUNT = 1e12
export const MAX_DECIMALS = 2

const GROUPING_CHARS = /[\s'’_]/g

/**
 * Canonical form of the field: digits, at most one '.' and MAX_DECIMALS decimals, no leading
 * zeros. ',' is decimal too, the iOS decimal pad in ru locale shows it. Paste: see readPasted().
 */
export function normalizeInput(raw: string, previous = '', paste = false): string {
    const text = paste ? readPasted(raw) : toPlain(raw)
    // A second separator would move the decimal point of the number, so it is ignored.
    if (previous.includes('.') && (text.match(/[.,]/g)?.length ?? 0) > 1) return previous
    const result = clean(text)
    const n = Number(result)
    // Growing past the limit is ignored; a converted amount above it still needs Backspace.
    if (result !== '' && n > MAX_AMOUNT && n >= Number(previous || 0)) return previous
    return result
}

/**
 * Where the caret goes after normalization: the length of the normalized text before it.
 * Counting raw characters fails when normalization adds some (".5" becomes "0.5").
 */
export function caretAfterNormalize(rawBeforeCaret: string, formatted: string): number {
    const before = clean(toPlain(rawBeforeCaret))
    // A zero typed in front of digits is dropped from the whole value, not only the prefix.
    if (before === '0' && !formatted.startsWith('0')) return 0
    return caretIndex(formatted, before.length)
}

/** Pasted or dropped text with its foreign grouping removed and one decimal separator at most. */
export function readPasted(raw: string): string {
    return separatorsForPaste(toPlain(raw))
}

// Full-width forms come from CJK IMEs, the others from Arabic and Persian keyboards.
const DIGIT_ZEROS = [0xff10, 0x0660, 0x06f0]
const FOREIGN_CHARS = /[\uff10-\uff19\u0660-\u0669\u06f0-\u06f9\uff0e\uff0c\u066b\u066c]/g

function toAscii(char: string): string {
    const code = char.charCodeAt(0)
    for (const zero of DIGIT_ZEROS) {
        if (code >= zero && code <= zero + 9) return String(code - zero)
    }
    if (char === '\uff0e' || char === '\u066b') return '.'
    if (char === '\uff0c') return ','
    return '' // U+066C Arabic thousands separator
}

function toPlain(raw: string): string {
    return raw.replace(FOREIGN_CHARS, toAscii).replace(GROUPING_CHARS, '')
}

function clean(plain: string): string {
    const text = plain.replace(/,/g, '.').replace(/[^\d.]/g, '')

    const dot = text.indexOf('.')
    let int = dot === -1 ? text : text.slice(0, dot)
    let frac = dot === -1 ? null : text.slice(dot + 1).replace(/\./g, '').slice(0, MAX_DECIMALS)

    int = int.replace(/^0+(?=\d)/, '')
    if (int === '' && frac !== null) int = '0'

    return frac === null ? int : `${int}.${frac}`
}

// Pasted text comes with someone else's grouping: "1,234.56", "1.234,56", "1,234,567".
// The last separator is decimal when both kinds are present; a repeated one is grouping.
// A single comma before exactly three digits is grouping too ("$1,234"): reading it as
// a decimal would cut the amount a thousand times. A single dot stays decimal, since
// "1.234" is a normal amount in KWD, BHD and OMR.
function separatorsForPaste(text: string): string {
    const lastDot = text.lastIndexOf('.')
    const lastComma = text.lastIndexOf(',')
    if (lastDot !== -1 && lastComma !== -1) {
        return lastDot > lastComma
            ? text.replace(/,/g, '')
            : text.replace(/\./g, '').replace(',', '.')
    }
    const sep = lastDot !== -1 ? '.' : ','
    const parts = text.split(sep)
    if (parts.length > 2) return parts.join('')
    if (sep === ',' && parts.length === 2 && /[1-9]\d*$/.test(parts[0]) && /^\d{3}(?!\d)/.test(parts[1])) {
        return parts.join('')
    }
    return text
}

/** Canonical "1234567.5" → "1 234 567.5" for the input field. */
export function groupDigits(canonical: string): string {
    const dot = canonical.indexOf('.')
    const int = dot === -1 ? canonical : canonical.slice(0, dot)
    const rest = dot === -1 ? '' : canonical.slice(dot)
    return int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + rest
}

/** Parses canonical input. Empty or a lone "0." still counts as a number where it can. */
export function parseCanonical(canonical: string): number | null {
    if (canonical === '' || canonical === '.') return null
    const n = Number(canonical)
    return Number.isFinite(n) ? n : null
}

const twoDecimals = new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})
const noDecimals = new Intl.NumberFormat('en-US', {maximumFractionDigits: 0})
const tiny = new Intl.NumberFormat('en-US', {maximumSignificantDigits: 2})

/**
 * Converted amount for display. Two decimals; no decimals from a billion up so VND and
 * KRW fit; two significant digits below 0.01, because "0.00" would claim a wrong value.
 */
export function formatAmount(value: number): string {
    if (!Number.isFinite(value)) throw new RangeError(`Cannot format ${value}`)
    const abs = Math.abs(value)
    let text: string
    if (abs === 0) text = twoDecimals.format(0)
    else if (abs < 0.01) text = tiny.format(value)
    else if (abs >= 1e9) text = noDecimals.format(value)
    else text = twoDecimals.format(value)
    return text.replace(/,/g, ' ')
}

/** Caret index in `formatted` right after the `significant`-th digit or separator. */
export function caretIndex(formatted: string, significant: number): number {
    if (significant <= 0) return 0
    let seen = 0
    for (let i = 0; i < formatted.length; i++) {
        if (formatted[i] !== ' ') seen++
        if (seen === significant) return i + 1
    }
    return formatted.length
}
