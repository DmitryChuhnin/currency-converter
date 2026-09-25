import {createApp} from 'vue'
import {createPinia} from 'pinia'
import '@fontsource-variable/inter'
import App from './App.vue'

// The service worker is registered by registerSW.js, which vite-plugin-pwa injects.
createApp(App).use(createPinia()).mount('#app')
