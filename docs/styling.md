# Стилизация Sync-Mate-Extension

Справочник по двум несовместимым «мирам» стилей расширения: Tailwind 4 **только** в popup и vanilla-DOM (`element.style.*` / инъекция `<style>`) для UI, встраиваемого прямо в страницу Rezka.

---

## 0. TL;DR — два мира стилей

В расширении сосуществуют ровно два подхода к стилям, и смешивать их нельзя:

| | **Popup** (React-приложение) | **Page-injected UI** (виджеты на Rezka) |
|---|---|---|
| Где живёт | `src/entrypoints/popup/**`, `src/features/room/components/**`, `src/shared/components/ui/**` | `src/ui/components/{InfoPanel,StatusBox,OverlayLoader}.ts` |
| Технология стилей | **Tailwind CSS 4** (utility-классы в `className`) | **Vanilla DOM**: инлайн `element.style.*` + редкие инъекции `<style>` |
| Документ (DOM) | собственный `index.html` расширения, изолированный контекст | DOM **чужой страницы** Rezka, общий с её стилями и скриптами |
| Изоляция стилей | полная (свой документ, Tailwind-reset) | **отсутствует** — стили Rezka и наши делят одно дерево |
| Префикс имён | не нужен | **обязателен `sync-mate-`** для имён классов и `@keyframes` |
| CSS-файлы | один: `src/entrypoints/popup/style.css` | нет ни одного |
| Инструмент сборки | плагин `@tailwindcss/vite` (см. `wxt.config.ts`) | ничего — строки в TS |

Ключевой принцип: **Tailwind физически не доезжает до страницы Rezka.** Content-script не импортирует никакого CSS (`cssInjectionMode` не включён, `content.ts` не делает `import "*.css"`), поэтому ни один utility-класс там не сработает. Всё, что видно поверх плеера Rezka, нарисовано «руками» через `style.*`.

---

## 1. Popup — Tailwind CSS 4

### 1.1. Как подключён Tailwind

Цепочка короткая и без классического конфиг-файла (Tailwind 4 — CSS-first, `tailwind.config.js` в проекте **нет**):

1. `src/entrypoints/popup/style.css` — единственная строка:
   ```css
   @import "tailwindcss";
   ```
   (`src/entrypoints/popup/style.css:1`)
2. `src/entrypoints/popup/main.tsx:4` импортирует этот CSS в bundle popup:
   ```ts
   import "./style.css";
   ```
3. `wxt.config.ts:43-45` регистрирует Vite-плагин Tailwind для всей сборки:
   ```ts
   vite: () => ({
       plugins: [tailwindcss()],
   }),
   ```
   (`import tailwindcss from "@tailwindcss/vite"` — `wxt.config.ts:2`)

Версии (`package.json`): `tailwindcss ^4.1.13`, `@tailwindcss/vite ^4.1.13`. Иконки — `@heroicons/react`.

> Важно: Tailwind подключается через единственный CSS, который импортирует **только** `popup/main.tsx`. Content-script (`entrypoints/content.ts`) и фоновый SW его не импортируют — значит utility-классы доступны исключительно в popup.

### 1.2. Точка входа и каркас popup

`src/entrypoints/popup/index.html` → `<div id="root">` → `main.tsx` монтирует `<App/>` в `React.StrictMode`.

`App.tsx:12-22` задаёт визуальный каркас (это и есть «дизайн-язык» popup):

```tsx
<div className="min-h-screen bg-gradient-to-b from-[#03001C] to-[#15001C] text-white flex items-center justify-center p-3">
    <div className="rounded-2xl shadow-2xl bg-white/4 backdrop-blur-lg border border-white/8 w-[380px] overflow-hidden">
        <RoomContainer />
    </div>
</div>
```

### 1.3. Где живут popup-компоненты (все на Tailwind)

