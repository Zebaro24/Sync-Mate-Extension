# Background Service Worker

Справочник по фоновому скрипту MV3 (`src/entrypoints/background.ts`): хранилище состояния комнат по вкладкам, IPC-обработчики `BrowserMessageTypes`, перехват навигации через `webRequest` и генерация ника при первом запуске.

---

## 1. Роль и контекст

Фоновый скрипт — это **MV3 service worker**, единая точка для всего расширения, которая:

1. Хранит **state комнаты для каждой вкладки** (`tabId → RoomState`) и переживает выгрузку воркера.
2. Отвечает на внутренние IPC-сообщения от popup и content-скрипта (`GET_ROOM` / `SET_ROOM` / `ADD_TO_ROOM`).
3. Слушает навигацию (`webRequest.onBeforeRequest`) на доменах Rezka и бэкенда, парсит URL и складывает извлечённые детали (контент/жанр/имя, `roomId`) в state соответствующей вкладки.
4. Чистит state при закрытии вкладки (`tabs.onRemoved`).
5. При самом первом старте генерирует пользователю случайный никнейм и кладёт его в `storage.local`.

Точка входа — `defineBackground(() => { ... })` (WXT-обёртка), `background.ts:38`. WXT сам регистрирует воркер в манифесте; ручной регистрации нет.

Манифест-разрешения, от которых зависит этот файл (`wxt.config.ts:28-34`):

| Разрешение | Зачем |
|---|---|
| `webRequest` | подписка `onBeforeRequest` |
| `storage` | `storage.session` (state комнат) + `storage.local` (ник, `id`) |
| `activeTab` | popup определяет активную вкладку |
| `host_permissions: ["https://rezka.ag/*.html", "${backendUrl}/*"]` | без host-доступа `webRequest` не увидит запросы к этим URL |

---

## 2. Почему state живёт в `browser.storage.session`, а не в переменной

Это центральное архитектурное решение всего файла.

В MV2 фоновая страница была persistent — можно было хранить `const rooms: Record<number, ...> = {}` прямо в модуле. В **MV3 service worker эфемерен**: браузер выгружает его после ~30 секунд бездействия (нет активных событий/таймеров) и заново поднимает при следующем событии. При выгрузке **весь модульный стейт обнуляется** — обычный `Record` потеряет все комнаты.

Поэтому состояние вынесено в `browser.storage.session` — in-memory хранилище, которое:

- переживает выгрузку/перезапуск воркера в пределах одной сессии браузера;
- **не пишется на диск** (в отличие от `storage.local`) — для временных данных комнат это правильно: после закрытия браузера всё должно исчезнуть;
- по умолчанию недоступно content-скриптам (`session` имеет `accessLevel = TRUSTED_CONTEXTS`), поэтому доступ к нему идёт только из воркера.

Комментарий-предупреждение зафиксирован прямо в коде (`background.ts:10-11`):

```ts
// Сохраняем комнаты в session storage — MV3 Service Worker может быть выгружен
// в любой момент, и обычный модульный Record при этом обнуляется.
```

> Запрет на «обычный `Record` в background» продублирован в `Sync-Mate-Extension/CLAUDE.md` (раздел «Что НЕ делать»). Не возвращайте состояние в модульную переменную «для скорости» — после первой же выгрузки воркера комнаты исчезнут, и баг будет плавающим.

### Деградация, если `session` недоступен

Доступ к API идёт через каст `(browser.storage as any).session` (`background.ts:13`). Каст нужен, потому что типы webextension-polyfill/WXT не всегда декларируют `storage.session`. Если рантайм его не предоставляет (очень старый Chromium / иной браузер):

- `loadRooms()` возвращает `{}` (`background.ts:20`);
- `saveRooms()` тихо ничего не делает (`background.ts:24-27`).

То есть расширение не падает, но **state комнат не персистится** между событиями. Это сознательный мягкий fallback, а не норма работы — целевой Chromium `storage.session` поддерживает.

---

## 3. Модель данных state

```ts
type RoomState = Record<string, unknown>;
```

`background.ts:8`. Намеренно нетипизированный мешок ключей — поля накапливаются из разных источников и мержатся в одну запись на вкладку. Полный объект в `storage.session` имеет форму:

```
session["rooms"] = {
  [tabId: number]: RoomState   // напр. { roomId, content, genre, name }
}
```

Откуда берутся ключи `RoomState`:

| Ключ | Источник | Когда появляется |
|---|---|---|
| `roomId` | `ADD_TO_ROOM` от `RoomCoordinator.createRoom` **или** `parseUrl` для `…/redirect` | при создании комнаты / переходе по invite-ссылке |
| `content` | `parseUrl` (Rezka) | при навигации на страницу фильма/сериала |
| `genre` | `parseUrl` (Rezka) | то же |
| `name` | `parseUrl` (Rezka) | то же |

