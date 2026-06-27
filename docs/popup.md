# Popup (React) — справочник

Полный разбор всплывающего окна расширения: монтирование, дерево компонентов, работа с TanStack Query, IPC с background и подводные камни смены никнейма.

---

## 1. Что такое popup и зачем он нужен

Popup — это HTML-страница, которую браузер показывает при клике на иконку расширения в тулбаре (`manifest.type=browser_action`, см. `src/entrypoints/popup/index.html:7`). В отличие от content-скрипта, который живёт на странице Rezka и управляет плеером, popup — это **отдельный React-документ в своём изолированном окне**. У него нет прямого доступа ни к DOM Rezka, ни к WebSocket-сессии; всё, что он знает о текущей комнате, он получает двумя путями:

1. **IPC к background** (`browser.runtime.sendMessage`) — узнаёт `roomId` активной вкладки;
2. **REST к бэкенду** (`roomApi.get`) — подтягивает актуальное состояние комнаты по этому `roomId`.

То есть popup — это «панель наблюдателя»: он отображает список участников, статус комнаты, ссылку-приглашение и позволяет переименовать комнату/сменить ник. Управление синхронизацией плеера в popup **не происходит** — это зона content-скрипта и `RoomCoordinator`.

---

## 2. Монтирование

### 2.1. HTML-точка входа

`src/entrypoints/popup/index.html`:

```html
<body>
<div id="root"></div>
<script type="module" src="main.tsx"></script>
</body>
```

- `#root` — контейнер React-дерева (`index.html:10`).
- `<script type="module" src="main.tsx">` — WXT/Vite сам подменяет `main.tsx` на собранный бандл при билде (`index.html:11`).
- `<title>Sync-Mate</title>` и `<meta name="manifest.type" content="browser_action"/>` — WXT по этому мета-тегу понимает, что HTML нужно зарегистрировать как `action.default_popup` в манифесте MV3 (`index.html:6-7`).

### 2.2. React createRoot + StrictMode

`src/entrypoints/popup/main.tsx`:

```ts
const rootElement = document.getElementById("root")!;
const root = ReactDOM.createRoot(rootElement);

root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
```

- Используется **новый React 19 API** `ReactDOM.createRoot` (`main.tsx:7`), а не устаревший `ReactDOM.render`.
- `document.getElementById("root")!` — non-null assertion; если `#root` пропадёт из `index.html`, упадёт здесь (`main.tsx:6`).
- `<React.StrictMode>` (`main.tsx:10`) — в dev-режиме включает двойной вызов рендеров/эффектов и `queryFn`. Это важно помнить: при `npm run dev` запрос комнаты и `useEffect` в `RoomContainer` могут вызваться дважды — это **ожидаемое поведение StrictMode**, не баг. В production-сборке двойного вызова нет.
- `import "./style.css"` (`main.tsx:4`) подключает Tailwind.

### 2.3. Стили

`src/entrypoints/popup/style.css` — одна строка:

```css
@import "tailwindcss";
```

Это **Tailwind CSS 4** (директива `@import`, а не старые `@tailwind base/...`). Tailwind применяется **только** к popup; на странице Rezka content-скрипт инлайнит стили вручную (см. `Sync-Mate-Extension/CLAUDE.md`, раздел «Стили»). Утилитарные классы (`bg-white/4`, `text-[10px]`, `from-[#03001C]` и т.п.) встречаются по всему дереву popup.

---

## 3. App — корневой компонент

`src/entrypoints/popup/App.tsx`:

```ts
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 0,
        },
    },
});

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <div className="min-h-screen bg-gradient-to-b from-[#03001C] to-[#15001C] text-white flex items-center justify-center p-3">
                <div className="rounded-2xl shadow-2xl bg-white/4 backdrop-blur-lg border border-white/8 w-[380px] overflow-hidden">
                    <RoomContainer />
                </div>
            </div>
        </QueryClientProvider>
    );
}
```

Что важно:

| Деталь | Где | Зачем |
|---|---|---|
| `QueryClient` создаётся **на уровне модуля** | `App.tsx:4` | Один клиент на жизнь popup. Popup пересоздаётся каждый раз при открытии, поэтому кэш не переживает закрытие окна. |
| `staleTime: 0` | `App.tsx:7` | Данные считаются устаревшими сразу → любой повторный маунт/фокус сразу инициирует рефетч. Вместе с `refetchInterval` (см. §5) даёт «живой» список. |
| Тёмный градиент `#03001C → #15001C` | `App.tsx:15` | Фон совпадает с фирменным макетом (`Шаблон.png`). |
| Карточка **фиксированной ширины `w-[380px]`** | `App.tsx:16` | Popup в Chromium берёт ширину из контента; фиксированные 380px дают стабильный размер окна. `overflow-hidden` обрезает углы под `rounded-2xl`. |
| Единственный потомок — `<RoomContainer />` | `App.tsx:17` | Вся логика делегирована контейнеру из feature-слоя. |

`RoomContainer` импортируется напрямую из feature-слоя: `@/features/room/components/containers/room-container` (`App.tsx:2`).

---

## 4. Дерево компонентов

```
main.tsx
└── <StrictMode>
    └── App                         (popup/App.tsx) — QueryClientProvider + layout
        └── RoomContainer           (features/room/components/containers/room-container.tsx)
            ├── RoomSkeleton         (skeletons/room-skeleton.tsx)        ← isLoading
            │   └── UserCardSkeleton (×3)
            │       └── Skeleton     (shared/components/ui/skeleton.tsx)
            ├── ErrorState           (локальный в room-container.tsx)     ← error
            ├── EmptyState           (локальный в room-container.tsx)     ← !room
            └── (нормальный рендер):
                ├── RoomHeader       (ui/room-header.tsx)
                ├── UserList         (ui/user-list.tsx)
                │   └── UserCard     (ui/user-card.tsx)  — по одному на участника
                │       └── Badge    (shared/components/ui/badge.tsx)  — эпизод/переводчик
                ├── Footer           (инлайн в room-container.tsx) — ник + «Сменить ник»
                └── EditModal        (ui/edit-modal.tsx) ×2 — комната / ник (по флагу)
```

### 4.1. Re-export «полки» в `popup/components` (legacy-совместимость)

Исторически компоненты лежали в `popup/components`, потом переехали в feature-слой. Оставлены тонкие re-export'ы, чтобы старые импорты не сломались:

| Файл | Содержимое | Реальное место |
|---|---|---|
| `popup/components/Room.tsx` | `export { RoomContainer as default }` | `features/room/components/containers/room-container` (`Room.tsx:2`) |
| `popup/components/User.tsx` | `export { UserCard as User }`, `export { UserList }` | `features/room/components/ui/{user-card,user-list}` (`User.tsx:2-3`) |
| `popup/types/room.ts` | `export type { UserViewModel as User, RoomViewModel as RoomInfo }` | `features/room/types/view-models` (`types/room.ts:2-5`) |

> Эти три файла — чистые алиасы, без своей логики. Менять компоненты нужно по **реальному** пути в `features/room`, а не здесь.

### 4.2. SetName — осиротевший компонент

`src/entrypoints/popup/components/SetName.tsx` — самостоятельная форма ввода имени с кнопкой «Случайное» (генератор `Прилагательное-Животное`, `SetName.tsx:63-91`). **Грепом по проекту он нигде не импортируется** (единственное вхождение `SetName` — само определение в этом файле). Это мёртвый код от прежнего флоу «введите имя при первом запуске». Сейчас ник генерируется автоматически в background (`generateNickname`, `background.ts:41-46`) и редактируется через `EditModal`. Документируется для полноты; **в актуальном дереве popup не участвует**.

> Внимание на расхождение: `SetName` генерирует ник на **русском** (`Быстрый-Тигр`), а активный генератор — `@/shared/utils/nickname::generateNickname` (другой источник). Не путать.

---

## 5. RoomContainer — оркестратор popup

