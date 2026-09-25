import {defineConfig, devices} from '@playwright/test'

const PORT = 4174

export default defineConfig({
    testDir: 'tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 0,
    reporter: [['list']],
    use: {
        baseURL: `http://localhost:${PORT}/converter/`,
        timezoneId: 'UTC',
        locale: 'en-US',
        // Most tests mock the rates API with page.route; the PWA spec turns workers back on.
        serviceWorkers: 'block',
        trace: 'retain-on-failure',
    },
    projects: [
        {name: 'desktop-chromium', use: {...devices['Desktop Chrome']}},
        {name: 'iphone-webkit', use: {...devices['iPhone 14']}},
        {name: 'android-chromium', use: {...devices['Pixel 7']}},
    ],
    webServer: {
        // The production build, so the service worker and base path are the real ones.
        command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}/converter/`,
        reuseExistingServer: false,
        timeout: 120_000,
    },
})
