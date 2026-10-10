// After any of these a reload would take something from the user: a typed amount, the open
// keyboard, a search, a drag.
const USER_INPUT = ['pointerdown', 'keydown', 'focusin'] as const

export interface WorkerUpdateOptions {
    reload?: () => void
}

/**
 * The worker of a new build takes over open pages at once (skipWaiting, clientsClaim), but a
 * page keeps running the bundle it loaded until it reloads. Returns a function that stops
 * watching.
 */
export function watchWorkerUpdates(
    container: ServiceWorkerContainer | undefined,
    {reload = () => location.reload()}: WorkerUpdateOptions = {},
): () => void {
    const watching = new AbortController()
    const stop = () => watching.abort()
    if (!container) return stop
    const {signal} = watching

    let touched = false
    let reloadWhenHidden = false
    let reloaded = false

    for (const type of USER_INPUT) window.addEventListener(type, () => (touched = true), {capture: true, signal})

    function reloadOnce() {
        if (reloaded) return
        reloaded = true
        reload()
    }

    // Without an active worker at load, the first takeover is that worker claiming the page and
    // only later ones are new builds. A hard reload loads the page without a controller past an
    // active worker, so the controller is not the test.
    const firstWorker = container.getRegistration().then((reg) => !reg?.active, () => !container.controller)
    let takeovers = 0

    container.addEventListener('controllerchange', () => {
        const takeover = ++takeovers
        void firstWorker.then((first) => {
            if (first && takeover === 1) return
            // The typed amount is not stored: a page the user touched waits until they leave it.
            if (document.visibilityState === 'hidden' || !touched) reloadOnce()
            else reloadWhenHidden = true
        })
    }, {signal})

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && reloadWhenHidden) reloadOnce()
    }, {signal})

    return stop
}
