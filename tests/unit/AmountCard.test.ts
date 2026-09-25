import {describe, expect, it} from 'vitest'
import {mount} from '@vue/test-utils'
import AmountCard from '@/components/AmountCard.vue'
import {currencyInfo} from '@/domain/currencies'

function card(props: Partial<{value: string; isSource: boolean; unavailable: boolean}> = {}) {
    return mount(AmountCard, {
        props: {
            info: currencyInfo('USD'),
            value: '',
            placeholder: '1.00',
            unavailable: false,
            isSource: false,
            fontSize: 24,
            ...props,
        },
    })
}

function input(el: HTMLInputElement, value: string, init: InputEventInit & {caret?: number} = {}) {
    el.value = value
    const caret = init.caret ?? value.length
    el.setSelectionRange(caret, caret)
    el.dispatchEvent(new InputEvent('input', {bubbles: true, inputType: 'insertText', ...init}))
}

describe('AmountCard', () => {
    it('leaves the value alone while an IME is composing', () => {
        const wrapper = card()
        const el = wrapper.find('input').element
        input(el, '１２', {isComposing: true})
        expect(el.value).toBe('１２')
        expect(wrapper.emitted('input')).toBeUndefined()

        el.dispatchEvent(new CompositionEvent('compositionend', {bubbles: true, data: '１２'}))
        expect(el.value).toBe('12')
        expect(wrapper.emitted('input')).toEqual([['12']])
    })

    it('deletes the digit after a group space on Delete', () => {
        const wrapper = card({value: '1 234', isSource: true})
        const el = wrapper.find('input').element
        input(el, '1234', {inputType: 'deleteContentForward', caret: 1})
        expect(el.value).toBe('134')
        expect(el.selectionStart).toBe(1)
        expect(wrapper.emitted('input')).toEqual([['134']])
    })

    it('deletes the digit before a group space on Backspace', () => {
        const wrapper = card({value: '1 234', isSource: true})
        const el = wrapper.find('input').element
        input(el, '1234', {inputType: 'deleteContentBackward', caret: 1})
        expect(el.value).toBe('234')
        expect(el.selectionStart).toBe(0)
    })

    it('does not make a converted field the source for a rejected keystroke', () => {
        const wrapper = card({value: '800.00'})
        const el = wrapper.find('input').element
        input(el, '800.005')
        expect(el.value).toBe('800.00')
        expect(wrapper.emitted('input')).toBeUndefined()
    })

    it('does not adopt a converted value above the limit', () => {
        const wrapper = card({value: '26 000 000 000 000 000'})
        const el = wrapper.find('input').element
        input(el, '26 000 000 000 000 0009')
        expect(el.value).toBe('26 000 000 000 000 000')
        expect(wrapper.emitted('input')).toBeUndefined()
    })

    it('reads dropped text with paste rules', () => {
        const wrapper = card()
        input(wrapper.find('input').element, '$1,234', {inputType: 'insertFromDrop'})
        expect(wrapper.emitted('input')).toEqual([['1234']])
    })

    it('ties the "No rate" note to the input for screen readers', () => {
        const wrapper = card({unavailable: true})
        const id = wrapper.find('.amount-card__warning').attributes('id')
        expect(id).toBeTruthy()
        expect(wrapper.find('input').attributes('aria-describedby')).toBe(id)
        expect(card().find('input').attributes('aria-describedby')).toBeUndefined()
    })
})
