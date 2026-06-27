# Конвенции кода — Sync-Mate-Extension

Определяющий справочник по стилю, линтингу, типам, тестированию и запретам для расширения (WXT/React/TS); всё проверяется через единый gate.

---

## 1. Обзор инструментов

| Слой | Инструмент | Где настроен |
|---|---|---|
| Линтинг + формат | ESLint 9 (flat config) + `eslint-plugin-prettier` + `@typescript-eslint` + `@eslint-react` | `eslint.config.ts` |
| Типы | TypeScript 5.8, `strict` (наследуется из WXT) | `tsconfig.json` + сгенерированный `.wxt/tsconfig.json` |
| Тесты | Vitest 3 + jsdom 27 + `@testing-library/react` 16 | конфига нет — см. §6 |
| Сборка / dev | WXT 0.20 (Vite) | `wxt.config.ts` |
| Запуск всех проверок | `scripts/gate.py` (workspace-level) | см. §5 |

> Версии зафиксированы в `package.json`. Все проверки запускаются **только** через gate (§5) — не вызывайте `eslint` / `tsc` / `vitest` / `npm` руками в основной сессии.

---

## 2. ESLint — flat config

Конфиг — `eslint.config.ts`, массив из трёх объектов (порядок важен: flat config мёржит блоки сверху вниз).

### 2.1. Блок 1 — общий для всего TS/TSX (`eslint.config.ts:8-33`)

```ts
files: ["**/*.{ts,tsx,mts}"]
languageOptions: { globals: globals.browser, parser: tsParser }   // @typescript-eslint/parser
plugins: { "@typescript-eslint": tsPlugin, prettier: prettierPlugin }
rules: {
    ...tsPlugin.configs.recommended.rules,
    "prettier/prettier": ["error", { tabWidth: 4, useTabs: false }],
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-empty-object-type": "off",
    "@typescript-eslint/no-unused-expressions": "off",
    "@typescript-eslint/consistent-type-imports": "error",
}
```

Расшифровка правил:

| Правило | Значение | Почему |
|---|---|---|
| `tsPlugin.configs.recommended.rules` | базовый набор | стандартные правила `@typescript-eslint` |
| `prettier/prettier` | `error`, `{ tabWidth: 4, useTabs: false }` | формат как ESLint-правило (см. §3) |
| `@typescript-eslint/no-unused-vars` | `warn` | при `--max-warnings=0` (см. §2.4) фактически = ошибка |
| `@typescript-eslint/no-explicit-any` | `off` | `any` сознательно разрешён — много нетипизированных WS-сообщений и DOM-узлов Rezka |
| `@typescript-eslint/no-empty-object-type` | `off` | допускаются пустые `{}`-типы/интерфейсы-маркеры |
| `@typescript-eslint/no-unused-expressions` | `off` | разрешены выражения вида `cond && fn()` |
| `@typescript-eslint/consistent-type-imports` | `error` | **обязателен** `import type ...` для импортов только-типов |

`consistent-type-imports` — самое цепкое правило. Любой импорт, используемый только как тип, обязан быть `import type`. Примеры из кода: `import type WebSocketClient from "./sockets/WebSocketClient";` (`RoomCoordinator.ts:3`), `import type { RoomViewModel } from "../types/view-models";` (`use-room.ts:10`). Если импортировать класс как значение, но использовать только в аннотации — ESLint упадёт.

### 2.2. Блок 2 — только popup React (`eslint.config.ts:35-49`)

```ts
files: ["src/entrypoints/popup/**/*.{ts,tsx}"]
...reactPlugin.configs.recommended            // @eslint-react/eslint-plugin
languageOptions: { parser: tsParser }
rules: { /* пять @eslint-react правил выключены */ }
```

Набор `@eslint-react` (плагин `@eslint-react/eslint-plugin`) применяется **только** к `src/entrypoints/popup/**`. Пять правил намеренно отключены:

| Отключённое правило | Зачем |
|---|---|
| `@eslint-react/no-array-index-key` | списки в popup стабильны/короткие — `key={index}` допустим |
| `@eslint-react/hooks-extra/no-redundant-custom-hook` | разрешены тонкие обёртки-хуки (`useRoom`) |
| `@eslint-react/dom/no-missing-button-type` | `<button>` без `type` допускается |
| `@eslint-react/hooks-extra/prefer-use-state-lazy-initialization` | не навязываем ленивую инициализацию `useState` |
| `@eslint-react/no-unstable-context-value` | допустим inline-объект как `value` контекста |

