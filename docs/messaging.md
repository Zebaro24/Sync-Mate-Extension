# Messaging — справочник по сообщениям расширения

Полное описание двух независимых систем сообщений Sync-Mate-Extension: внутреннего IPC расширения (`BrowserMessageTypes`) и протокола WebSocket с сервером (`WSMessageTypes`) — что это, чем они различаются и почему их **категорически нельзя путать**.

---

## ⚠️ ГЛАВНОЕ: это ДВА РАЗНЫХ enum'а

В кодовой базе живут два enum'а с похожими названиями, но **они про совершенно разные транспорты, форматы и сценарии**. Смешивать их нельзя ни логически, ни в коде.

| | `BrowserMessageTypes` | `WSMessageTypes` |
|---|---|---|
| **Назначение** | Внутренний IPC расширения | Сетевой протокол с сервером |
| **Транспорт** | `browser.runtime.sendMessage` / `onMessage` (Chrome extension messaging) | Нативный `WebSocket` (JSON по проводу) |
| **Кто общается** | content-script ↔ background (Service Worker) ↔ popup | расширение (клиент) ↔ FastAPI/WS-сервер |
| **Формат значений** | **числовой** enum (`0`, `1`, `2`) | **строковый** enum (`"connect"`, `"play"`, …) |
| **Где объявлен** | `src/shared/constants/message-types.ts` | `src/features/room/model/messageTypes.ts` |
| **Хелперы** | `sendMessage` / `onMessage` из `src/shared/messaging.ts` | методы класса `WebSocketClient` (`send` / `onMessage` / `onClose`) |
| **Покидает браузер?** | Нет, всё локально внутри расширения | Да, уходит по сети на сервер |
| **Документация** | этот файл | [`websocket-protocol.md`](./websocket-protocol.md) |

> **НИКОГДА не отправляйте `BrowserMessageTypes` в `socket.send(...)` и `WSMessageTypes` в `sendMessage(...)`.**
> Это разные вселенные. `BrowserMessageTypes.GET_ROOM` — это число `0`; сервер не знает, что с ним делать. `WSMessageTypes.PLAY` — это строка `"play"`; background-обработчик IPC её не поймёт и вернёт `{ error: "Unknown message" }`.
> Эта же ошибка специально вынесена как предупреждение в корневой `CLAUDE.md` и в `Sync-Mate-Extension/CLAUDE.md` — она встречается на практике.

Этот документ описывает **только `BrowserMessageTypes`** (IPC). За `WSMessageTypes` идите в [`websocket-protocol.md`](./websocket-protocol.md).

---

## 1. `BrowserMessageTypes` — внутренний IPC

### 1.1 Объявление

`src/shared/constants/message-types.ts:1`

```ts
export enum BrowserMessageTypes {
    GET_ROOM,     // = 0
    SET_ROOM,     // = 1
    ADD_TO_ROOM,  // = 2
}
```

Это **числовой** enum без явных значений, поэтому члены получают `0`, `1`, `2` автоматически. Практическое следствие:

- По проводу/в логах сообщение выглядит как `{ type: 0 }`, а не `{ type: "GET_ROOM" }`. При отладке через `console.log` держите это в голове.
- **Не переупорядочивайте члены enum'а.** Числа позиционные: вставка нового значения в середину сдвинет коды всех последующих. Если в `browser.storage.session` или в ещё необработанных сообщениях остались «старые» числа, они начнут интерпретироваться неправильно. Добавляйте новые члены **только в конец**.
- Файл реэкспортируется из `src/features/room/model/messageTypes.ts:1` — это сделано для удобства импорта рядом с `WSMessageTypes`, но **сам тип остаётся тем же** `BrowserMessageTypes`. Реэкспорт ничего не «объединяет», он просто прокидывает символ дальше.

### 1.2 Назначение каждого значения

`BrowserMessageTypes` обслуживает один сценарий — **хранение состояния комнаты, привязанного к вкладке (tab)**. Background играет роль владельца состояния (см. `src/entrypoints/background.ts`), потому что в MV3 ни content-script (живёт в контексте страницы), ни popup (открывается/закрывается) не могут надёжно хранить общее состояние. State лежит в `browser.storage.session`, ключ — `tabId`.

| Значение | Код | Кто отправляет | Полезная нагрузка (поля сообщения) | Что делает background | Что возвращает |
|---|---|---|---|---|---|
| `GET_ROOM` | `0` | content (`RoomCoordinator.init`) и popup (`use-room.ts`) | `activeTabId?` | Читает `rooms[tabId]` из session storage | Объект состояния комнаты **или** `undefined`, если для вкладки ничего нет |
| `SET_ROOM` | `1` | *(сейчас никто — обработчик зарезервирован)* | `room`, `activeTabId?` | **Полностью перезаписывает** `rooms[tabId] = msg.room` | `{ success: true }` |
| `ADD_TO_ROOM` | `2` | content (`RoomCoordinator.createRoom`) | `room`, `activeTabId?` | **Сливает** (merge) `msg.room` в существующий `rooms[tabId]` через `updateRoom` | `{ success: true }` |

