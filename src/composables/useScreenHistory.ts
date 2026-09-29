import {onBeforeUnmount, onMounted, ref} from 'vue'

export type Screen = 'home' | 'edit'

const isEdit = (state: unknown) => (state as {screen?: unknown} | null)?.screen === 'edit'

/**
 * The edit screen is a history entry, so the system back gesture (Android, iOS swipe,
 * browser button) closes it instead of leaving the app.
 */
export function useScreenHistory() {
    const screen = ref<Screen>(isEdit(history.state) ? 'edit' : 'home')
    // history.back() is async: until popstate, history.state still says edit, and a
    // second tap would go back once more and leave the app.
    let goingBack = false

    function onPopState(event: PopStateEvent) {
        goingBack = false
        screen.value = isEdit(event.state) ? 'edit' : 'home'
    }

    function open() {
        if (screen.value === 'edit' || goingBack) return
        history.pushState({screen: 'edit'}, '')
        screen.value = 'edit'
    }

    function close() {
        if (screen.value !== 'edit' || goingBack) return
        if (isEdit(history.state)) {
            goingBack = true
            history.back()
        }
        screen.value = 'home'
    }

    onMounted(() => window.addEventListener('popstate', onPopState))
    onBeforeUnmount(() => window.removeEventListener('popstate', onPopState))

    return {screen, open, close}
}
