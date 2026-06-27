# DOM-локаторы расширения

Справочник по слою DOM-локаторов Sync-Mate-Extension: как устроен механизм поиска элементов, какие узлы Rezka он находит и как подключить новый сайт.

---

## Зачем нужен слой локаторов

Расширение встраивается в чужую страницу (Rezka) и должно найти на ней конкретные DOM-узлы: видеоплеер, кнопку play, таймлайн, заголовок фильма, списки переводчиков и эпизодов. Все CSS-селекторы собраны в одном месте — в классах-локаторах под `src/locators/`. Это единственный слой, который «знает» про конкретную разметку сайта; вся остальная логика (плеер, комната, UI-компоненты) получает уже готовые `HTMLElement` и не содержит селекторов.

Структура слоя:

| Файл | Назначение |
|---|---|
| `src/locators/BaseLocators.ts` | Базовый класс: механизм `defineSelector` / `defineSelectorLazy` + поля, общие для всех сайтов |
| `src/locators/RezkaLocators.ts` | Реализация под `rezka.ag`: объявляет все конкретные селекторы |
| `src/locators/index.ts` | Диспетчер `pickLocators(hostname)` → выбирает класс по домену |

Иерархия классов: `RezkaLocators extends BaseLocators`. Для нового сайта появится свой `XxxLocators extends BaseLocators`.

---

## Механизм: `defineSelector` (eager) vs `defineSelectorLazy` (lazy)

Оба метода объявлены в `BaseLocators` (`src/locators/BaseLocators.ts:7` и `:24`) и доступны наследникам. Разница — **когда** выполняется поиск и **что происходит, если элемент не найден**.

### `defineSelector` — жадный (eager)

```ts
// src/locators/BaseLocators.ts:7
defineSelector<T extends boolean = false>(
    selector: string,
    all?: T,
): T extends true ? NodeListOf<HTMLElement> : HTMLElement
```

- Выполняет `document.querySelector` / `querySelectorAll` **немедленно**, в момент вызова (то есть в конструкторе `RezkaLocators`).
- Если элемент **не найден** — **бросает исключение**:
  - одиночный режим: `Error("Element not found for selector \"<selector>\"")` (`BaseLocators.ts:18`);
  - режим `all = true`: `Error("No elements found for selector \"<selector>\"")`, когда `NodeList` пуст (`BaseLocators.ts:13`).
- Возвращает уже найденный `HTMLElement` (или `NodeListOf<HTMLElement>` при `all`). Поле в классе хранит **сам узел**, а не функцию.

Последствие: все eager-селекторы обязаны существовать в DOM **на момент запуска content-скрипта**. Если хотя бы один не найден — конструктор `RezkaLocators` падает с исключением, и инициализация расширения на странице срывается. Поэтому через `defineSelector` объявляют только статичные элементы страницы, гарантированно присутствующие при загрузке (заголовок, контейнер плеера, таблица рейтинга и т. п.).

### `defineSelectorLazy` — ленивый (lazy)

```ts
// src/locators/BaseLocators.ts:24
defineSelectorLazy<T extends boolean = false>(
    selector: string,
    all?: T,
): () => T extends true ? NodeListOf<HTMLElement> : HTMLElement | null
```

- **Ничего не ищет** в момент вызова. Возвращает **функцию-замыкание**, которая выполняет `querySelector` / `querySelectorAll` при каждом вызове.
- Поиск откладывается до момента, когда потребитель действительно вызовет `locators.foo()`.
- **Не бросает** исключений: в одиночном режиме при отсутствии узла вернётся `null` (тип результата — `HTMLElement | null`). Проверять на `null` — обязанность вызывающего кода.
- Привязка метода к `document` делается один раз через `.bind(document)` (`BaseLocators.ts:28-30`), сам `selector` фиксируется в замыкании.

Последствие: lazy-селекторы подходят для элементов, которые **появляются/меняются динамически** уже после загрузки страницы или могут отсутствовать в принципе:
- `video` — Rezka вставляет тег плеера асинхронно;
- активный переводчик/эпизод (`.active`) — класс `active` навешивается и переснимается при переключении;
- списки переводчиков/эпизодов — могут отсутствовать у фильмов без озвучек/серий.