Важно: React-правила **не** действуют на инжектируемый в страницу UI (`src/ui/`, `src/features/**`) — там нет React, только нативный DOM.

### 2.3. Блок 3 — ignores (`eslint.config.ts:51-53`)

```ts
ignores: ["**/.output/*", "**/.wxt/*", "**/.idea/*"]
```

Сборка (`.output`), сгенерированные WXT-типы (`.wxt`) и файлы IDE из линтинга исключены.

### 2.4. Zero-tolerance: `--max-warnings=0`

Скрипт линта (`package.json:10`):

```json
"lint": "eslint --max-warnings=0"
```

- Путь не указан — ESLint 9 flat config линтит весь проект от cwd.
- `--max-warnings=0` означает: **любое предупреждение валит проверку**. Поскольку `no-unused-vars` имеет уровень `warn`, неиспользованная переменная/импорт = warning = красный gate. Практически в этом проекте warning эквивалентен error.

### 2.5. Замечание: `eslint-config-prettier` установлен, но не подключён

`eslint-config-prettier` есть в devDependencies (`package.json:43`), но **не импортируется** в `eslint.config.ts`. Это не баг: форматирование здесь делает `eslint-plugin-prettier` через правило `prettier/prettier`, а не отдельный конфиг-выключатель. Не добавляйте его без необходимости — текущая схема рабочая.

---

## 3. Prettier (формат как ESLint-правило)

Отдельного `.prettierrc` нет — все опции заданы инлайн в правиле `prettier/prettier` (`eslint.config.ts:20-26`). Явно переопределены только два параметра; остальное — **дефолты Prettier 3**:

| Параметр | Значение | Источник |
|---|---|---|
| `tabWidth` | `4` | задано явно (`eslint.config.ts:23`) |
| `useTabs` | `false` (только пробелы, **никаких табов**) | задано явно (`eslint.config.ts:24`) |
| `semi` | `true` — **точки с запятой обязательны** | дефолт Prettier |
| `singleQuote` | `false` — двойные кавычки | дефолт Prettier |
| `trailingComma` | `all` — висячие запятые в многострочных | дефолт Prettier 3 |
| `printWidth` | `80` | дефолт Prettier |

> **Корректировка распространённого заблуждения:** точки с запятой здесь **нужны**. Дефолт Prettier `semi: true` действует, и весь код их использует (например `RoomCoordinator.ts` — 79 `;`). Утверждение «no semicolons» неверно — не убирайте `;`, иначе `prettier/prettier` (error) завалит линт. Аналогично: строки — в **двойных** кавычках, отступ — **4 пробела**.

---

## 4. TypeScript — strict

`tsconfig.json`:

```json
{
  "extends": "./.wxt/tsconfig.json",
  "compilerOptions": {
    "allowImportingTsExtensions": true,
    "allowJs": true,
    "jsx": "react-jsx",
    "lib": ["ESNext", "DOM"],
    "paths": { "@/*": ["./src/*"] }
  }
}
```

- **`strict` наследуется** из сгенерированного WXT-базиса `.wxt/tsconfig.json` (там `"strict": true`, `moduleResolution: "Bundler"`, `noEmit`, `forceConsistentCasingInFileNames`, `skipLibCheck`, `esModuleInterop`, `resolveJsonModule`, target/module `ESNext`). Базис создаётся командой `wxt prepare` — без неё `tsc` не увидит окружения (поэтому gate в проверке `type-check` сначала гоняет `wxt prepare`, см. §5).
- `allowImportingTsExtensions: true` — разрешает явные расширения в путях импорта (в коде обычно не используются — импорт идёт через barrel `index.ts`).
- `jsx: "react-jsx"` — новый JSX-трансформ React 19, без `import React`.
- `paths` `@/*` → `./src/*` — основной алиас (см. §5.2 про относительные пути). В WXT-базисе доступны также `~/*`, `@@/*`, `~~/*`, но в коде проекта используется только `@/`.
- `forceConsistentCasingInFileNames` (из базиса) — регистр в путях импортов должен совпадать с файловой системой; на Windows это особенно легко нарушить.

