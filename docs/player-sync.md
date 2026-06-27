# Синхронизация плеера

Исчерпывающий справочник по самой хитрой части расширения: как наблюдать за HTML5-плеером Rezka, как им управлять и как флаги подавления эха не дают программным действиям зациклиться.

---

## 1. Зачем это вообще сложно

Расширение синхронизирует один и тот же `<video>` у нескольких пользователей через WebSocket-сервер. Проблема в том, что **браузерный `<video>` не различает, кто инициировал действие**: и нажатие пользователя на «play», и наш программный вызов `player.play()` порождают **одно и то же** DOM-событие `play`. Наши собственные слушатели поймают это событие и примут программное действие за пользовательское — отправят на сервер `play`, сервер разошлёт `play` обратно, мы снова вызовем `player.play()`, снова поймаем событие… → **бесконечный цикл (эхо)**.

Решение — набор булевых флагов-«меток»: перед каждым программным действием выставляется флаг, а соответствующий обработчик события, увидев флаг, **молча гасит эхо** (сбрасывает флаг и выходит, ничего не отправляя). Подробности — в §6.

Вторая сложность — **готовность к воспроизведению**: нельзя стартовать всех, пока у каждого нет достаточного буфера и одинаковой позиции. За это отвечают `BufferedTime`, поле `downloaded_time` и серверный порог `REQUIRED_DOWNLOAD_TIME` (§5).

---

## 2. Действующие лица и поток данных

```
                Rezka <video>  (DOM-события: play/pause/seeking/progress/waiting/…)
                      │  ▲
        (слушает)     │  │  (вызывает player.play()/pause()/currentTime=…)
                      ▼  │
   EventListeners ──────────▶ ControlPlayer ──(SendStatusCallback)──▶ RoomCoordinator ──▶ WebSocket ──▶ сервер
   (подписка/отписка)         (флаги + действия)        onStatus            handleStatus      socket.send
                      ▲                                                          │
                      └──────── PlayerCoordinator (фасад/жизненный цикл) ◀───────┘
                                                                       handleWsMessage:
                                                                       play/pause/seek/remove_block_pause
```

| Компонент | Файл | Роль |
|---|---|---|
| `PlayerCoordinator` | `src/features/player/PlayerCoordinator.ts` | Фасад над `ControlPlayer` + `EventListeners`; пересоздаёт их при смене серии/озвучки. |
| `ControlPlayer` | `src/features/player/services/ControlPlayer.ts` | Вся логика: обработчики событий, флаги эха, программные действия `play/pause/seek`, отправка статусов. |
| `EventListeners` | `src/features/player/services/EventListeners.ts` | Подписка/отписка от DOM-событий `<video>`, проброс в `ControlPlayer`. |
| `BufferedTime` | `src/features/player/utills/BufferedTime.ts` | Учёт буферизованных диапазонов, вычисление «сколько секунд буфера впереди». ⚠️ Каталог называется `utills` (с двумя `l`). |
| `OverlayLoader` | `src/ui/components/OverlayLoader.ts` | Визуальная блокировка плеера (спиннер + перехват пробела) на время ожидания комнаты. |
| `RoomCoordinator` | `src/features/room/RoomCoordinator.ts` | Связывает плеер с WS: статусы плеера → сервер; входящие WS-команды → методы плеера. |

`ControlPlayer.SendStatusCallback` (`ControlPlayer.ts:5-11`) — форма исходящего статуса:

```ts
interface SendStatusCallback {
    (arg?: { type: string; current_time: number; downloaded_time: number }): void;
}
```

---

## 3. Жизненный цикл: инициализация и пересоздание

### 3.1. Сборка

`initPlayerFeatured(locators)` (`src/features/player/index.ts:5-12`) собирает UI-объект `{ overlayLoader, getPlayer }` и создаёт `PlayerCoordinator`. `getPlayer` — это локатор `locators.player` (находит `<video>` Rezka), `overlayLoader` — `new OverlayLoader(locators)`.

Конструктор `PlayerCoordinator` (`PlayerCoordinator.ts:17-24`) сразу создаёт `ControlPlayer` (берёт текущий `<video>` через `getPlayer()`, бросает `"Player didn't find"`, если его нет — `ControlPlayer.ts:37-39`) и `EventListeners` (тоже резолвит `<video>` в конструкторе — `EventListeners.ts:22-25`).