`src/features/room/components/containers/room-container.tsx`. Это «умный» компонент: дёргает данные, держит локальное UI-состояние, разруливает три состояния загрузки и рендерит модалки.

### 5.1. Состояние и хуки

```ts
const queryClient = useQueryClient();
const { data: room, isLoading, error, refetch } = useRoom();

const [nickname, setNickname] = useState<string>("");
const [editingRoomName, setEditingRoomName] = useState(false);
const [editingNickname, setEditingNickname] = useState(false);

useEffect(() => {
    getItem("name").then((n) => setNickname((n as string) ?? ""));
}, []);
```

- `useRoom()` (`room-container.tsx:70`) — главный источник данных (§6).
- `nickname` (`:72`) — текущий ник из `storage.local`, подгружается один раз в `useEffect` (`:76-78`). Показывается в футере (`:124`).
- `editingRoomName` / `editingNickname` (`:73-74`) — флаги открытия двух модалок `EditModal`.

### 5.2. Мутации (TanStack Query)

```ts
const updateRoomName = useMutation({
    mutationFn: (name: string) => roomApi.update(room!.id, { name }),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["room"] });
        setEditingRoomName(false);
    },
});

const updateNickname = useMutation({
    mutationFn: async (name: string) => {
        await setItem("name", name);
        return name;
    },
    onSuccess: (name) => {
        setNickname(name);
        setEditingNickname(false);
    },
});
```

| Мутация | Что делает | Куда пишет | После успеха |
|---|---|---|---|
| `updateRoomName` (`:80-86`) | PATCH `/rooms/{id}` с `{ name }` | **на бэкенд** (REST, `roomApi.update`) | инвалидирует кэш `["room"]` → немедленный рефетч; закрывает модалку |
| `updateNickname` (`:88-97`) | пишет `name` в `storage.local` | **локально** (`setItem`) | обновляет локальный `nickname`; закрывает модалку. **Кэш `["room"]` НЕ инвалидируется** — см. §8 |

Асимметрия принципиальна: имя комнаты — серверное состояние (видят все), ник — клиентская настройка, которая применится только при следующем `connect`.

### 5.3. Порядок ранних возвратов (guard clauses)

```ts
const myUser = room?.users.find((u) => u.isMe);

if (isLoading) return <RoomSkeleton />;
if (error)     return <ErrorState error={error} onRetry={() => refetch()} />;
if (!room)     return <EmptyState message="Комната не найдена." />;
```

Порядок важен (`:99-103`):

1. **`isLoading`** → `RoomSkeleton` (скелетон-заглушка, §7).
2. **`error`** → `ErrorState` (разные тексты по `error.message`, §5.4).
3. **`!room`** → `EmptyState` «Комната не найдена». На практике почти недостижимо: `retry: false` + `throw` в `queryFn` означают, что отсутствие комнаты приходит как `error` (`NO_ROOM`), а не как `data === undefined`. Это страховочная ветка.

`myUser` вычисляется до возвратов — используется в модалке ника (`initialValue={myUser?.name ?? nickname}`, `:149`).

### 5.4. ErrorState — маппинг ошибок

`ErrorState` (`room-container.tsx:29-66`) различает `error.message`:

| `error.message` | Текст | Иконка/цвет | Кнопка «Повторить» |
|---|---|---|---|
| `"NO_TAB"` | «Не удалось определить активную вкладку.» | rose | нет |
| `"NO_ROOM"` | «Вы не в комнате. Перейдите на Rezka…» | violet (нейтральнее) | нет |
| прочее | `Ошибка: {message}` | rose | **есть** (`onRetry → refetch`) |

`NO_ROOM` оформлен фиолетовым (не «ошибка», а «нормальная ситуация — вы просто не в комнате»). Кнопка «Повторить» показывается только для неизвестных ошибок (`:55`), потому что для `NO_TAB`/`NO_ROOM` повтор бессмыслен — нужно действие пользователя.

### 5.5. EmptyState

`EmptyState` (`:18-27`) — иконка фильма + серый текст. Используется как fallback `!room` и потенциально для прочих «пусто»-сценариев. Текст приходит пропом `message`.

