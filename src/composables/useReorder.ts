import {onBeforeUnmount, ref, type Ref} from 'vue'
import {dropIndex} from '@/domain/reorder'

const EDGE_PX = 64
const MAX_SCROLL_STEP = 14

interface DragState {
    from: number
    pointerId: number
    startY: number
    startScroll: number
    /** Rows' vertical centers at drag start, in page coordinates. */
    centers: number[]
    /** How far the other rows slide to make room: dragged row height + gap. */
    step: number
    handle: HTMLElement
}

/**
 * Drag to reorder with pointer events, so mouse and touch share one path. The rows move
 * with transforms only; the list itself changes once, on drop, through `onMove`.
 */
export function useReorder(list: Ref<HTMLElement | null>, onMove: (from: number, to: number) => void) {
    const dragging = ref<number | null>(null)
    const target = ref<number | null>(null)
    const offset = ref(0)

    let state: DragState | null = null
    let lastClientY = 0
    let frame = 0

    function rows(): HTMLElement[] {
        return list.value ? (Array.from(list.value.children) as HTMLElement[]) : []
    }

    function start(event: PointerEvent, index: number) {
        if (state || (event.pointerType === 'mouse' && event.button !== 0)) return
        const els = rows()
        const el = els[index]
        if (!el) return
        event.preventDefault()

        const handle = event.currentTarget as HTMLElement
        handle.setPointerCapture?.(event.pointerId)
        const rects = els.map((row) => row.getBoundingClientRect())
        const next = rects[index + 1] ?? rects[index - 1]
        const gap = next ? Math.abs(next.top - rects[index].top) - rects[index].height : 0

        state = {
            from: index,
            pointerId: event.pointerId,
            startY: event.clientY,
            startScroll: window.scrollY,
            centers: rects.map((r) => r.top + window.scrollY + r.height / 2),
            step: rects[index].height + Math.max(0, gap),
            handle,
        }
        lastClientY = event.clientY
        dragging.value = index
        target.value = index
        offset.value = 0

        handle.addEventListener('pointermove', move)
        handle.addEventListener('pointerup', end)
        handle.addEventListener('pointercancel', cancel)
        frame = requestAnimationFrame(autoScroll)
    }

    function update() {
        if (!state) return
        offset.value = lastClientY - state.startY + (window.scrollY - state.startScroll)
        const others = state.centers.filter((_, i) => i !== state!.from)
        target.value = dropIndex(others, state.centers[state.from] + offset.value)
    }

    function move(event: PointerEvent) {
        if (!state || event.pointerId !== state.pointerId) return
        lastClientY = event.clientY
        update()
    }

    // Keeps the page scrolling while the finger rests near the top or bottom edge.
    function autoScroll() {
        if (!state) return
        const fromBottom = window.innerHeight - lastClientY
        let delta = 0
        if (lastClientY < EDGE_PX) delta = -MAX_SCROLL_STEP * (1 - lastClientY / EDGE_PX)
        else if (fromBottom < EDGE_PX) delta = MAX_SCROLL_STEP * (1 - fromBottom / EDGE_PX)
        if (delta) {
            window.scrollBy(0, delta)
            update()
        }
        frame = requestAnimationFrame(autoScroll)
    }

    function finish(commit: boolean) {
        if (!state) return
        const {from, handle, pointerId} = state
        const to = target.value ?? from
        handle.removeEventListener('pointermove', move)
        handle.removeEventListener('pointerup', end)
        handle.removeEventListener('pointercancel', cancel)
        if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId)
        cancelAnimationFrame(frame)
        state = null
        dragging.value = null
        target.value = null
        offset.value = 0
        if (commit && to !== from) onMove(from, to)
    }

    const end = () => finish(true)
    const cancel = () => finish(false)

    /** Transform for row `index` while a drag is in progress. */
    function shift(index: number): number {
        if (dragging.value === null || target.value === null || !state) return 0
        const from = dragging.value
        const to = target.value
        if (index === from) return offset.value
        if (from < to && index > from && index <= to) return -state.step
        if (from > to && index < from && index >= to) return state.step
        return 0
    }

    onBeforeUnmount(() => finish(false))

    return {dragging, start, shift}
}
