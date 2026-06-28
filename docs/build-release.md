# Сборка, CI и релиз — Sync-Mate-Extension

Полный справочник по тому, как расширение собирается локально, что проверяет CI и как `v*`-тег превращается в опубликованный GitHub Release («деплой» расширения).

> **Где что лежит.** `package.json`, `wxt.config.ts`, `eslint.config.ts`, `.github/workflows/` — внутри репозитория расширения (`Sync-Mate-Extension/`, у него свой git). А `scripts/gate.py`, `scripts/release.py`, `.claude/` — в корне рабочего пространства-обёртки (на уровень выше, **не** в git расширения). Пути ниже даны относительно того места, где файл реально лежит.

---

## Краткая карта

| Действие | Команда / триггер | Что происходит | Деплой? |
|---|---|---|---|
| Запуск в dev | `npm run dev` | WXT поднимает Chrome с расширением и открывает Rezka | нет |
| Сборка | `npm run build` (`wxt zip`) | `.output/chrome-mv3/` + `.zip` | нет |
| Линт | `npm run lint` | `eslint --max-warnings=0` (любое предупреждение = ошибка) | нет |
| Тесты | `npm test` | `vitest run` | нет |
| Тайп-чек | `npx wxt prepare && npx tsc --noEmit` | только через гейт, не отдельным npm-скриптом | нет |
| Гейт | `python scripts/gate.py --repo ext` | lint · type-check · arch · protocol · test (+ build в `--strict`) | нет |
| `git push` (в `main`) | скил `/push` | запускает CI (`ci.yml`) | **нет** |
| `v*`-тег | скил `/release` → `release.yml` | сборка Chrome+Firefox zip → **GitHub Release** | **да** |

Ключевое различие: **push = только CI**, **`v*`-тег = упакованный GitHub Release** (это и есть «деплой» расширения).

---

## 1. Переменные окружения

Расширение конфигурируется **одной** переменной. WXT (как и Vite) пробрасывает в код только переменные с префиксом `WXT_` (или `VITE_`) — обычные переменные окружения в бандл не попадают.

| Имя | Назначение |
|---|---|
| `WXT_BACKEND_URL` | Базовый URL бэкенда без завершающего `/` (например `http://localhost:8000` или `https://test-sm.zebaro.dev`). Из него выводится всё остальное. |
| `NODE_ENV` | `production` для релизных сборок (выставляется в `release.yml`); определяет, какой `.env.*` подхватит WXT. |

Файлы окружения (все — в `.gitignore`, в репозиторий не коммитятся; шаблон — `.env.example`):

| Файл | Когда используется |
|---|---|
| `.env.development` | `npm run dev` (режим разработки) |
| `.env.production` | релизная сборка (`NODE_ENV=production`); в CI генерируется на лету (см. §6) |
| `.env.example` | образец с единственной переменной `WXT_BACKEND_URL` — копируется в реальные `.env.*` |

### Как из `WXT_BACKEND_URL` выводятся адреса

Переменная читается и нормализуется в **двух** местах.

