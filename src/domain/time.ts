const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (n: number) => String(n).padStart(2, '0')

/** "24 Jul, 14:32" in local time; the year is added when it differs from `now`. */
export function formatUpdated(time: number, now: number): string {
    const date = new Date(time)
    const year = date.getFullYear() !== new Date(now).getFullYear() ? ` ${date.getFullYear()}` : ''
    return `${date.getDate()} ${MONTHS[date.getMonth()]}${year}, ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** "14:32" when `time` is on the same local day as `now`, otherwise as `formatUpdated`. */
export function formatChecked(time: number, now: number): string {
    const date = new Date(time)
    if (date.toDateString() !== new Date(now).toDateString()) return formatUpdated(time, now)
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export const STALE_AFTER_MS = 48 * 60 * 60 * 1000

export function isStale(time: number, now: number): boolean {
    return now - time > STALE_AFTER_MS
}

// Rates change once a day at the provider; this only bounds how long an open tab waits.
export const REFRESH_AFTER_MS = 30 * 60 * 1000
const FIRST_RETRY_MS = 60 * 1000

/** Pause after `failures` failed requests in a row: 1, 2, 4… minutes, at most 30. */
export function retryDelay(failures: number): number {
    return Math.min(FIRST_RETRY_MS * 2 ** Math.max(failures - 1, 0), REFRESH_AFTER_MS)
}