Тип-чек в gate: `npx wxt prepare && npx tsc --noEmit` (`gate.py:75`). `--noEmit` — компиляции нет, только проверка.

---

## 5. Запуск проверок — единый gate

Единственный санкционированный способ запускать линт/типы/арх/тесты — `scripts/gate.py` из корня workspace. **Не** вызывайте `npm`/`eslint`/`tsc`/`vitest` напрямую.

### 5.1. Команды

```bash
python scripts/gate.py --repo ext            # core-проверки расширения
python scripts/gate.py --repo ext --lint     # только статические (lint, type-check, arch, protocol)
python scripts/gate.py --repo ext --tests    # только тесты
python scripts/gate.py --repo ext --strict   # + тяжёлая проверка build
python scripts/gate.py --repo ext --only test -- tests/check.test.mts   # точечный тест
python scripts/gate.py --repo ext --list     # показать все проверки и выйти
```

Алиасы repo: `frontend` / `fe` == `ext`. Если запускать из каталога `Sync-Mate-Extension/`, gate сам выведет repo по имени папки (`gate.py:150-155`).

### 5.2. Состав проверок для `ext` (`gate.py:73-81`)

| Имя | Группа | Core/Strict | Что запускает |
|---|---|---|---|
| `lint` | lint | core | `npm run lint` (eslint `--max-warnings=0`) |
| `type-check` | lint | core | `npx wxt prepare` → `npx tsc --noEmit` |
| `arch` | lint | core | `python scripts/arch_lint_ext.py` (см. §7) |
| `protocol` | lint | core | `python scripts/protocol_sync.py` — паритет WS-контракта BE↔FE |
| `test` | test | core | `npm test` (`vitest run`) |
| `build` | build | **strict** | `npm run build` (`wxt zip`) — гоняется только с `--strict` |

Многошаговая проверка падает на первом упавшем шаге (например `type-check` упадёт уже на `wxt prepare`, если тот сломан).

### 5.3. Точечный прогон (`-- <args>`)

Аргументы после `--` уходят в **ровно одну** проверку — поэтому их нужно сочетать с `--only <name>` (`gate.py:184-186`). Типичный кейс для тестов:

```bash
python scripts/gate.py --repo ext --only test -- tests/check.test.mts
python scripts/gate.py --repo ext --only test -- src/features/room   # когда появятся тесты по пути
```

gate подставляет лишние аргументы в последний шаг проверки (`gate.py:198`).

---

## 6. Тестирование

### 6.1. Стек и текущее состояние

- Установлены: `vitest@3` (`package.json:50`), `jsdom@27` (`package.json:47`), `@testing-library/react@16` (`package.json:35`).
- Скрипты: `test` → `vitest run`, `test:watch` → `vitest --watch` (`package.json:11-12`).
- **Реальных тестов пока нет.** Единственный файл — заглушка `tests/check.test.mts`:

  ```ts
  import { test, expect } from "vitest";

  // TODO: Add tests
  test("check test", () => {
      expect(true).toBe(true);
  });
  ```

> Заглушка существует не случайно: в Vitest 3 запуск **без единого** тестового файла завершается ненулевым кодом («No test files found»), что завалило бы проверку `test` в gate. Один тривиальный `expect(true).toBe(true)` держит проверку зелёной до появления настоящих тестов. Не удаляйте файл, не добавив взамен реальные тесты (или флаг `--passWithNoTests`).

### 6.2. Конфигурации Vitest нет — важный нюанс окружения

Файла `vitest.config.ts` в проекте **нет**. Из этого следует:

- Окружение по умолчанию — `node` (в выводе прогона `environment 0ms` — jsdom не грузится). Текущая заглушка это устраивает.
- `jsdom` и `@testing-library/react` установлены, но **ещё не подключены**. Чтобы написать первый компонентный тест popup, нужно включить jsdom-окружение одним из способов:
  - создать `vitest.config.ts` с `test.environment = "jsdom"` (рекомендуется; для WXT-моков обычно подключают `WxtVitest` из `wxt/testing`);
  - либо в начале конкретного файла директивой `// @vitest-environment jsdom`.
- Имя тест-файла — `*.test.ts(x)` или `*.test.mts` (заглушка использует `.mts`). Каталог тестов — `tests/` в корне расширения (исходники — `src/`).

### 6.3. Как запускать

Только через gate (§5):

