import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import {VitePWA} from 'vite-plugin-pwa'
import path from 'path'

// The app is served from /converter/. Manifest paths below repeat this prefix by hand.
const BASE = '/converter/'

export default defineConfig({
    base: BASE,
    plugins: [
        vue(),
        VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'script',
            includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
            manifest: {
                name: 'Currency Converter',
                short_name: 'Converter',
                description: 'Convert between many currencies at once, also offline',
                theme_color: '#ffffff',
                background_color: '#ffffff',
                display: 'standalone',
                orientation: 'portrait',
                start_url: BASE,
                scope: BASE,
                icons: [
                    {src: `${BASE}icon-192.png`, sizes: '192x192', type: 'image/png'},
                    {src: `${BASE}icon-512.png`, sizes: '512x512', type: 'image/png'},
                    // Full-bleed: launchers crop maskable icons to their own shape.
                    {src: `${BASE}icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable'},
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
                // The UI is English: other Inter subsets load on demand and are not worth
                // precaching.
                globIgnores: ['**/inter-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese,latin-ext}-*.woff2'],
                navigateFallback: `${BASE}index.html`,
                // Take over the page on the first visit, so it works offline right away.
                clientsClaim: true,
                skipWaiting: true,
                // Rates are not cached here: the app keeps the last good response itself
                // and must know when a request really failed.
                runtimeCaching: [],
            },
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    css: {
        preprocessorOptions: {
            scss: {
                api: 'modern-compiler',
            },
        },
    },
})
