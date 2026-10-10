import {describe, expect, it, vi} from 'vitest'
import {reloadOnWorkerUpdate} from '@/services/workerUpdate'

function fakeContainer(controller: object | null) {
    return Object.assign(new EventTarget(), {controller}) as unknown as ServiceWorkerContainer
}

describe('reloadOnWorkerUpdate', () => {
    it('reloads a page that had a worker once a new worker takes it over', () => {
        const container = fakeContainer({})
        const reload = vi.fn()
        reloadOnWorkerUpdate(container, reload)
        expect(reload).not.toHaveBeenCalled()
        container.dispatchEvent(new Event('controllerchange'))
        container.dispatchEvent(new Event('controllerchange'))
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it('does not reload on the first visit, when the first worker claims the page', () => {
        const container = fakeContainer(null)
        const reload = vi.fn()
        reloadOnWorkerUpdate(container, reload)
        container.dispatchEvent(new Event('controllerchange'))
        expect(reload).not.toHaveBeenCalled()
    })

    it('does nothing without service worker support', () => {
        const reload = vi.fn()
        expect(() => reloadOnWorkerUpdate(undefined, reload)).not.toThrow()
        expect(reload).not.toHaveBeenCalled()
    })
})
