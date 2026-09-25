import {afterEach, describe, expect, it, vi} from 'vitest'
import {readJson, writeJson} from '@/services/storage'

const asNumber = (v: unknown) => (typeof v === 'number' ? v : null)

afterEach(() => localStorage.clear())

describe('storage', () => {
    it('round-trips a value', () => {
        expect(writeJson('k', 5)).toBe(true)
        expect(readJson('k', asNumber)).toBe(5)
    })

    it('returns null for a missing key, broken JSON and a value the validator rejects', () => {
        expect(readJson('missing', asNumber)).toBeNull()
        localStorage.setItem('k', '{not json')
        expect(readJson('k', asNumber)).toBeNull()
        localStorage.setItem('k', '"five"')
        expect(readJson('k', asNumber)).toBeNull()
    })

    it('survives a storage that throws on every call', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('denied', 'SecurityError')
        })
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('full', 'QuotaExceededError')
        })
        expect(readJson('k', asNumber)).toBeNull()
        expect(writeJson('k', 1)).toBe(false)
    })
})