### 5.6. Footer и две модалки

Футер (`:121-133`) показывает текущий ник (`nickname || "Guest"`) и кнопку «Сменить ник», открывающую `editingNickname`.

Модалки (`:135-156`) рендерятся **условно** по флагам:

```ts
{editingRoomName && (
    <EditModal title="Название комнаты" initialValue={room.name}
        isLoading={updateRoomName.isPending}
        onSave={(name) => updateRoomName.mutate(name)}
        onClose={() => setEditingRoomName(false)} />
)}

{editingNickname && (
    <EditModal title="Ваш никнейм" initialValue={myUser?.name ?? nickname}
        note="Новый ник применится при следующем подключении (перезагрузите страницу…)."
        isLoading={updateNickname.isPending}
        onSave={(name) => updateNickname.mutate(name)}
        onClose={() => setEditingNickname(false)} />
)}
```

У модалки ника есть `note` с предупреждением про reload (`:151`) — единственное место в UI, где пользователю объясняют caveat из §8.

---

## 6. useRoom — загрузка состояния комнаты

`src/features/room/hooks/use-room.ts`. Это сердце данных popup.

### 6.1. Сигнатура запроса

```ts
export function useRoom() {
    return useQuery<RoomViewModel, Error>({
        queryKey: ["room"],
        queryFn: fetchCurrentRoom,
        retry: false,
        refetchInterval: 5_000,
    });
}
```

| Опция | Значение | Смысл |
|---|---|---|
| `queryKey` | `["room"]` | единственный ключ; по нему идёт `invalidateQueries` в мутации имени комнаты |
| `queryFn` | `fetchCurrentRoom` | см. §6.2 |
| `retry` | `false` (`use-room.ts:67`) | при `throw` (NO_TAB/NO_ROOM/сетевая) **не ретраить** — сразу показать `ErrorState`. Иначе «Вы не в комнате» висело бы со спиннером. |
| `refetchInterval` | `5_000` (`:69`) | каждые 5 c обновлять список: новые участники, их `current_time`, статус синхронизации. Вместе со `staleTime: 0` (из `App`) даёт near-realtime без WS в самом popup. |

> В popup нет WebSocket — «живость» достигается коротким polling'ом раз в 5 секунд.

### 6.2. fetchCurrentRoom — пошаговый разбор

`use-room.ts:12-62`. Что происходит при каждом запросе:

1. **Найти активную вкладку** (`:13-17`):
   ```ts
   const tabs = await browser.tabs.query({ active: true, currentWindow: true });
   const tabId = tabs[0]?.id;
   if (!tabId) throw new Error("NO_TAB");
   ```
   Popup не знает «свою» вкладку — берёт активную в текущем окне. Нет вкладки → `NO_TAB`.

2. **Спросить у background `roomId` этой вкладки** (`:20-26`):
   ```ts
   const { roomId } = (await sendMessage({
       type: BrowserMessageTypes.GET_ROOM,
       activeTabId: tabId,
   })) ?? {};
   if (!roomId) throw new Error("NO_ROOM");
   ```
   Это **единственный канал popup → background** (см. §9). `?? {}` страхует от `undefined` (если для вкладки нет записи, background вернёт `undefined`). Нет `roomId` → `NO_ROOM`.

3. **Параллельно: GET комнаты с бэкенда + чтение своего `id`** (`:28-31`):
   ```ts
   const [{ data: roomData }, myId] = await Promise.all([
       roomApi.get(roomId),
       getItem("id") as Promise<string | undefined>,
   ]);
   ```
   `roomApi.get` → `apiClient.get<RoomResponse>("/rooms/{roomId}")` (axios, baseURL `API_URL`). `myId` — UUID, который сервер вернул при `connect` и который content-скрипт/RoomCoordinator сохранил в `storage.local` под ключом `"id"`.

4. **Найти себя среди участников** (`:33`):
   ```ts
   const meUser = roomData.users.find((u) => u.user_id === myId);
   ```
   Может быть `undefined`, если текущий пользователь ещё не успел подключиться/нет `id`.