### Сводная таблица

| Свойство | `defineSelector` (eager) | `defineSelectorLazy` (lazy) |
|---|---|---|
| Когда ищет | сразу, в конструкторе | при каждом вызове возвращённой функции |
| Что хранится в поле | сам `HTMLElement` | функция `() => HTMLElement \| null` |
| Элемент не найден | **бросает `Error`** | возвращает `null` (не бросает) |
| Тип (одиночный) | `HTMLElement` | `() => HTMLElement \| null` |
| Тип (`all = true`) | `NodeListOf<HTMLElement>` | `() => NodeListOf<HTMLElement>` |
| Для чего | статичные, гарантированно присутствующие узлы | динамические/опциональные узлы |

### Параметр `all` и приведения типов

- Дженерик `T extends boolean = false` управляет перегрузкой результата: `all = true` → коллекция (`querySelectorAll`), иначе → один узел (`querySelector`). На практике в `RezkaLocators` режим `all` пока **не используется** — все селекторы одиночные, но возможность заложена.
- Внутри обоих методов стоит `as any` (`BaseLocators.ts:15,20,31`) — TypeScript не умеет автоматически сузить условный возвращаемый тип `T extends true ? ... : ...`, поэтому приведение неизбежно. Это намеренно, не «грязь».

---

## Каталог селекторов `RezkaLocators`

Все селекторы объявляются в конструкторе `RezkaLocators` (`src/locators/RezkaLocators.ts:15-48`). Поля сгруппированы комментариями по смысловым блокам. Ниже — исчерпывающий перечень: поле, режим, селектор, какой DOM-узел Rezka он находит и кто его потребляет.

| Поле | Режим | Селектор | Что за элемент Rezka | Где объявлено | Потребитель |
|---|---|---|---|---|---|
| `playerFrame` | eager | `#oframecdnplayer` | корневой контейнер CDN-плеера (обёртка iframe-плеера) | `RezkaLocators.ts:19` | `InfoPanel` — внутрь монтируется информационная панель (`InfoPanel.ts:33`) |
| `playerControlTimeline` | eager | `#cdnplayer_control_timeline` | полоса таймлайна (прогресс-бар) плеера | `RezkaLocators.ts:20` | `OverlayLoader` (вставка оверлея, `OverlayLoader.ts:69-70`), `InfoPanel` (наблюдение за видимостью контролов, `InfoPanel.ts:37,42`) |
| `playerPlayBtn` | eager | `#oframecdnplayer > pjsdiv:nth-child(20)` | большая центральная кнопка play/overlay плеера | `RezkaLocators.ts:25` | `OverlayLoader` — затемняет/гасит кнопку при загрузке (`OverlayLoader.ts:66-67,81-82`) |
| `ratingTable` | eager | `table.b-post__rating_table` | таблица рейтинга в шапке поста | `RezkaLocators.ts:30` | `StatusBox` — переносится в собственный контейнер статуса (`StatusBox.ts:28-37`) |
| `socialWrapper` | eager | `div.b-post__social_holder_wrapper` | блок соц-кнопок («поделиться») | `RezkaLocators.ts:31` | `StatusBox` — якорь для вставки блока статуса через `insertAdjacentElement("afterend", …)` (`StatusBox.ts:39`) |
| `title` | eager | `h1` | заголовок страницы (название фильма/сериала) | `RezkaLocators.ts:39` | `ParseInfo.parse()` — извлекает название, режет суффикс «в озвучке» (`ParseInfo.ts:13-15`) |
| `player` | **lazy** | `video` | HTML5-видеоэлемент плеера | `RezkaLocators.ts:36` | `initPlayerFeatured` → `getPlayer`, приводится к `HTMLVideoElement \| null` (`features/player/index.ts:8`) |
| `translator` | **lazy** | `.b-translator__item.active` | текущий активный переводчик/озвучка | `RezkaLocators.ts:40` | `ParseInfo.parse()` — читает `title` элемента как имя озвучки (`ParseInfo.ts:18-21`) |
| `episode` | **lazy** | `.b-simple_episode__item.active` | текущий активный эпизод сериала | `RezkaLocators.ts:41` | `ParseInfo.parse()` — читает `data-episode_id` / `data-season_id` (`ParseInfo.ts:24-30`) |
| `changeTranslator` | **lazy** | `#translators-list` | контейнер списка переводчиков | `RezkaLocators.ts:46` | `ParseInfo.setWatchInfo()` — `MutationObserver` на смену активного переводчика (`ParseInfo.ts:85`) |
| `changeEpisode` | **lazy** | `#simple-episodes-tabs` | контейнер вкладок/списка эпизодов | `RezkaLocators.ts:47` | `ParseInfo.setWatchInfo()` — `MutationObserver` на смену активного эпизода (`ParseInfo.ts:86`) |

