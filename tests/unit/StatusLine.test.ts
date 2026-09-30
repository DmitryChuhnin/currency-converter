import {beforeEach, describe, expect, it, vi} from 'vitest'
import {mount} from '@vue/test-utils'
import {createPinia, setActivePinia} from 'pinia'
import StatusLine from '@/components/StatusLine.vue'
import {useRatesStore} from '@/stores/rates'
import {RatesError} from '@/services/ratesApi'

const DAY = 24 * 3600e3
const T = new Date(2026, 8, 25, 3, 0).getTime()

function setup(patch: Partial<{time: number | null; loading: boolean; error: RatesError | null; online: boolean; now: number}>) {
    const store = useRatesStore()
    const time = patch.time === undefined ? T : patch.time
    store.snapshot = time === null ? null : {rates: {USD: 1, RUB: 80}, providerTime: time, fetchedAt: time}
    store.loading = patch.loading ?? false
    store.error = patch.error ?? null
    store.online = patch.online ?? true
    store.tick(patch.now ?? T + 3600e3)
    return mount(StatusLine)
}

beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
})

describe('StatusLine', () => {
    it.each([
        ['fresh rates', {}, 'Updated 25 Sep, 03:00', false],
        ['first load', {time: null, loading: true}, 'Loading rates…', false],
        ['nothing and not loading', {time: null}, 'No rates yet', false],
        ['refreshing', {loading: true}, 'Updating…', false],
        ['offline', {online: false}, 'Offline · rates from 25 Sep, 03:00', true],
        ['offline error', {error: new RatesError('offline', '')}, 'Offline · rates from 25 Sep, 03:00', true],
        ['failed update', {error: new RatesError('http', '', 500)}, "Couldn't update · rates from 25 Sep, 03:00", true],
        ['stale rates', {now: T + 3 * DAY}, 'Outdated · rates from 25 Sep, 03:00', true],
    ] as const)('%s', (_name, patch, text, warn) => {
        const wrapper = setup(patch)
        const button = wrapper.find('button')
        expect(wrapper.find('.status__text').text()).toBe(text)
        expect(wrapper.find('[role="status"]').text()).toBe(text)
        // The button's name carries the status for screen readers, not only the action.
        expect(button.text()).toBe(`${text} · Refresh rates`)
        expect(button.find('[role="status"]').exists()).toBe(false)
        expect(button.classes('status--warn')).toBe(warn)
    })

    it('refreshes on click and is disabled while loading', async () => {
        const wrapper = setup({})
        const store = useRatesStore()
        const refresh = vi.spyOn(store, 'refresh').mockResolvedValue()
        await wrapper.find('button').trigger('click')
        expect(refresh).toHaveBeenCalledTimes(1)
        store.loading = true
        await wrapper.vm.$nextTick()
        expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    })
})