| Слой | Путь | Назначение |
|---|---|---|
| Каркас/провайдеры | `src/entrypoints/popup/App.tsx`, `main.tsx` | градиент-фон, карточка, `QueryClientProvider` |
| Контейнер комнаты | `src/features/room/components/containers/room-container.tsx` | состояния `loading/error/empty`, сборка экрана |
| UI комнаты | `src/features/room/components/ui/{room-header,user-list,user-card,edit-modal}.tsx` | шапка, список участников, модалка редактирования |
| Скелетоны | `src/features/room/components/skeletons/room-skeleton.tsx` | заглушки загрузки |
| Общие примитивы | `src/shared/components/ui/{badge,skeleton}.tsx` | переиспользуемые элементы |
| Прочее popup | `src/entrypoints/popup/components/{SetName,Room,User}.tsx` | вспомогательные экраны |

### 1.4. Дизайн-конвенции popup (де-факто из кода)

Единого токен-файла нет — палитра и ритм заданы повторяющимися Tailwind-классами. Наблюдаемые паттерны:

- **Палитра фона**: тёмно-фиолетовый градиент `from-[#03001C] to-[#15001C]` (`App.tsx`), модалки — сплошной `bg-[#0D0820]` (`edit-modal.tsx:46`).
- **Полупрозрачные поверхности**: `bg-white/4`, `bg-white/5`, `bg-white/2`; границы `border-white/8`, `border-white/10`, `border-white/6`.
- **Текст по уровням важности**: `text-white`, `text-white/50`, `text-white/35`, `text-white/30`, `text-white/25` — чем второстепеннее, тем ниже opacity.
- **Акцентный цвет** — violet/indigo: `bg-violet-600 hover:bg-violet-500` (основная кнопка), `text-violet-400`, `focus:ring-violet-500/20` (`edit-modal.tsx`, `room-container.tsx`); в `SetName.tsx` акцент — `indigo-600`.
- **Семантические статусы** (`room-header.tsx:17-42`, `statusConfig`):

  | Статус комнаты | Классы |
  |---|---|
  | `waiting` | `bg-amber-500/15 text-amber-300 border-amber-500/25`, точка `bg-amber-400` |
  | `playing` | `bg-emerald-500/15 text-emerald-300 border-emerald-500/25`, точка `bg-emerald-400` + `animate-pulse` |
  | `paused` / `pausing` | `bg-blue-500/15 text-blue-300 border-blue-500/25`, точка `bg-blue-400` |
  | fallback | `bg-white/8 text-white/50 border-white/10` |

- **Скругления**: карточки/модалки `rounded-2xl`, кнопки/инпуты `rounded-xl`, бейджи `rounded-full`.
- **Анимации**: только встроенные утилиты Tailwind — `animate-pulse` (точка статуса), `transition-colors`/`transition-all` на интерактиве. **Свои `@keyframes` в popup не используются** (и не нужны — изоляция полная).
- **Размеры popup**: внешняя карточка `w-[380px]` (`App.tsx`), модалка `max-w-[300px]` (`edit-modal.tsx`), `SetName` — `w-[300px]`.

Поскольку отдельного конфига нет, при добавлении нового экрана **переиспользуйте уже встречающиеся классы** (например, бейдж-статус копируйте из `statusConfig`), а не вводите новый оттенок.

---

## 2. Page-injected UI — vanilla DOM на странице Rezka

### 2.1. Почему не Tailwind и почему всё «руками»

Виджеты из `src/ui/components/` встраиваются в DOM страницы Rezka content-скриптом (`entrypoints/content.ts` → `initPlayerFeatured` / `initRoomFeatured`). У этого DOM:

- **нет нашего CSS** — Tailwind туда не инжектится (см. §1.1), а тянуть весь reset Tailwind в чужую страницу нельзя — он сломал бы вёрстку Rezka;
- **общее пространство имён** — классы и `@keyframes` Rezka и наши конфликтуют;
- **Rezka активно перетирает короткие имена** — например глобальный `@keyframes spin` или класс вроде `.loader` может быть переопределён её собственными стилями.