Дополнительно у любого сообщения может присутствовать поле `activeTabId` — см. §1.4 про разрешение `tabId`.

#### `GET_ROOM` (код 0)

Запрос текущего состояния комнаты для вкладки. Возвращает то, что лежит в `rooms[tabId]`. Если комнаты нет — вернётся `undefined`, поэтому все вызывающие используют паттерн `(… ) ?? {}` и затем достают `roomId`:

```ts
const { roomId } = (await sendMessage({ type: BrowserMessageTypes.GET_ROOM })) ?? {};
```

Состояние комнаты — это не строго типизированный объект (`type RoomState = Record<string, unknown>` в `background.ts:8`). На практике туда кладут как минимум `{ roomId }`, а `webRequest`-листенер (см. §1.5) дописывает поля разобранного URL Rezka (`content`, `genre`, `name`).

#### `SET_ROOM` (код 1)

**Перезапись** всего состояния комнаты для вкладки: `rooms[tabId] = msg.room`. В отличие от `ADD_TO_ROOM` ничего не сливает — затирает целиком.

> **Готча:** на момент написания этого документа `SET_ROOM` **нигде не отправляется** (`grep` по `*.ts` находит его только в объявлении enum'а и в `switch` background'а). Это «спящий» обработчик: он реализован, но не используется. Если соберётесь его задействовать — помните, что он именно затирает, а не дополняет; для дополнения есть `ADD_TO_ROOM`.

#### `ADD_TO_ROOM` (код 2)

**Частичное обновление (merge)** состояния комнаты. Использует `updateRoom(tabId, patch)`:

```ts
async function updateRoom(tabId: number, patch: RoomState): Promise<RoomState> {
    const rooms = await loadRooms();
    rooms[tabId] = { ...(rooms[tabId] || {}), ...patch };
    await saveRooms(rooms);
    return rooms[tabId];
}
```

Это единственный поддерживаемый способ дописать поле в state, **не потеряв уже сохранённое** (например, поля URL, которые туда положил `webRequest`-листенер). Именно поэтому `Sync-Mate-Extension/CLAUDE.md` требует: новое поле state'а добавляйте через `updateRoom` / `ADD_TO_ROOM`, а не через `SET_ROOM`.

Отправляется при создании комнаты:

```ts
// RoomCoordinator.createRoom — src/features/room/RoomCoordinator.ts:74
await sendMessage({
    type: BrowserMessageTypes.ADD_TO_ROOM,
    room: { roomId },
});
```

### 1.3 Хелперы `sendMessage` / `onMessage`

Оба объявлены в `src/shared/messaging.ts`. Это тонкие промис-обёртки над callback-API `browser.runtime`.

#### Тип сообщения

```ts
type BrowserMessage = { type: BrowserMessageTypes } & Record<string, any>;
```

То есть обязательно поле `type` (одно из `BrowserMessageTypes`) плюс произвольные дополнительные поля (`room`, `activeTabId`, …). Типизация намеренно «широкая» (`Record<string, any>`) — полезная нагрузка не валидируется на уровне типов.

#### `sendMessage`

`src/shared/messaging.ts:9`

```ts
export function sendMessage<R = any>(message: BrowserMessage): Promise<R> {
    return new Promise((resolve, reject) => {
        browser.runtime.sendMessage(message, (resp: R) => {
            const err = browser.runtime.lastError;
            if (err) reject(err);
            else resolve(resp);
        });
    });
}
```

Поведение и нюансы:

- Превращает callback-стиль `runtime.sendMessage` в `Promise`.
- **`reject` происходит только при `browser.runtime.lastError`** — это ошибки самого канала messaging (нет получателя, порт закрыт и т.п.), а **не** прикладные ошибки. Если background вернул `{ error: "..." }` (см. ниже), это для `sendMessage` — **успешный** ответ; промис **зарезолвится** объектом с полем `error`. Вызывающий код обязан проверять это сам.
- Дженерик `R` — тип ожидаемого ответа; по умолчанию `any`. Никакой рантайм-проверки соответствия нет.
- Типовая ловушка MV3: если background (Service Worker) выгружен и не успел зарегистрировать листенер, либо некому ответить — сработает `lastError` и промис отклонится. Поэтому потребители оборачивают результат в `?? {}` и/или try/catch там, где это критично.

#### `onMessage`

`src/shared/messaging.ts:19`