```bash
python scripts/gate.py --repo ext --tests                          # все тесты
python scripts/gate.py --repo ext --only test -- <путь-к-тесту>    # один файл/каталог
```

---

## 7. Структурные правила — `arch_lint_ext.py`

Проверка `arch` (`scripts/arch_lint_ext.py`) — это страж архитектуры расширения. Регекс-основан, но комментарии вырезаются строко-осведомлённым сканером, поэтому `//` внутри URL и упоминания `@keyframes` в комментариях не дают ложных срабатываний. Четыре правила:

### 7.1. Направление импортов (`arch_lint_ext.py:103-115`)

Нижние/общие слои не должны зависеть от верхних:

| Слой | Не имеет права импортировать |
|---|---|
| `src/shared/**` | `@/features`, `@/entrypoints` |
| `src/locators/**` | `@/entrypoints` |
| `src/features/**` | `@/entrypoints` |

Иерархия (сверху вниз): `entrypoints` → `features` → (`locators`, `ui`) → `shared`. `entrypoints` — самый верх (точки входа content/background/popup), `shared` — самый низ (утилиты, константы, storage, messaging). Зависимость снизу вверх запрещена.

### 7.2. Разделение двух enum'ов (`arch_lint_ext.py:117-129`)

| Enum | Единственное допустимое место определения |
|---|---|
| `enum WSMessageTypes` | `src/features/room/model/messageTypes.ts` |
| `enum BrowserMessageTypes` | `src/shared/constants/message-types.ts` |

Это **критично**: `WSMessageTypes` — протокол WebSocket с сервером, `BrowserMessageTypes` — внутренний IPC content↔background↔popup. Их легко перепутать. Второе определение любого из них = ошибка арх-линта. Реальные определения: `messageTypes.ts:3` и `message-types.ts:1`.

### 7.3. Префикс `@keyframes` (`arch_lint_ext.py:131-139`)

Каждое литеральное `@keyframes <name>` обязано начинаться с `sync-mate-`. Короткие имена (`spin`, `fade`) Rezka может перетереть своими стилями. Интерполированные имена (`@keyframes ${NAME}`) пропускаются — статически не проверяемы. См. также `CLAUDE.md:84`.

### 7.4. Никакого YouTube в `matches` (`arch_lint_ext.py:142-153`)

Если в `src/entrypoints/content.ts` в строковом литерале встретится `youtube`, арх-линт падает: `YouTubeLocators` не реализованы, и content-скрипт молча упадёт. Сейчас `matches: ["https://rezka.ag/*.html"]` (`content.ts:11`). Подробнее — §8.1.

---

## 8. Именование, экспорты, алиасы

### 8.1. Имена файлов: две зоны

В кодовой базе сосуществуют два стиля — это результат миграции, оба валидны, но для **нового** кода ориентир — kebab-case.

| Стиль | Где применяется | Примеры файлов |
|---|---|---|
| **kebab-case** (целевой для нового React/feature-кода) | `features/**/components`, `hooks`, `api`, `types`, `model`, `shared/components`, общие константы | `room-api.ts`, `use-room.ts`, `user-card.tsx`, `room-container.tsx`, `edit-modal.tsx`, `view-models.ts`, `message-types.ts`, `badge.tsx` |
| **PascalCase** (легаси: классы-сервисы и инжектируемый UI) | координаторы, сервисы, локаторы, `src/ui/`, старые popup-компоненты | `RoomCoordinator.ts`, `PlayerCoordinator.ts`, `ControlPlayer.ts`, `WebSocketClient.ts`, `RezkaLocators.ts`, `InfoPanel.ts`, `ParseInfo.ts`, `App.tsx` |
| camelCase (точечно) | отдельные утилиты/модели | `messageTypes.ts`, `parseUrl.ts`, `deepCompare.ts`, `nickname.ts`, `time.ts` |

Для новых React-компонентов и feature-модулей называйте файлы **kebab-case** и экспортируйте **именованно**. Классы-сервисы (OOP-слой страницы) исторически — PascalCase + `export default`.

> Примечание: каталоги утилит называются `utills/` (с двойной `l`) — `features/player/utills`, `features/room/utills`. Это опечатка, закрепившаяся в путях импортов; не «исправляйте» её мимоходом — сломаете импорты.

### 8.2. Экспорты: именованные vs default