### Разделение eager/lazy в `RezkaLocators`

- **Eager (`defineSelector`)**: `playerFrame`, `playerControlTimeline`, `playerPlayBtn`, `ratingTable`, `socialWrapper`, `title`. Это статичная разметка страницы поста — она присутствует сразу при загрузке. Если любого из них нет, конструктор бросит `Error` и расширение не инициализируется (это сознательная защита: без них работать всё равно нельзя).
- **Lazy (`defineSelectorLazy`)**: `player`, `translator`, `episode`, `changeTranslator`, `changeEpisode`. Эти узлы либо появляются асинхронно (`video`), либо меняют состояние во времени (`.active`), либо опциональны (списки переводчиков/эпизодов есть не у всех тайтлов).

### Где объявлены поля (типы)

- В `BaseLocators` объявлены **кросс-сайтовые** поля (то, что обязан предоставить любой сайт):
  - `player!: () => HTMLElement | null` (lazy, `BaseLocators.ts:2`);
  - `playerPlayBtn!: HTMLElement` (eager, `BaseLocators.ts:4`);
  - `playerControlTimeline!: HTMLElement` (eager, `BaseLocators.ts:5`).
- В `RezkaLocators` добавлены **Rezka-специфичные** поля: `playerFrame`, `ratingTable`, `socialWrapper`, `title` (eager) и `changeTranslator`, `changeEpisode`, `translator`, `episode` (lazy) — `RezkaLocators.ts:4-13`.

Это разделение важно для понимания FIXME (см. ниже): `OverlayLoader` обходится только базовыми полями, а `InfoPanel`, `StatusBox`, `ParseInfo` требуют Rezka-специфичных.

> Готча: селектор `playerPlayBtn` — `#oframecdnplayer > pjsdiv:nth-child(20)` — **позиционный и хрупкий**. `pjsdiv` — внутренние узлы плеера Rezka без стабильных классов, а `:nth-child(20)` завязан на конкретный порядок. При обновлении плеера Rezka этот селектор отвалится первым, и поскольку он eager — уронит весь конструктор. При диагностике «расширение перестало запускаться на Rezka» проверяйте этот селектор в первую очередь.

---

## Диспетчер `pickLocators(hostname)`

```ts
// src/locators/index.ts
import RezkaLocators from "./RezkaLocators";

export function pickLocators(hostname: string) {
    if (hostname.endsWith("rezka.ag")) return new RezkaLocators();
}
```

Поведение:

- Принимает `hostname` (в content-скрипте передаётся `location.hostname`, см. `content.ts:17`).
- Если хост заканчивается на `rezka.ag` — создаёт и возвращает **новый** `RezkaLocators` (на этом шаге выполняются все eager-`defineSelector` и могут бросить `Error`).
- Иначе функция **неявно возвращает `undefined`** (нет `else`/`return`). Тип результата — `RezkaLocators | undefined`.

Готчи диспетчера:

- `endsWith("rezka.ag")` шире, чем кажется: формально совпадёт и с `www.rezka.ag`, и с экзотическим `fakerezka.ag`. На практике это безопасно, потому что content-скрипт инжектится только на `https://rezka.ag/*.html` (см. `content.ts:11`) — до `pickLocators` доходит только настоящий хост Rezka.
- Возврат `undefined` — это штатный «нет поддержки этого сайта» сигнал; именно на нём держится отсутствие YouTube (см. ниже).

