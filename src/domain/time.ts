const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (n: number) => String(n).padStart(2, '0')

/** "24 Jul, 14:32" in local time; the year is added when it differs from `now`. */
export function formatUpdated(time: number, now: number): string {
    const date = new Date(time)
    const year = date.getFullYear() !== new Date(now).getFullYear() ? ` ${date.getFullYear()}` : ''
    return `${date.getDate()} ${MONTHS[date.getMonth()]}${year}, ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export const STALE_AFTER_MS = 48 * 60 * 60 * 1000

export function isStale(time: number, now: number): boolean {
    return now - time > STALE_AFTER_MS
}
