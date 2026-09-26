<template>
  <div class="app">
    <HomeScreen v-if="screen === 'home'" ref="home" @edit="openEdit"/>
    <EditScreen v-else :focus-search="focusSearch" @close="closeEdit"/>
  </div>
</template>

<script setup lang="ts">
import {nextTick, onBeforeUnmount, onMounted, ref, watch} from 'vue'
import HomeScreen from './components/HomeScreen.vue'
import EditScreen from './components/EditScreen.vue'
import {useRatesStore} from './stores/rates'
import {useScreenHistory} from './composables/useScreenHistory'

// Retry pauses are whole minutes, see retryDelay.
const TICK_MS = 60 * 1000

const ratesStore = useRatesStore()
const {screen, open, close} = useScreenHistory()

const home = ref<InstanceType<typeof HomeScreen> | null>(null)
const focusSearch = ref(false)
let returnFocusTo: 'edit' | 'add' = 'edit'
let homeScroll = 0

function openEdit(adding: boolean) {
  focusSearch.value = adding
  returnFocusTo = adding ? 'add' : 'edit'
  homeScroll = window.scrollY
  open()
  window.scrollTo(0, 0)
}

function closeEdit() {
  close()
}

// Restore the home screen where the user left it, also after the system back gesture.
watch(screen, async (next) => {
  if (next !== 'home') return
  await nextTick()
  window.scrollTo(0, homeScroll)
  const target = returnFocusTo === 'add' ? home.value?.addButton : home.value?.editButton
  target?.focus({preventScroll: true})
})

const onOnline = () => ratesStore.setOnline(true)
const onOffline = () => ratesStore.setOnline(false)

function refreshIfDue() {
  if (document.visibilityState === 'visible') ratesStore.refreshIfDue()
}

let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  ratesStore.refresh()
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  document.addEventListener('visibilitychange', refreshIfDue)
  timer = setInterval(refreshIfDue, TICK_MS)
})

onBeforeUnmount(() => {
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
  document.removeEventListener('visibilitychange', refreshIfDue)
  clearInterval(timer)
})
</script>

<style lang="scss">
@use './styles.scss';

.app {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 480px;
  min-height: 100vh;
  min-height: 100dvh;
  margin: 0 auto;
  background: var(--c-surface);
  padding-top: env(safe-area-inset-top);

  > * {
    flex: 1;
  }
}

@media (min-width: 600px) {
  .app {
    margin: 32px auto;
    min-height: calc(100dvh - 64px);
    border-radius: 28px;
    box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
    overflow: clip;
  }
}
</style>