Ключ верхнего уровня в хранилище — `tabId` (число). Это связывает state с конкретной вкладкой: в разных вкладках могут быть разные комнаты одновременно.

---

## 4. Паттерн load / save / update

Три функции образуют единственный санкционированный способ работы со state. **Любое новое поле state добавляйте через `updateRoom`**, иначе сломаете merge (правило из `CLAUDE.md`).

### 4.1. `loadRooms(): Promise<Record<number, RoomState>>`

`background.ts:12-21`. Читает ключ `"rooms"` из `storage.session`, возвращает `stored.rooms ?? {}`. Если `session` недоступен — `{}`.

```ts
async function loadRooms(): Promise<Record<number, RoomState>> {
    const sessionStorage = (browser.storage as any).session;
    if (sessionStorage) {
        const stored = (await sessionStorage.get("rooms")) as {
            rooms?: Record<number, RoomState>;
        };
        return stored.rooms ?? {};
    }
    return {};
}
```

### 4.2. `saveRooms(rooms): Promise<void>`

`background.ts:23-28`. Перезаписывает весь ключ `"rooms"` целиком (`sessionStorage.set({ rooms })`). Это **полная замена**, а не частичное обновление — поэтому корректный порядок всегда «load → mutate → save».

### 4.3. `updateRoom(tabId, patch): Promise<RoomState>` — merge-паттерн

`background.ts:30-35`. Сердце паттерна — **поверхностный (shallow) merge** записи одной вкладки:

```ts
async function updateRoom(tabId: number, patch: RoomState): Promise<RoomState> {
    const rooms = await loadRooms();
    rooms[tabId] = { ...(rooms[tabId] || {}), ...patch };
    await saveRooms(rooms);
    return rooms[tabId];
}
```

Шаг за шагом:

1. Загружает **весь** объект комнат из `storage.session`.
2. Берёт текущую запись вкладки (`rooms[tabId]`) или `{}`, если её нет.
3. Накладывает `patch` поверх (spread) — новые ключи добавляются, совпадающие перезаписываются, **остальные ключи сохраняются**.
4. Сохраняет весь объект обратно и возвращает обновлённую запись вкладки.

Почему это важно: `parseUrl` при навигации кладёт `{ content, genre, name }`, а `RoomCoordinator` отдельным сообщением кладёт `{ roomId }`. Благодаря merge они **накапливаются** в одной записи, не затирая друг друга. Если бы вместо `updateRoom` всегда использовался прямой `rooms[tabId] = patch`, второй источник стирал бы данные первого.

> **Gotcha — merge только поверхностный.** Вложенные объекты не сливаются: `patch` с вложенным объектом заменит вложенный объект целиком. Сейчас в state нет вложенности, так что это не проблема, но при добавлении вложенных полей помните об этом.

> **Gotcha — гонки на чтении-записи.** `updateRoom` делает read-modify-write без блокировки. Если два события (`webRequest` + IPC) сработают почти одновременно, второй `saveRooms` может затереть результат первого («last write wins»). На практике события по одной вкладке редко идут параллельно, но это объясняет, почему `webRequest`-листенер использует именно `updateRoom` (merge), минимизируя потери, а не `saveRooms` с целым объектом.

---

## 5. IPC: обработчики `BrowserMessageTypes`

Регистрируется один листенер через `onMessage` из `@/shared/messaging` (`background.ts:48`). Обёртка `onMessage` (`src/shared/messaging.ts:19-57`) умеет async-хендлеры: если хендлер вернул промис, она возвращает `true` из `runtime.onMessage` (держит канал ответа открытым) и резолвит/режектит через `sendResponse`; ошибки сворачиваются в `{ error: String(e) }`.

### 5.1. Определение `tabId` — первый шаг любого сообщения

```ts
const tabId = msg.activeTabId ?? sender.tab?.id;
if (!tabId) return { error: "No tab" };
```

`background.ts:49-50`. Два источника `tabId`, и порядок важен:

- **`msg.activeTabId`** — присылает **popup**. У popup нет своей вкладки, поэтому `sender.tab` будет `undefined`; popup сам определяет активную вкладку через `browser.tabs.query` и передаёт её id явно (см. `src/features/room/hooks/use-room.ts:13-23`).
- **`sender.tab?.id`** — для сообщений от **content-скрипта**: там `sender.tab` заполнен браузером автоматически (см. `RoomCoordinator.ts:46,74`, который шлёт без `activeTabId`).