1. В манифесте — `wxt.config.ts:17-19` (срезается завершающий `/`, чтобы `host_permissions` не получил двойной слэш):

   ```ts
   const backendUrl = ((import.meta.env.WXT_BACKEND_URL as string) || "")
       .replace(/\/+$/, "");
   // ...
   host_permissions: ["https://rezka.ag/*.html", `${backendUrl}/*`],
   ```

2. В рантайме — `src/shared/constants/api.ts:6-20`:

   ```ts
   const BACKEND_URL = ((import.meta.env.WXT_BACKEND_URL as string) || "")
       .replace(/\/+$/, "");
   // если пусто — console.error «WXT_BACKEND_URL is not set …»
   export const API_URL = `${BACKEND_URL}/api`;                       // axios baseURL
   export const WS_URL  = `${BACKEND_URL.replace(/^http/, "ws")}/ws`; // http→ws, https→wss
   ```

   То есть `API_URL = {WXT_BACKEND_URL}/api`, `WS_URL = {WXT_BACKEND_URL}/ws` (с автоматической заменой схемы `http(s)` → `ws(s)`). Если переменная не задана — запросы тихо ломаются, но в DevTools сразу падает `console.error`.

> **Секреты.** Не коммитьте `.env.development` / `.env.production` — они в `.gitignore`. В CI URL берётся из repo-переменной (не секрета) `WXT_BACKEND_URL`; никаких токенов расширению не нужно.

---

## 2. npm-скрипты

Из `package.json:6-13`:

| Скрипт | Команда | Назначение |
|---|---|---|
| `dev` | `wxt` | Dev-режим с HMR, поднимает браузер |
| `prepare` | `wxt prepare` | Генерирует `.wxt/` (типы, авто-импорты, `tsconfig`); нужен перед `tsc` и в CI перед тестами |
| `build` | `wxt zip` | Production-сборка + упаковка в `.zip` |
| `lint` | `eslint --max-warnings=0` | Линт; **любое** предупреждение валит сборку |
| `test` | `vitest run` | Прогон тестов один раз |
| `test:watch` | `vitest --watch` | Тесты в watch-режиме |

> `prepare` — это ещё и npm-lifecycle-хук: он выполняется автоматически после `npm install`. Поэтому после установки зависимостей `.wxt/` уже сгенерирован.

---

## 3. Dev — `npm run dev`

`wxt` поднимает dev-сборку с HMR и запускает браузер с уже установленным расширением.

Что происходит по шагам:

1. WXT собирает `.output/chrome-mv3-dev/` (распакованное расширение для разработки).
2. Через `web-ext` запускает Chromium с загруженным расширением.
3. Открывает стартовые URL из `wxt.config.ts:10-14`:

   ```ts
   webExt: {
       startUrls: [
           "https://rezka.ag/films/action/76221-supermen-2025-latest.html",
       ],
   },
   ```

   То есть сразу открывается страница Rezka — content-скрипт активируется на ней без ручной навигации.
4. Переменные берутся из `.env.development` (`WXT_BACKEND_URL=http://localhost:8000` для локального бэкенда).

Целевой браузер по умолчанию — Chrome (MV3). Для другого браузера: `npm run dev -- --browser firefox`.

Локальный запуск всего стека (бэкенд + расширение) удобнее через bat-обёртки в корне: `scripts/start-ext.bat` (`npm run dev`) и `scripts/start-api.bat` (uvicorn бэкенда).

---

## 4. Сборка — `npm run build` (`wxt zip`)

`wxt zip` сначала выполняет обычный `wxt build`, затем упаковывает результат в архив. Результат — в `.output/`.

### Артефакты

| Путь | Что это |
|---|---|
| `.output/chrome-mv3/` | распакованная production-сборка (можно грузить через «Загрузить распакованное») |
| `.output/sync-mate-extension-<version>-chrome.zip` | упакованный Chrome-билд |
| `.output/sync-mate-extension-<version>-firefox.zip` | упакованный Firefox-билд (только при сборке под firefox) |
| `.output/sync-mate-extension-<version>-sources.zip` | архив исходников (генерируется для Firefox/AMO-ревью) |
| `.output/chrome-mv3-dev/` | артефакт dev-режима (не для публикации) |

Имена задаются шаблонами в `wxt.config.ts:37-41`:

```ts
zip: {
    artifactTemplate: "{{name}}-{{version}}-{{browser}}.zip",
    sourcesTemplate:  "{{name}}-{{version}}-sources.zip",
},
```

- `{{name}}` = `sync-mate-extension` (поле `name` из `package.json:2`).
- `{{version}}` = `version` из `package.json` (`package.json:4`).
- `{{browser}}` = `chrome` / `firefox`.

CI читает архивы именно по этой маске — не меняйте шаблон без правки `release.yml`.

### Манифест

Манифест собирается функцией `manifest: () => {…}` в `wxt.config.ts:15-36`:

| Поле | Значение | Источник |
|---|---|---|
| `name` | `Sync-Mate` | `wxt.config.ts:21` |
| `version` | из `package.json` | WXT подставляет автоматически |
| `permissions` | `clipboardWrite`, `webRequest`, `storage` | `wxt.config.ts` |
| `host_permissions` | `https://rezka.ag/*.html`, `${backendUrl}/*` | `wxt.config.ts:34` |
| `web_accessible_resources` | `icon/48.png` для `<all_urls>` | `wxt.config.ts:22-27` |

> Версия в манифесте всегда наследуется из `package.json`. Поэтому и `release.py`, и `release.yml` сначала правят `package.json`, а уже потом собирают (см. §7).

### Сборка под конкретный браузер

```bash
npx wxt zip --browser chrome     # Chrome MV3   → .output/chrome-mv3/
npx wxt zip --browser firefox    # Firefox MV2  → .output/firefox-mv2/ (+ sources.zip)
```

Firefox WXT собирает как **MV2** (каталог `firefox-mv2/`) — это сознательное поведение WXT, MV3 в Firefox исторически отличается. `npm run build` без флага собирает только Chrome.

### Vite / Tailwind / React

- React-поддержка — через модуль `@wxt-dev/module-react` (`wxt.config.ts:42`).
- Tailwind 4 подключён как Vite-плагин (`wxt.config.ts:43-45`) и применяется **только к popup**; на странице Rezka стили инлайнятся вручную (см. `CLAUDE.md` расширения).
- `srcDir: src`, `imports: false` (авто-импорты WXT выключены — импорты явные).

---

## 5. Линт — `npm run lint`

```bash
eslint --max-warnings=0
```

Плоский конфиг — `eslint.config.ts`. Существенное:

- **`--max-warnings=0`**: предупреждения трактуются как ошибки. Самый частый «провал на ровном месте» — `@typescript-eslint/no-unused-vars`, у которого уровень `warn` (`eslint.config.ts:27`). Один неиспользуемый импорт/переменная — и линт красный.
- Prettier прогоняется **внутри** ESLint правилом `prettier/prettier` (`eslint.config.ts:20-26`): `tabWidth: 4`, без табов. То есть форматирование — часть линта, отдельной команды `prettier` нет.
- Типы импортов: `@typescript-eslint/consistent-type-imports` = `error` (`eslint.config.ts:31`) — импорты типов обязаны быть `import type`.
- Для popup (`src/entrypoints/popup/**`) добавлен пресет `@eslint-react` (`eslint.config.ts:35-49`).
- Игнор: `.output/`, `.wxt/`, `.idea/` (`eslint.config.ts:51-53`).

---

## 6. Тесты — `npm test`

```bash
vitest run        # один прогон (CI, гейт)
vitest --watch    # локальный watch (npm run test:watch)
```

- Раннер — **Vitest 3** (`package.json:50`), окружение DOM — **jsdom** (`package.json:47`), для React-компонентов — `@testing-library/react`.
- На момент написания тесты в основном заготовки (см. `CLAUDE.md`: «Vitest 3 — тесты (пока пустые)»).
- Перед тестами в CI выполняется `npm run prepare` — без сгенерированного `.wxt/` (типы, авто-импорты) тесты не разрешат импорты.

---

## 7. Тайп-чек (только через гейт)

Отдельного npm-скрипта `type-check` **нет** — проверку типов добавляет гейт (`scripts/gate.py:75`):

```bash
npx wxt prepare        # генерирует .wxt/tsconfig.json и типы
npx tsc --noEmit       # проверка типов без вывода
```

Порядок важен: `tsconfig.json` расширяет `./.wxt/tsconfig.json` (`tsconfig.json:2`), который создаётся `wxt prepare`. Запустить `tsc` до `prepare` — получить ошибки резолва путей и отсутствующих типов WXT.

`paths` алиас `@/*` → `./src/*` (`tsconfig.json:7-9`) — отсюда импорты вида `@/shared/...`.

---

## 8. Гейт — `python scripts/gate.py --repo ext`

Гейт — единственный санкционированный способ запускать проверки/тесты для расширения. Не вызывайте `eslint`/`tsc`/`vitest` руками — гоняйте через гейт, он печатает компактную таблицу pass/fail.

Набор проверок для `ext` (`scripts/gate.py:73-81`):

| Проверка | Команда(ы) | Группа | По умолчанию |
|---|---|---|---|
| `lint` | `npm run lint` | lint | да |
| `type-check` | `npx wxt prepare` → `npx tsc --noEmit` | lint | да |
| `arch` | `python scripts/arch_lint_ext.py` | lint | да |
| `protocol` | `python scripts/protocol_sync.py` | lint | да |
| `test` | `npm test` | test | да |
| `build` | `npm run build` | build | **только `--strict`** |

Полезные флаги (`scripts/gate.py`):

```bash
python scripts/gate.py --repo ext             # core-проверки
python scripts/gate.py --repo ext --lint      # только статические проверки
python scripts/gate.py --repo ext --tests     # только тесты
python scripts/gate.py --repo ext --strict    # + build (heavy)
python scripts/gate.py --repo ext --only type-check
python scripts/gate.py --repo ext --list      # показать все проверки
```

Алиасы repo: `frontend` / `fe` == `ext`. Многошаговая проверка падает на первом упавшем шаге.

Дополнительно гейт включает:

- **`arch`** (`scripts/arch_lint_ext.py`) — архитектурный сторож расширения: направление импортов, разделение двух enum (`BrowserMessageTypes` ≠ `WSMessageTypes`), требование префикса `sync-mate-` у `@keyframes`, отсутствие «забытого» YouTube в `matches`.
- **`protocol`** (`scripts/protocol_sync.py`) — сверка контракта WS: множество `type`-сообщений должно совпадать на бэкенде и на фронте (`WSMessageTypes`). Эта проверка идёт **в обоих** гейтах (api и ext).

> **Гейт ≠ CI.** Гейт строже CI: тайп-чек, arch- и protocol-проверки и сборка выполняются **только** в гейте, в `ci.yml` их нет (см. §9). Гейт — локальный/предпушевый контроль; CI — серверная подстраховка.

---

## 9. CI — `.github/workflows/ci.yml`

### Триггеры

```yaml
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
```

CI срабатывает на push в `main` и на PR в `main` (`ci.yml:3-7`). **CI ничего не деплоит** — это только проверки.

### Джобы (Node 22, ubuntu-latest)

| Джоб | Шаги | Файл |
|---|---|---|
| `lint` | `actions/checkout@v4` → `setup-node@v3` (Node `22`) → кэш npm → `npm ci` → `npm run lint` | `ci.yml:10-25` |
| `tests` | `actions/checkout@v4` → `setup-node@v3` (Node `22`) → кэш npm → `npm ci` → `npm run prepare` → `npm test` | `ci.yml:27-43` |

Детали:

- Node — версия `22` в обоих джобах (`ci.yml:16`, `ci.yml:32`).
- Кэш npm — вручную через `actions/cache@v3` по ключу `${{ runner.os }}-npm-${{ hashFiles('package-lock.json') }}` (`ci.yml:17-23`, `ci.yml:34-40`).
- Зависимости ставятся через `npm ci` (по `package-lock.json`, воспроизводимо).
- В `tests` обязателен `npm run prepare` **перед** `npm test` — иначе нет `.wxt/` типов (`ci.yml:42-43`).

### Чего CI НЕ делает

- Не запускает тайп-чек (`tsc`), arch- и protocol-проверки — они только в гейте.
- Не собирает расширение (`npm run build`) и не пакует zip.
- Не создаёт релизов и ничего не публикует.

Иными словами: **push в `main` → запускается `ci.yml` (lint + tests) и на этом всё.** Чтобы получить артефакты — нужен `v*`-тег (§10).

---

## 10. Релиз — `.github/workflows/release.yml`

`v*`-тег — это **production-деплой расширения**: workflow собирает zip под Chrome и Firefox и публикует GitHub Release с этими архивами.

### Триггеры

```yaml
on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Release version (без префикса v, например 0.2.0)'
        required: true
        type: string
```

Два способа (`release.yml:3-13`):

1. **Push тега `v*`** — обычный путь (тег ставит `/release`, см. §11).
2. **Ручной запуск** (Actions → Release → Run workflow) с вводом версии без префикса `v`.

`permissions: contents: write` (`release.yml:15-16`) — нужно для создания релиза.

### Пошаговый разбор (джоб `build`, ubuntu-latest)

1. **Checkout** с `fetch-depth: 0` (`release.yml:23-26`) — полная история нужна для авто-генерации release notes по коммитам.
2. **Resolve version** (`release.yml:28-38`): если запуск ручной (`workflow_dispatch`) — версия из `inputs.version`; иначе из `GITHUB_REF` (`refs/tags/vX.Y.Z`) обрезается `refs/tags/` и ведущий `v`. Результат → `steps.version.outputs.VERSION`.
3. **Setup Node** `22` со встроенным npm-кэшем (`release.yml:40-44`, здесь `setup-node@v4` с `cache: 'npm'` — в отличие от ручного кэша в `ci.yml`).
4. **Install** — `npm ci` (`release.yml:46-47`).
5. **Sync package.json version** (`release.yml:49-51`):

   ```bash
   npm version "<VERSION>" --no-git-tag-version --allow-same-version
   ```

   Подставляет версию из тега в `package.json` (без коммита и без git-тега). Отсюда её возьмёт WXT для манифеста. `--allow-same-version` нужен, потому что при нормальном `/release` версия уже выставлена `release.py` — тогда шаг идемпотентен.
6. **Lint** — `npm run lint` (`release.yml:53-54`).
7. **Test** — `npm test` (`release.yml:56-57`).
8. **Configure production env** (`release.yml:59-71`) — генерация `.env.production` из repo-переменной:

   ```bash
   if [ -z "${{ vars.WXT_BACKEND_URL }}" ]; then
     echo "::error::WXT_BACKEND_URL is missing in repo variables."
     exit 1
   fi
   echo "WXT_BACKEND_URL=${{ vars.WXT_BACKEND_URL }}" > .env.production
   ```

   - Файла `.env.production` в репозитории нет (он в `.gitignore`) — workflow создаёт его на лету.
   - Источник — **repo VARIABLE** `WXT_BACKEND_URL` (Settings → Secrets and variables → Actions → **Variables**), не секрет.
   - Если переменная **не задана** — workflow падает рано с `::error::` и `exit 1` (ничего не соберёт и не опубликует). Это намеренный fail-fast.
9. **Build Chrome** (`release.yml:73-76`): `npx wxt zip --browser chrome`, `NODE_ENV: production` → `.output/sync-mate-extension-<v>-chrome.zip`.
10. **Build Firefox** (`release.yml:78-81`): `npx wxt zip --browser firefox`, `NODE_ENV: production` → firefox-zip **+** sources-zip (MV2).
11. **List artifacts** — `ls -la .output/` (`release.yml:83-84`), для логов.
12. **Create GitHub Release** (`release.yml:86-96`), action `softprops/action-gh-release@v2`:

    | Параметр | Значение |
    |---|---|
    | `tag_name` | `v${VERSION}` |
    | `name` | `v${VERSION}` |
    | `generate_release_notes` | `true` (авто-нотки по коммитам) |
    | `draft` | `false` |
    | `prerelease` | `true`, если в версии есть `-` (например `0.2.0-rc1`) |
    | `files` | `.output/*.zip` |

### Что попадает в релиз

`files: .output/*.zip` грузит **все** zip из `.output/` — то есть в GitHub Release окажутся три архива:

- `sync-mate-extension-<v>-chrome.zip`
- `sync-mate-extension-<v>-firefox.zip`
- `sync-mate-extension-<v>-sources.zip`

### Краевые случаи и тонкости

- **Pre-release по дефису.** Версия с дефисом (`0.2.0-beta`, `1.0.0-rc1`) помечается как pre-release через `contains(version, '-')`. Учтите: MV3-манифест требует числовой версии — суффикс вида `-rc1` WXT кладёт в `version_name`, а в `version` оставляет числовую часть.
- **Ручной запуск создаёт тег.** При `workflow_dispatch` workflow сам тег не ставит, но `action-gh-release` с `tag_name: v<version>` создаст тег на текущем коммите, если его ещё нет. Так релиз можно выпустить из ветки `main` без предварительного тегирования.
- **Версия в `package.json` в CI не коммитится.** Шаг `npm version --no-git-tag-version` правит файл только в рабочей копии раннера. Поэтому источник истины версии для тега — это коммит `Release vX.Y.Z`, который делает `release.py` **до** тега (§11). При ручном запуске из произвольного коммита версия форсится из инпута.
- **Падение до сборки.** Линт/тест/проверка `WXT_BACKEND_URL` идут **до** сборки — красный линт или незаданная переменная остановят релиз, ничего не опубликовав.

---

## 11. Привязка к control system — `/push` против `/release`

Расширение живёт под общим «control system» рабочего пространства (скрипты в `scripts/`, скилы и хуки в `.claude/`). Внешние действия — два слова.

### `/push` — только CI

Скил `/push` (`.claude/skills/push/SKILL.md`):

1. Находит репозитории с непзапушенными коммитами (`git log origin/main..HEAD`).
2. Гоняет гейт: `python scripts/gate.py --repo ext`. **Красный → STOP**, не пушит.
3. На зелёном создаёт маркер `.claude/.approve-push` и делает `git push origin main`.
4. Push **запускает CI** (`ci.yml`) — это **не** деплой.

Push блокирует хук `guard-git` (`.claude/hooks/guard-git.py`), пока нет свежего маркера `.approve-push` (TTL ~15 мин).

### `/release` — деплой (`v*`-тег → GitHub Release)

`v*`-тег — единственный путь к продакшену. Готовит его `scripts/release.py`, **который никогда не пушит** (`release.py:1-21`); пуш делает скил `/release` (`.claude/skills/release/SKILL.md`) после одного подтверждения владельца.

Что делает `scripts/release.py --repo ext` по шагам:

1. **Sanity** (`release.py:149-154`): репозиторий на `main`, рабочее дерево чистое (иначе abort; обходы — `--allow-branch`, `--allow-dirty`).
2. **Версия** (`release.py:156-165`): берёт последний `v*`-тег и вычисляет следующий (`--bump patch|minor|major`, по умолчанию `patch`; либо `--set X.Y.Z`).
3. **Strict-гейт** (`release.py:174-179`): `python scripts/gate.py --repo ext --strict` — **с** проверкой `build`. Красный → abort (обход `--no-gate` только для аварий).
4. **Бамп версии** (`release.py:97-109`): для `ext` правит `"version"` в `package.json`.
5. **CHANGELOG** (`release.py:112-128`): добавляет секцию `## vX.Y.Z — <дата>` в начало `CHANGELOG.md`.
6. **Коммит + локальный тег** (`release.py:187-189`): `git commit -m "Release vX.Y.Z"` и аннотированный тег `vX.Y.Z`. **Без пуша.**

Дальше скил `/release` после явного «go» владельца:

1. Создаёт маркеры `.claude/.approve-push` + `.claude/.approve-deploy` (их требует хук `guard-git`).
2. `git -C Sync-Mate-Extension push origin main`.
3. `git -C Sync-Mate-Extension push origin vX.Y.Z` — **этот пуш тега и запускает `release.yml`** (деплой).
4. Сообщает, где смотреть (вкладка Actions репозитория).

> **Памятка из скила `/release`:** `release.yml` требует выставленную repo-переменную `WXT_BACKEND_URL`, иначе падает рано (§10, шаг 8).

Сухой прогон без изменений: `python scripts/release.py --repo ext --bump patch --dry-run`.

### Итоговое различие

| Действие | Значит | Контроль |
|---|---|---|
| `git commit` | локальный сейвпоинт | свободно (блок только при упоминании Claude/AI или опасных операциях) |
| `git push` (`/push`) | **запуск CI** (`ci.yml`) | зелёный гейт → маркер `.approve-push` (TTL ~15 мин) |
| push `v*`-тега (`/release`) | **production-деплой** → GitHub Release (`release.yml`) | strict-гейт + бамп версии + одно подтверждение → маркер `.approve-deploy` |

---

## 12. Частые проблемы

- **Линт красный без видимой причины** — скорее всего неиспользуемый импорт/переменная: правило `no-unused-vars` имеет уровень `warn`, а `--max-warnings=0` превращает его в ошибку.
- **`tsc` ругается на пути/типы WXT** — забыли `wxt prepare` (или запускаете `tsc` напрямую вместо гейта). `tsconfig` расширяет сгенерированный `.wxt/tsconfig.json`.
- **`release.yml` падает на шаге Configure production env** — не задана repo-переменная `WXT_BACKEND_URL` (Settings → Variables).
- **В сборке `console.error` «WXT_BACKEND_URL is not set»** — переменная пустая; API/WS-вызовы не работают. Проверьте `.env.*`.
- **CI прошёл, но что-то всё равно не так** — помните, CI слабее гейта: он не делает тайп-чек, arch/protocol-проверки и сборку. Перед пушем гоняйте `python scripts/gate.py --repo ext`.
- **Push заблокирован хуком** — маркер `.approve-push` устарел (>15 мин). `/push` пересоздаёт его и повторяет.
- **`git push` не задеплоил** — так и должно быть: деплой даёт только пуш `v*`-тега через `/release`, обычный push — лишь CI.

> О deploy-разделе в корневом `DOCUMENTATION.md`: он частично устарел — доверяйте конфигам (`ci.yml`, `release.yml`, `wxt.config.ts`) и этому файлу, а не старому документу.

---

## См. также

- [`../CLAUDE.md`](../CLAUDE.md) — гид по расширению (стек, архитектура, конвенции).
- [`../../CLAUDE.md`](../../CLAUDE.md) — общий гид по репозиторию-обёртке Sync-Mate.
- [`../README.md`](../README.md) — README расширения.
- [`../../scripts/README.md`](../../scripts/README.md) — инструментарий рабочего пространства (`gate.py`, `release.py` и др.).
- [`../../.claude/docs/workflow.md`](../../.claude/docs/workflow.md) — жизненный цикл задачи, push vs deploy.
- [`../../.claude/docs/conventions.md`](../../.claude/docs/conventions.md) — коммиты, гейт, версии и теги, правила `.env`.
- [`../../DOCUMENTATION.md`](../../DOCUMENTATION.md) — полная техдокументация (раздел про деплой частично устарел — см. §12).