Важно: **слушатели на этом этапе ещё не подключены**. `EventListeners.enable()` вызывается позже — из `RoomCoordinator.connect` (`RoomCoordinator.ts:117`), уже после успешного WS-подключения. До подключения к комнате плеер ведёт себя как обычно.

### 3.2. Фасад: проброс методов

`PlayerCoordinator` отдаёт наружу **связанные** (`.bind`) методы (`PlayerCoordinator.ts:26-53`):

| Геттер | Делегирует в | Кто вызывает |
|---|---|---|
| `play` | `ControlPlayer.play` | `RoomCoordinator` на WS `play` |
| `pause` | `ControlPlayer.pause` | `RoomCoordinator` на WS `pause` |
| `seek` | `ControlPlayer.seek` | `RoomCoordinator` на WS `seek` |
| `setIsBlockPause` | `ControlPlayer.setIsBlockPause` | `RoomCoordinator` на WS `remove_block_pause` |
| `enable` / `disable` | `EventListeners.enable/disable` | `RoomCoordinator` при connect/close/смене серии |
| `onStatus` | `ControlPlayer.onStatus` | `RoomCoordinator` для подписки на исходящие статусы |

### 3.3. `updatePlayer()` — смена серии/озвучки

Когда `ParseInfo` замечает смену эпизода или переводчика, `RoomCoordinator.handleInfo` (`RoomCoordinator.ts:166-172`) вызывает `playerCoordinator.updatePlayer()` и затем снова `enable()`.

`updatePlayer()` (`PlayerCoordinator.ts:55-65`):

1. `eventListener.disable()` — снимает слушатели со старого `<video>`.
2. Пересоздаёт `ControlPlayer` — **все флаги сбрасываются в исходное** (новый инстанс), новый `<video>` резолвится заново.
3. Пересоздаёт `EventListeners` поверх нового `<video>`.
4. Восстанавливает `statusCallback` через `onStatus`.

**Почему это нужно:** Rezka при смене серии/озвучки **подменяет элемент `<video>`**. Старые слушатели висели бы на «мёртвом» узле, а накопленные флаги (`isBlockPause`, `isFirstStart` и т. п.) стали бы неконсистентны. Пересоздание — чистый сброс состояния синхронизации под новый медиаэлемент.

---

## 4. Наблюдение за плеером — `EventListeners`

`EventListeners` подписывается на семь событий `<video>` и проксирует их в методы `ControlPlayer`. Обвязка хендлеров — в конструкторе (`EventListeners.ts:27-33`), подписка — в `enable()` (`EventListeners.ts:48-62`).

| DOM-событие | `addEventListener` опции | Обработчик `ControlPlayer` | Назначение |
|---|---|---|---|
| `loadedmetadata` | bubble (по умолчанию) | `onLoadedMetadata` | Узнать, что длительность/метаданные готовы. |
| `play` | **`{ capture: true }`** | `onUserPlay` | Пользователь (или эхо) запустил воспроизведение. |
| `pause` | **`{ capture: true }`** | `onUserPause` | Пользователь (или эхо) поставил на паузу. |
| `timeupdate` | bubble | `onTimeUpdate` | Запомнить позицию (для детекта ложных перемоток). |
| `seeking` | bubble | `onSeeking` | Перемотка (или эхо). |
| `progress` | bubble | `onProgress` | Изменился буфер → пересчитать `downloaded_time`. |
| `waiting` | bubble | `onWaiting` | Плеер «захлебнулся» (кончился буфер). |

**Почему `play`/`pause` слушаются в фазе capture:** чтобы наш обработчик отработал **раньше** собственных скриптов плеера Rezka. В capture-фазе событие идёт сверху вниз до целевого элемента; так мы успеваем принять решение (и при необходимости — погасить эхо/откатить действие) до того, как страница среагирует.

### 4.1. Механика подписки/отписки

`onEventListener` (`EventListeners.ts:36-46`) добавляет слушатель и складывает функцию-отписку в массив `unsub`. `disable()` (`EventListeners.ts:64-69`) вызывает все отписки и очищает массив. Оба метода идемпотентны через флаг `enabled` (`enable` выходит, если уже включено; `disable` — если уже выключено). Это защищает от двойной подписки при повторных `enable()` (например, connect + handleInfo).

---

## 5. Буферизация и определение готовности

### 5.1. `BufferedTime`

