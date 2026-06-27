# ADR-0004: Только Rezka в `matches`, YouTube намеренно не реализован

- **Статус:** Accepted
- **Дата:** 2026-06-27 (зафиксировано постфактум)

## Контекст

Content-скрипт работает через слой локаторов (`pickLocators(hostname)` → `RezkaLocators`). Без
реализованных локаторов для сайта скрипт не находит плеер и **молча падает**. Соблазн «добавить
YouTube в `matches`» без `YouTubeLocators` приводит к неработающему расширению на YT.

## Решение

`matches` в `entrypoints/content.ts` содержит **только** Rezka (`https://rezka.ag/*.html`). YouTube —
отдельная фича, а не «забытый кусочек». Чтобы добавить сайт: реализовать `XxxLocators` (наследник
`BaseLocators`), ветку в `pickLocators`, и только потом расширить `matches` + `host_permissions`.
См. [../locators.md](../locators.md).

## Последствия

- ➕ Расширение не ломается на неподдержанных сайтах.
- ➖ Поддержка нового сайта — осознанная работа (локаторы → matches), а не одна строка.
- 🔒 Enforced: `scripts/arch_lint_ext.py` падает, если в `content.ts` появляется YouTube-паттерн без
  локаторов (гейт-проверка `arch`).