Если ни того, ни другого нет — `{ error: "No tab" }`. Этот ранний выход защищает все ветки `switch` от обращения по `undefined`-ключу.

### 5.2. Таблица обработчиков

`BrowserMessageTypes` — числовой enum (`src/shared/constants/message-types.ts`): `GET_ROOM=0`, `SET_ROOM=1`, `ADD_TO_ROOM=2`. Это **внутренний IPC расширения**, не путать с `WSMessageTypes` (протокол с сервером) — предупреждение в обоих `CLAUDE.md`.

| Сообщение | Доп. поля | Что делает | Возвращает |
|---|---|---|---|
| `GET_ROOM` | — | `loadRooms()`, возвращает `rooms[tabId]` (может быть `undefined`) | `RoomState \| undefined` |
| `SET_ROOM` | `room: RoomState` | `loadRooms()`, **полная замена** `rooms[tabId] = msg.room`, `saveRooms()` | `{ success: true }` |
| `ADD_TO_ROOM` | `room: RoomState` (patch) | `updateRoom(tabId, msg.room)` — **merge** | `{ success: true }` |
| (default) | — | неизвестный тип | `{ error: "Unknown message" }` |

`background.ts:51-71`. Каждая ветка пишет в консоль воркера результат (`Message get room:` / `Message set room:` / `Message add to room:`) — удобно при отладке через DevTools service worker.

Ключевая разница **`SET_ROOM` vs `ADD_TO_ROOM`**:

- `SET_ROOM` затирает запись вкладки **целиком** — использовать только когда нужно полностью переопределить state.
- `ADD_TO_ROOM` дописывает поля через merge — основной путь для добавления `roomId`, не теряя ранее распарсенные `content/genre/name`.

> **Замечание о факт. использовании.** В текущем коде popup вызывает `GET_ROOM` (`use-room.ts`), а `RoomCoordinator` — `GET_ROOM` и `ADD_TO_ROOM` (`RoomCoordinator.ts:46,74-77`). Ветка **`SET_ROOM` сейчас не вызывается** ни одним известным отправителем — она оставлена как полный аналог `ADD_TO_ROOM` на случай нужды в перезаписи. При рефакторинге не считайте её мёртвой автоматически, но и знайте, что живых вызовов нет.

### 5.3. Как ответ потребляется на стороне отправителя

`GET_ROOM` может вернуть `undefined` (комнаты нет). Отправители это учитывают: `RoomCoordinator.init` и `fetchCurrentRoom` пишут `(await sendMessage(...)) ?? {}` и затем деструктурируют `{ roomId }`. То есть «нет комнаты» = `roomId === undefined` — нормальный, ожидаемый исход, не ошибка.

---

## 6. `webRequest.onBeforeRequest` — перехват навигации и парсинг URL

`background.ts:74-89`. Подписка, которая наполняет state по мере того, как пользователь ходит по Rezka и переходит по invite-ссылкам бэкенда.

### 6.1. Фильтр URL

```ts
browser.webRequest.onBeforeRequest.addListener(handler, { urls: parseUrls });
```

`parseUrls` (`src/shared/utils/parseUrl.ts:3`):

```ts
export const parseUrls = [API_URL + "/*", REZKA_URL + "/*"];
```

То есть слушаются запросы к `${BACKEND_URL}/api/*` и `https://rezka.ag/*`. Реально воркер увидит только те URL, на которые есть **host-доступ**: `host_permissions` ограничивает Rezka до `https://rezka.ag/*.html`, поэтому на практике с Rezka прилетают именно `.html`-навигации, а не каждый ассет.

### 6.2. Пошаговый разбор хендлера

```ts
(details) => {
    const tabId = details.tabId;
    if (tabId < 0) return;                 // (1)

    const roomDetails = parseUrl(details.url);  // (2)
    if (!roomDetails) return;              // (3)

    updateRoom(tabId, roomDetails).catch((e) =>  // (4) fire-and-forget
        console.error("Failed to persist room state:", e),
    );
    return undefined;                      // (5) не блокируем запрос
}
```

1. **`tabId < 0` → выход.** Запросы вне контекста вкладки (фоновые, prefetch и т. п.) имеют `tabId = -1`. Их некуда привязывать — пропускаем.
2. **`parseUrl(details.url)`** извлекает детали (см. §7).
3. Если URL не распознан (`undefined`) — выходим.
4. **Fire-and-forget `updateRoom`.** Листенер `webRequest` обязан вернуть **синхронно** (иначе блокировал бы запрос/ломал контракт API). `updateRoom` асинхронный, поэтому его промис не ожидается, а ошибки гасятся через `.catch`. Комментарий в коде это фиксирует (`background.ts:82`).
5. **`return undefined`** — не модифицируем и не блокируем запрос (этот листенер зарегистрирован без `"blocking"`, так что он наблюдатель, а не интерсептор).

