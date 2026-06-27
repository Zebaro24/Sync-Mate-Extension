# Конфигурация и манифест

Полный справочник по настройке расширения Sync-Mate-Extension: единственная переменная окружения, деривация URL-ов, манифест MV3, артефакты сборки и алиасы путей.

> Все пути в этом документе указаны относительно корня под-проекта `Sync-Mate-Extension/`.
> Секреты (`.env.development`, `.env.production`) **не** хранятся в репозитории и здесь не приводятся — описываются только имена переменных.

---

## 1. Кратко (TL;DR)

| Что | Значение | Где задаётся |
|---|---|---|
| Единственная env-переменная | `WXT_BACKEND_URL` | `.env.development` / `.env.production` локально, repo variable в CI |
| Тип переменной | **build-time** (инлайнится в бандл) | `import.meta.env.WXT_BACKEND_URL` |
| Деривация | `API_URL = {BACKEND}/api`, `WS_URL = {BACKEND}/ws` (http→ws) | `src/shared/constants/api.ts` |
| Хардкод-домен | `REZKA_URL = "https://rezka.ag"` | `src/shared/constants/api.ts:2` |
| Имя расширения | `Sync-Mate` | `wxt.config.ts:21` |
| Алиас путей | `@/*` → `./src/*` | `tsconfig.json:9` |
| Главное правило | смена бэкенда требует **пересборки** | см. §8 |

---

## 2. Переменная окружения `WXT_BACKEND_URL`

Это **единственная** настраиваемая извне переменная всего расширения. Она задаёт базовый URL бэкенда (FastAPI + WebSocket-сервер из под-проекта `Sync-Mate-API-WS/`), от которого затем выводятся все сетевые адреса.

### 2.1. Префикс `WXT_` обязателен

WXT (как и Vite, на котором он построен) пробрасывает в клиентский код через `import.meta.env` **только** переменные с белым списком префиксов. Для WXT это `WXT_` (а также Vite-овский `VITE_`). Переменная без префикса — например `BACKEND_URL` — в бандл **не попадёт**, `import.meta.env.BACKEND_URL` окажется `undefined`, и расширение молча сломается на сетевых вызовах.

```
WXT_BACKEND_URL   ✅  попадает в import.meta.env
BACKEND_URL       ❌  WXT её игнорирует, в коде будет undefined
```

### 2.2. Только на этапе сборки (build-time), не runtime

Значение **инлайнится** в собранный JavaScript в момент `wxt build` / `wxt zip` / `wxt` (dev). Это не runtime-конфиг: в готовом расширении нет механизма прочитать переменную окружения — её там уже нет как переменной, есть только зашитая строка-литерал.

Прямое следствие — см. §8: **чтобы поменять бэкенд, расширение нужно пересобрать.** Нельзя «подкрутить» URL у уже установленного `.crx`/`.zip`.

### 2.3. Нормализация и валидация

Значение используется в **двух** местах, и в обоих обрезается завершающий слэш, чтобы `https://host/` и `https://host` давали одинаковый результат:

`src/shared/constants/api.ts:6-9`

```ts
const BACKEND_URL = ((import.meta.env.WXT_BACKEND_URL as string) || "").replace(
    /\/+$/,
    "",
);
```

`wxt.config.ts:16-19` (отдельная нормализация — манифест собирается до импорта `api.ts`):

```ts
// Backend URL может быть с trailing / в env — нормализуем.
const backendUrl = (
    (import.meta.env.WXT_BACKEND_URL as string) || ""
).replace(/\/+$/, "");
```

Если переменная не задана (пустая строка), `api.ts:11-16` пишет ошибку в консоль ещё на старте — чтобы не искать «молча сломанные» запросы:

```ts
if (!BACKEND_URL) {
    console.error(
        "[Sync-Mate] WXT_BACKEND_URL is not set — API/WS calls will fail.",
    );
}
```

> Важно: пустое значение **не** прерывает сборку. Бандл соберётся, но `API_URL` станет `"/api"`, а `WS_URL` — `"ws/ws"` (см. §3.2, regex по пустой строке даёт мусор). CI (`release.yml`) специально падает заранее, если repo variable отсутствует (см. §7).