5. **Смаппить `RoomResponse` (DTO) → `RoomViewModel`** (`:35-61`). Преобразования:

   | Поле VM | Источник | Преобразование |
   |---|---|---|
   | `id` | `roomData.room_id` | как есть |
   | `name` | `roomData.name` | как есть |
   | `status` | `roomData.status` | строка `waiting`/`playing`/`paused`/`pausing` |
   | `link` | `roomData.link` | `new URL(roomData.link, API_URL).href` — относительная ссылка резолвится в абсолютную против `API_URL` (`:39`) |
   | `videoUrl` | `roomData.video_url` | как есть |
   | `users[]` | `roomData.users[]` | маппинг каждого (ниже) |

   Для каждого `user` (`:41-60`):

   | Поле VM | Источник | Преобразование |
   |---|---|---|
   | `id` | `user.user_id` | |
   | `name` | `user.name` | |
   | `downloadTime` | `user.downloaded_time` (сек) | `formatTime()` → `"M:SS"` |
   | `currentTime` | `user.current_time` (сек) | `formatTime()` → `"M:SS"` |
   | `translator` | `user.info?.translator` | `?? null` |
   | `episode` | `user.info?.episode` | если есть → `` `S${season} E${episode}` ``, иначе `null` (`:47-49`) |
   | `synchronized` | сравнение с `meUser` | `deepCompare(...)` (ниже) |
   | `isMe` | `user.user_id === myId` | |

6. **Вычисление `synchronized`** (`:50-58`) — насколько участник «совпадает» со мной:
   ```ts
   synchronized: meUser
       ? deepCompare(meUser, user, [
             "user_id", "name", "downloaded_time",
             "info.translator", "info.url",
         ])
       : false,
   ```
   `deepCompare` (`shared/utils/deepCompare.ts`) рекурсивно сериализует оба объекта в JSON, **игнорируя** перечисленные ключи (поддерживает вложенные через точку, напр. `info.translator`). То есть «синхронизирован» = совпадают все поля, **кроме** идентичности (`user_id`, `name`), прогресса скачивания (`downloaded_time`) и `info.translator`/`info.url`. Грубо — сравниваются позиция/состояние воспроизведения и эпизод. Если `meUser` нет (я ещё не в списке) — все `synchronized = false`.

   > Тонкость: `meUser` сам себя тоже проходит через `deepCompare(meUser, meUser, …)` → всегда `true`, поэтому я в списке всегда «синхронизирован».

### 6.3. Типы DTO ↔ VM

- DTO (с бэка): `RoomResponse`, `UserResponse` — `features/room/types/dtos.ts`. Snake_case, времена в **секундах (number)**.
- VM (для UI): `RoomViewModel`, `UserViewModel` — `features/room/types/view-models.ts`. camelCase, времена — **строки `"M:SS"`**, плюс производные `synchronized`/`isMe`/`episode`.

Маппинг живёт **только** в `fetchCurrentRoom`; компоненты получают уже готовый VM.

---

## 7. Скелетоны и shared-UI

### 7.1. RoomSkeleton

`features/room/components/skeletons/room-skeleton.tsx`. Рендерится, пока `isLoading`. Повторяет геометрию реального экрана:

- шапка с двумя строками-заглушками + «кнопка» (`:19-27`);
- список из **трёх** `UserCardSkeleton` (`:29-35`, `[1,2,3].map`);
- футер (`:37-40`).

`UserCardSkeleton` (`:3-14`) — аватар-круг + две строки текста + правый значок, мимикрия под `UserCard`.

### 7.2. Skeleton (shared)

`shared/components/ui/skeleton.tsx` — примитив:

```ts
export function Skeleton({ className = "" }: SkeletonProps) {
    return <div className={`animate-pulse rounded-lg bg-white/8 ${className}`} />;
}
```

Чистый «мерцающий прямоугольник»; форма/размер задаются через `className`.

### 7.3. Badge (shared)