| Зона | Стиль экспорта | Пример |
|---|---|---|
| React-компоненты, хуки, API, типы, фабрики `features` | **именованный** | `export function UserCard(...)` (`user-card.tsx:32`), `export function useRoom()` (`use-room.ts:64`), `export const roomApi = ...` (`room-api.ts`), `export async function initRoomFeatured(...)` (`features/room/index.ts:14`) |
| Классы-сервисы / координаторы / локаторы / инжектируемый UI | `export default class` | `export default class RoomCoordinator` (`RoomCoordinator.ts:24`), `export default class WebSocketClient` (`WebSocketClient.ts:11`), `export default class ParseInfo` (`ParseInfo.ts:5`) |
| Точки входа (`entrypoints/*`) | `export default defineX(...)` (требование WXT) | `export default defineContentScript({...})` (`content.ts:8`) |

Правило для нового кода: **именованные экспорты** для всего, кроме (а) точек входа WXT, где `export default` обязателен фреймворком, и (б) когда расширяете легаси-слой классов, держащий единый `default`-класс на файл.

### 8.3. Алиас `@/` vs относительные пути

- `@/*` → `src/*` (`tsconfig.json:9`). Используйте `@/` для импортов **между слоями**: `import { getItem } from "@/shared/storage";`, `import type PlayerCoordinator from "@/features/player/PlayerCoordinator";`.
- Относительные пути (`./`, `../`) допустимы **внутри одного feature/модуля**: `import { roomApi } from "../api/room-api";` (`use-room.ts:9`), `import { WSMessageTypes } from "../model/messageTypes";`.
- Не смешивайте без нужды; межслойные импорты через `@/` читаются яснее и не ломаются при перемещении файла.

---

## 9. Стили / инжекция CSS

- **Tailwind 4** — только для popup (`src/entrypoints/popup/`), подключается через `@tailwindcss/vite` (`wxt.config.ts:43-45`). На странице Rezka Tailwind не используется.
- На странице Rezka стили задаются инлайн через `element.style.*` либо собственными `<style>`-тегами. Имена классов/анимаций — с префиксом `sync-mate-`.
- `@keyframes` — **только** с префиксом `sync-mate-` (`@keyframes sync-mate-spin`, не `spin`). Короткое имя Rezka перетрёт. Проверяется арх-линтом (§7.3) и описано в `CLAUDE.md:84`.

---

## 10. Что НЕ делать (с обоснованием)

Базовый список — `CLAUDE.md:86-91`. Здесь развёрнуто, с причинами и точками в коде.

### 10.1. Не возвращать YouTube в `matches` без `YouTubeLocators`

`content.ts:11` сейчас `matches: ["https://rezka.ag/*.html"]`. Если добавить YT-паттерн, не реализовав `YouTubeLocators` + ветку в `pickLocators`, то `pickLocators(location.hostname)` вернёт `undefined`, `content.ts:18` сделает `return`, и расширение **молча** не запустится на YT (без ошибки в консоли — просто ничего). Арх-линт (§7.4) ловит даже наличие строки `youtube` в content-скрипте. YouTube — это отдельная фича, а не «забытый кусочек».

Чтобы добавить сайт правильно (`CLAUDE.md:45-51`): создать `src/locators/MySiteLocators.ts` (наследник `BaseLocators`) → добавить ветку в `pickLocators` (`src/locators/index.ts`) → расширить `matches` в `content.ts` → добавить домен в `host_permissions` в `wxt.config.ts:34`.

### 10.2. Не убирать debounce в `ParseInfo.setWatchInfo`

`ParseInfo.ts:46-57` — debounce на 50 мс. Rezka при смене переводчика в одной микрозадаче снимает класс `active` со старого элемента и ставит на новый. Без debounce `MutationObserver` дважды вызовет callback (`handleInfo` в `RoomCoordinator.ts:166`), что приведёт к двойной отправке `info` в сокет и лишним обновлениям плеера. Debounce схлопывает парный mutation в один вызов.

### 10.3. Не использовать обычный `Record`/переменную модуля для state комнат в background

`background.ts:12-28` хранит state комнат в `browser.storage.session`, а не в модульной переменной. Причина: MV3 Service Worker может быть выгружен в любой момент, и обычный `Record` при этом обнулится — комнаты «потеряются». Новые поля state пишите через `updateRoom(tabId, patch)` (`background.ts:30-35`) — он делает merge (`{ ...старое, ...patch }`), а не перезапись. Очистка записи — по `tabs.onRemoved` (`background.ts:91-97`).