---

## 3. Деривация URL-ов (`src/shared/constants/api.ts`)

Из одного `WXT_BACKEND_URL` модуль `api.ts` выводит все адреса. Это единственный источник правды для сетевых базовых URL.

### 3.1. Итоговые константы

| Константа | Формула | Пример (`WXT_BACKEND_URL=http://localhost:8000`) | Где объявлена |
|---|---|---|---|
| `REZKA_URL` | хардкод | `https://rezka.ag` | `api.ts:2` |
| `BACKEND_URL` (private) | `env.replace(/\/+$/, "")` | `http://localhost:8000` | `api.ts:6-9` |
| `API_URL` | `` `${BACKEND_URL}/api` `` | `http://localhost:8000/api` | `api.ts:18` |
| `WS_URL` | `` `${BACKEND_URL.replace(/^http/, "ws")}/ws` `` | `ws://localhost:8000/ws` | `api.ts:20` |

### 3.2. Преобразование схемы http→ws

`WS_URL` получается заменой **первого** `http` в начале строки на `ws`. Регекс `/^http/` без флага `g` срабатывает один раз и только в начале:

```ts
export const WS_URL = `${BACKEND_URL.replace(/^http/, "ws")}/ws`;
```

| Входной `BACKEND_URL` | `WS_URL` |
|---|---|
| `http://localhost:8000` | `ws://localhost:8000/ws` |
| `https://test-sm.zebaro.dev` | `wss://test-sm.zebaro.dev/ws` |
| `""` (не задано) | `ws/ws` ← сломано, отсюда `console.error` в §2.3 |

Трюк работает потому, что `https`.replace(`/^http/`, `ws`) даёт `wss` (заменяется только `http`, остаётся `s`). Так http→ws и https→wss получаются одной строкой.

### 3.3. Хардкод `REZKA_URL`

`REZKA_URL` **сознательно** не выведен в env (`api.ts:1`):

```ts
// Константа: домен видеохостинга. Не конфигурируется через env — её нет смысла менять.
export const REZKA_URL = "https://rezka.ag";
```

Расширение работает только с Rezka, и менять домен видеохостинга смысла нет. Этот же домен зашит в `manifest.host_permissions` и в `matches` content-скрипта (см. §5.3). Поддержка других сайтов — отдельная фича (`YouTubeLocators` и т.д.), не вопрос конфигурации; см. корневой `CLAUDE.md`.

### 3.4. Карта REST-маршрутов `API_ROUTES`

`api.ts:22-33` — относительные пути, дописываемые к `API_URL` (через `apiClient.baseURL`). Это не «конфигурация» в смысле env, но часть контракта с бэкендом:

| Ключ | Путь | Назначение |
|---|---|---|
| `ROOMS` | `/rooms` | список / создание комнат |
| `ROOM(id)` | `/rooms/{id}` | получение / обновление / удаление |
| `ROOM_REDIRECT(id)` | `/rooms/{id}/redirect` | редирект на видео комнаты |
| `REZKA_QUICK_SEARCH` | `/rezka/quick_search` | быстрый поиск |
| `REZKA_SEARCH` | `/rezka/search` | полный поиск |
| `REZKA_QUICK_INFO` | `/rezka/quick_info_movie` | краткая инфа |
| `REZKA_INFO_MOVIE` | `/rezka/info_movie` | подробная инфа |
| `REZKA_MOVIE_SOURCE` | `/rezka/movie_source` | источник фильма |
| `REZKA_SERIES_SOURCE` | `/rezka/series_source` | источник сериала |
| `INFO` | `/info` | служебный health/info |

### 3.5. Кто потребляет эти константы (code-flow)

| Константа | Потребитель | Что делает |
|---|---|---|
| `API_URL` | `src/shared/api/axios.ts:5` | `axios.create({ baseURL: API_URL, timeout: 10_000 })` — единый REST-клиент |
| `WS_URL` | `src/features/room/sockets/WebSocketClient.ts:20` | `new WebSocket(`${WS_URL}/${roomId}`)` — подключение к комнате |
| `API_URL` + `REZKA_URL` | `src/shared/utils/parseUrl.ts:3` | `parseUrls = [API_URL + "/*", REZKA_URL + "/*"]` — фильтр для `webRequest` (см. §5.2) |
| `REZKA_URL` | `src/shared/utils/parseUrl.ts:9` | определение типа открытой страницы (фильм/сериал) |

