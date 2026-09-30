export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
    const result = list.slice()
    if (from < 0 || from >= list.length) return result
    const target = Math.max(0, Math.min(list.length - 1, to))
    const [item] = result.splice(from, 1)
    result.splice(target, 0, item)
    return result
}

/**
 * Index the dragged row should take: how many of the other rows' vertical centers lie
 * above the dragged row's center. `centers` are the other rows' centers in list order.
 */
export function dropIndex(centers: readonly number[], draggedCenter: number): number {
    let index = 0
    for (const center of centers) {
        if (draggedCenter > center) index++
    }
    return index
}
