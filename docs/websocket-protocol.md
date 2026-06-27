# Протокол WebSocket — Sync-Mate

Единый канонический контракт реального времени между браузерным расширением (FE) и FastAPI-сервером (BE): рукопожатие, коды закрытия, все 9 типов сообщений, алгоритм синхронизации воспроизведения и жизненный цикл комнаты.

> **Перспектива: фронтенд.** Этот файл живёт в `Sync-Mate-Extension/docs/`. Его зеркало с перспективой бэкенда — `Sync-Mate-API-WS/docs/websocket-protocol.md`.
>
> **Канонические разделы §1–§6 в обоих файлах идентичны слово в слово.** Любая правка протокола обязана синхронно менять оба файла (см. §6). Раздел §7 — специфичен для этой стороны (фронтенд: какой метод `RoomCoordinator` обрабатывает входящий тип, что и когда расширение отправляет).

> Документ описывает **реальность кода** на момент написания. Корневой `DOCUMENTATION.md` частично устарел (особенно про деплой) — при расхождениях доверяйте этому файлу и исходникам.

---

## 1. Эндпоинт и рукопожатие

### 1.1. Эндпоинт

```
ws://{host}/ws/{room_id}      # локально:  ws://127.0.0.1:8000/ws/<room_id>
wss://{host}/ws/{room_id}     # за TLS
```

Роутер объявлен как `@router.websocket("/{room_id}")` и подключается с префиксом `/ws`, поэтому полный путь — `/ws/{room_id}`. `room_id` — это идентификатор уже **существующей** комнаты (создаётся заранее REST-запросом `POST /api/rooms`); WebSocket комнату не создаёт, только присоединяет к ней.

### 1.2. Рукопожатие

Обмен строго двухтактный — соединение бесполезно, пока не пройден этот шаг:

```jsonc
// 1. Клиент → сервер  (ПЕРВЫЙ кадр после открытия сокета, обязателен)
{ "type": "connect", "name": "Alice" }

// 2. Сервер → клиент  (подтверждение, выдаёт идентификатор пользователя)
{ "type": "connect", "id": "550e8400-e29b-41d4-a716-446655440000" }
```

Последовательность на сервере:

1. `await websocket.accept()` — сокет принимается всегда.
2. `room_service.get_room(room_id)`; если комнаты нет → **close 4000**.
3. Чтение первого кадра и его валидация как `ConnectMessage` (Pydantic). Любая ошибка (не JSON, нет `type`/`name`, `type != "connect"`) → **close 4001**.
4. Создаётся `User(name, websocket)` с новым `uuid4`, выполняется `await room.add_user(user)`.
5. Сервер отправляет `{"type":"connect","id": user.user_id}` и входит в основной цикл приёма.

`id` — UUID, сгенерированный сервером (`User.user_id = str(uuid4())`). Имя берётся **только** из кадра `connect`; смена ника в хранилище расширения на активную сессию не влияет до переподключения.

---

## 2. Коды закрытия

| Код | Когда | Сторона/причина |
|---|---|---|
| `4000` | `room_service.get_room(room_id)` вернул `None` | Комната не найдена. `reason="Room not found"`. Закрытие **до** рукопожатия. |
| `4001` | Первый кадр не прошёл валидацию `ConnectMessage` | `reason="Authentication is required"`. Не JSON / нет полей / `type != "connect"`. |
| `1011` | Необработанное исключение в основном цикле приёма | Внутренняя ошибка сервера (стандартный WS-код). Закрытие оборачивается в `try/except` — сокет мог уже быть закрыт клиентом. |
| *(норма)* | `WebSocketDisconnect` — клиент закрыл соединение | Кода ошибки нет; сервер только логирует и снимает пользователя. |

При **любом** исходе (нормальное закрытие, 1011, исключение) в блоке `finally` выполняется `await room.remove_user(user)` — пользователь всегда снимается из комнаты. `4000`/`4001` срабатывают до создания пользователя, поэтому снимать некого.

Автопереподключения протокол не предусматривает — это ответственность клиента. Комнаты не персистятся (in-memory `dict` в `RoomService`); перезапуск сервера рвёт все сессии.