---

## Поток инициализации в content-скрипте (шаг за шагом)

Точка входа — `src/entrypoints/content.ts`. Что происходит при попадании на страницу:

```ts
// src/entrypoints/content.ts
matches: ["https://rezka.ag/*.html"],   // где вообще запускается content-скрипт
async main() {
    const locators = pickLocators(location.hostname);  // 1
    if (!locators) return;                              // 2
    const playerCoordinator = initPlayerFeatured(locators);   // 3
    await initRoomFeatured(locators, playerCoordinator);      // 4
}
```

1. **`matches`** уже отфильтровал страницы: WXT инжектит content-скрипт только на `https://rezka.ag/*.html` (заметьте — только пути, оканчивающиеся на `.html`; это все страницы-посты Rezka). На остальных сайтах `main()` вообще не запускается.
2. **`pickLocators(location.hostname)`** возвращает `RezkaLocators` либо `undefined`. В этот момент срабатывают eager-селекторы — если разметка Rezka изменилась и какой-то eager-узел не найден, здесь будет выброшено исключение.
3. **`if (!locators) return;`** — если сайт не распознан (`undefined`), content-скрипт **молча завершается**, ничего не делая. Это ключевая точка «тихого отказа».
4. **`initPlayerFeatured(locators)`** (`features/player/index.ts`) — оборачивает `locators.player` в `getPlayer` и `OverlayLoader` (тот берёт только базовые поля) и создаёт `PlayerCoordinator`.
5. **`initRoomFeatured(locators, playerCoordinator)`** (`features/room/index.ts`) — создаёт `InfoPanel`, `OverlayLoader`, `StatusBox`, `ParseInfo`, WebSocket-клиент и `RoomCoordinator`. Здесь `locators` приводится к `RezkaLocators` (см. FIXME).

> Важно про default `run_at`: content-скрипт WXT по умолчанию запускается на `document_idle`, поэтому статичная разметка поста (заголовок, контейнер плеера, рейтинг) к этому моменту уже есть в DOM — eager-селекторы валидны. Динамику (видео, активный переводчик) оставляют на lazy именно потому, что к `document_idle` она может ещё не появиться.

---

## Рецепт: как добавить новый сайт

Допустим, нужно добавить поддержку условного `example-tv.com`. Порядок действий.

### Шаг 1. Создать класс локаторов

`src/locators/ExampleTvLocators.ts`, унаследованный от `BaseLocators`:

```ts
import BaseLocators from "@/locators/BaseLocators";

export default class ExampleTvLocators extends BaseLocators {
    // Site-specific поля (как в RezkaLocators)
    title!: HTMLElement;
    // ...другие нужные ParseInfo/UI-компонентам поля

    constructor() {
        super();

        // Обязательные базовые поля (их ждут OverlayLoader / PlayerCoordinator):
        this.player = this.defineSelectorLazy("video");
        this.playerPlayBtn = this.defineSelector("<селектор кнопки play>");
        this.playerControlTimeline = this.defineSelector("<селектор таймлайна>");

        // Site-specific:
        this.title = this.defineSelector("h1");
        // ...
    }
}
```

### Шаг 2. Объявить и инициализировать селекторы

- Для **статичных, обязательных** узлов используйте `defineSelector(...)` (eager). Помните: если узел не найдётся, конструктор бросит `Error` и расширение не запустится на этом сайте.
- Для **динамических/опциональных** узлов используйте `defineSelectorLazy(...)` (lazy) — поле станет функцией, вызывающий код сам проверит результат на `null`.
- Обязательно предоставьте все поля, которые читают потребители: как минимум базовые `player`, `playerPlayBtn`, `playerControlTimeline`; а если хотите парсинг тайтла/переводчика/эпизода и UI-панели — ещё и аналоги `title`, `translator`, `episode`, `changeTranslator`, `changeEpisode`, `playerFrame`, `ratingTable`, `socialWrapper`. Иначе соответствующие компоненты упадут на `undefined`.

