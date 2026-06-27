# Документация — Sync-Mate-Extension

Подробный справочник по расширению (WXT/React/TS, MV3) для синхронного просмотра на Rezka.
Это источник правды по коду этого репозитория. Тонкие правила для Claude — в [../CLAUDE.md](../CLAUDE.md);
система контроля и процесс — в `.claude/docs/` корня workspace (или `/playbook`).

## Содержание

| Документ | О чём |
|---|---|
| [architecture.md](architecture.md) | Стек, Coordinator-паттерн (`PlayerCoordinator`/`RoomCoordinator`/`ParseInfo`), точка входа content-скрипта, feature-slices, направление импортов |
| [websocket-protocol.md](websocket-protocol.md) | **Контракт WS-протокола** (общий с бэкендом): `WSMessageTypes`, обработка в `RoomCoordinator`, `WebSocketClient`, алгоритм синхронизации |
| [player-sync.md](player-sync.md) | Синхронизация плеера, флаги подавления эха (`isManualPlay`/`isManualPause`/`isManualSeek`/`isBlockPause`/`isSkipWaiting`), буферизация |
| [locators.md](locators.md) | DOM-локаторы Rezka, `defineSelector`/`defineSelectorLazy`, рецепт добавления нового сайта |
| [messaging.md](messaging.md) | Два enum: `BrowserMessageTypes` (внутренний IPC) vs `WSMessageTypes` (протокол сервера) — не путать |
| [background.md](background.md) | MV3 service worker, `browser.storage.session`, `webRequest`, никнейм, очистка вкладок |
| [popup.md](popup.md) | React-popup, компоненты, хуки, TanStack Query, нюанс смены никнейма |
| [styling.md](styling.md) | Tailwind (только popup) vs инжектируемый UI на странице (префикс `sync-mate-`) |
| [build-release.md](build-release.md) | `wxt` сборка/zip, env, CI (`ci.yml`), релиз по тегу (`release.yml`), Chrome/Firefox |
| [configuration.md](configuration.md) | `WXT_BACKEND_URL`, вывод URL в `api.ts`, manifest, алиасы |
| [conventions.md](conventions.md) | Стиль кода, eslint/prettier, тесты (vitest), «Что НЕ делать» с обоснованием |
| [adr/](adr/) | Architecture Decision Records — зафиксированные ключевые решения и их причины |

## Как это поддерживается в синхроне

Документация — часть контракта, а не «приписка». Правило:

- Любое изменение поведения/архитектуры/контракта **обновляет соответствующий документ в этом `docs/`** в том же изменении (этим занимается агент `docs-sync`, шаг в скиле `/finish`).
- **WS-протокол** ([websocket-protocol.md](websocket-protocol.md)) — общий с бэкендом. Любая правка типа сообщения затрагивает обе стороны и оба `websocket-protocol.md`; парность кода проверяет `python scripts/protocol_sync.py` (гейт-проверка `protocol`), а скил `/sync-protocol` + агент `protocol-guardian` следят за обеими сторонами.
- Значимые решения фиксируются как ADR в [adr/](adr/) (не переписывай старые — добавляй новые со статусом «Supersedes …»).

## См. также

- [../CLAUDE.md](../CLAUDE.md) — краткие правила по расширению
- [../../CLAUDE.md](../../CLAUDE.md) — общий гид workspace и система контроля
- [../../Sync-Mate-API-WS/docs/](../../Sync-Mate-API-WS/docs/) — документация бэкенда (вторая сторона WS-контракта)