> **Gotcha — `parseUrl` синхронно бросает на step (2).** В отличие от `updateRoom`, вызов `parseUrl` **не** обёрнут в try/catch. Если URL имеет распознанный `content`, но укорочен (нет сегмента имени), `parts[3]` будет `undefined`, и `.replace(".html", "")` бросит `TypeError` прямо в листенере (см. §7.3). На практике host-фильтр `*.html` + структура ссылок Rezka делает это маловероятным, но при расширении набора доменов/паттернов помните о хрупкости.

---

## 7. `parseUrl` — извлечение деталей из URL

`src/shared/utils/parseUrl.ts:5-22`. Чистая функция: на вход строка URL, на выход `RoomState`-patch или `undefined`.

```ts
const url = new URL(text_url);
const parts = url.pathname.split("/");   // parts[0] === "" из-за ведущего "/"
```

### 7.1. Rezka (`text_url.startsWith(REZKA_URL)`)

`parseUrl.ts:9-15`. Ожидаемая форма пути: `/<content>/<genre>/<name>.html`.

| Условие/поле | Значение |
|---|---|
| Допустимый `parts[1]` (`content`) | один из `films`, `series`, `cartoons`, `animation` — иначе `return` (→ `undefined`) |
| `genre` | `parts[2]` |
| `name` | `parts[3]` с отрезанным `.html` |
| Результат | `{ content, genre, name }` |

Пример: `https://rezka.ag/films/action/76221-supermen-2025-latest.html` →
`{ content: "films", genre: "action", name: "76221-supermen-2025-latest" }`.

### 7.2. Бэкенд (`text_url.startsWith(API_URL)`)

`parseUrl.ts:16-21`. Распознаётся **только** invite-redirect:

- Если URL заканчивается на `/redirect`: находим индекс сегмента `"redirect"` и берём предыдущий сегмент как `roomId` → `{ roomId: parts[redirectIndex - 1] }`.
- Любой другой API-URL → функция доходит до конца без `return` → `undefined`.

Пример: `${API_URL}/rooms/<id>/redirect` → `{ roomId: "<id>" }`. Это путь, которым переход по приглашению (открытие redirect-ссылки бэкенда) кладёт `roomId` в state вкладки ещё до того, как content-скрипт инициализирует комнату.

### 7.3. Граничные случаи и возвраты

| Вход | Результат |
|---|---|
| Rezka, `content` не из белого списка | `undefined` (тихо) |
| Rezka, корректная `.html`-ссылка | `{ content, genre, name }` |
| Rezka, `content` валиден, но нет сегмента имени (`parts[3] === undefined`) | **бросает `TypeError`** на `.replace` |
| API, оканчивается на `/redirect` | `{ roomId }` |
| API, любой другой путь | `undefined` |
| Невалидная строка URL | **бросает** из `new URL(...)` |

Важно: `parseUrl` возвращает `undefined` неявно (через голый `return` или достижение конца функции) — листенер `webRequest` трактует falsy-результат как «нечего сохранять».

---

## 8. `tabs.onRemoved` — очистка state

`background.ts:91-97`.

```ts
browser.tabs.onRemoved.addListener(async (tabId) => {
    const rooms = await loadRooms();
    if (rooms[tabId]) {
        delete rooms[tabId];
        await saveRooms(rooms);
    }
});
```

При закрытии вкладки её запись удаляется из `storage.session`, и только если она там была (проверка `if (rooms[tabId])` избегает лишней записи). Это предотвращает утечку устаревших записей: `tabId` уникальны в пределах сессии, но без чистки объект `rooms` рос бы неограниченно.

> Поскольку `storage.session` и так очищается при закрытии браузера, эта чистка нужна именно для **живой** сессии — чтобы освобождать память по мере закрытия отдельных вкладок.

---

## 9. Генерация ника при первом запуске

`background.ts:41-46`, выполняется один раз при инициализации воркера:

```ts
getItem("name").then((name) => {
    if (!name)
        setItem("name", generateNickname()).then(() =>
            console.log("Nickname created!"),
        );
});
```

Шаг за шагом:

1. Читаем `name` из `storage.local` через `getItem`.
2. Если ника **нет** (первый запуск) — генерируем случайный и пишем обратно. Если есть — ничего не делаем (идемпотентно).

