# CLAUDE.md — Sync-Mate-Extension

Гид для Claude по расширению. **Полная документация — в [docs/](docs/)** (архитектура, WS-протокол, синхронизация плеера, локаторы, messaging, background, popup, стили, сборка/релиз, конфигурация, конвенции, ADR). Держи её в синхроне с кодом (агент `docs-sync` / `/finish`).

## Стек

- WXT 0.20 (фреймворк для браузерных расширений на Vite)
- React 19 + TanStack Query 5 — popup
- TypeScript 5.8
- Tailwind CSS 4
- Axios 1.13 — REST
- Native WebSocket — реалтайм
- Vitest 3 — тесты (пока пустые)

Manifest V3, текущая цель — Chromium. Firefox не проверялся, но базово должен работать (WXT абстрагирует).

## Запуск

```bash
npm install
npm run dev               # запускает Chrome с расширением + Rezka
npm run build             # production → .output/chrome-mv3/ + .zip
npm run lint              # eslint --max-warnings=0
npm test                  # vitest run
```

## Архитектура — Coordinator-паттерн

Три «координатора» инкапсулируют разные слои:

| Координатор | Отвечает за |
|---|---|
| `PlayerCoordinator` | HTML5-видеоплеер: play/pause/seek, флаги для подавления эха, наблюдение за метаданными/буфером |
| `RoomCoordinator` | Связь между WS, плеером и UI; обработка входящих WS-сообщений и broadcast статусов от плеера |
| `ParseInfo` (utility) | Парсинг заголовка/переводчика/эпизода + MutationObserver на смену переводчика и эпизода |

Точка входа content-скрипта — `entrypoints/content.ts`:

```ts
const locators = pickLocators(location.hostname);   // → RezkaLocators или undefined
const playerCoordinator = initPlayerFeatured(locators);
await initRoomFeatured(locators, playerCoordinator);
```

## Locators — как добавить новый сайт

1. Создать `src/locators/MySiteLocators.ts`, унаследовав `BaseLocators`.
2. Объявить все нужные поля как `defineSelector(...)` (eager) или `defineSelectorLazy(...)` (lazy — функция, поиск откладывается).
3. Добавить ветку в `pickLocators` (`src/locators/index.ts`).
4. Расширить `matches` в `entrypoints/content.ts` и `host_permissions` в `wxt.config.ts`.
5. Если ParseInfo использует RezkaLocators напрямую — выделить общий интерфейс (сейчас есть FIXME).

## WS-протокол

Полный список — в `DOCUMENTATION.md` §2.5. Особенности фронта:

- `WebSocketClient.connect()` теперь возвращает чистый `Promise<boolean>` — никаких unhandled rejections при таймауте. Если когда-то снова станет `reject`-я, обязательно оберните `await socket.connect(...)` в try/catch в `RoomCoordinator`.
- Имена сообщений → `src/features/room/model/messageTypes.ts::WSMessageTypes`. Любое новое — добавлять туда.
- НЕ путать с `BrowserMessageTypes` (внутренний IPC content↔background↔popup).

## ControlPlayer — флаги

В синхронизации плеера много «эхо»-проблем: когда мы сами вызываем `player.play()`, плеер генерирует событие `play`, которое наш же listener примет за пользовательское — и зациклимся. Поэтому каждое программное действие помечается флагом, который при возникновении эха сразу сбрасывается без отправки сообщения.

| Флаг | Когда ставится | Когда сбрасывается |
|---|---|---|
| `isManualPlay` | перед `player.play()` | в `onUserPlay` |
| `isManualPause` | перед `player.pause()` | в `onUserPause` |
| `isManualSeek` | перед `player.currentTime = ...` | в `onSeeking` |
| `isBlockPause` | пока ждём подтверждения от сервера | `setIsBlockPause(false)` (приходит `remove_block_pause` или сами решаем) |
| `isSkipWaiting` | после намеренной паузы для буферизации | в `onWaiting` |

Не трогайте эти флаги без понимания — они защищают от race conditions с плеером.

## Background Service Worker

State комнат хранится в `browser.storage.session` (не в обычной переменной — MV3 SW может выгружаться). При закрытии вкладки запись чистится через `tabs.onRemoved`.

Если добавляете новое поле в state комнаты — пишите его через `updateRoom(tabId, patch)` чтобы не сломать merge.

## Стили

- Tailwind 4 — только для popup. На странице Rezka стили инлайнятся через `element.style.*` или собственные `<style>`-теги с уникальными именами классов/анимаций (префикс `sync-mate-`).
- Не используйте короткие имена `@keyframes spin` — Rezka может перетереть. Префиксуйте: `sync-mate-spin`.

## Что НЕ делать

- Не возвращайте YouTube в `matches` без `YouTubeLocators` — иначе content-скрипт молча падает.
- Не убирайте debounce в `ParseInfo.setWatchInfo` — Rezka даёт двойные active-mutations при смене переводчика.
- Не используйте обычный `Record<...>` в background для state — только `browser.storage.session`.
- Не убирайте try/catch вокруг `socket.connect()` в `RoomCoordinator.connect`.

## Зависимость от бэкенда (контракт)

Расширение полагается на:

- `WS_URL/{roomId}` доступен.
- WS принимает `{"type":"connect","name":"..."}` и отвечает `{"type":"connect","id":"<uuid>"}`.
- REST `/rooms` (POST/GET/PATCH/DELETE), `/rooms/{id}/redirect`.
- Поле `status` комнаты — одно из `waiting`/`playing`/`paused`/`pausing`.

Если бэкенд переименует сообщение или сменит структуру — расширение нужно править одновременно.
