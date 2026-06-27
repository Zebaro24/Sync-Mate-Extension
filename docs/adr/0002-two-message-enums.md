# ADR-0002: Два раздельных enum сообщений — WS-протокол vs внутренний IPC

- **Статус:** Accepted
- **Дата:** 2026-06-27 (зафиксировано постфактум)

## Контекст

В расширении есть два совершенно разных канала сообщений: (1) WebSocket с сервером (контракт
синхронизации), (2) внутренний IPC между content-скриптом, background и popup. Один общий enum
смешал бы несвязанные домены и провоцировал бы ошибки «отправил не туда».

## Решение

Держать их раздельно: `WSMessageTypes` (`src/features/room/model/messageTypes.ts`) — протокол сервера;
`BrowserMessageTypes` (`src/shared/constants/message-types.ts`) — внутренний IPC. Не путать.
См. [../messaging.md](../messaging.md) и [../websocket-protocol.md](../websocket-protocol.md).

## Последствия

- ➕ Каждый канал эволюционирует независимо; читателю сразу ясно, о каком слое речь.
- ➖ Нужно помнить, что это разные enum (легко перепутать по созвучию).
- 🔒 Enforced: `scripts/arch_lint_ext.py` требует, чтобы `enum WSMessageTypes` и `enum BrowserMessageTypes`
  определялись каждый строго в своём файле (гейт-проверка `arch`). WS-сторона дополнительно сверяется
  с бэкендом через `scripts/protocol_sync.py` (см. ADR-0003 бэкенда).