`<video>.buffered` — это `TimeRanges` (набор интервалов `[start, end]`, что уже скачано). `BufferedTime` хранит копию этих интервалов и отвечает на вопрос «сколько секунд непрерывного буфера впереди от текущей позиции».

| Метод | Файл:строки | Что делает |
|---|---|---|
| `update(buffered)` | `BufferedTime.ts:24-35` | Перестраивает `ranges` из `TimeRanges`. Если `start < 0.1`, считает его `0` (нормализация «почти нуля»). |
| `getCurrBuffer(t)` | `BufferedTime.ts:4-11` | Находит диапазон, **содержащий** `t` (`start <= t <= end`). ⚠️ `FIXME`: результат может быть меньше реального (на стыках диапазонов). |
| `getCurrEnd(t)` | `BufferedTime.ts:13-17` | Конец текущего диапазона; если `t` вне всех диапазонов — возвращает сам `t`. |
| `getCurrDownTime(t)` | `BufferedTime.ts:19-22` | `getCurrEnd(t) - t` → секунды буфера впереди. **0, если позиция не попадает ни в один буферизованный диапазон.** |

`getCurrDownTime(currentTime) === 0` — ключевой признак «впереди буфера нет», используется в `onUserPlay`, `onSeeking`, `onWaiting`.

### 5.2. `downloaded_time` и порог сервера

`sendStatus` (`ControlPlayer.ts:205-214`) кладёт в каждое исходящее сообщение:

```ts
{
    type,                                                  // "status" | "play" | "pause" | …
    current_time:    roundTime(this.player.currentTime),   // округление до мс, time.ts:1-3
    downloaded_time: roundTime(this.bufferedTime.getCurrDownTime(this.player.currentTime)),
}
```

Сервер при каждом `play`/`pause`/`status` сохраняет `user.current_time` и `user.downloaded_time` (`handler.py:35-36`) и в `Room.check_is_loaded` (`models.py:67-83`) считает комнату готовой, только если **у всех** позиция совпадает с комнатной **и** `downloaded_time >= REQUIRED_DOWNLOAD_TIME` (= `15` сек, `Sync-Mate-API-WS/app/config.py:17`). Отстающих по позиции сервер сам подтягивает командой `seek` (`models.py:71-75`).

Иначе говоря: **поток `progress → onProgress → sendStatus()` — это сердцебиение готовности.** Пока буфер растёт, клиент шлёт статусы; как только у всех буфера хватает, сервер разрешает `play`.

### 5.3. `OverlayLoader` — что значит «заблокировано»

`setIsBlockPause(true)` показывает оверлей (`OverlayLoader.show`, `OverlayLoader.ts:65-75`): затемняет кнопку play, рисует спиннер поверх таймлайна и **перехватывает пробел** (`blockSpace`, `OverlayLoader.ts:87-95`, слушатель `keydown` в capture с `preventDefault` + `stopImmediatePropagation`). `setIsBlockPause(false)` всё это снимает (`OverlayLoader.ts:77-85`).

Смысл: пока мы ждём подтверждения от комнаты, пользователь физически не может «расжать» паузу — иначе он рассинхронизировался бы с остальными.

---

## 6. Флаги подавления эха (ECHO-SUPPRESSION)

Все флаги объявлены в `ControlPlayer` (`ControlPlayer.ts:21-27`). Это **приватное состояние одного инстанса**; при `updatePlayer()` инстанс пересоздаётся, и все флаги обнуляются.

### 6.1. Сводная таблица