`shared/components/ui/badge.tsx` — пилюля с цветовым вариантом (`green|blue|purple|red|gray|indigo`, по умолчанию `gray`). В `UserCard` используется `indigo` для эпизода и `blue` для переводчика (`user-card.tsx:65,68`).

---

## 8. UI-компоненты комнаты

### 8.1. RoomHeader

`features/room/components/ui/room-header.tsx`. Props: `name`, `status`, `usersCount`, `link`, `onEditName`.

- **Статус-бейдж** через `statusConfig` (`:17-42`) — словарь `waiting/playing/paused/pausing` → `{ label, color, dot, pulse? }`. `playing` единственный с `pulse: true` (мигающая точка, `:30`). Неизвестный статус → серый fallback с самим значением как лейблом (`:53-57`).
- **Кнопка переименования** появляется по hover группы (`opacity-0 group-hover:opacity-100`, `:75`) и зовёт `onEditName`.
- **Копирование ссылки** (`:59-63`): `navigator.clipboard.writeText(link)` → флаг `copied` на 2 секунды меняет кнопку «Ссылка» → «Готово» с галочкой.
- **Плюрализация участников** (`:93-98`): `1 → участник`, `2–4 → участника`, `≥5 → участников`. Простое правило без обработки `11/21` и т.п. — для маленьких комнат достаточно.

### 8.2. UserList

`features/room/components/ui/user-list.tsx`. Props: `users`, `onEditNickname`.

- Пустой список → плашка «Нет участников» (`:11-18`).
- Иначе `<ul>` с прокруткой `max-h-[55vh] overflow-y-auto` (`:21`) — длинный список не разорвёт popup.
- `onEditNickname` пробрасывается в `UserCard` **только для `isMe`** (`:26`): `user.isMe ? onEditNickname : undefined`. У чужих карточек кнопки редактирования нет.

### 8.3. UserCard

`features/room/components/ui/user-card.tsx`. Props: `user: UserViewModel`, `onEditNickname?`.

- **Аватар-градиент** детерминирован по имени: `getAvatarGradient` (`:20-25`) суммирует коды символов имени `% 6` и берёт градиент из `AVATAR_GRADIENTS`. Один и тот же ник → всегда тот же цвет. Инициалы — первые 2 символа в upper-case (`:47`).
- **Подсветка себя**: при `user.isMe` карточка с фиолетовым фоном/бордером + бейдж «вы» (`:39,56-60`).
- **Метаданные** (`:63-78`): `Badge` эпизода (если есть), `Badge` переводчика (если есть), `currentTime` (иконка часов), `downloadTime` (иконка загрузки).
- **Кнопка ника** показывается только если `isMe && onEditNickname` (`:83-91`), по hover.
- **Индикатор синхронизации** (`:92-102`): `synchronized` → зелёный `CheckCircleIcon`, иначе бледно-розовый `XCircleIcon` (с `title`).

### 8.4. EditModal

`features/room/components/ui/edit-modal.tsx`. Универсальная модалка для «Название комнаты» и «Ваш никнейм».

Props:

```ts
interface EditModalProps {
    title: string;
    initialValue: string;
    placeholder?: string;
    note?: string;
    isLoading?: boolean;
    onSave: (value: string) => void;
    onClose: () => void;
}
```

Поведение:

- **Автофокус + выделение** текста при открытии (`useEffect` → `inputRef.focus()/select()`, `:26-29`).
- **Submit** (`:31-35`): `value.trim()`, сохраняет только непустое (`if (trimmed) onSave(trimmed)`).
- **Escape** закрывает (`handleKeyDown`, `:37-39`); клик по затемнённому фону тоже (`onClick` с проверкой `e.target === e.currentTarget`, `:44`).
- `maxLength={50}` на инпуте (`:67`).
- **`note`** рендерится мелким текстом под полем (`:70-74`) — используется для предупреждения про reload у ника.
- **Дисейбл кнопки «Сохранить»** (`:85`): `disabled={isLoading ?? !value.trim()}`. Тонкость оператора `??`: если `isLoading` передан (даже `false`), берётся именно он; `!value.trim()` срабатывает **только** когда `isLoading === undefined`. В `RoomContainer` `isLoading` передаётся всегда (`updateRoomName.isPending` / `updateNickname.isPending`), поэтому в проде кнопка дисейблится **по факту выполнения мутации**, а не по пустоте поля. При `isLoading` лейбл становится `"..."` (`:88`).

