/**
 * The worker of a new build takes over open pages at once (skipWaiting, clientsClaim), but a
 * page keeps running the bundle it loaded. Reloading shows the deploy on this very launch.
 */
export function reloadOnWorkerUpdate(container: ServiceWorkerContainer | undefined, reload: () => void) {
    // No controller: the first visit, which clientsClaim takes over without a new build.
    if (!container?.controller) return
    container.addEventListener('controllerchange', () => reload(), {once: true})
}
