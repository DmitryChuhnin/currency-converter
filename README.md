# currency-converter

Installable currency converter (PWA). Type an amount in any field and the
rest update. Pick your own list from 160+ currencies, reorder it by dragging.
Works offline with the last loaded rates.

## Stack

- Vue 3, TypeScript, Pinia
- Vite, `vite-plugin-pwa` (Workbox service worker caches the app shell)
- Rates from [exchangerate-api.com](https://www.exchangerate-api.com/) (open v4 endpoint, no key)

## Run

```bash
npm install
npm run dev
```

`npm run build` type-checks with `vue-tsc` and writes the bundle to `dist/`.
`npm test` runs unit tests, `npm run test:e2e` runs Playwright against the
production build, `npm run check` runs everything.
The app is built for the `/converter/` sub-path (see `base` in `vite.config.ts`).

The 2022 vanilla JS version lives in the git history before the Vue migration.