### 10.4. Не убирать try/catch вокруг `socket.connect()` в `RoomCoordinator.connect`

`RoomCoordinator.ts:88-94` оборачивает `await this.socket.connect(...)` в try/catch:

```ts
let connected = false;
try {
    connected = await this.socket.connect(roomId, name);
} catch (e) {
    // Без try/catch таймаут/ошибка WS превращалась в unhandled promise rejection.
    console.error("WS connect failed:", e);
}
```

Сейчас `WebSocketClient.connect()` возвращает чистый `Promise<boolean>` и не реджектит (`WebSocketClient.ts:14-63`: таймаут 5 с → `finish(false)`, ошибка/close → `finish(false)`). try/catch — страховка: если кто-то вернёт `connect()` к `reject`-семантике, без обёртки получится unhandled promise rejection и сломанный UX подключения. Подробнее — `CLAUDE.md:57`.

### 10.5. Не путать и не дублировать enum'ы сообщений

`WSMessageTypes` (`messageTypes.ts`) — протокол WebSocket с сервером; `BrowserMessageTypes` (`message-types.ts`) — внутренний IPC расширения. Это **разные** enum'ы в разных файлах. Определять любой из них во втором месте нельзя — арх-линт (§7.2) упадёт. Изменение `WSMessageTypes` затрагивает бэкенд — это контракт (см. §11), правится синхронно и ловится проверкой `protocol`.

### 10.6. Не нарушать направление импортов

`shared`/`locators`/`features` не импортируют из `@/entrypoints`; `shared` не импортирует из `@/features` (§7.1). Иначе арх-линт красный.

### 10.7. Не убирать префикс `sync-mate-` у `@keyframes` / не использовать короткие имена анимаций и классов на странице Rezka

См. §9 и §7.3. Rezka перетирает короткие имена.

### 10.8. Не обходить gate и не ослаблять проверки

Не запускайте `eslint`/`tsc`/`vitest`/`npm` напрямую в основной сессии — только через `scripts/gate.py` (§5). Не понижайте `--max-warnings=0` и не глушите правила точечными `// eslint-disable`, чтобы «позеленить» сборку, — чините причину.

### 10.9. Не трогать `.env`-файлы

`.env.development` / `.env.production` содержат реальную конфигурацию (в т.ч. `WXT_BACKEND_URL`). Не читать, не править, не коммитить. Редактируется/коммитится только `.env.example` (если есть). Переменные окружения расширения читаются как `import.meta.env.WXT_*` (например `wxt.config.ts:17` — `WXT_BACKEND_URL`).

---

## 11. Контракт с бэкендом (коротко)

Расширение зависит от бэкенда (`CLAUDE.md:93-102`): доступность `WS_URL/{roomId}`; handshake `{"type":"connect","name":"..."}` → ответ `{"type":"connect","id":"<uuid>"}` (`WebSocketClient.ts:41,44-50`); REST `/rooms` (POST/GET/PATCH/DELETE) и `/rooms/{id}/redirect`; поле `status` комнаты ∈ `waiting`/`playing`/`paused`/`pausing`. Любое переименование/изменение структуры WS-сообщения правится в обеих частях одновременно и проверяется gate-проверкой `protocol` (`scripts/protocol_sync.py`). Полный протокол — в корневом `DOCUMENTATION.md` §2.5.

---

## См. также

- `../CLAUDE.md` — тонкие канонические правила расширения (стек, координаторы, флаги `ControlPlayer`, «что не делать»).
- `./architecture.md` — структура и слои расширения (соседний документ этой папки `docs/`, если присутствует).
- `../../CLAUDE.md` — корневой гид по обоим подпроектам и общим конвенциям.
- `../../DOCUMENTATION.md` — полная техдокументация; §2.5 — WS-протокол (контракт BE↔FE).
- `../README.md` — README расширения.
- `../../scripts/README.md` — описание workspace-тулинга (`gate.py`, `arch_lint_ext.py`, `protocol_sync.py`).
- Бэкенд-аналог: `Sync-Mate-API-WS/CLAUDE.md` и его правила линтинга (black/isort/flake8/mypy).