---

## 3. Полная таблица сообщений (9 типов)

Поля `current_time` и `downloaded_time` — числа (секунды; на клиенте округляются). «Направление»: c→s (клиент→сервер), s→c (сервер→клиент), оба.

| Тип | Направление | Поля | Триггер | Эффект |
|---|---|---|---|---|
| `connect` | оба | c→s: `name`; s→c: `id` | Открытие сокета | Рукопожатие (§1.2). c→s обязателен первым; s→c подтверждает и выдаёт UUID. |
| `info` | оба | c→s: произвольные (`title`, `translator`, `episode?`, `season?`, `url`, …); s→c: `name`, `downloaded_time` (+ что было в `status`, кроме `current_time`) | c→s: смена видео/перевода/эпизода; s→c: ретрансляция чужого `status` | c→s: сохраняется в `user.info` (всё, кроме `type`). s→c: peers видят, кто и сколько забуферизировал. |
| `play` | оба | c→s: `current_time`, `downloaded_time`; s→c: *(полей нет)* | c→s: пользователь нажал play / домотал; s→c: все готовы | c→s: запрос воспроизведения. s→c: команда всем играть (рассылается, только когда «готовы все»). |
| `pause` | оба | c→s: `current_time`, `downloaded_time`; s→c: *(полей нет)* | c→s: пользователь нажал pause; s→c: пауза от соседа | c→s: запрос паузы. s→c: команда поставить паузу **остальным** (инициатору не шлётся). |
| `seek` | **s→c** | `current_time` | Выравнивание позиции (§4): отстающие в `check_is_loaded` + согласование при `play`/`pause` | Клиент перематывает плеер на `current_time`. **Клиент `seek` не отправляет** — его нет в `_VALID_ACTIONS`, такой кадр был бы проигнорирован. |
| `status` | **c→s** | `current_time`, `downloaded_time` | Heartbeat: буферизация плеера + внутренние `pause()`/`seek()` клиента | Сервер обновляет `user.current_time`/`downloaded_time`, проверяет готовность комнаты (§4) и ретранслирует кадр соседям как `info`. **Сервер `status` не шлёт.** |
| `load` | **c→s** | `current_time`, `downloaded_time` | Запрос пересинхронизации с позицией комнаты | Сервер фиксирует позицию и, если готовы все, отдаёт `play` или `remove_block_pause`. **Внимание:** в текущем FE-коде `load` не отправляется — тип зарезервирован в обоих enum ради паритета (§6). |
| `set_video` | оба | c→s: `video_url` **или** `url` (+ `current_time?`); s→c: `video_url`, `current_time` | c→s: сменить видео для всей комнаты; s→c: команда перейти на URL | c→s: сброс состояния комнаты + рассылка всем. s→c: клиент переходит (`location.href`) на новый URL. **Внимание:** текущий FE только принимает `set_video`, сам его не шлёт. |
| `remove_block_pause` | **s→c** | *(полей нет)* | Комната на паузе, и подошедший клиент стал готов (`status`/`load`) | Снять блокировку-«замок» паузы на клиенте (скрыть оверлей), не запуская воспроизведение. |

### Асимметрии, которые легко упустить

- **`seek` — только s→c.** Когда пользователь сам перематывает, клиент шлёт `play`/`pause` (со своим `current_time`), а сервер выравнивает остальных через s→c `seek`.
- **`status` — только c→s.** Сервер никогда не шлёт `status`; он превращает его в `info` для соседей.
- **`load` и `set_video`** присутствуют в обоих enum, но в текущем FE как исходящие **не используются** (`load` не шлётся вообще; `set_video` FE только принимает). Их нельзя удалять — это сломает паритет §6 и REST-сценарий смены видео.

---

## 4. Алгоритм синхронизации — «никто не стартует, пока не готовы все»

Центральный инвариант: воспроизведение запускается только тогда, когда **у всех** участников совпадает позиция **и** набрано достаточно буфера. Иначе один отстающий навсегда блокировал бы запуск.

