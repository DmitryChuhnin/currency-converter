# Архитектура

Состояние на 2026-09-25, сверено с кодом в ветке `dev`.

## Состав

| Файл | Что делает |
|---|---|
| `src/main.ts` | монтирует Vue, подключает Pinia, регистрирует service worker |
| `src/components/CurrencyConverter.vue` | экран: список валют, статус загрузки, офлайн-плашка, кнопка обновления |
| `src/components/CurrencyBlock.vue` | поле ввода одной валюты |
| `src/stores/currency.ts` | курсы, значения полей, пересчёт, статус сети |
| `src/services/currencyService.ts` | запрос курсов |
| `src/utils/formatters.ts` | разбор и форматирование чисел |

Валюты зашиты в код: USD, RUB, VND, THB, KRW. Список живёт в трёх местах:
`CurrencyCode` в `src/types/currency.ts`, массив `currencies` в `CurrencyConverter.vue`
и литералы объектов в сторе. Новая валюта требует правки всех трёх.

## Курсы

Источник — `GET https://api.exchangerate-api.com/v4/latest/USD`, открытый endpoint без
ключа. Приложение берёт из ответа `rates.RUB`, `rates.VND`, `rates.THB`, `rates.KRW`,
USD считается равным 1.

Пересчёт идёт через USD: введённое значение делится на курс исходной валюты и
умножается на курс каждой целевой. Результат округляется до 2 знаков (`toFixed(2)`).

До первого ответа API стор держит курсы, зашитые в `src/stores/currency.ts`.

## Известные расхождения

Найдены чтением кода 2026-09-25, в браузере не воспроизводились.

- При ошибке запроса `CurrencyService.fetchRates` не бросает исключение, а возвращает
  курсы, равные 0. Стор принимает их как настоящие: плашка ошибки не появляется,
  а пересчёт делит на 0.
- Офлайн конвертер не работает, хотя оболочка приложения закеширована: поля ввода
  получают `:disabled="!isOnline"` в `CurrencyBlock.vue`.
- Правило `runtimeCaching` в `vite.config.ts` ловит `https://microverse.space/api/`,
  а курсы приходят с `api.exchangerate-api.com`. Ответ API service worker не кеширует.
- Service worker регистрируется дважды: скриптом `registerSW.js`, который вставляет
  `vite-plugin-pwa`, и вручную в `src/main.ts`. Оба регистрируют один файл
  `/converter/sw.js`.
- `index.html` ссылается на `/vite.svg`, а `includeAssets` в конфиге PWA на `favicon.ico`.
  Ни того, ни другого в `public/` нет.
