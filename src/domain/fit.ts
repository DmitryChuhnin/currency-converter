export interface FitOptions {
    max: number
    min: number
}

/**
 * One font size for every amount: the largest integer size at which the widest text fits
 * `available` px. Text width grows linearly with font size, so one measurement at `max`
 * is enough.
 */
export function fitFontSize(
    texts: readonly string[],
    available: number,
    measureAtMax: (text: string) => number,
    {max, min}: FitOptions,
): number {
    if (available <= 0) return max
    let widest = 0
    for (const text of texts) {
        if (text) widest = Math.max(widest, measureAtMax(text))
    }
    if (widest <= available) return max
    const size = Math.floor((max * available) / widest)
    return Math.max(min, Math.min(max, size))
}