### 4.1. Состояние

- **Комната:** `current_time` (опорная позиция), `is_paused` (логическая пауза комнаты), `is_loaded` (все готовы).
- **Пользователь:** `current_time`, `downloaded_time` — обновляются на **каждом** входящем `status`/`play`/`pause`/`load`.
- **Порог:** `REQUIRED_DOWNLOAD_TIME` (по умолчанию **15** секунд) — сколько буфера впереди позиции обязан иметь каждый.

### 4.2. Проверка готовности (`check_is_loaded`)

Выполняется под `asyncio.Lock` (сериализация с `add_user`/`remove_user`):

1. **Коррекция отстающих.** Все, у кого `user.current_time != room.current_time`, получают s→c `seek` на `room.current_time`. Без этого один рассинхронизированный клиент блокировал бы старт навсегда.
2. **Готовы все?** `all_ready` истинно, когда участников ≥ 1 **и** для каждого: `current_time == room.current_time` **и** `downloaded_time >= REQUIRED_DOWNLOAD_TIME`.
3. Если `all_ready` → `is_loaded = True`; возвращается `all_ready`.

> Сравнение `current_time == room.current_time` — **точное** равенство `float`. Оно работает потому, что клиент округляет время перед отправкой, а опорная `room.current_time` берётся из того же присланного значения; рассогласование исправляет шаг 1 (`seek`).

### 4.3. Гейт `REQUIRED_DOWNLOAD_TIME`

`downloaded_time` — это сколько секунд впереди текущей позиции уже в буфере. Пока хотя бы у одного оно меньше порога — `all_ready = False`, команда `play` не уходит, клиенты держат «замок» паузы (оверлей загрузки). Это не даёт стартовать тому, кто не успел докачать.

### 4.4. Ход проверки по событиям

- **`status` (heartbeat):** если комната ещё не `is_loaded` → `check_is_loaded`. Стали готовы все → если `is_paused`: `remove_block_pause` (снять замок без старта), иначе `play` (старт всем).
- **`play`:** выровнять остальных (`seek` с позицией инициатора), `load(current_time)`, `is_paused=False`, и если готовы все → `play`.
- **`pause`:** выровнять остальных (`seek`), отправить им `pause`, `load(current_time)`, `is_paused=True`.
- **`load`:** `load(current_time)`; если готовы все → `remove_block_pause` (когда `is_paused`) или `play`.

`load(current_time)` всегда ставит `is_loaded=False` — любая смена позиции требует новой проверки готовности.

---

## 5. Жизненный цикл комнаты

```
СОЗДАНИЕ            REST POST /api/rooms  →  Room в RoomService (in-memory)
   │                video_url = текущая страница Rezka; current_time = 0
   ▼
ПОДКЛЮЧЕНИЕ         ws://host/ws/{room_id}  →  connect{name}  →  connect{id}
   │                add_user(user)
   ▼
HEARTBEAT          плеер шлёт status{current_time, downloaded_time}
   │                сервер: check_is_loaded → (play | remove_block_pause)
   │                сервер ретранслирует соседям как info{name, downloaded_time}
   ▼
УПРАВЛЕНИЕ          play / pause / seek(s→c) / load
   │                выравнивание позиции + гейт буфера (§4)
   ▼
СМЕНА ВИДЕО         set_video{video_url}  →  всем set_video  →  переход по URL
   │                state комнаты сбрасывается (is_loaded=False, is_paused=False)
   ▼
ВЫХОД              WebSocketDisconnect / close  →  finally: remove_user(user)
```

Замечания:

- **Создание** — это REST, не WS. WebSocket присоединяет к уже существующей комнате.
- **Heartbeat** двунаправлен по эффекту: продвигает машину готовности и одновременно кормит чужие info-панели.
- **Смена видео** ведёт к перезагрузке страницы у всех; после неё content-скрипт переинициализируется и заново проходит рукопожатие.
- **Очистки пустых комнат нет** — удаление только вручную через REST `DELETE`.

---

## 6. Критический инвариант: паритет BE ↔ FE

