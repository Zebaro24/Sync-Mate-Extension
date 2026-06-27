# Архитектура расширения Sync-Mate

Определяющий справочник по устройству браузерного расширения `Sync-Mate-Extension`: стек, слои, Coordinator-паттерн, поток инициализации content-скрипта и правила направления импортов.

---

## 1. Стек и платформа

| Слой | Технология | Версия (см. `package.json`) | Где используется |
|---|---|---|---|
| Фреймворк расширения | [WXT](https://wxt.dev) поверх Vite | `wxt ^0.20.11` | весь проект, генерация MV3-манифеста, dev-сервер, сборка |
| Manifest | **MV3** (Chromium-target) | — | `wxt.config.ts:15-36` |
| UI popup | React + ReactDOM | `react ^19.1.0` / `react-dom ^19.1.0` | только `entrypoints/popup/**` |
| Серверный стейт popup | TanStack Query | `@tanstack/react-query ^5.90.21` | `features/room/hooks/use-room.ts` |
| Иконки popup | Heroicons | `@heroicons/react ^2.2.0` | `features/room/components/**` |
| Стили popup | Tailwind CSS 4 | `tailwindcss ^4.1.13` через `@tailwindcss/vite` | `entrypoints/popup/style.css`, JSX-классы |
| Язык | TypeScript | `typescript ^5.8.3` | весь проект |
| REST-клиент | Axios | `axios ^1.13.6` | `shared/api/axios.ts` |
| Реалтайм | нативный `WebSocket` | — | `features/room/sockets/WebSocketClient.ts` |
| Тесты | Vitest (+ jsdom, Testing Library) | `vitest ^3.2.4` | пока тестов нет (каркас) |
| Линт | ESLint 9 flat-config + Prettier-as-rule | `eslint ^9.36.0` | `eslint.config.ts` |

NPM-скрипты (`package.json:6-13`):

```bash
npm run dev          # wxt — запускает Chrome с расширением + Rezka (webExt.startUrls)
npm run build        # wxt zip → .output/chrome-mv3/ + .zip-артефакты
npm run lint         # eslint --max-warnings=0  (предупреждения = ошибка)
npm test             # vitest run
npm run test:watch   # vitest --watch
npm run prepare      # wxt prepare (генерирует .wxt/типы)
```

### Ключевые особенности WXT-конфигурации (`wxt.config.ts`)

- `srcDir: "src"` — весь код в `src/`, `entrypointsDir: "entrypoints"`.
- `imports: false` — **авто-импорты WXT отключены**. Всё, что нужно из WXT-рантайма (`browser`, `defineContentScript`, `defineBackground`, тип `Browser`), импортируется явно из виртуального модуля `#imports`. Поэтому в коде нет «магических» глобалей.
- `modules: ["@wxt-dev/module-react"]` — поддержка React в popup-энтрипоинте.
- `manifest()` — функция, читающая `import.meta.env.WXT_BACKEND_URL` для подстановки `host_permissions` бэкенда (`wxt.config.ts:16-35`).
- `permissions`: `clipboardWrite`, `webRequest`, `storage`, `activeTab` (`wxt.config.ts:28-33`).
- `host_permissions`: `https://rezka.ag/*.html` + `${backendUrl}/*` (`wxt.config.ts:34`).
- `web_accessible_resources`: `icon/48.png` для `<all_urls>` — нужно, чтобы `StatusBox` мог подгрузить иконку на странице Rezka (`wxt.config.ts:22-27`, использование — `ui/components/StatusBox.ts:55`).
- `zip.artifactTemplate: "{{name}}-{{version}}-{{browser}}.zip"` — CI читает артефакт по этой маске.

---

## 2. Слои и направление импортов

Расширение построено по **feature-sliced** раскладке с тремя логическими уровнями. Стрелка = «может импортировать».

```
┌──────────────────────────────────────────────────────────┐
│  entrypoints/  (ВЕРХНИЙ слой — точки входа браузера)       │
│  content.ts · background.ts · popup/                       │
└───────────────┬──────────────────────────────────────────┘
                │ импортирует ↓ (только сверху вниз)
┌───────────────▼──────────────────────────────────────────┐
│  features/  (player, room — бизнес-логика, координаторы)   │
└───────────────┬──────────────────────────────────────────┘
                │ импортирует ↓
┌───────────────▼──────────────────────────────────────────┐
│  shared/ · locators/ · ui/  (НИЖНИЙ слой — переиспользуемое)│
└──────────────────────────────────────────────────────────┘
```

**Главное правило:** зависимости идут только сверху вниз. Нижние слои ничего не знают о верхних.

| Каталог | Слой | Что внутри | Кого МОЖЕТ импортировать |
|---|---|---|---|
| `src/entrypoints/` | верхний | content.ts, background.ts, popup/ | `@/features`, `@/shared`, `@/locators`, `@/ui` |
| `src/features/` | средний | `player/`, `room/` (координаторы, сервисы, сокеты, React-компоненты popup) | `@/shared`, `@/locators`, `@/ui`, другие `@/features` |
| `src/shared/` | нижний | messaging, storage, api, constants, utils | только `@/shared` (+ `#imports`, внешние пакеты) |
| `src/locators/` | нижний | DOM-селекторы сайтов | `@/locators` (+ `#imports`) |
| `src/ui/` | нижний | UI, инжектируемый прямо в страницу Rezka (vanilla DOM) | `@/shared`, `@/locators` (тип `BaseLocators`) |

### Принудительно проверяемые правила — `scripts/arch_lint_ext.py`

Архитектурные инварианты не на словах, а в коде: их проверяет `scripts/arch_lint_ext.py` (лежит в **корне репозитория-обёртки**, не внутри расширения). Запуск: `python scripts/arch_lint_ext.py --root Sync-Mate-Extension` (по умолчанию `--root` = cwd). Скрипт на чистом stdlib, сначала вырезает комментарии строко-безопасным сканером, чтобы `//` в URL и упоминания `@keyframes` в комментариях не давали ложных срабатываний.

Четыре проверяемых правила (`arch_lint_ext.py:9-24`):

| # | Правило | Реализация |
|---|---|---|
| 1 | **Направление импортов.** `src/shared/**` не импортирует `@/features` и `@/entrypoints`; `src/locators/**` и `src/features/**` не импортируют `@/entrypoints`. | `check_import_direction` (`arch_lint_ext.py:103-114`) |
| 2 | **Разделение двух enum.** `enum WSMessageTypes` определён ТОЛЬКО в `src/features/room/model/messageTypes.ts`; `enum BrowserMessageTypes` — ТОЛЬКО в `src/shared/constants/message-types.ts`. Второе определение = нарушение. | `check_enum_locations` (`arch_lint_ext.py:117-128`) |
| 3 | **Изоляция инжектируемого CSS.** Каждый литеральный `@keyframes <имя>` обязан иметь префикс `sync-mate-` (Rezka перетирает короткие имена анимаций). Интерполированные `@keyframes ${NAME}` пропускаются — статически не проверить. | `check_keyframes_prefix` (`arch_lint_ext.py:131-139`) |
| 4 | **YouTube вне `matches`.** Пока нет `YouTubeLocators`, никакого `youtube` в строковых литералах `entrypoints/content.ts` (иначе content-скрипт молча падает). | `check_no_youtube` (`arch_lint_ext.py:142-153`) |

> Замечание (гэп): линт **не** покрывает `src/ui/**` правилом направления импортов. Концептуально `ui/` — нижний слой (vanilla-DOM инъекции) и не должен импортировать `@/features`/`@/entrypoints`, но сейчас это держится на дисциплине, а не на проверке. Фактически `ui/` импортирует только `@/shared` и тип `@/locators/BaseLocators` (`ui/components/OverlayLoader.ts:` — нет; `ui/components/StatusBox.ts:1` импортирует `#imports`).

ESLint (`eslint.config.ts`) дополняет линт стилем: `@typescript-eslint/consistent-type-imports: error` (отсюда везде `import type`), Prettier-as-rule (`tabWidth: 4`, без табов), отдельный блок правил `@eslint-react/*` только для `src/entrypoints/popup/**`. `no-explicit-any` отключён осознанно.

---

## 3. Полная карта `src/`

```
src/
├── entrypoints/                    # ВЕРХНИЙ слой — точки входа браузера
│   ├── content.ts                  # content-скрипт (инъекция в страницу Rezka)
│   ├── background.ts               # MV3 service worker
│   └── popup/                      # React-popup
│       ├── main.tsx                # ReactDOM.createRoot + StrictMode
│       ├── App.tsx                 # QueryClientProvider + <RoomContainer/>
│       ├── style.css               # Tailwind entry
│       ├── components/             # ⚠ ЛЕГАСИ, см. §10 (Room/User/SetName — мёртвый код)
│       └── types/room.ts           # ре-экспорт view-models (back-compat алиасы)
│
├── features/                       # СРЕДНИЙ слой — бизнес-логика
│   ├── player/
│   │   ├── index.ts                # barrel: initPlayerFeatured()
│   │   ├── PlayerCoordinator.ts    # координатор плеера
│   │   ├── services/
│   │   │   ├── ControlPlayer.ts    # play/pause/seek + анти-эхо флаги
│   │   │   └── EventListeners.ts   # подписка на HTMLMediaElement-события
│   │   └── utills/BufferedTime.ts  # учёт буферизованных диапазонов
│   └── room/
│       ├── index.ts                # barrel: initRoomFeatured()
│       ├── RoomCoordinator.ts      # координатор комнаты (WS ↔ плеер ↔ UI)
│       ├── model/messageTypes.ts   # enum WSMessageTypes (единственное место!)
│       ├── sockets/WebSocketClient.ts
│       ├── services/RoomService.ts # REST create/get (для content-скрипта)
│       ├── utills/ParseInfo.ts     # парсинг title/переводчика/эпизода + MutationObserver
│       ├── api/room-api.ts         # REST CRUD (для popup, axios)
│       ├── hooks/use-room.ts       # TanStack-хук popup
│       ├── types/dtos.ts           # DTO бэкенда (snake_case)
│       ├── types/view-models.ts    # ViewModel popup (camelCase)
│       └── components/             # React-компоненты popup (containers/ui/skeletons)
│
├── shared/                         # НИЖНИЙ слой — переиспользуемое
│   ├── messaging.ts                # sendMessage/onMessage (IPC content↔bg↔popup)
│   ├── storage.ts                  # getItem/setItem (storage.local)
│   ├── api/axios.ts                # apiClient (axios instance)
│   ├── constants/
│   │   ├── api.ts                  # API_URL, WS_URL, API_ROUTES, REZKA_URL
│   │   └── message-types.ts        # enum BrowserMessageTypes (единственное место!)
│   ├── components/ui/              # shadcn-подобные React-примитивы (badge, skeleton)
│   └── utils/                      # parseUrl, nickname, time, deepCompare
│
├── locators/                       # НИЖНИЙ слой — DOM-селекторы сайтов
│   ├── index.ts                    # pickLocators(hostname)
│   ├── BaseLocators.ts             # defineSelector / defineSelectorLazy
│   └── RezkaLocators.ts            # конкретные селекторы Rezka
│
└── ui/                             # НИЖНИЙ слой — инжектируемый в страницу UI (vanilla DOM)
    └── components/
        ├── OverlayLoader.ts        # спиннер-оверлей над плеером + блок Space
        ├── InfoPanel.ts            # панель «кто сколько загрузил»
        └── StatusBox.ts            # кнопка-статус «Create room / Connected»
```

> Опечатка-конвенция: каталоги называются `utills` (с двумя `l`) — это устоявшееся имя в обеих фичах, не исправляйте точечно.

---

## 4. Coordinator-паттерн

Содержимое страницы Rezka синхронизируется тремя «координаторами», каждый инкапсулирует свой слой ответственности. Координаторы создаются и связываются в barrel-функциях (`initPlayerFeatured`, `initRoomFeatured`) и общаются между собой через колбэки, а не через прямые ссылки на внутренности.

### Таблица ответственностей

| Координатор | Файл | Отвечает за | НЕ отвечает за |
|---|---|---|---|
| `PlayerCoordinator` | `features/player/PlayerCoordinator.ts` | Управление HTML5-`<video>`: `play`/`pause`/`seek`, флаги подавления «эха», наблюдение за метаданными/буфером, пересборка при смене плеера | Сеть, WS, парсинг страницы |
| `RoomCoordinator` | `features/room/RoomCoordinator.ts` | Склейка WS ↔ плеер ↔ инжектируемый UI: создание/подключение к комнате, обработка входящих WS-сообщений, broadcast статусов от плеера, реакция на смену переводчика/эпизода | Прямое управление `<video>` (делегирует в `PlayerCoordinator`), DOM-селекторы (делегирует в locators/ParseInfo) |
| `ParseInfo` (utility) | `features/room/utills/ParseInfo.ts` | Парсинг заголовка/переводчика/эпизода из DOM + `MutationObserver` на смену переводчика и эпизода (с дебаунсом) | Сеть, состояние плеера |

`ParseInfo` формально не «координатор», а utility-класс, но в архитектуре стоит рядом с ними как третий участник: он — единственный источник «что сейчас смотрим» и сигнала «контент сменился».

### 4.1. `PlayerCoordinator`

Фасад над двумя сервисами: `ControlPlayer` (действия) и `EventListeners` (подписки). Конструктор принимает `UI { overlayLoader, getPlayer }` (`PlayerCoordinator.ts:6-24`). Публичный API — геттеры, отдающие забинженные методы `ControlPlayer`/`EventListeners`:

```ts
get play()            // → controlPlayer.play
get pause()           // → controlPlayer.pause
get seek()            // → controlPlayer.seek
get setIsBlockPause() // → controlPlayer.setIsBlockPause
get enable()          // → eventListener.enable   (навесить слушатели на <video>)
get disable()         // → eventListener.disable  (снять слушатели)
onStatus(cb)          // подписка на исходящие статусы плеера
updatePlayer()        // пересоздать ControlPlayer+EventListeners для НОВОГО <video>
```

`updatePlayer()` (`PlayerCoordinator.ts:55-65`) — критичный метод: при смене переводчика/эпизода Rezka подменяет DOM-элемент `<video>`, поэтому нужно снять старые слушатели, создать новый `ControlPlayer`/`EventListeners` на свежий элемент и переподписать сохранённый `statusCallback`.

#### `ControlPlayer` — флаги анти-эха (`services/ControlPlayer.ts`)

Корневая проблема синхронизации: когда мы сами зовём `player.play()`, плеер генерирует событие `play`, которое наш же слушатель примет за действие пользователя — и пойдёт зацикливание/широковещание. Поэтому каждое программное действие помечается флагом, который при возникновении «эха» сразу сбрасывается без отправки сообщения.

| Флаг | Ставится | Сбрасывается | Назначение |
|---|---|---|---|
| `isManualPlay` | в `play()` перед `player.play()` (`:172`) | в `onUserPlay` (`:51-54`) | отличить наш play от пользовательского |
| `isManualPause` | в `pause()` перед `player.pause()` (`:180`) | в `onUserPause` (`:76-79`) | отличить нашу паузу |
| `isManualSeek` | в `seek()` перед `currentTime=` (`:199`) | в `onSeeking` (`:107-110`) | отличить нашу перемотку |
| `isBlockPause` | при ожидании подтверждения сервера; `setIsBlockPause(true)` показывает оверлей | `setIsBlockPause(false)` (приходит `remove_block_pause` или решаем сами) | блокировка пользовательского управления, пока идёт синхронизация |
| `isSkipWaiting` | после намеренной паузы под буферизацию | в `onWaiting` (`:146-149`) | не реагировать на «искусственный» `waiting` |
| `isLoadedMetaData` | в `onLoadedMetadata` (`:44-47`) | — | до загрузки метаданных глушим play/pause/seek |
| `isFirstStart` | в `seek()` когда метаданных ещё нет (`:191`) | в `onUserPause`/`onSeeking` | первый «холостой» прогон плеера для подгрузки |

`setIsBlockPause(isBlock)` (`:160-168`) идемпотентен (ранний выход при том же значении) и завязан на `OverlayLoader.show()/hide()` — то есть «блокировка паузы» = визуальный спиннер + блок клавиши Space.

Исходящие статусы формируются в `sendStatus(type="status")` (`:205-214`): `{ type, current_time: roundTime(...), downloaded_time: roundTime(bufferedTime.getCurrDownTime(...)) }`. Колбэк регистрируется через `onStatus(cb)` (`:216-221`), который возвращает функцию-отписку (сбрасывает `send` в no-op).

> Не трогайте эти флаги без понимания — они защищают от гонок с плеером. Логика `onUserPlay`/`onUserPause`/`onSeeking`/`onWaiting` плотно зависит от их порядка.

#### `EventListeners` (`services/EventListeners.ts`)

Тонкая обёртка над `addEventListener`/`removeEventListener` для `<video>`. Конструктор резолвит `<video>` через `getPlayer()` (бросает, если не найден — `:22-23`) и заранее создаёт стрелочные хендлеры-делегаты к `ControlPlayer` (`:27-33`). `enable()` (`:48-62`) идемпотентен (`enabled`-гард) и навешивает: `loadedmetadata`, `play`/`pause` (**с `capture: true`** — чтобы перехватить раньше плеера Rezka), `timeupdate`, `seeking`, `progress`, `waiting`. `disable()` снимает все подписки и чистит список `unsub`.

#### `BufferedTime` (`utills/BufferedTime.ts`)

Хранит нормализованные диапазоны буфера (`update(TimeRanges)` — копирует `buffered`, схлопывая старт < 0.1 в 0). `getCurrDownTime(currentTime)` = сколько секунд буфера осталось впереди от текущей позиции; используется и для статусов, и для решений `onWaiting`/`onSeeking` (если впереди 0 — выставляем `isSkipWaiting`).

### 4.2. `RoomCoordinator`

Центральный связующий класс. Конструктор (`RoomCoordinator.ts:32-42`) получает 4 зависимости: `WebSocketClient`, `RoomService`, `UI { infoPanel, overlayLoader, statusBox, parseInfo }`, `PlayerCoordinator`. Хранит массив отписок `unsub: (() => void)[]`.

| Метод | Что делает |
|---|---|
| `init()` (`:44-55`) | спрашивает у background `GET_ROOM` → если есть `roomId`, сразу `connect`; иначе показывает в `StatusBox` «Create room» и вешает обработчик клика на `createRoom` |
| `createRoom()` (`:63-83`) | берёт имя из storage (или `"Guest"`), `service.createRoom(name's room, location.href)`, копирует ссылку в буфер, шлёт background `ADD_TO_ROOM { roomId }`, затем `connect` |
| `connect(roomId)` (`:85-120`) | подключает WS (в try/catch!), при неудаче — UI «Error connecting» с откатом на «Create room»; при успехе подписывается на сообщения/закрытие WS, на статусы плеера, шлёт `parse()`, подписывается на смену переводчика, включает слушатели плеера, статус «Connected ✅» |
| `handleWsMessage(data)` (`:122-155`) | роутинг входящих WS-сообщений по `WSMessageTypes` (см. ниже) |
| `handleWsClose()` (`:157-160`) | `playerCoordinator.disable()` + `dispose()` |
| `handleStatus(data)` (`:162-164`) | проброс статуса плеера в WS (`socket.send`) |
| `handleInfo()` (`:166-172`) | реакция на смену переводчика/эпизода: `updatePlayer()` + `enable()` + повторный `parse()` в WS |
| `dispose()` (`:57-61`) | `socket.disconnect()` + вызов всех отписок |

Роутинг `handleWsMessage` по `WSMessageTypes`:

| Входящее сообщение | Действие |
|---|---|
| `INFO` | `infoPanel.updateInformation(data.name, data.downloaded_time)` |
| `PLAY` | `playerCoordinator.play()` |
| `PAUSE` | `playerCoordinator.pause()` |
| `SEEK` | `playerCoordinator.seek(data.current_time)` |
| `REMOVE_BLOCK_PAUSE` | `playerCoordinator.setIsBlockPause(false)` |
| `SET_VIDEO` | если `data.video_url` строка и не равен текущему URL → `window.location.href = data.video_url` (навигация на новое видео) |

> **Гэп vs. enum:** `WSMessageTypes` объявляет также `CONNECT`, `STATUS`, `LOAD` (`messageTypes.ts:5-11`). `CONNECT` обрабатывается внутри `WebSocketClient` при рукопожатии; `STATUS`/`LOAD` в `handleWsMessage` не разбираются (исходящие/серверные). Это нормально, не «забытая ветка».

### 4.3. `ParseInfo`

`parse()` (`ParseInfo.ts:12-41`) собирает объект `INFO` из DOM через locators:
- `title` — `locators.title.textContent`, обрезается по `"в озвучке"`;
- `translator` — `locators.translator()?.title.trim()` (lazy-селектор);
- `episode`/`season` — атрибуты `data-episode_id`/`data-season_id` активного эпизода;
- `url` — `location.href`; `type: WSMessageTypes.INFO`.

`setWatchInfo(callback)` (`:43-94`) — навешивает `MutationObserver` на контейнеры смены переводчика (`#translators-list`) и эпизодов (`#simple-episodes-tabs`). Срабатывает только при переходе элемента в состояние `active && !disabled`. **Дебаунс 50 мс обязателен** (`:46-57`): Rezka в одной микрозадаче снимает `active` со старого элемента и ставит на новый, без дебаунса колбэк улетает дважды. Возвращает функцию-отписку (disconnect всех observer + clearTimeout).

> FIXME в коде (`ParseInfo.ts:1`, `room/index.ts:18`): `ParseInfo` принимает конкретный `RezkaLocators`, а не общий интерфейс. При добавлении второго сайта нужно выделить интерфейс «info-локаторов».

---

## 5. Точка входа content-скрипта — пошаговый поток

`entrypoints/content.ts` объявляет content-скрипт через `defineContentScript` с `matches: ["https://rezka.ag/*.html"]` (`content.ts:11`). Внутри `main()`:

```ts
const locators = pickLocators(location.hostname);   // (1)
if (!locators) return;                              // (2)
const playerCoordinator = initPlayerFeatured(locators);   // (3)
await initRoomFeatured(locators, playerCoordinator);      // (4)
```

Шаг за шагом:

1. **`pickLocators(location.hostname)`** (`locators/index.ts:3-5`) — если хост заканчивается на `rezka.ag`, возвращает `new RezkaLocators()`; иначе `undefined`. Конструктор `RezkaLocators` (`RezkaLocators.ts:15-48`) **eager** резолвит критичные селекторы через `defineSelector` (`playerFrame`, `playerControlTimeline`, `playerPlayBtn`, `ratingTable`, `socialWrapper`, `title`) — если их нет в DOM, `defineSelector` **бросает** (`BaseLocators.ts:18-20`), и весь content-скрипт падает. Lazy-селекторы (`player`, `translator`, `episode`, `changeTranslator`, `changeEpisode`) — функции, отложенный поиск.
2. Если locators нет — тихий выход (другой сайт).
3. **`initPlayerFeatured(locators)`** (`features/player/index.ts:5-12`) — собирает `ui = { overlayLoader: new OverlayLoader(locators), getPlayer: locators.player }` и возвращает `new PlayerCoordinator(ui)`. Здесь же конструируется `ControlPlayer` (резолвит `<video>`, бросает если нет — `ControlPlayer.ts:37-38`) и `EventListeners`. **Слушатели ещё НЕ навешаны** — `enable()` зовётся позже, в `RoomCoordinator.connect`.
4. **`initRoomFeatured(locators, playerCoordinator)`** (`features/room/index.ts:14-36`) — создаёт инжектируемый UI (`InfoPanel`, `OverlayLoader`, `StatusBox`, `ParseInfo`), `WebSocketClient`, `RoomService`, собирает `RoomCoordinator` и зовёт `await coordinator.init()`.

> Из-за eager-`defineSelector` content-скрипт жёстко завязан на разметку Rezka: если Rezka изменит DOM-структуру (например уберёт `table.b-post__rating_table`), конструктор `RezkaLocators` бросит и расширение не стартует. Это сознательный «fail-fast».

### Сквозные сценарии

**A. Первый заход без комнаты:** `init` → `GET_ROOM` пуст → `StatusBox` «Create room» → клик → `createRoom` → REST `POST /rooms` → ссылка в буфер → `ADD_TO_ROOM` в background → `connect`.

**B. Заход по redirect-ссылке:** пользователь открывает `…/rooms/{id}/redirect`, background-`webRequest` распознаёт URL (`parseUrl`) и пишет `{ roomId }` в session-storage этой вкладки; после редиректа на видео content-скрипт через `GET_ROOM` получает `roomId` и сразу `connect`.

**C. Подключение (`connect`):** `WebSocketClient.connect(roomId, name)` открывает WS на `${WS_URL}/${roomId}`, шлёт `{type:"connect", name}` и ждёт ответ `{type:"connect", id}`; при успехе сохраняет `id` в storage. Затем `RoomCoordinator` подписывается на: входящие WS, закрытие WS, статусы плеера; шлёт первый `parse()`; подписывается на смену переводчика; `playerCoordinator.enable()`.

**D. Пользователь нажал play:** событие `play` (capture) → `onUserPlay` → если не «эхо» и метаданные есть и не заблокировано — `pause()` + `setIsBlockPause(true)` + `sendStatus("play")` → `handleStatus` → `socket.send`. Сервер рассинхронизирует/подтвердит и пришлёт `play`/`remove_block_pause`.

**E. Сервер прислал `play`:** `handleWsMessage` → `playerCoordinator.play()` → `ControlPlayer.play()` ставит `isManualPlay=true`, снимает блок, `player.play()`. Возникающее эхо-событие `play` гасится флагом в `onUserPlay`.

**F. Смена переводчика/эпизода:** `MutationObserver` в `ParseInfo` → дебаунс → `handleInfo` → `updatePlayer()` (пересборка на новый `<video>`) + `enable()` + новый `parse()` в WS.

**G. Закрытие WS:** `onClose` → `handleWsClose` → `playerCoordinator.disable()` + `dispose()` (отписки + `socket.disconnect()`).

---

## 6. Background service worker (`entrypoints/background.ts`)

Объявлен через `defineBackground`. Три зоны ответственности:

1. **Никнейм при старте** (`:41-46`): если в `storage.local` нет `name`, генерирует через `generateNickname()` (`shared/utils/nickname.ts` — рус. прилагательное+существительное+опц. эмодзи).
2. **IPC-роутер** (`onMessage`, `:48-72`) — обрабатывает `BrowserMessageTypes`:

   | Тип | Действие |
   |---|---|
   | `GET_ROOM` | вернуть `rooms[tabId]` |
   | `SET_ROOM` | перезаписать `rooms[tabId] = msg.room` |
   | `ADD_TO_ROOM` | смёржить через `updateRoom(tabId, patch)` |

   `tabId` берётся из `msg.activeTabId ?? sender.tab?.id` (`:49`) — popup передаёт `activeTabId` явно (своей вкладки у него нет), content-скрипт полагается на `sender.tab.id`.
3. **`webRequest.onBeforeRequest`** (`:74-89`) — слушает URL из `parseUrls` (`API_URL/*` и `REZKA_URL/*`); `parseUrl` извлекает `{ content, genre, name }` для Rezka или `{ roomId }` для `…/redirect`; fire-and-forget пишет в state вкладки (listener обязан вернуть синхронно).
4. **`tabs.onRemoved`** (`:91-97`) — чистит `rooms[tabId]` при закрытии вкладки.

**Почему не обычная переменная:** MV3 service worker может быть выгружен в любой момент, поэтому состояние комнат хранится в `browser.storage.session` через `loadRooms`/`saveRooms`/`updateRoom` (`:12-35`). Новые поля state добавляйте только через `updateRoom(tabId, patch)`, чтобы не сломать merge. Есть graceful-фолбэк, если `storage.session` недоступно (Firefox/старые рантаймы) — тогда state не персистится (`:14`, `:24`).

---

## 7. Shared-слой

| Файл | Экспорт | Назначение / нюанс |
|---|---|---|
| `shared/messaging.ts` | `sendMessage`, `onMessage`, ре-экспорт `BrowserMessageTypes` | Promise-обёртка над `browser.runtime.sendMessage`; `onMessage` корректно возвращает `true` для async-хендлеров (держит порт `sendResponse` открытым) и оборачивает ошибки в `{ error }` |
| `shared/storage.ts` | `getItem<T>`, `setItem` | тонкая обёртка над `browser.storage.local`. Хранит `name`, `id` |
| `shared/api/axios.ts` | `apiClient` | axios-инстанс, `baseURL: API_URL`, `timeout: 10_000`, JSON-заголовки |
| `shared/constants/api.ts` | `REZKA_URL`, `API_URL`, `WS_URL`, `API_ROUTES` | `BACKEND_URL` берётся из `import.meta.env.WXT_BACKEND_URL`, нормализуется (срезается trailing `/`), при отсутствии — `console.error`. `WS_URL` = `BACKEND_URL` с заменой `^http`→`ws` + `/ws` |
| `shared/constants/message-types.ts` | `enum BrowserMessageTypes` | **единственное** место объявления (`GET_ROOM`, `SET_ROOM`, `ADD_TO_ROOM`) |
| `shared/utils/parseUrl.ts` | `parseUrls`, `parseUrl` | классификация URL Rezka/redirect для `webRequest` |
| `shared/utils/nickname.ts` | `generateNickname` | случайный русский ник |
| `shared/utils/time.ts` | `roundTime`, `formatTime` | округление до мс / формат `m:ss` |
| `shared/utils/deepCompare.ts` | `deepCompare` | сравнение объектов с игнором ключей (точечная нотация) — используется в popup для пометки «synchronized» |
| `shared/components/ui/` | `badge.tsx`, `skeleton.tsx` | React-примитивы для popup |

### Переменные окружения

`.env.development` / `.env.production` (локально) и repo-variable в CI задают **только**:

| Имя переменной | Где читается |
|---|---|
| `WXT_BACKEND_URL` | `shared/constants/api.ts:6`, `wxt.config.ts:18` |

> Содержимое `.env`-файлов не читать и не печатать — там реальные секреты.

---

## 8. Locators — слой DOM-абстракции

`BaseLocators` (`locators/BaseLocators.ts`) предоставляет два билдера:

- `defineSelector(selector, all?)` — **eager**: ищет элемент сразу в конструкторе и **бросает**, если не найден (fail-fast). С `all=true` возвращает `NodeListOf` (тоже бросает на пустом).
- `defineSelectorLazy(selector, all?)` — **lazy**: возвращает функцию `() => HTMLElement | null`, поиск откладывается до вызова (для элементов, появляющихся позже — `<video>`, активный переводчик/эпизод).

`RezkaLocators` (`locators/RezkaLocators.ts`) наследует `BaseLocators` и в конструкторе объявляет все селекторы Rezka, сгруппированные комментариями (Information Panel / Overlay Loader / Status Box / Player / Parse Info / Change). `pickLocators` (`locators/index.ts`) — фабрика по hostname.

### Как добавить новый сайт

1. `src/locators/MySiteLocators.ts` extends `BaseLocators`, объявить поля через `defineSelector`/`defineSelectorLazy`.
2. Добавить ветку в `pickLocators` (`locators/index.ts`).
3. Расширить `matches` в `entrypoints/content.ts` **и** `host_permissions` в `wxt.config.ts` одновременно.
4. Если `ParseInfo` использует `RezkaLocators` напрямую — выделить общий интерфейс (текущий FIXME).
5. Помнить про правило линта №4: YouTube в `matches` без `YouTubeLocators` = молчаливое падение.

---

## 9. UI, инжектируемый в страницу (`src/ui/`)

Vanilla-DOM компоненты, которые рисуются **поверх страницы Rezka** (не React — на чужой странице Tailwind/React не используется). Все стили задаются через `element.style.*` или собственные `<style>`-теги.

| Компонент | Файл | Что делает | Нюансы |
|---|---|---|---|
| `OverlayLoader` | `ui/components/OverlayLoader.ts` | спиннер-оверлей над плеером во время блокировки + перехват клавиши Space | `@keyframes sync-mate-spin` с префиксом (правило линта №3), `<style id="sync-mate-spin-keyframes">` добавляется один раз |
| `InfoPanel` | `ui/components/InfoPanel.ts` | панель «кто сколько секунд загрузил», видимость синхронизируется с таймлайном плеера через `MutationObserver` | хранит `information: Record<person, seconds>` |
| `StatusBox` | `ui/components/StatusBox.ts` | кнопка-статус рядом с рейтингом: «Create room» / «Connecting…» / «Connected ✅» / «Error…» | подменяет `table.b-post__rating_table`, грузит `icon/48.png` через `browser.runtime.getURL` (отсюда `web_accessible_resources`) |

> Правило стилей: на странице Rezka — только инлайн-стили или `<style>` с уникальным префиксом `sync-mate-`. Короткие имена `@keyframes spin` Rezka может перетереть.

---

## 10. Popup (React + TanStack Query)

Точка входа `entrypoints/popup/main.tsx` → `ReactDOM.createRoot` + `<React.StrictMode>`. `App.tsx` оборачивает в `QueryClientProvider` (`staleTime: 0`) и рендерит `<RoomContainer/>`.

Поток данных popup:

```
RoomContainer (features/room/components/containers/room-container.tsx)
   └─ useRoom() (features/room/hooks/use-room.ts)
        ├─ browser.tabs.query({active}) → tabId
        ├─ sendMessage(GET_ROOM, {activeTabId}) → roomId
        ├─ roomApi.get(roomId) (axios) + getItem("id")
        └─ маппинг RoomResponse (DTO, snake_case) → RoomViewModel (camelCase)
              · users[].synchronized = deepCompare(meUser, user, [игнор-поля])
              · refetchInterval: 5_000, retry: false
```

- `useRoom` бросает доменные ошибки-строки `NO_TAB`/`NO_ROOM`, которые `RoomContainer.ErrorState` различает и показывает понятный текст.
- DTO (`types/dtos.ts`, snake_case как у бэкенда) строго отделены от ViewModel (`types/view-models.ts`, camelCase для UI). Маппинг — в `use-room.ts`.
- `roomApi` (`api/room-api.ts`) — REST CRUD для popup (list/get/create/update/delete). `RoomService` (`services/RoomService.ts`) — отдельный, более узкий клиент (create/get) для **content-скрипта**.
- Смена ника пишет `storage.local`, но активная WS-сессия использует имя из момента `connect` — отсюда подсказка в `EditModal` «применится при следующем подключении».

> **Мёртвый код:** `entrypoints/popup/components/{Room,User,SetName}.tsx` и `entrypoints/popup/types/room.ts` — легаси раннего popup. Никто их не импортирует (проверено grep); активный popup собран из `features/room/components/**`. `types/room.ts` — лишь back-compat ре-экспорт `view-models`.

---

## 11. Два enum: WS-протокол vs внутренний IPC

Критично не путать (правило линта №2):

| Enum | Файл | Назначение | Значения |
|---|---|---|---|
| `WSMessageTypes` | `features/room/model/messageTypes.ts` | **WebSocket-протокол** с сервером | `connect`, `info`, `play`, `pause`, `seek`, `status`, `load`, `set_video`, `remove_block_pause` |
| `BrowserMessageTypes` | `shared/constants/message-types.ts` | внутренний **IPC** расширения (content ↔ background ↔ popup) | `GET_ROOM`, `SET_ROOM`, `ADD_TO_ROOM` (числовые) |

`messageTypes.ts` ре-экспортирует `BrowserMessageTypes` для удобства (`messageTypes.ts:1`), но **определение** остаётся единственным в `shared/`.

---

## 12. Barrels (index.ts)

Каждая фича публикует наружу только barrel — функцию инициализации, скрывая внутренние классы:

| Barrel | Экспорт | Кто потребитель |
|---|---|---|
| `features/player/index.ts` | `initPlayerFeatured(locators)` | `entrypoints/content.ts` |
| `features/room/index.ts` | `initRoomFeatured(locators, playerCoordinator)` | `entrypoints/content.ts` |
| `locators/index.ts` | `pickLocators(hostname)` | `entrypoints/content.ts` |

Сам `PlayerCoordinator` импортируется напрямую как `type` в `room/index.ts` и `RoomCoordinator.ts` (кросс-фичевая зависимость разрешена правилами слоёв). Остальные внутренности (`ControlPlayer`, `EventListeners`, `WebSocketClient`, `RoomService`, `ParseInfo`) наружу фичи не торчат.

---

## 13. Сборка и CI (актуально, не по старому DOCUMENTATION.md)

- Локально: `npm run build` = `wxt zip` → `.output/chrome-mv3/` + zip-артефакты по маске `{{name}}-{{version}}-{{browser}}.zip`.
- CI подставляет `WXT_BACKEND_URL` из repo-variable (см. `release.yml` в репозитории расширения, упомянут в `shared/constants/api.ts:7`).
- Цель — Chromium (MV3). Firefox WXT абстрагирует, но не проверялся; фолбэк на отсутствие `storage.session` в background это учитывает.

> Старый корневой `DOCUMENTATION.md` частично устарел — детали деплоя по нему не сверять. Для бэкенда реальность: `docker-compose.yml` содержит ОДИН сервис (cloudflared удалён в коммите `f0c7443`); CI тестирует ТОЛЬКО на Python 3.13. Это к API, но упомянуто, чтобы не доверять устаревшему доку.

---

## 14. Краткий чек-лист гочей

- Любое изменение типа/полей WS-сообщения затрагивает **обе** части (фронт `messageTypes.ts` + бэк `handler.py`/`models.py`).
- `WebSocketClient.connect()` возвращает `Promise<boolean>` (никогда не reject); но `await socket.connect()` в `RoomCoordinator.connect` всё равно обёрнут в try/catch — не убирать.
- Не убирать дебаунс 50 мс в `ParseInfo.setWatchInfo` — Rezka даёт двойную mutation при смене переводчика.
- Не возвращать YouTube в `matches` без `YouTubeLocators`.
- В background — только `storage.session`, не обычная переменная.
- `@keyframes` на странице Rezka — только с префиксом `sync-mate-`.
- eager-`defineSelector` бросает при отсутствии элемента → content-скрипт fail-fast завязан на разметку Rezka.

---

## См. также

- [`../CLAUDE.md`](../CLAUDE.md) — гид Claude по расширению (стек, флаги `ControlPlayer`, locators-чек-лист).
- [`../../CLAUDE.md`](../../CLAUDE.md) — общий гид по репозиторию-обёртке Sync-Mate (фронт + бэк, WS-контракт).
- [`../../DOCUMENTATION.md`](../../DOCUMENTATION.md) — полная техническая документация (WS-протокол §2.5); **частично устарела по части деплоя** — сверяйте с кодом.
- `scripts/arch_lint_ext.py` (корень репозитория) — принудительная проверка слоёв/инвариантов расширения.
- `scripts/arch_lint_api.py` — аналогичный страж для бэкенда `Sync-Mate-API-WS/`.