Пошагово, как один env-литерал расходится по коду:

1. `wxt build` инлайнит строку `WXT_BACKEND_URL` в `import.meta.env`.
2. `api.ts` нормализует её → `BACKEND_URL` → выводит `API_URL` / `WS_URL`.
3. `axios.ts` берёт `API_URL` как `baseURL` для всех REST-вызовов (таймаут 10 с).
4. `WebSocketClient.connect()` строит `` `${WS_URL}/${roomId}` `` и открывает сокет.
5. `parseUrl.ts` собирает `parseUrls` для фильтра `webRequest.onBeforeRequest` в `background.ts:74-89`.

---

## 4. Файлы `.env.*`

WXT грузит `.env`-файлы по соглашениям Vite. Локально используются два режима, плюс закоммиченный пример.

### 4.1. Состав и git-статус

| Файл | В репозитории? | Когда используется | Содержимое (только имя переменной) |
|---|---|---|---|
| `.env.example` | **Да** (закоммичен) | шаблон для разработчика | `WXT_BACKEND_URL=` |
| `.env.development` | Нет (gitignored) | `npm run dev` (`wxt`) | `WXT_BACKEND_URL=` → локальный URL (`http://localhost:8000`) |
| `.env.production` | Нет (gitignored) | `npm run build` / `wxt zip` (`NODE_ENV=production`) | `WXT_BACKEND_URL=` → прод-URL (`https://...`) |

Структурно все три файла идентичны — одна строка `WXT_BACKEND_URL=<url>`. Различаются **только значением**: dev указывает на localhost, production — на боевой/тестовый домен. Реальные значения здесь не приводятся (см. дисклеймер вверху и §SECRETS задания).

### 4.2. Правила `.gitignore`

`.gitignore:68-71` гарантирует, что секреты не утекут, а пример останется:

```gitignore
# dotenv environment variable files
.env
.env.*
!.env.example
```

То есть игнорируются все `.env*`, кроме `.env.example`. При первой настройке: скопировать пример и подставить значения.

```bash
cp .env.example .env.development   # вписать http://localhost:8000
cp .env.example .env.production    # вписать прод-URL (обычно создаётся CI, а не вручную)
```

### 4.3. Как WXT выбирает файл

WXT берёт `.env.development` при dev-команде (`wxt`) и `.env.production` при сборке с `NODE_ENV=production` (как делает `release.yml`, см. §7). Базовый `.env` (без суффикса) тоже подхватился бы, но в проекте не используется.

---

## 5. Манифест MV3 (`wxt.config.ts`)

Манифест **генерируется функцией**, а не статичным объектом — это нужно, чтобы подставить нормализованный `backendUrl` в `host_permissions` на этапе сборки.

`wxt.config.ts:15-36`:

```ts
manifest: () => {
    const backendUrl = (
        (import.meta.env.WXT_BACKEND_URL as string) || ""
    ).replace(/\/+$/, "");
    return {
        name: "Sync-Mate",
        web_accessible_resources: [
            { resources: ["icon/48.png"], matches: ["<all_urls>"] },
        ],
        permissions: ["clipboardWrite", "webRequest", "storage", "activeTab"],
        host_permissions: ["https://rezka.ag/*.html", `${backendUrl}/*`],
    };
},
```

> `name`, `version`, иконки и описание, не указанные явно, WXT берёт из `package.json` (`version: "0.1.0"`, `name`-fallback и т.д.) и собственных дефолтов. Версия в CI подменяется из git-тега (`release.yml:49-51`).

### 5.1. Имя

`name: "Sync-Mate"` (`wxt.config.ts:21`). Обратите внимание: имя пакета в `package.json` — `sync-mate-extension`, а отображаемое имя расширения — `Sync-Mate`.

### 5.2. Permissions

`permissions: ["clipboardWrite", "webRequest", "storage", "activeTab"]` (`wxt.config.ts:28-33`):

| Permission | Зачем нужен | Где используется |
|---|---|---|
| `clipboardWrite` | копировать ссылку-приглашение в комнату | `RoomCoordinator.ts:70` и `room-header.tsx:60` (`navigator.clipboard.writeText`) |
| `webRequest` | отслеживать переходы на страницы Rezka и redirect-URL комнат | `background.ts:74-89` — `webRequest.onBeforeRequest` с фильтром `{ urls: parseUrls }` |
| `storage` | хранить никнейм/настройки (`storage.local`) и state комнат по вкладкам (`storage.session`) | `src/shared/storage`, background SW |
| `activeTab` | доступ к активной вкладке для popup-действий | popup / взаимодействие с текущей страницей |

Поток `webRequest` пошагово (`background.ts:74-89`):

1. Слушатель `onBeforeRequest` срабатывает только на URL из `parseUrls` (= `API_URL/*` и `REZKA_URL/*`).
2. Игнорирует фоновые запросы без вкладки (`tabId < 0`).
3. `parseUrl(details.url)` определяет, фильм это/сериал на Rezka или `/rooms/{id}/redirect` API.
4. Если распознано — fire-and-forget `updateRoom(tabId, roomDetails)` (слушатель обязан вернуться синхронно).

### 5.3. Host permissions

`host_permissions: ["https://rezka.ag/*.html", `${backendUrl}/*`]` (`wxt.config.ts:34`):

| Хост | Источник | Назначение |
|---|---|---|
| `https://rezka.ag/*.html` | хардкод (совпадает с `REZKA_URL`) | content-скрипт и `webRequest` на страницах Rezka; ограничено `.html` |
| `${backendUrl}/*` | из `WXT_BACKEND_URL` (build-time) | REST/WS-запросы к бэкенду без CORS-блокировок |

> Поскольку второй хост подставляется из env **на этапе сборки**, смена `WXT_BACKEND_URL` меняет `host_permissions` в манифесте — ещё одна причина, по которой нельзя переключить бэкенд без пересборки (см. §8). Если в env пусто, в манифест попадёт `"/*"` — невалидный паттерн.

### 5.4. Web accessible resources

`web_accessible_resources` (`wxt.config.ts:22-27`) открывает `icon/48.png` для `<all_urls>` — иконку нужно подгружать в инлайн-UI на странице Rezka (overlay/бейджи), поэтому ресурс должен быть веб-доступным.

---

## 6. Прочие настройки `wxt.config.ts`

| Опция | Значение | Назначение |
|---|---|---|
| `srcDir` | `path.resolve("src")` | весь исходник в `src/` (нестандартно для WXT, по умолчанию корень) |
| `imports` | `false` | **отключён** авто-импорт WXT — все импорты явные |
| `entrypointsDir` | `"entrypoints"` | точки входа в `src/entrypoints/` |
| `modules` | `["@wxt-dev/module-react"]` | поддержка React (popup) |
| `vite` | `() => ({ plugins: [tailwindcss()] })` | Tailwind CSS 4 через Vite-плагин |
| `webExt.startUrls` | URL фильма на Rezka | при `npm run dev` браузер открывается сразу на тестовой странице |

### 6.1. Артефакты сборки (`zip`)

`wxt.config.ts:37-41`:

```ts
zip: {
    // {{name}}-{{version}}-{{browser}}.zip (CI читает по этой маске)
    artifactTemplate: "{{name}}-{{version}}-{{browser}}.zip",
    sourcesTemplate: "{{name}}-{{version}}-sources.zip",
},
```

| Шаблон | Пример имени | Кто читает |
|---|---|---|
| `artifactTemplate` | `Sync-Mate-0.1.0-chrome.zip`, `Sync-Mate-0.1.0-firefox.zip` | `release.yml` собирает `.output/*.zip` в GitHub Release |
| `sourcesTemplate` | `Sync-Mate-0.1.0-sources.zip` | требуется при ревью расширения в Firefox AMO |

Плейсхолдеры: `{{name}}` — из манифеста (`Sync-Mate`), `{{version}}` — из `package.json` (в CI подменяется тегом), `{{browser}}` — `chrome`/`firefox`. `npm run build` = `wxt zip` (`package.json:9`).

---

## 7. Интеграция с CI/CD

> Внимание о дрейфе документации: старый корневой `DOCUMENTATION.md` местами устарел. Доверяйте конфигам, а не ему. Актуально (по `.github/workflows/`):
> - В бэкенде `docker-compose.yml` — **один** сервис (`cloudflared` удалён в коммите `f0c7443`).
> - CI бэкенда тестируется **только на Python 3.13** (не 3.11/3.12).
> - CI расширения использует **Node 22** (ниже).

Расширение НЕ хранит `.env.production` в репозитории — его создаёт пайплайн релиза.

`.github/workflows/release.yml` (триггер: тег `v*` или ручной `workflow_dispatch`):

1. `release.yml:59-71` — берёт `vars.WXT_BACKEND_URL` (repo variable, **Settings → Secrets and variables → Actions → Variables**) и пишет в `.env.production`. Если переменной нет — workflow **падает заранее** с понятной ошибкой.
2. `release.yml:49-51` — синхронизирует версию `package.json` из git-тега (`npm version --no-git-tag-version`); WXT берёт её в манифест.
3. `release.yml:73-81` — собирает Chrome и Firefox zip с `NODE_ENV=production`.
4. `release.yml:86-96` — публикует `.output/*.zip` в GitHub Release.

`.github/workflows/ci.yml` (триггер: push/PR в `main`) — две джобы, обе на **Node 22**: `lint` (`npm ci` → `npm run lint`) и `tests` (`npm ci` → `npm run prepare` → `npm test`). CI **не** требует `WXT_BACKEND_URL` — он не собирает бандл, только линтит и гоняет тесты.

---

## 8. `@/*` — алиас путей (`tsconfig.json`)

`tsconfig.json:8-10`:

```json
"paths": {
  "@/*": ["./src/*"]
}
```

`@/` указывает на `src/`. Примеры из кода:

```ts
import { API_URL } from "@/shared/constants/api";   // → src/shared/constants/api.ts
import { setItem } from "@/shared/storage";          // → src/shared/storage
```

WXT/Vite резолвит алиас при сборке автоматически (синхронизирован с `srcDir: "src"`). `tsconfig.json` наследует базовый `./.wxt/tsconfig.json` (генерируется `wxt prepare`) и добавляет `allowImportingTsExtensions`, `allowJs`, `jsx: "react-jsx"`, `lib: ["ESNext", "DOM"]`. Внутри `src/` встречаются и относительные импорты (`../model/messageTypes`) — оба стиля валидны.

---

## 9. Смена бэкенда требует пересборки

Ключевое следствие build-time-природы `WXT_BACKEND_URL` (§2.2): **нельзя переключить расширение на другой бэкенд без полной пересборки.** URL зашит в бандл сразу в трёх местах:

1. `API_URL` / `WS_URL` — литералы внутри собранного JS (`api.ts`).
2. `host_permissions` манифеста — `${backendUrl}/*` (`wxt.config.ts:34`).
3. `parseUrls` для `webRequest` — производное от `API_URL` (`parseUrl.ts:3`).

Чтобы сменить бэкенд:

```bash
# 1. поправить значение WXT_BACKEND_URL
#    - локально:  .env.development или .env.production
#    - в CI:      repo variable WXT_BACKEND_URL (Actions → Variables)

# 2. пересобрать
npm run build        # production → .output/chrome-mv3/ + .zip

# 3. переустановить распакованное расширение / перевыпустить релиз
```

«Горячей» подмены URL у уже установленного расширения не существует — в готовом артефакте переменной окружения уже нет, есть только вкомпилированная строка.

---

## См. также

- [`../CLAUDE.md`](../CLAUDE.md) — гид по расширению (стек, архитектура, координаторы, locators).
- [`../../CLAUDE.md`](../../CLAUDE.md) — корневой гид по обоим под-проектам (WS-протокол, конвенции, ограничения).
- [`../../DOCUMENTATION.md`](../../DOCUMENTATION.md) — полная техническая документация (раздел про деплой частично устарел — см. §7).
- Соседние документы в этой папке `docs/` (архитектура, сборка, WS-протокол), если присутствуют.