### Шаг 3. Добавить ветку в `pickLocators`

`src/locators/index.ts`:

```ts
import RezkaLocators from "./RezkaLocators";
import ExampleTvLocators from "./ExampleTvLocators";

export function pickLocators(hostname: string) {
    if (hostname.endsWith("rezka.ag")) return new RezkaLocators();
    if (hostname.endsWith("example-tv.com")) return new ExampleTvLocators();
}
```

### Шаг 4. Расширить `matches` content-скрипта

`src/entrypoints/content.ts` — добавить домен в массив `matches`, чтобы content-скрипт вообще инжектился:

```ts
matches: ["https://rezka.ag/*.html", "https://example-tv.com/*"],
```

### Шаг 5. Расширить `host_permissions` в `wxt.config.ts`

`wxt.config.ts:34` — без этого расширение не получит доступ к домену:

```ts
host_permissions: [
    "https://rezka.ag/*.html",
    "https://example-tv.com/*",
    `${backendUrl}/*`,
],
```

### Шаг 6. Разобраться с общим интерфейсом (FIXME)

Сейчас `ParseInfo`, `InfoPanel`, `StatusBox` типизированы под `RezkaLocators` и получают его через приведение `locators as RezkaLocators` (`features/room/index.ts:19-24`). Для второго сайта это приведение станет ложью. Правильный путь — выделить **общий интерфейс** требуемых полей (или поднять их в `BaseLocators`), чтобы любой `XxxLocators` структурно гарантировал их наличие. См. следующий раздел.

### Чек-лист

| Шаг | Файл | Что сделать |
|---|---|---|
| 1-2 | `src/locators/XxxLocators.ts` | новый класс `extends BaseLocators`, объявить селекторы (eager/lazy) |
| 3 | `src/locators/index.ts` | ветка `if (hostname.endsWith(...)) return new XxxLocators()` |
| 4 | `src/entrypoints/content.ts` | добавить домен в `matches` |
| 5 | `wxt.config.ts` | добавить домен в `host_permissions` |
| 6 | `BaseLocators` / общий интерфейс | устранить `as RezkaLocators` (FIXME) |

---

## FIXME: общий интерфейс для site-specific полей

В коде есть два явных `// FIXME: Add BaseLocators`:

- `src/features/room/utills/ParseInfo.ts:1` — `ParseInfo` импортирует `type RezkaLocators` и обращается к `title`, `translator()`, `episode()`, `changeTranslator()`, `changeEpisode()`.
- `src/features/room/index.ts:18` — `initRoomFeatured` принимает `BaseLocators`, но передаёт его в `InfoPanel`, `StatusBox`, `ParseInfo` через `locators as RezkaLocators` (`index.ts:21-23`).

Суть проблемы. `BaseLocators` объявляет только кросс-сайтовые поля (`player`, `playerPlayBtn`, `playerControlTimeline`). Всё остальное (`title`, `translator`, `episode`, `changeTranslator`, `changeEpisode`, `playerFrame`, `ratingTable`, `socialWrapper`) живёт только на `RezkaLocators`. Поэтому:

- `OverlayLoader` обходится `BaseLocators` (`features/player/index.ts:5` принимает `BaseLocators`, `OverlayLoader` использует только `playerPlayBtn` + `playerControlTimeline`) — корректно типизировано.
- `InfoPanel`, `StatusBox`, `ParseInfo` требуют Rezka-полей, но получают их через небезопасное приведение `as RezkaLocators`. Для нового сайта это приведение скомпилируется, но в рантайме обернётся `undefined`-полями.

Что сделать при добавлении второго сайта (варианты):

1. **Поднять общие поля в `BaseLocators`** — объявить там `title`, `translator`, `episode`, `changeTranslator`, `changeEpisode`, `playerFrame`, `ratingTable`, `socialWrapper` (как абстрактный контракт), а каждый `XxxLocators` обязан их заполнить. Тогда `as RezkaLocators` уйдёт.
2. **Ввести отдельные интерфейсы** под потребности компонентов (например `ParseInfoLocators`, `InfoPanelLocators`, `StatusBoxLocators`) и типизировать конструкторы по ним. Гибче, но многословнее.

Любой из вариантов снимает оба FIXME и делает добавление сайтов типобезопасным.

---

## Почему YouTube намеренно отсутствует

YouTube **сознательно не поддержан** — это не забытая фича. Соответствующее ограничение зафиксировано и в корневом `CLAUDE.md`, и в `CLAUDE.md` расширения, и комментарием в коде (`content.ts:9-10`).

Механика «тихого отказа» и почему нельзя просто добавить домен в `matches`:

- Если добавить YouTube в `matches` (и `host_permissions`), но **не** добавить ветку в `pickLocators`, то на YouTube `pickLocators(location.hostname)` вернёт `undefined`, сработает `if (!locators) return;` (`content.ts:18`) и content-скрипт **молча завершится** — без ошибок, но и без какой-либо функциональности. Пользователь увидит, что расширение «как будто не работает».
- Если же завести `YouTubeLocators`, но скопировать в нём Rezka-селекторы (`#oframecdnplayer`, `table.b-post__rating_table` и т. д.), то eager-`defineSelector` не найдёт эти узлы на YouTube и **бросит `Error` прямо в конструкторе** — инициализация упадёт.

Поэтому в `matches` намеренно оставлен только Rezka (`content.ts:11`). Чтобы по-настоящему добавить YouTube, нужно пройти весь рецепт выше: реализовать `YouTubeLocators` с корректными YT-селекторами, добавить ветку в `pickLocators`, расширить `matches` и `host_permissions`, и разобраться с общим интерфейсом локаторов. Половинчатое включение приведёт ровно к одному из двух отказов выше.

---

## Готчи и краевые случаи (сводка)

- **Eager бросает, lazy возвращает `null`.** Не объявляйте через `defineSelector` ничего, что может отсутствовать или появляться асинхронно — иначе конструктор `XxxLocators` упадёт и убьёт инициализацию на всей странице.
- **Хрупкий `playerPlayBtn`** (`#oframecdnplayer > pjsdiv:nth-child(20)`) — позиционный селектор по внутренним `pjsdiv` плеера. Первый кандидат на поломку при обновлении Rezka.
- **`pickLocators` без `else`** возвращает `undefined` — это штатный сигнал «сайт не поддержан», на нём держится поведение content-скрипта.
- **`endsWith` шире, чем точный хост** — безопасно лишь потому, что `matches`/`host_permissions` ограничивают инжект самим `rezka.ag`.
- **Приведения `as RezkaLocators`** (`features/room/index.ts:21-23`) — техдолг (FIXME); при добавлении сайта они станут источником рантайм-`undefined`.
- **Режим `all = true`** в `defineSelector*` реализован, но в `RezkaLocators` не используется — все текущие селекторы одиночные.
- **Lazy-поля — это функции.** Потребитель обязан вызывать их (`locators.player()`, `locators.translator()`) и проверять на `null`; обращение как к свойству вернёт саму функцию, а не узел.

---

## См. также

- `../CLAUDE.md` — гид по расширению (раздел «Locators — как добавить новый сайт», список запретов, в т. ч. про YouTube).
- `../../CLAUDE.md` — корневой гид по монорепозиторию Sync-Mate (связь фронта и бэка, WS-протокол).
- `../../DOCUMENTATION.md` — полная техническая документация проекта (WS-протокол — контракт между сервером и расширением).
- Соседние документы в этой папке `docs/` (по мере их появления) — например, по координаторам плеера/комнаты и WS-протоколу со стороны клиента.
- Исходники слоя: `../src/locators/BaseLocators.ts`, `../src/locators/RezkaLocators.ts`, `../src/locators/index.ts`.
- Потребители локаторов: `../src/entrypoints/content.ts`, `../src/features/player/index.ts`, `../src/features/room/index.ts`, `../src/features/room/utills/ParseInfo.ts`, `../src/ui/components/{InfoPanel,OverlayLoader,StatusBox}.ts`.
