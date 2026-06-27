# Architecture Decision Records — Sync-Mate-Extension

Короткие записи значимых решений: **контекст → решение → последствия**. ADR неизменяемы —
если решение меняется, добавляй новый ADR со статусом `Supersedes ADR-NNNN`, а у старого ставь
`Superseded by ADR-MMMM`. Это объясняет «почему так», чтобы будущие сессии не «чинили то, что не сломано».

| ADR | Решение | Статус |
|---|---|---|
| [0001](0001-coordinator-pattern.md) | Coordinator-паттерн (Player/Room) | Accepted |
| [0002](0002-two-message-enums.md) | Два раздельных enum: WS-протокол vs внутренний IPC | Accepted |
| [0003](0003-page-style-isolation.md) | Инжектируемые стили — с префиксом `sync-mate-` | Accepted |
| [0004](0004-rezka-only-no-youtube.md) | Только Rezka в `matches`, YouTube не реализован | Accepted |

Шаблон нового ADR — [0000-template.md](0000-template.md).
