import {afterEach, describe, expect, it, vi} from 'vitest'
import {watchWorkerUpdates} from '@/services/workerUpdate'

type Start = 'first visit' | 'controlled' | 'uncontrolled, worker active'

function fakeContainer(start: Start) {
    const registration = {active: start === 'first visit' ? null : {}}
    const container = Object.assign(new EventTarget(), {
        controller: start === 'controlled' ? {} : null,
        getRegistration: () => Promise.resolve(start === 'first visit' ? undefined : registration),
    }) as unknown as ServiceWorkerContainer
    return {container}
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

let visibility: DocumentVisibilityState = 'visible'
function setVisibility(state: DocumentVisibilityState) {
    visibility = state
    document.dispatchEvent(new Event('visibilitychange'))
}

const stops: (() => void)[] = []
function watch(container: ServiceWorkerContainer | undefined) {
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
    const reload = vi.fn()
    stops.push(watchWorkerUpdates(container, {reload}))
    return reload
}

async function takeOver(container: ServiceWorkerContainer) {
    container.dispatchEvent(new Event('controllerchange'))
    await flush()
}

afterEach(() => {
    stops.splice(0).forEach((stop) => stop())
    visibility = 'visible'
})

describe('watchWorkerUpdates', () => {
    it('reloads an untouched page at once when a new worker takes it over, and only once', async () => {
        const {container} = fakeContainer('controlled')
        const reload = watch(container)
        await flush()
        expect(reload).not.toHaveBeenCalled()
        await takeOver(container)
        await takeOver(container)
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it.each(['pointerdown', 'keydown', 'focusin'])('after a %s the reload waits until the page is hidden', async (type) => {
        const {container} = fakeContainer('controlled')
        const reload = watch(container)
        window.dispatchEvent(new Event(type))
        await takeOver(container)
        expect(reload).not.toHaveBeenCalled()

        setVisibility('visible')
        expect(reload).not.toHaveBeenCalled()
        setVisibility('hidden')
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it('reloads a touched page at once if it is hidden when the new worker takes over', async () => {
        const {container} = fakeContainer('controlled')
        const reload = watch(container)
        window.dispatchEvent(new Event('pointerdown'))
        visibility = 'hidden'
        await takeOver(container)
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it('a page hidden without a new worker does not reload', async () => {
        const {container} = fakeContainer('controlled')
        const reload = watch(container)
        window.dispatchEvent(new Event('pointerdown'))
        setVisibility('hidden')
        expect(reload).not.toHaveBeenCalled()
    })

    it('on the first visit the first worker claiming the page is not a new build, the next one is', async () => {
        const {container} = fakeContainer('first visit')
        const reload = watch(container)
        await takeOver(container)
        expect(reload).not.toHaveBeenCalled()
        await takeOver(container)
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it('a page loaded without a controller while the scope had a worker reloads for a new build', async () => {
        const {container} = fakeContainer('uncontrolled, worker active')
        const reload = watch(container)
        await takeOver(container)
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it('stops reacting once stopped', async () => {
        const {container} = fakeContainer('controlled')
        const reload = watch(container)
        stops.pop()!()
        await takeOver(container)
        expect(reload).not.toHaveBeenCalled()
    })

    it('does nothing without service worker support', () => {
        const reload = vi.fn()
        expect(() => stops.push(watchWorkerUpdates(undefined, {reload}))).not.toThrow()
        expect(reload).not.toHaveBeenCalled()
    })
})