| Флаг | Когда **ставится** | Когда **сбрасывается** | Что предотвращает / зачем |
|---|---|---|---|
| `isManualPlay` | в `play()` перед `player.play()` (`:172`) | в `onUserPlay`, первой же проверкой (`:51-55`) | Эхо от нашего `player.play()`. Без него событие `play`, порождённое программным вызовом, ушло бы на сервер как «пользователь нажал play» → цикл. |
| `isManualPause` | в `pause()` перед `player.pause()` (`:180`), **только если плеер играл** (`:178`) | в `onUserPause`, первой же проверкой (`:76-79`) | Эхо от нашего `player.pause()`. Ставится условно: если плеер уже на паузе, события `pause` не будет — флаг не нужен. |
| `isManualSeek` | в `seek()` перед `player.currentTime = …` (`:199`) | в `onSeeking` (`:107-110`) | Эхо от нашей программной перемотки. Без него наш же `seek` пришёл бы обратно как пользовательская перемотка. |
| `isBlockPause` | каждый раз, когда ждём подтверждения комнаты: `onUserPlay` (`:70`), `onUserPause` (`:88`), `onSeeking` (`:132`), `onWaiting` (`:155`), `seek()` (`:195`) | `play()` → `setIsBlockPause(false)` (`:173`); приход WS `remove_block_pause` → `RoomCoordinator` → `setIsBlockPause(false)` (`RoomCoordinator.ts:142-143`) | Двойную обработку и пользовательский «развал» паузы во время ожидания. В `onUserPlay` (`:63-67`): если уже заблокировано, локальный play откатывается обратно в паузу. Управляет оверлеем (§5.3). |
| `isSkipWaiting` | когда впереди нет буфера и сейчас будет «ложный» `waiting`: `onUserPlay` (`:56-58`), `onSeeking` (`:104-106`) | в `onWaiting`, первой проверкой (`:146-149`) | Одиночное ложное срабатывание `onWaiting`. После намеренной паузы/перемотки в незабуференную зону плеер кинет `waiting`, который мы хотим проигнорировать ровно один раз. |
| `isLoadedMetaData` | в `onLoadedMetadata` (`:44-47`) | не сбрасывается (живёт до пересоздания инстанса) | Реакцию на события до готовности метаданных. Пока `false`: `onUserPlay` пропускает «первый play» (`:59-62`), `onUserPause` выходит (`:81`), `seek()` уходит в режим первого старта (`:189-193`). |
| `isFirstStart` | в `seek()`, если метаданные ещё не загружены (`:191`) | в `onUserPause` (`:82-85`) и в `onSeeking` (`:115-118`) | Артефакты «прогрева» плеера. Когда клиент только присоединился и сервер шлёт `seek` до загрузки метаданных, мы вынуждены однократно дёрнуть `player.play()`, чтобы заставить медиа инициализироваться; порождённые при этом `play`/`seeking`/`pause` гасятся этим флагом. |

### 6.2. Главный принцип

> **Программное действие → выставить флаг → событие приходит → обработчик видит флаг → сбрасывает его и молча выходит.**

`isManualPlay`/`isManualPause`/`isManualSeek` — «одноразовые предохранители»: они **потребляются** первым же эхо-событием. `isBlockPause` — состояние («мы ждём комнату»), живёт до явного снятия. `isSkipWaiting` — одноразовый, но привязан к `waiting`. `isLoadedMetaData`/`isFirstStart` — фазовые флаги жизненного цикла, не про эхо в прямом смысле, но в той же системе «не реагируй, пока рано».

---

## 7. Обработчики событий — детально

### 7.1. `onLoadedMetadata` (`:44-47`)
Ставит `isLoadedMetaData = true`. С этого момента остальные обработчики начинают работать «по-настоящему».

### 7.2. `onUserPlay` (`:49-72`)
Реакция на событие `play`. Порядок проверок критичен:

1. `isManualPlay` → сброс, выход (эхо нашего `play()`).
2. Если `getCurrDownTime() === 0` → `isSkipWaiting = true` (готовимся проглотить грядущий `waiting`).
3. Если `!isLoadedMetaData` → «Skip first play», выход (автозапуск до метаданных игнорируем).
4. Если `isBlockPause` → `pause()` и выход («Play blocked by pause» — пользователь пытается играть, пока мы ждём комнату: откатываем в паузу).
5. Иначе — **реальный пользовательский play**: `pause()` (локально откатываем!), `setIsBlockPause(true)` (оверлей), `sendStatus("play")`.

Пункт 5 неинтуитивен: при нажатии play мы **сначала ставим себя на паузу** и блокируемся, а реальный старт произойдёт только когда сервер пришлёт авторитетный `play` всем (см. §8.1).

### 7.3. `onUserPause` (`:74-90`)
Реакция на событие `pause`:

1. `isManualPause` → сброс, выход (эхо нашего `pause()`).
2. `!isLoadedMetaData` → выход.
3. `isFirstStart` → сброс, выход (пауза во время прогрева).
4. `isBlockPause` → выход (уже ждём комнату — не дублируем).
5. Иначе — **реальная пользовательская пауза**: `setIsBlockPause(true)`, `sendStatus("pause")`.