Поэтому правила жёсткие:

1. Стили задаются **инлайн** через `element.style.*` (большинство случаев) — инлайн имеет высокий приоритет и не зависит от селекторов Rezka.
2. То, что инлайном не выразить (а это практически только `@keyframes`), инжектится отдельным `<style>`-тегом.
3. **Любое** собственное имя класса или `@keyframes` обязано начинаться с префикса `sync-mate-`.

Почему именно `sync-mate-`: префикс резервирует пространство имён под расширение и спасает от того, что Rezka объявит свой `spin`/`loader`/`my-popup` и перетрёт наш. См. также раздел «Стили» в `Sync-Mate-Extension/CLAUDE.md`.

### 2.2. Два механизма инъекции

| Механизм | Когда | Пример |
|---|---|---|
| `element.style.<prop> = "..."` | почти всё: позиция, размеры, цвета, transform, opacity | `InfoPanel.ts:22-31`, `StatusBox.ts:44-66`, `OverlayLoader.ts:40-60` |
| `element.style.setProperty(prop, value, "important")` | когда нужно перебить стиль Rezka с `!important` | `StatusBox.ts:28-29` (`width:auto`, `margin-left:10px` для `ratingTable`) |
| Инъекция `<style>` в `document.head` | только для `@keyframes` (их нельзя задать инлайн) | `OverlayLoader.ts:6-12` (`ensureSpinKeyframes`) |

---

## 3. Встраиваемые компоненты (`src/ui/components/`)

Все три создаются один раз в `initRoomFeatured` (`src/features/room/index.ts:19-24`) из объекта `ui` и принимают на вход узлы-«якоря» из `RezkaLocators` (`src/locators/RezkaLocators.ts`). `OverlayLoader` дополнительно фигурирует в player-слое (`src/features/player/index.ts:7`).

### 3.1. OverlayLoader — спиннер «ждём буферизацию/синхронизацию»

Файл: `src/ui/components/OverlayLoader.ts`. **Единственный компонент, которому нужен `@keyframes`** — отсюда и канонический пример правила префикса.

**Роль.** Когда плеер заблокирован в ожидании подтверждения от сервера (буферизация участников), поверх области плеера показывается крутящийся круг, кнопка play приглушается, а пробел перехватывается, чтобы пользователь не снял паузу руками.

**Как устроены стили:**

- Спин-анимация объявляется через инжектируемый `<style>` с уникальными идентификаторами (`OverlayLoader.ts:3-12`):
  ```ts
  const SPIN_KEYFRAMES_ID = "sync-mate-spin-keyframes";   // id <style>-тега
  const SPIN_ANIMATION_NAME = "sync-mate-spin";           // имя @keyframes

  function ensureSpinKeyframes() {
      if (document.getElementById(SPIN_KEYFRAMES_ID)) return;   // идемпотентно
      const style = document.createElement("style");
      style.id = SPIN_KEYFRAMES_ID;
      style.textContent = `@keyframes ${SPIN_ANIMATION_NAME} { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
      document.head.appendChild(style);
  }
  ```
  Проверка `getElementById` делает вставку **идемпотентной** — повторные конструкторы (например после `updatePlayer`) не плодят дубли `<style>`.
- Сам спиннер — `div` с инлайн-бордером и анимацией (`OverlayLoader.ts:53-60`): круг 110×110, толстый полупрозрачный бордер, `borderRadius: 50%`, `animation: "sync-mate-spin 1s linear infinite"`.
- Оверлей-подложка (`OverlayLoader.ts:39-45`): абсолютный `div` 100%×100% с прозрачным фоном `rgba(255,255,255,0)` — нужен, чтобы накрыть тайм-лайн и перехватывать события.

**Жизненный цикл (`show`/`hide`):**

- `show()` (`OverlayLoader.ts:65-75`): приглушает кнопку play (`filter: grayscale(90%)`, `opacity: 0.7`), вставляет оверлей перед `playerControlTimeline`, добавляет обёртку спиннера в родителя тайм-лайна и вызывает `blockSpace()`.
- `hide()` (`OverlayLoader.ts:77-85`): удаляет оверлей и спиннер, сбрасывает `filter`/`opacity` кнопки play в `""`, вызывает `unblockSpace()`.
- `blockSpace()` / `unblockSpace()` (`OverlayLoader.ts:87-101`): вешает/снимает `keydown`-listener в фазе capture, который для `code === "Space"` делает `preventDefault()` + `stopImmediatePropagation()`.

**Кто дёргает.** `show`/`hide` вызываются из `ControlPlayer.setIsBlockPause` (`src/features/player/services/ControlPlayer.ts:160-168`): `isBlockPause === true → show()`, иначе `hide()`. Якоря: `playerPlayBtn` (`#oframecdnplayer > pjsdiv:nth-child(20)`) и `playerControlTimeline` (`#cdnplayer_control_timeline`) — `RezkaLocators.ts:25-27, 20-22`.

