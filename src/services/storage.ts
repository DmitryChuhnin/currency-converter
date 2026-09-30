// localStorage throws in some private modes and when full; a broken value must not
// break startup. Every read goes through a validator and falls back to null.

export function readJson<T>(key: string, revive: (value: unknown) => T | null): T | null {
    try {
        const raw = window.localStorage.getItem(key)
        if (raw === null) return null
        return revive(JSON.parse(raw))
    } catch {
        return null
    }
}

export function writeJson(key: string, value: unknown): boolean {
    try {
        window.localStorage.setItem(key, JSON.stringify(value))
        return true
    } catch {
        return false
    }
}

export const STORAGE_KEYS = {
    rates: 'converter.rates.v1',
    selection: 'converter.selection.v1',
} as const
