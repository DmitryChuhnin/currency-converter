import {createApp} from 'vue'
import {createPinia} from 'pinia'
import '@fontsource-variable/inter'
import App from './App.vue'
import {reloadOnWorkerUpdate} from './services/workerUpdate'

// The service worker is registered by registerSW.js, which vite-plugin-pwa injects.
createApp(App).use(createPinia()).mount('#app')

// Undefined outside a secure context.
reloadOnWorkerUpdate(navigator.serviceWorker as ServiceWorkerContainer | undefined, () => location.reload())