**Множество типов сообщений обязано быть идентичным на бэкенде и фронтенде.** Рассинхрон ломает синхронизацию комнаты молча — кадр незнакомого типа просто игнорируется.

Добавление / переименование / удаление типа требует правок **на обеих сторонах одновременно**:

**Бэкенд (`Sync-Mate-API-WS`):**
- `app/modules/room/handler.py` → `UserHandler._VALID_ACTIONS` (входящие действия) **И** соответствующий `_handle_*`/inline-ветка.
- `app/modules/room/models.py` / `handler.py` / `ws/router.py` → `send_json({"type": …})` (исходящие).
- `app/ws/schemas.py` → `ConnectMessage.type = Literal["connect"]` (рукопожатие).

**Фронтенд (`Sync-Mate-Extension`):**
- `src/features/room/model/messageTypes.ts` → `enum WSMessageTypes`.
- `src/features/room/RoomCoordinator.ts` → ветка обработки входящего типа и/или отправитель.

**Документация и автоматика:**
- `scripts/protocol_sync.py` — гейт паритета: извлекает все строковые `type` с обеих сторон и сверяет множества (exit 0 — синхронны, 1 — дрейф, 2 — файлы не найдены).
- Общий гейт `scripts/gate.py` (шаг `protocol`).
- Хук `.claude/hooks/guard-protocol.py`.
- Скилл `/sync-protocol`.
- Агент `protocol-guardian`.

> **Классическая ловушка:** строка добавлена в `_VALID_ACTIONS`, но `_handle_*` для неё нет → действие «молча принято» и **не имеет эффекта**. То же ловит `scripts/arch_lint_api.py`.

---

## 7. Перспектива фронтенда: что обрабатываем и что шлём

Все пути относительны корня `Sync-Mate-Extension/`. Имена типов — `WSMessageTypes` (`src/features/room/model/messageTypes.ts:3-13`). Не путать с `BrowserMessageTypes` — это внутренний IPC content↔background↔popup, другой enum.

### 7.1. Установка соединения (`src/features/room/sockets/WebSocketClient.ts`)

| Шаг | Место |
|---|---|
| `new WebSocket(`${WS_URL}/${roomId}`)` | `WebSocketClient.ts:20` |
| Таймаут 5000 мс → `close()` + `finish(false)` | `WebSocketClient.ts:33-37` |
| `open` → отправка `connect{name}` | `WebSocketClient.ts:39-42` |
| Приём `connect` → `setItem("id", …)` + `finish(true)` | `WebSocketClient.ts:44-50` |
| `close` во время connect → `finish(false)` | `WebSocketClient.ts:52-55` |
| `error` во время connect → `finish(false)` | `WebSocketClient.ts:57-61` |
| `send()` шлёт, только если сокет `OPEN` | `WebSocketClient.ts:77-80` |
| `onClose` логирует `code`/`reason` | `WebSocketClient.ts:99-112` |

`connect()` возвращает чистый `Promise<boolean>` (никаких unhandled-rejection). `WS_URL` собирается в `src/shared/constants/api.ts:20` из `WXT_BACKEND_URL` (`http`→`ws`, `https`→`wss`, суффикс `/ws`).

### 7.2. Обработка входящих (`RoomCoordinator.handleWsMessage`, `RoomCoordinator.ts:122-155`)

| Входящий тип (s→c) | Ветка | Действие плеера/UI |
|---|---|---|
| `info` | `RoomCoordinator.ts:127-132` | `ui.infoPanel.updateInformation(data.name, data.downloaded_time)`. |
| `play` | `RoomCoordinator.ts:133-135` | `playerCoordinator.play()` → `ControlPlayer.play` (снять замок, `player.play()`). |
| `pause` | `RoomCoordinator.ts:136-138` | `playerCoordinator.pause()` → `ControlPlayer.pause`. |
| `seek` | `RoomCoordinator.ts:139-141` | `playerCoordinator.seek(data.current_time)` → `ControlPlayer.seek`. |
| `remove_block_pause` | `RoomCoordinator.ts:142-144` | `playerCoordinator.setIsBlockPause(false)` (скрыть оверлей загрузки). |
| `set_video` | `RoomCoordinator.ts:145-153` | Если `video_url` — строка и ≠ текущему `location.href`, переход: `window.location.href = data.video_url`. |
| `connect` | (в `WebSocketClient`, не здесь) | Завершает рукопожатие, см. §7.1. |
| `status` / `load` | — | **Не обрабатываются** входящими: сервер их не шлёт. |