### 3.2. InfoPanel — панель «кто сколько загрузил»

Файл: `src/ui/components/InfoPanel.ts`.

**Роль.** Маленькая полупрозрачная панель в левом нижнем углу плеера, показывает, сколько секунд видео уже буферизовал каждый участник (приходит из WS-сообщений `info`).

**Как устроены стили (`InfoPanel.ts:20-46`):** один `div`, целиком инлайн —
`position: absolute`, `bottom: 60px`, `left: 10px`, `padding: 8px`, `borderRadius: 2.3px`, `opacity: 0` (по умолчанию скрыта), `fontSize: 12px`, `background: rgb(23, 35, 34)`, `display: flex`. Добавляется в `playerFrame` (`#oframecdnplayer`).

**Логика видимости (`InfoPanel.ts:35-45`):** `MutationObserver` следит за атрибутом `style` элемента `playerControlTimeline`; когда панель управления плеера скрывается (`visibility === "hidden"`), скрывается и наша панель — она появляется только вместе с контролами плеера.

**Обновление данных (`InfoPanel.ts:48-67`):**
- `updateInformation(person, downloaded_time)` округляет время и кладёт в `this.information[person]`, затем зовёт `updatePanel()`.
- `updatePanel()` строит текст `"Загружено:\n<имя>: <сек>s\n..."` и выставляет `opacity = 0.7`.

**Якоря:** `playerFrame`, `playerControlTimeline` (`RezkaLocators.ts:19-22`). Вызывается из `RoomCoordinator.handleWsMessage` по `WSMessageTypes.INFO` (`RoomCoordinator.ts:127-132`).

### 3.3. StatusBox — кнопка-статус рядом с рейтингом

Файл: `src/ui/components/StatusBox.ts`.

**Роль.** Кликабельная плашка на странице фильма (под блоком соц-кнопок, рядом с таблицей рейтинга), которая показывает текущее состояние комнаты (`Connecting...` → `Create room` / `Connected ✅` / `Error connecting` и т.д.) и служит точкой входа в действия (создать комнату, переподключиться).

**Перекомпоновка вёрстки Rezka (`StatusBox.ts:25-40`):** конструктор переносит таблицу рейтинга в собственный flex-контейнер. Здесь применяется приоритет `!important`, чтобы перебить стили Rezka:
```ts
this.ratingTable.style.setProperty("width", "auto", "important");
this.ratingTable.style.setProperty("margin-left", "10px", "important");
```
Контейнер (`display:flex; position:relative`) вставляется через `socialWrapper.insertAdjacentElement("afterend", ...)`.

