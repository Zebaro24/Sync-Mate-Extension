# ADR-0001: Coordinator-паттерн для слоёв расширения

- **Статус:** Accepted
- **Дата:** 2026-06-27 (зафиксировано постфактум)

## Контекст

Логика расширения делится на разные миры: HTML5-плеер на странице, WebSocket к серверу, UI на
странице и popup, парсинг метаданных Rezka. Смешивать их в одном модуле — путь к спагетти и
race conditions с плеером.

## Решение

Инкапсулировать каждый мир в «координатор»: `PlayerCoordinator` (плеер: play/pause/seek, флаги
подавления эха, наблюдение за буфером), `RoomCoordinator` (связь WS↔плеер↔UI, обработка входящих
сообщений и broadcast статусов), `ParseInfo` (парсинг заголовка/переводчика/эпизода + MutationObserver).
Точка входа `entrypoints/content.ts`: `pickLocators → initPlayerFeatured → initRoomFeatured`.
См. [../architecture.md](../architecture.md) и [../player-sync.md](../player-sync.md).

## Последствия

- ➕ Чёткие границы ответственности; синхронизацию плеера можно понимать изолированно.
- ➕ Direction импортов: `entrypoints` сверху, `features` ниже, `shared`/`locators` в основании.
- 🔒 Enforced: `scripts/arch_lint_ext.py` запрещает `shared/` импортировать `@/features`, а нижним
  слоям — `@/entrypoints` (гейт-проверка `arch`).
