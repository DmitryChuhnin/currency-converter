import {onBeforeUnmount, onMounted, ref, watch, type Ref} from 'vue'
import {fitFontSize, type FitOptions} from '@/domain/fit'

export const AMOUNT_FONT: FitOptions = {max: 24, min: 12}
// The same family and weight as .amount-card__input; canvas cannot read CSS variables.
const FONT_FAMILY = '"Inter Variable", Inter, system-ui, sans-serif'
// Room for the caret and rounding between canvas and layout.
const SLACK_PX = 6

/**
 * One font size for every amount on the screen, the largest at which the longest value
 * fits its field. `probe` is any amount input: all of them have the same width.
 */
export function useFitFontSize(texts: Ref<readonly string[]>, probe: Ref<HTMLInputElement | null>) {
    const size = ref(AMOUNT_FONT.max)
    let ctx: CanvasRenderingContext2D | null = null
    let observer: ResizeObserver | null = null

    function measure(text: string): number {
        ctx ??= document.createElement('canvas').getContext('2d')
        if (!ctx) return 0
        ctx.font = `700 ${AMOUNT_FONT.max}px ${FONT_FAMILY}`
        return ctx.measureText(text).width
    }

    function update() {
        const input = probe.value
        if (!input) return
        const style = getComputedStyle(input)
        const available = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - SLACK_PX
        size.value = fitFontSize(texts.value, available, measure, AMOUNT_FONT)
    }

    watch([texts, probe], update, {flush: 'post'})

    onMounted(() => {
        update()
        if (typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(update)
            watch(probe, (el, old) => {
                if (old) observer?.unobserve(old)
                if (el) observer?.observe(el)
            }, {immediate: true})
        }
        // Widths measured with a fallback font are wrong once Inter arrives.
        document.fonts?.ready.then(update).catch(() => {})
    })

    onBeforeUnmount(() => observer?.disconnect())

    return size
}