**Сама плашка (`createStatusBox`, `StatusBox.ts:42-73`):** инлайн-стили — `backgroundColor:#03001d`, `borderRadius:5px`, `200×40`, `transform: translateY(-10px)`, flex-центрирование, `cursor:pointer`, `userSelect:none`. Внутри:
- иконка `img`, `src = browser.runtime.getURL("icon/48.png")` (30×30). Иконка объявлена в `wxt.config.ts:22-27` как `web_accessible_resources`.
- текст-`div` (`flex:1`, по центру, `color:#fff`, `14px`), стартовый текст `"Connecting..."`.

**API:** `setText(text)` (`StatusBox.ts:79-81`) меняет текст; `onClick(fn)` (`StatusBox.ts:75-77`) задаёт обработчик клика. Управляется из `RoomCoordinator` (`RoomCoordinator.ts:52-53, 80, 97-119`).

**Якоря:** `ratingTable` (`table.b-post__rating_table`), `socialWrapper` (`div.b-post__social_holder_wrapper`) — `RezkaLocators.ts:30-33`.

> Метод `togglePopup` (`StatusBox.ts:83-121`) — незавершённая выезжающая панель: см. §5 (гочи).

---

## 4. Линтер `arch_lint_ext.py` — правило `sync-mate-` для `@keyframes`

Файл: `scripts/arch_lint_ext.py` (запускается из корня репозитория: `python scripts/arch_lint_ext.py`). Это архитектурный «сторож»; среди его проверок есть прямо относящаяся к стилям.

**Правило 3 (`check_keyframes_prefix`, `arch_lint_ext.py:131-139`).** Сканирует все code-файлы (`.ts/.tsx/.mts/.cts/.js/.jsx`, кроме `node_modules`, `.output`, `.wxt`, `.idea`) и для каждого литерального `@keyframes <name>` требует префикс `sync-mate-`:

```python
kf = re.compile(r"@keyframes\s+([A-Za-z_][\w-]*)")
...
if not name.startswith("sync-mate-"):
    violations.append(f"...: @keyframes '{name}' must be prefixed `sync-mate-` (Rezka clobbers short animation names)")
```

**Что важно знать о покрытии:**

- Перед проверкой комментарии вырезаются строко-осведомлённым сканером (`strip_comments`, `arch_lint_ext.py:51-89`), поэтому `@keyframes spin` или `//` внутри URL в комментариях/строках не дают ложных срабатываний.
- **Интерполированные имена пропускаются.** Регэксп требует, чтобы после `@keyframes ` шёл `[A-Za-z_]`. В `OverlayLoader.ts:10` имя задано как `@keyframes ${SPIN_ANIMATION_NAME}` — после пробела идёт `$`, поэтому строка **не матчится и не проверяется**. То есть реальный спиннер проходит «мимо» линтера: его корректность держится на константе `SPIN_ANIMATION_NAME = "sync-mate-spin"` (конвенция), а линтер — это backstop, который поймает любого, кто впишет литеральный короткий `@keyframes spin`.
- Линтер **не проверяет имена классов** (`className` / `element.className`). Правило `sync-mate-` для классов — только конвенция из `CLAUDE.md`, машинно оно не валидируется (это и есть причина, по которой «my-popup» в §5 не ловится).

**Остальные правила линтера** (для контекста, не про стили): направление импортов между слоями (`shared`/`locators`/`features` не импортируют `@/entrypoints`); единственность `enum WSMessageTypes` и `enum BrowserMessageTypes`; отсутствие YouTube-паттернов в `matches` content-скрипта.

---

## 5. Гочи и расхождения (drift)

