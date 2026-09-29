import {createApp} from 'vue'
import {createPinia} from 'pinia'
import '@fontsource-variable/inter'
import App from './App.vue'

// The service worker is registered by registerSW.js, which vite-plugin-pwa injects.
createApp(App).use(createPinia()).mount('#app')

// The pre-redesign worker cached API responses under this name. Workbox cleans up only
// its precache, so the leftover is removed here.
if ('caches' in window) caches.delete('api-cache').catch(() => undefined)