`generateNickname()` (`src/shared/utils/nickname.ts`) собирает ник из русскоязычных списков: `прилагательное-существительное` с 50%-ным шансом добавить `-эмодзи`. Например `Космический-Бобр-🚀` или `Турбо-Краб`. Пулы: 10 прилагательных, 10 существительных, 8 эмодзи (`nickname.ts:2-28`).

Где используется ник: `RoomCoordinator` берёт `getItem("name") || "Guest"` при создании комнаты и при `connect` (`RoomCoordinator.ts:65,86`).

> **Gotcha (из корневого `CLAUDE.md`).** Ник хранится в `storage.local`, но **активная WS-сессия использует имя, переданное при `connect`**. Смена ника применяется только после перезагрузки страницы — фоновый скрипт его при первом запуске лишь инициализирует, не пушит в живые сессии.

> **Хранилище `local` vs `session`.** Ник и `id` пользователя живут в `storage.local` (персистентно, на диске, между перезапусками браузера) — в отличие от state комнат в `storage.session`. Это сознательное разделение: личность пользователя долгоживущая, комнаты — нет.

---

## 10. `getItem` теперь дженерик

`src/shared/storage.ts`:

```ts
export async function getItem<T = string>(key: string): Promise<T | undefined> {
    const data = await browser["storage"].local.get(key);
    return data?.[key] as T | undefined;
}

export async function setItem(key: string, value: any) {
    await browser["storage"].local.set({ [key]: value });
}
```

Изменение по сравнению с прежней версией: **`getItem` параметризован `<T = string>`**. Поведение:

- По умолчанию (`getItem("name")`) тип результата — `string | undefined`, как раньше.
- Можно явно указать тип: `getItem<RoomDTO>("...")`, и тогда вернётся `RoomDTO | undefined`.
- В коде это используется, например, в popup: `getItem("id") as Promise<string | undefined>` (`use-room.ts:30`) и `getItem<...>` по месту. Каст `as T` внутри — непроверяемый: дженерик удобен, но **не валидирует** содержимое хранилища, так что вызывающий отвечает за корректность типа.

Оба обработчика работают со `storage.local`. Это namespace, отличный от `storage.session`, который использует state комнат, — путать нельзя.

---

## 11. Полный жизненный цикл (сводный walkthrough)

Типичный сценарий «создатель комнаты»:

1. Воркер стартует → `console.log("Background running...")`; при первом запуске создаётся ник в `storage.local`.
2. Пользователь открывает страницу фильма на Rezka → `webRequest.onBeforeRequest` ловит `.html`-навигацию → `parseUrl` отдаёт `{ content, genre, name }` → `updateRoom(tabId, …)` пишет их в `storage.session` (merge).
3. Content-скрипт через popup/`RoomCoordinator` создаёт комнату, шлёт `ADD_TO_ROOM { roomId }` → `updateRoom` дописывает `roomId` к уже лежащим `content/genre/name` (merge сохраняет оба источника).
4. Popup периодически шлёт `GET_ROOM` c `activeTabId` → получает запись вкладки → тянет данные комнаты с бэкенда.
5. Пользователь закрывает вкладку → `tabs.onRemoved` удаляет запись из `storage.session`.

Сценарий «присоединившийся по ссылке»: открытие `…/rooms/<id>/redirect` → `webRequest` → `parseUrl` отдаёт `{ roomId }` → `updateRoom` кладёт `roomId` в state вкладки ещё до инициализации content-скрипта, который затем прочитает его через `GET_ROOM`.

В любой момент между шагами воркер может быть выгружен MV3 — и именно `storage.session` гарантирует, что после повторного подъёма state комнат на месте.

---

## См. также

- [`../CLAUDE.md`](../CLAUDE.md) — гид по расширению (раздел «Background Service Worker», запреты в «Что НЕ делать»).
- [`../../CLAUDE.md`](../../CLAUDE.md) — корневой гид по монорепозиторию (различие `BrowserMessageTypes` vs `WSMessageTypes`, ограничение «ник применяется после перезагрузки»).
- [`../../DOCUMENTATION.md`](../../DOCUMENTATION.md) — полная техническая документация (WS-протокол; учтите, что раздел про деплой устарел — доверяйте конфигам, а не доку).
- Исходники, на которые ссылается этот документ: `src/entrypoints/background.ts`, `src/shared/storage.ts`, `src/shared/utils/parseUrl.ts`, `src/shared/utils/nickname.ts`, `src/shared/messaging.ts`, `src/shared/constants/message-types.ts`, `src/shared/constants/api.ts`, `src/features/room/RoomCoordinator.ts`, `src/features/room/hooks/use-room.ts`.