```ts
export function onMessage<R = any>(
    handler: (msg: BrowserMessage, sender: Browser.runtime.MessageSender) => R | Promise<R>,
): () => void
```

Регистрирует листенер `browser.runtime.onMessage` и **возвращает функцию отписки** (`() => browser.runtime.onMessage.removeListener(wrapped)`).

Внутри обёртка (`wrapped`) делает три важные вещи:

1. **Поддерживает и синхронные, и асинхронные обработчики.** Если `handler` вернул объект с методом `then` (то есть промис), обёртка:
   - подписывается на него `.then(sendResponse)`,
   - и **возвращает `true`** из листенера. Это обязательное требование Chrome MV3: вернуть `true`, чтобы канал ответа остался открытым до асинхронного `sendResponse`. Без этого ответ потеряется.
2. **Заворачивает ошибки в `{ error: String(e) }`** — как из синхронного `throw`, так и из отклонённого промиса (`.catch((e) => sendResponse({ error: String(e) }))`). То есть необработанное исключение в обработчике не «уронит» канал, а вернётся отправителю как обычный ответ с полем `error`.
3. Для синхронного результата просто вызывает `sendResponse(result)` и неявно возвращает `undefined` (канал закрывается сразу).

**Следствие для контракта:** ответ от background по факту бывает трёх форм —
полезные данные (`GET_ROOM` → объект состояния или `undefined`), подтверждение (`{ success: true }`) или ошибка (`{ error: "..." }`). Любой потребитель должен быть готов ко всем трём.

В Sync-Mate `onMessage` вызывается **ровно один раз** — в `background.ts:48`. Возвращаемая функция отписки там не сохраняется: листенер живёт всё время жизни Service Worker'а, отдельная отписка не нужна.

### 1.4 Разрешение `tabId` — ключевая деталь

Состояние комнаты привязано к вкладке. Откуда background берёт `tabId`:

```ts
// background.ts:49
const tabId = msg.activeTabId ?? sender.tab?.id;
if (!tabId) return { error: "No tab" };
```

Логика «`activeTabId` ИЛИ `sender.tab?.id`» закрывает два разных отправителя:

| Отправитель | Есть ли `sender.tab`? | Как передаётся `tabId` |
|---|---|---|
| **content-script** (`RoomCoordinator`) | Да — `sender.tab.id` указывает на вкладку, где исполняется скрипт | `activeTabId` **не передаётся**; background берёт `sender.tab.id` |
| **popup** (`use-room.ts`) | Нет — popup не привязан к вкладке, `sender.tab` отсутствует | popup сам определяет активную вкладку через `browser.tabs.query` и передаёт её как `activeTabId` |

Пример из popup (`src/features/room/hooks/use-room.ts:13`):

```ts
const tabs = await browser.tabs.query({ active: true, currentWindow: true });
const tabId = tabs[0]?.id;
if (!tabId) throw new Error("NO_TAB");

const { roomId } = (await sendMessage({
    type: BrowserMessageTypes.GET_ROOM,
    activeTabId: tabId,
})) ?? {};
```

> **Готча:** если content-script когда-нибудь передаст `activeTabId`, оно **перекроет** `sender.tab.id` (приоритет у `??`-левого операнда — он непустой). Для content'а это не нужно и потенциально опасно. Передавайте `activeTabId` только из контекстов без своей вкладки (popup, options).
> Если `tabId` так и не нашёлся (нет ни `activeTabId`, ни `sender.tab`), обработчик сразу вернёт `{ error: "No tab" }`, не трогая storage.

### 1.5 Хранилище состояния (куда пишут эти сообщения)

State комнат хранится в **`browser.storage.session`**, а не в модульной переменной — потому что MV3 Service Worker может быть выгружен в любой момент, и обычный `Record` обнулится (`background.ts:10`). Доступ идёт через `(browser.storage as any).session` с защитой на случай отсутствия API (фолбэк — пустой объект).

Функции-обёртки в `background.ts`:

| Функция | Назначение |
|---|---|
| `loadRooms()` | Читает `{ rooms }` из session storage, возвращает `rooms ?? {}` |
| `saveRooms(rooms)` | Пишет весь объект `rooms` обратно |
| `updateRoom(tabId, patch)` | merge-обновление одной комнаты (используется `ADD_TO_ROOM` и `webRequest`-листенером) |

Помимо IPC-сообщений состояние меняют **два не-IPC источника** в том же background'е:

- **`webRequest.onBeforeRequest`** (`background.ts:74`): на навигации Rezka/API разбирает URL (`parseUrl`) и `updateRoom(tabId, roomDetails)` дописывает поля `content` / `genre` / `name` (для Rezka) или `roomId` (для `/redirect`-ссылки API). Это **fire-and-forget** — listener `webRequest` обязан возвращать синхронно, поэтому промис не ожидается, а только логирует ошибку в `.catch`. Это и есть причина, по которой обновления state должны быть merge'ами: иначе `ADD_TO_ROOM` затёр бы эти поля.
- **`tabs.onRemoved`** (`background.ts:91`): при закрытии вкладки запись `rooms[tabId]` удаляется — чтобы session storage не накапливал мусор.

Эти два листенера к `BrowserMessageTypes` отношения не имеют (не сообщения), но важны для понимания, что ещё пишет в то же состояние.

---

## 2. Поток данных шаг за шагом

### 2.1 content-script запускается на странице Rezka

`RoomCoordinator.init` (`src/features/room/RoomCoordinator.ts:44`):

1. Content шлёт `sendMessage({ type: GET_ROOM })` — **без** `activeTabId`.
2. Background: `tabId = sender.tab.id` → `loadRooms()` → возвращает `rooms[tabId]` (или `undefined`).
3. Content: `const { roomId } = (…) ?? {}`.
   - **Есть `roomId`** → `this.connect(roomId)` — открывается WebSocket (дальше уже `WSMessageTypes`, см. [`websocket-protocol.md`](./websocket-protocol.md)).
   - **Нет `roomId`** → показывает StatusBox «Create room» и вешает обработчик на клик.

### 2.2 Пользователь создаёт комнату

`RoomCoordinator.createRoom` (`src/features/room/RoomCoordinator.ts:63`):

1. REST-запрос `service.createRoom(...)` → сервер возвращает `room_id` и `link`.
2. Ссылка копируется в буфер обмена.
3. Content шлёт `sendMessage({ type: ADD_TO_ROOM, room: { roomId } })` — background merge'ит `roomId` в `rooms[tabId]`, не теряя ранее разобранных полей URL.
4. `this.connect(roomId)` — подключение к WS.

### 2.3 popup показывает текущую комнату

`fetchCurrentRoom` в `useRoom` (`src/features/room/hooks/use-room.ts`, опрашивается каждые 5 c через TanStack Query `refetchInterval: 5000`):

1. Popup определяет активную вкладку (`browser.tabs.query`) → `tabId`.
2. Шлёт `sendMessage({ type: GET_ROOM, activeTabId: tabId })` — здесь `activeTabId` обязателен, так как у popup нет `sender.tab`.
3. Получив `roomId`, дальше работает уже через **REST** (`roomApi.get(roomId)`) — не через IPC и не через WS. То есть popup читает «живое» состояние комнаты с сервера по HTTP, а IPC ему нужен только чтобы узнать, в какой комнате находится вкладка.

> Тонкость: popup получает `roomId` через IPC, а детали комнаты — через REST. Это третий канал данных (HTTP REST), не пересекающийся ни с IPC, ни с WS. Не путайте и его.

---

## 3. Чек-лист при изменениях

- **Добавляете новый IPC-тип?** Добавляйте член **в конец** `BrowserMessageTypes` (числовой enum — порядок значим), реализуйте `case` в `switch` `background.ts`, не забудьте про `default → { error: "Unknown message" }`.
- **Новое поле состояния комнаты?** Пишите его через `updateRoom` / `ADD_TO_ROOM` (merge), **не** через `SET_ROOM` (перезапись). Так требует `Sync-Mate-Extension/CLAUDE.md`.
- **Меняете протокол с сервером?** Это `WSMessageTypes`, а не `BrowserMessageTypes`. Идите в [`websocket-protocol.md`](./websocket-protocol.md) и помните: правка WS-сообщения почти всегда затрагивает и бэкенд (`handler.py` + `models.py`).
- **Сомневаетесь, какой enum нужен?** Спросите себя: *сообщение покидает браузер?* Да → `WSMessageTypes`. Нет, оно гуляет между content/background/popup → `BrowserMessageTypes`.

---

## См. также

- [`websocket-protocol.md`](./websocket-protocol.md) — вторая система сообщений: `WSMessageTypes`, протокол WebSocket с сервером (контракт фронт ↔ бэк).
- [`../CLAUDE.md`](../CLAUDE.md) — гид по расширению (раздел «WS-протокол» прямо предупреждает не путать enum'ы; раздел «Background Service Worker» про session storage).
- [`../../CLAUDE.md`](../../CLAUDE.md) — корневой гид Sync-Mate (раздел «Прежде чем что-то менять», п. 3: `BrowserMessageTypes` ≠ `WSMessageTypes`).
- [`../../Sync-Mate-API-WS/CLAUDE.md`](../../Sync-Mate-API-WS/CLAUDE.md) — гид по бэкенду (серверная сторона `WSMessageTypes`).
