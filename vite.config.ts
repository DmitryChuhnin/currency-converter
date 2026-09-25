import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import {VitePWA} from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
    base: '/converter/', // ВАЖНО: базовый путь
    plugins: [
        vue(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico'],
            manifest: {
                name: 'Currency Converter',
                short_name: 'CurrConv',
                description: 'Simple PWA Currency Converter',
                theme_color: '#ffffff',
                background_color: '#ffffff',
                display: 'standalone',
                orientation: 'portrait',
                start_url: '/converter/', // Изменено!
                scope: '/converter/', // Добавлено!
                icons: [
                    {
                        src: '/converter/icon-192x192.svg', // Изменено!
                        sizes: '192x192',
                        type: 'image/svg+xml'
                    },
                    {
                        src: '/converter/icon-512x512.svg', // Изменено!
                        sizes: '512x512',
                        type: 'image/svg+xml'
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
                navigateFallback: '/converter/index.html', // Добавлено!
                navigateFallbackDenylist: [/^\/api/], // Исключаем API запросы
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/microverse\.space\/api\//,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'api-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 300 // 5 минут
                            }
                        }
                    }
                ]
            }
        })
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },
    css: {
        preprocessorOptions: {
            scss: {
                api: 'modern-compiler'
            }
        }
    }
})