### 7.4. `onTimeUpdate` (`:92-100`)
Сохраняет `this.currentTime = player.currentTime`. Это значение используется в `onSeeking` для детекта «ложной перемотки» (дрожание `timeupdate` против настоящего скраба).

### 7.5. `onSeeking` (`:102-133`)
Самый ветвистый обработчик:

1. Если `getCurrDownTime() === 0` → `isSkipWaiting = true`.
2. `isManualSeek` → сброс, выход (эхо нашей перемотки).
3. `player.currentTime === 0.1` → принудительно `= 0`, выход (костыль под особенность плеера Rezka, который выставляет `0.1` на инициализации).
4. `isFirstStart` → `player.pause()`, выход (во время прогрева держим на паузе).
5. **Ложная перемотка**: если новая позиция в пределах `±0.3` сек от запомненной `currentTime` и не равна `0` → «Ложное перематывание», выход.
6. Иначе — **реальная перемотка**: `sendStatus(player.paused ? "pause" : "play")` (сообщаем серверу позицию и текущее состояние), `pause()`, `setIsBlockPause(true)`.

### 7.6. `onProgress` (`:135-143`)
1. Если `!player.duration` → выход (плеер ещё не готов).
2. `bufferedTime.update(player.buffered)` — обновить диапазоны.
3. `sendStatus()` (тип `"status"`) — отправить серверу свежий `downloaded_time`.

Это и есть пульс готовности из §5.2.

### 7.7. `onWaiting` (`:145-156`)
Плеер «захлебнулся»:

1. `isSkipWaiting` → сброс, выход (ожидаемый stall после намеренной паузы/перемотки).
2. Если `getCurrDownTime() > 0` → выход (ложный `waiting`, буфер впереди есть).
3. Иначе — **настоящая нехватка буфера**: `pause()`, `sendStatus("play")` (просим возобновить, когда дозагрузимся), `setIsBlockPause(true)`. Это повторно входит в воротца готовности — сервер не разошлёт `play`, пока буфер не восстановится.

---

## 8. Программные действия — `ControlPlayer`

| Метод | Файл:строки | Поведение |
|---|---|---|
| `setIsBlockPause(b)` | `:160-168` | Идемпотентно (выход, если значение не меняется). При `true` — `overlayLoader.show()`, при `false` — `hide()`. |
| `play()` | `:170-175` | `isManualPlay = true` → `setIsBlockPause(false)` (снять оверлей) → `player.play()`. |
| `pause()` | `:177-185` | Если плеер играл: `isManualPause = true` → `player.pause()`. **Всегда** в конце `sendStatus()` (тип `"status"`). |
| `seek(time)` | `:187-201` | Если `!isLoadedMetaData`: `player.play()` + `isFirstStart = true` + выход (режим прогрева). Иначе: `pause()` → `setIsBlockPause(true)` → `sendStatus()` → `isManualSeek = true` → `player.currentTime = time`. |
| `sendStatus(type="status")` | `:205-214` | Отправляет `{type, current_time, downloaded_time}` через `this.send` (см. `onStatus`). |
| `onStatus(cb)` | `:216-221` | Регистрирует колбэк `this.send`; возвращает функцию отписки (сбрасывает `send` в no-op). |

Обратите внимание: `pause()` и `seek()` сами вызывают `sendStatus()` (тип `"status"`) до прикладного сообщения. Поэтому в эфире рядом с `play`/`pause`/`seek` всегда летят и `status`-кадры — это нормально, сервер ими обновляет позицию/буфер.

---

## 9. Сквозные сценарии («что происходит шаг за шагом»)

В обоих сценариях канал такой: `ControlPlayer.sendStatus` → колбэк `onStatus`, зарегистрированный в `RoomCoordinator.connect` (`RoomCoordinator.ts:108-110`) → `handleStatus` (`:162-164`) → `socket.send`. Входящие WS-команды разбирает `handleWsMessage` (`:122-155`).

### 9.1. Play — от нажатия до синхронного старта

Пользователь **A** нажимает play:

1. `<video>` A кидает `play` → `onUserPlay` (флаг `isManualPlay` снят).
2. `onUserPlay` ветка 5: `pause()` (локально откатываемся в паузу; событие `pause` гасится `isManualPause`), `setIsBlockPause(true)` (оверлей + блок пробела), `sendStatus("play")`.
3. На сервер уходит `{type:"play", current_time, downloaded_time}` → `UserHandler._handle_play` (`handler.py:61-67`): подтянуть остальных `seek(current_time)` (кроме A), `room.load(current_time)`, `is_paused = False`, затем `check_is_loaded`.
4. `check_is_loaded` (`models.py:67-83`): отстающим шлёт `seek`; если **у всех** позиция совпала и `downloaded_time >= 15` → `is_loaded = True` и `room.play()` → broadcast `{type:"play"}` **всем, включая A** (`models.py:85-87`).
5. Каждый клиент получает WS `play` → `RoomCoordinator` → `playerCoordinator.play()` → `ControlPlayer.play()`: `isManualPlay = true`, `setIsBlockPause(false)` (оверлей гаснет), `player.play()`.
6. `player.play()` кидает `play` → `onUserPlay` видит `isManualPlay` → сброс, выход. Эхо погашено, воспроизведение идёт синхронно.

Если на шаге 4 готовы **не все** — `room.play()` не вызывается. Клиенты продолжают слать `status` по `onProgress` (буфер растёт); когда статус приходит при незагруженной комнате, `_handle_status` (`handler.py:47-59`) снова дергает `check_is_loaded` и, когда все готовы и комната не на паузе, вызывает `room.play()`. Оверлей у всех гаснет в шаге 5.

### 9.2. Pause — от нажатия до подтверждённой паузы

Пользователь **A** нажимает pause:

1. `<video>` A кидает `pause` → `onUserPause` (флаг `isManualPause` снят).
2. `onUserPause` ветка 5: `setIsBlockPause(true)` (оверлей), `sendStatus("pause")`.
3. На сервер уходит `{type:"pause", …}` → `_handle_pause` (`handler.py:69-77`): `room.seek(current_time)` остальным, `room.pause(exception_user=A)` → broadcast `{type:"pause"}` всем, **кроме A** (`models.py:89-92`), `room.load(current_time)` (обнуляет `is_loaded`), `is_paused = True`.
4. Остальные клиенты получают WS `pause` → `playerCoordinator.pause()` → `ControlPlayer.pause()`: если играли — `isManualPause = true`, `player.pause()` (эхо `pause` гасится), и в конце `sendStatus()` (тип `"status"`).
5. Эти `status`-кадры приходят на сервер → `_handle_status`: комната снова `is_loaded == False` (из-за `load` в шаге 3), `check_is_loaded` пересчитывается; когда у всех совпали позиции и буфер, а `is_paused == True` → `room.remove_block_pause()` (`models.py:118-119`) → broadcast `{type:"remove_block_pause"}` всем.
6. Каждый клиент получает `remove_block_pause` → `RoomCoordinator` → `setIsBlockPause(false)` → оверлей гаснет. Все стоят на паузе в одной точке, блокировка снята.

**Почему оверлей снимается через `remove_block_pause`, а не сразу:** пауза должна быть «подтверждена» — то есть нужно дождаться, что все участники реально встали на одну и ту же позицию. До подтверждения оверлей не даёт пользователю снять паузу и разойтись с группой.

### 9.3. Seek (перемотка) — кратко
Реальный скраб у A → `onSeeking` ветка 6 → `sendStatus(paused?"pause":"play")` + `pause()` + блок. Сервер (`_handle_play`/`_handle_pause` в зависимости от типа) перематывает остальных через `room.seek` и заново проходит воротца готовности. Команды `seek` приходящие клиентам исполняет `ControlPlayer.seek()` с флагом `isManualSeek` (гашение эха).

### 9.4. Первый старт нового участника (прогрев)
Участник присоединился, метаданных ещё нет. Сервер шлёт `seek(current_time)`:

1. `ControlPlayer.seek()`: `!isLoadedMetaData` → `player.play()` + `isFirstStart = true` + выход. Это «будит» медиаэлемент, чтобы он начал грузиться.
2. Возникающие при прогреве `seeking` гасит ветка `isFirstStart` (`:115-118`, `player.pause()`), а `pause` — ветка `isFirstStart` в `onUserPause` (`:82-85`).
3. Приходит `loadedmetadata` → `isLoadedMetaData = true`. Дальше `seek` уже работает в нормальном режиме (перемотка + `isManualSeek`), и клиент включается в обычный цикл готовности.

---

## 10. Краевые случаи и подводные камни