Закрытие после установки соединения → `handleWsClose` (`RoomCoordinator.ts:157-160`): `playerCoordinator.disable()` + `dispose()`. Автопереподключения нет. Закрытия `4000`/`4001`/таймаут происходят **до** разрешения `connect()` → `connected=false` → статус-бокс «Error connecting» (`RoomCoordinator.ts:96-103`).

### 7.3. Что и когда отправляет фронтенд

| Исходящий тип (c→s) | Где формируется | Когда |
|---|---|---|
| `connect` | `WebSocketClient.ts:41` | Сразу по `open` сокета (рукопожатие). |
| `info` | `ParseInfo.parse()` → `{type:"info", title, translator, episode?, season?, url}` (`ParseInfo.ts:32-40`) | На подключении (`RoomCoordinator.ts:112`) и при смене перевода/эпизода (`handleInfo`, `RoomCoordinator.ts:166-172`). |
| `status` | `ControlPlayer.sendStatus()` (тип по умолчанию, `ControlPlayer.ts:205-214`) | Heartbeat буфера `onProgress` (`ControlPlayer.ts:138`); внутренние `pause()` (`:184`) и `seek()` (`:197`). |
| `play` | `ControlPlayer.sendStatus("play")` | `onUserPlay` (`ControlPlayer.ts:71`), `onSeeking` при играющем плеере (`:130`), `onWaiting` (`:154`). |
| `pause` | `ControlPlayer.sendStatus("pause")` | `onUserPause` (`ControlPlayer.ts:89`), `onSeeking` при паузе (`:130`). |

Тракт отправки статусов: `PlayerCoordinator.onStatus` → `RoomCoordinator.handleStatus` (`RoomCoordinator.ts:162-164`) → `socket.send(data)`. Все исходящие `status`/`play`/`pause` несут `current_time` и `downloaded_time`, округлённые `roundTime` (`ControlPlayer.ts:207-213`).

**Фронтенд НЕ отправляет:** `seek` (при перемотке шлёт `play`/`pause`), `load` (нигде не вызывается), `set_video` (только принимает), `remove_block_pause`, `connect`-ответ.

### 7.4. Подавление эха (почему важно для протокола)

Браузерный `<video>` не различает программные и пользовательские события, поэтому каждое программное действие помечается флагом (`isManualPlay`/`isManualPause`/`isManualSeek`/`isBlockPause`/`isSkipWaiting` в `ControlPlayer.ts`). Без них приход s→c `play` спровоцировал бы исходящий c→s `play` — бесконечный цикл. Подробности — в [`docs/player-sync.md`](player-sync.md).

---

## См. также

- [`docs/player-sync.md`](player-sync.md) — синхронизация плеера, флаги подавления эха, `ControlPlayer`.
- [`docs/messaging.md`](messaging.md) — внутренний IPC `BrowserMessageTypes` (не путать с `WSMessageTypes`).
- [`docs/architecture.md`](architecture.md) — Coordinator-паттерн, точка входа content-скрипта.
- [`docs/configuration.md`](configuration.md) — `WXT_BACKEND_URL`, сборка `WS_URL`/`API_URL`.
- [`docs/locators.md`](locators.md) · [`docs/background.md`](background.md) · [`docs/conventions.md`](conventions.md) · [`docs/styling.md`](styling.md) · [`docs/popup.md`](popup.md) · [`docs/build-release.md`](build-release.md).
- Зеркало с перспективой бэкенда: `../../Sync-Mate-API-WS/docs/websocket-protocol.md`.
- Гиды: [`../CLAUDE.md`](../CLAUDE.md) (расширение) · [корневой `CLAUDE.md`](../../CLAUDE.md).