---

## 9. Связь с background — IPC через BrowserMessageTypes

> Не путать `BrowserMessageTypes` (внутренний IPC расширения) и `WSMessageTypes` (WebSocket-протокол с сервером). Popup использует **только** первый.

### 9.1. Enum

`shared/constants/message-types.ts`:

```ts
export enum BrowserMessageTypes {
    GET_ROOM,    // 0
    SET_ROOM,    // 1
    ADD_TO_ROOM, // 2
}
```

Это **числовой** enum (значения 0/1/2). Popup посылает **только `GET_ROOM`**; `SET_ROOM`/`ADD_TO_ROOM` шлёт content-скрипт / `RoomCoordinator`.

### 9.2. Транспорт — sendMessage

`shared/messaging.ts:9-17` — обёртка над `browser.runtime.sendMessage`, возвращающая `Promise`:

```ts
export function sendMessage<R = any>(message: BrowserMessage): Promise<R> {
    return new Promise((resolve, reject) => {
        browser.runtime.sendMessage(message, (resp) => {
            const err = browser.runtime.lastError;
            if (err) reject(err);
            else resolve(resp);
        });
    });
}
```

### 9.3. Обработка в background

`entrypoints/background.ts:48-72`. На `GET_ROOM`:

```ts
const tabId = msg.activeTabId ?? sender.tab?.id;   // popup передаёт activeTabId явно
if (!tabId) return { error: "No tab" };
...
case BrowserMessageTypes.GET_ROOM: {
    const rooms = await loadRooms();   // из browser.storage.session
    return rooms[tabId];               // RoomState | undefined
}
```

Ключевые моменты:

- Popup **обязан** передавать `activeTabId` (`use-room.ts:23`), потому что у сообщения от popup нет `sender.tab` (popup — не вкладка). Background это учитывает: `msg.activeTabId ?? sender.tab?.id` (`background.ts:49`).
- State комнат хранится в **`browser.storage.session`** (`loadRooms`, `:12-21`), а не в обычной переменной — MV3 Service Worker может выгрузиться и обнулить модульный `Record`.
- Запись по вкладке создаётся из `webRequest`-листенера (парсинг URL комнаты, `:74-89`) и чистится по `tabs.onRemoved` (`:91-97`).
- Возврат `rooms[tabId]` может быть `undefined` → в `fetchCurrentRoom` это превращается в `NO_ROOM` (через `?? {}` и проверку `roomId`).

### 9.4. Полный путь данных (popup ← → весь стек)

```
[Popup]  useRoom → fetchCurrentRoom
   │ 1. browser.tabs.query(active) → tabId
   │ 2. sendMessage(GET_ROOM, {activeTabId})  ──runtime──▶  [Background SW]
   │                                                          loadRooms() ← storage.session
   │ 3. ◀── { roomId, ... }  ───────────────────────────────┘
   │ 4. roomApi.get(roomId) ──HTTP GET /rooms/{id}──▶  [Бэкенд FastAPI]
   │    getItem("id")        ← storage.local
   │ 5. ◀── RoomResponse ────────────────────────────────────┘
   └─ map → RoomViewModel → React-дерево
```

Параллельно `RoomCoordinator` (в content-скрипте) держит **живой WebSocket** с тем же бэкендом и шлёт background `SET_ROOM`/`ADD_TO_ROOM`. Popup в этом WS-канале **не участвует** — он лишь читает агрегированный REST-снимок.

---

## 10. Caveat: смена никнейма (storage.local меняется, активная WS-сессия — нет)

Самая частая «почему не работает» в popup. Разбор:

1. Пользователь жмёт «Сменить ник» → `EditModal` → `updateNickname.mutate(newName)`.
2. Мутация делает **только** `setItem("name", newName)` — пишет в `storage.local` (`room-container.tsx:88-91`).
3. `onSuccess` обновляет локальный `nickname` (футер сразу показывает новый ник) и закрывает модалку.

Но:

- **Активная WS-сессия использует имя, переданное в момент `connect`.** Content-скрипт/`RoomCoordinator` берут ник из `storage.local` **один раз** при установлении WebSocket-соединения и шлют его в `{"type":"connect","name":"..."}`. Сервер хранит это имя за пользователем до переподключения.
- Поэтому в списке участников (который приходит по REST из серверного состояния) **ваш старый ник останется**, пока вы не переподключитесь.
- Именно поэтому:
  - `updateNickname` **не инвалидирует** `["room"]` (рефетч ничего бы не изменил — на сервере старое имя);
  - в `EditModal` ника задан `note`: *«Новый ник применится при следующем подключении (перезагрузите страницу или подключитесь к комнате заново)»* (`room-container.tsx:151`).

**Как применить новый ник:** перезагрузить вкладку Rezka (или заново зайти в комнату) — тогда content-скрипт переподключит WebSocket и отправит `connect` с обновлённым именем.

> Та же логика отражена в корневом `CLAUDE.md`: «Никнейм меняется в `storage.local`, но активная WS-сессия использует имя, переданное при `connect`. Чтобы обновить — пользователь должен перезагрузить страницу.»

В `UserCard` для своей карточки берётся `myUser?.name` (серверное имя), а в футере — локальный `nickname`. До reload эти два значения могут **расходиться** — это ожидаемо и есть прямое следствие caveat.

---

## 11. Краткие гочи (чек-лист)

- **StrictMode в dev** удваивает `queryFn`/`useEffect` — не пугаться двойных запросов комнаты при `npm run dev`.
- **`retry: false`** — любая ошибка `fetchCurrentRoom` сразу видна как `ErrorState`; «NO_ROOM» это норма, не баг.
- **`refetchInterval: 5_000` + `staleTime: 0`** — список обновляется каждые 5 c; WebSocket в popup нет.
- **`activeTabId` обязателен** в `GET_ROOM` из popup — без него background не найдёт вкладку.
- **`updateNickname` не трогает сервер** — только `storage.local`; нужен reload (см. §10).
- **`updateRoomName` инвалидирует `["room"]`** — имя комнаты серверное, рефетч обязателен.
- **`disabled={isLoading ?? !value.trim()}`** в `EditModal` — при переданном `isLoading` проверка пустоты поля не работает; полагаемся на `trim()` уже в `handleSubmit`.
- **`SetName.tsx` — мёртвый код**, не импортируется; не путать его русский генератор с актуальным `generateNickname`.
- **`Room.tsx` / `User.tsx` / `types/room.ts`** — re-export-алиасы; редактировать оригиналы в `features/room`.
- **Ширина popup `w-[380px]`** фиксирована в `App.tsx`; список юзеров скроллится в пределах `max-h-[55vh]`.

---

## См. также

- `Sync-Mate-Extension/CLAUDE.md` — гид по расширению (стек, Coordinator-паттерн, стили, что не делать).
- `Sync-Mate-Extension/docs/` — соседние справочники этого подпроекта (content-скрипт/`RoomCoordinator`, `WebSocketClient`, background, locators).
- `Sync-Mate-API-WS/docs/rest-api.md` — REST-контракт `/rooms` (GET/POST/PATCH/DELETE), на который опирается `roomApi`.
- `D:/Projects/Sync-Mate/CLAUDE.md` — общий гид по репозиторию (особенно про caveat никнейма и разделение `BrowserMessageTypes` ↔ `WSMessageTypes`).
- `D:/Projects/Sync-Mate/DOCUMENTATION.md` — полная техдокументация и WS-протокол (учитывать, что часть про деплой устарела — доверять конфигам, а не доку).