- **`player.currentTime === 0.1`** (`onSeeking`, `:111-114`) — плеер Rezka выставляет `0.1` при инициализации; код жёстко возвращает позицию в `0`. Не «чините» как мёртвый код.
- **Окно ложной перемотки `±0.3`** (`onSeeking`, `:119-127`) — `timeupdate` иногда выглядит как микроперемотка. Сужение/расширение окна повлияет на ложные срабатывания.
- **`pause()` ставит `isManualPause` только если плеер играл** (`:178`) — если уже на паузе, события не будет, флаг остался бы «висеть» и проглотил бы следующую настоящую паузу. Условие критично.
- **`getCurrDownTime` может занижать буфер** (`BufferedTime.ts` `FIXME`, `:6`) — на стыке диапазонов вернёт `0`, что вызовет лишний цикл готовности. Не баг-блокер, но знайте.
- **`isLoadedMetaData` не сбрасывается** — сбросить его можно только пересозданием `ControlPlayer` (`updatePlayer`). При смене серии без `updatePlayer` логика прогрева сломалась бы.
- **`capture: true` только у `play`/`pause`** — остальные события в фазе всплытия. Если перевести `seeking` в capture, поведение относительно скриптов Rezka изменится.
- **Оверлей перехватывает только пробел** (`OverlayLoader.ts:88-93`) — клики по таймлайну во время блокировки UI частично «прикрыты» прозрачным `overlay`-слоем (`:65-75`), но это визуальная, а не жёсткая блокировка.

---

## 11. ⚠️ Не трогайте флаги без понимания

Флаги `isManualPlay` / `isManualPause` / `isManualSeek` / `isBlockPause` / `isSkipWaiting` (и фазовые `isLoadedMetaData` / `isFirstStart`) — это **тонкая защита от гонок и эхо-циклов с нативным `<video>`** (это же предупреждение зафиксировано в `Sync-Mate-Extension/CLAUDE.md`, раздел «ControlPlayer — флаги»).

Конкретные риски при «упрощении»:

- Убрать выставление флага перед программным действием → его событие уйдёт на сервер → сервер разошлёт обратно → **бесконечный цикл** play/pause/seek.
- Сбрасывать флаг не в том обработчике (или раньше времени) → флаг «проглотит» следующее **настоящее** пользовательское действие, и оно не уйдёт в комнату.
- Снять `isBlockPause` раньше `remove_block_pause` → пользователь снимет паузу до готовности остальных → рассинхрон.
- Изменить порядок проверок в `onUserPlay`/`onSeeking` → ломается приоритет «эхо → фаза → блок → реальное действие».

Любая правка здесь обязана проверяться на **обе стороны** WS-протокола (см. `handler.py` + `models.py`) и желательно вручную с двумя клиентами.

---

## См. также

- [`../CLAUDE.md`](../CLAUDE.md) — гид по расширению; раздел «ControlPlayer — флаги» (краткая версия §6) и «Архитектура — Coordinator-паттерн».
- [`../../CLAUDE.md`](../../CLAUDE.md) — корневой гид по монорепозиторию Sync-Mate; правило «любое изменение WS-сообщения затрагивает обе части».
- [`../../DOCUMENTATION.md`](../../DOCUMENTATION.md) — полная техническая документация и контракт WS-протокола. ⚠️ Раздел про деплой частично устарел (в `docker-compose.yml` сейчас **один** сервис — `cloudflared` удалён в коммите `f0c7443`; CI гоняется **только на Python 3.13**). Доверяйте коду/конфигам, а не этому файлу в части деплоя.
- [`../../Sync-Mate-API-WS/CLAUDE.md`](../../Sync-Mate-API-WS/CLAUDE.md) — гид по бэкенду (вторая сторона протокола).
- [`../../Sync-Mate-API-WS/docs/architecture.md`](../../Sync-Mate-API-WS/docs/architecture.md) — серверная логика готовности комнаты (`check_is_loaded`, §8.3) и WS-цикл.
- Исходники этой подсистемы: `src/features/player/PlayerCoordinator.ts`, `src/features/player/services/ControlPlayer.ts`, `src/features/player/services/EventListeners.ts`, `src/features/player/utills/BufferedTime.ts`, `src/features/room/RoomCoordinator.ts`, `src/ui/components/OverlayLoader.ts`.
- Серверная сторона play/pause/seek/готовности: `Sync-Mate-API-WS/app/modules/room/handler.py` + `Sync-Mate-API-WS/app/modules/room/models.py`.