- **`StatusBox.togglePopup` нарушает конвенцию префикса.** На `StatusBox.ts:87` всплывающая панель получает `className = "my-popup"` — без префикса `sync-mate-`. Это противоречит правилу из `CLAUDE.md`, и линтер это **не ловит** (он проверяет только `@keyframes`, а не имена классов). Сам метод выглядит незавершённым: содержит отладочный `console.log(this.container)` (`StatusBox.ts:84`) и плейсхолдер-текст `"Это панель справа!"` (`StatusBox.ts:88`). При доработке: переименуйте класс в `sync-mate-popup`.
- **Плейсхолдер-тексты в injected-UI.** `InfoPanel` стартует с `textContent = "Hello"` (`InfoPanel.ts:31`) — заменяется при первом `updatePanel()`. Это временная заглушка, не финальный текст.
- **Мёртвая ветка в `InfoPanel.updatePanel`.** Проверка `if (!this.information)` (`InfoPanel.ts:49`) всегда ложна: `information` инициализирован как `{}` и никогда не становится `null`/`undefined`. Ветка, скрывающая панель (`opacity = "0"`), фактически недостижима — панель всегда уходит в `opacity = 0.7`. Видимостью реально управляет только `MutationObserver`.
- **Анимация `@keyframes` обходит линтер.** Как описано в §4, интерполированное имя в `OverlayLoader` статически не проверяется. Если кто-то заведёт новый спиннер с литеральным `@keyframes spin` — линтер упадёт; если через интерполяцию короткой строки — пройдёт. Всегда префиксуйте имя в константе.
- **Никакого CSS на странице Rezka.** Не пытайтесь «вынести» инлайн-стили injected-компонентов в `.css` и заимпортировать в content-script ради чистоты — это либо не подключится, либо протечёт Tailwind-reset в Rezka. Инлайн здесь — осознанное решение.
- **DOCUMENTATION.md в корне частично устарел.** Не сверяйтесь с ним по вопросам деплоя: фактически `docker-compose.yml` бэкенда содержит один сервис (`cloudflared` удалён в коммите `f0c7443`), а CI гоняет тесты только на Python 3.13. К стилям расширения это прямого отношения не имеет, но при кросс-чтении доков держите в уме.

---

## 6. Рецепт: как добавить новый встраиваемый (page-injected) компонент

1. Создайте класс в `src/ui/components/<Name>.ts` по образцу существующих.
2. Все визуальные свойства задавайте через `element.style.*`; чтобы перебить Rezka — `setProperty(prop, value, "important")`.
3. Нужна анимация? Заведите константы `<NAME>_KEYFRAMES_ID` и `<NAME>_ANIMATION_NAME = "sync-mate-<name>"`, инжектируйте `<style>` идемпотентно через `getElementById` (паттерн `ensureSpinKeyframes`, `OverlayLoader.ts:6-12`).
4. Нужен класс? Имя — строго с префиксом `sync-mate-` (например `sync-mate-popup`), не короткое слово.
5. Получайте DOM-якоря из `RezkaLocators` через конструктор `ui` в `src/features/room/index.ts` (или player-слой), не хардкодьте селекторы внутри компонента.
6. Прогоните `python scripts/arch_lint_ext.py` и `npm run lint` перед коммитом.

Для popup-экрана всё наоборот: новый `*.tsx` под `src/features/**/components/**` или `src/entrypoints/popup/**`, стили — только Tailwind-классы в `className`, переиспользуя палитру из §1.4. Никаких `element.style.*` и `<style>`-инъекций.

---

## См. также

- [`../CLAUDE.md`](../CLAUDE.md) — гид по расширению (раздел «Стили» и «Что НЕ делать»).
- [`../../CLAUDE.md`](../../CLAUDE.md) — общий гид по репозиторию Sync-Mate.
- [`../../DOCUMENTATION.md`](../../DOCUMENTATION.md) — полная техдокументация (учитывайте §5: частично устарела по деплою).
- [`../../scripts/arch_lint_ext.py`](../../scripts/arch_lint_ext.py) — архитектурный линтер расширения (правило `sync-mate-` для `@keyframes`).
- Соседние документы в `docs/` этого подпроекта (по мере появления) — архитектура, WS-протокол, координаторы.
