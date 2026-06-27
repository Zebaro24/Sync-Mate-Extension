import { browser, defineBackground } from "#imports";
import { onMessage } from "@/shared/messaging";
import { BrowserMessageTypes } from "@/shared/constants/message-types";
import { parseUrls, parseUrl } from "@/shared/utils/parseUrl";
import { getItem, setItem } from "@/shared/storage";
import { generateNickname } from "@/shared/utils/nickname";
import { createLogger } from "@/shared/logger";

const log = createLogger("BG");

type RoomState = Record<string, unknown>;

// Сериализуем read-modify-write над storage.session 'rooms', чтобы параллельные
// записи (webRequest, SET_ROOM, tabs.onRemoved) не затирали друг друга.
let writeChain: Promise<unknown> = Promise.resolve();

function withRoomsLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = writeChain.then(fn, fn);
    writeChain = run.catch(() => {});
    return run as Promise<T>;
}

// Сохраняем комнаты в session storage — MV3 Service Worker может быть выгружен
// в любой момент, и обычный модульный Record при этом обнуляется. Если session
// недоступен (старый Firefox/мобильный) — падаем на local, иначе запись молча
// теряется и после reload всегда показывается «Create room».
let warnedSessionFallback = false;

function getRoomsStorage() {
    const storage = browser.storage as any;
    if (storage.session) return storage.session;
    if (!warnedSessionFallback) {
        warnedSessionFallback = true;
        log.warn(
            "Sync-Mate: storage.session недоступен — используем storage.local",
        );
    }
    return storage.local;
}

async function loadRooms(): Promise<Record<number, RoomState>> {
    const stored = (await getRoomsStorage().get("rooms")) as {
        rooms?: Record<number, RoomState>;
    };
    return stored.rooms ?? {};
}

async function saveRooms(rooms: Record<number, RoomState>): Promise<void> {
    await getRoomsStorage().set({ rooms });
}

async function updateRoom(tabId: number, patch: RoomState): Promise<RoomState> {
    return withRoomsLock(async () => {
        const rooms = await loadRooms();
        rooms[tabId] = { ...(rooms[tabId] || {}), ...patch };
        await saveRooms(rooms);
        return rooms[tabId];
    });
}

// Гарантирует единственный ник пользователя: если он уже есть в storage —
// возвращаем его, иначе генерируем, дожидаемся записи (await) и возвращаем.
// Промис кэшируется, чтобы параллельные вызовы не сгенерировали два разных имени.
let namePromise: Promise<string> | null = null;

function getOrCreateName(): Promise<string> {
    if (!namePromise) {
        namePromise = (async () => {
            const existing = await getItem("name");
            if (existing) return existing;
            const name = generateNickname();
            await setItem("name", name);
            return name;
        })();
    }
    return namePromise;
}

// noinspection JSUnusedGlobalSymbols
export default defineBackground(() => {
    log.debug("Background running...");

    // Гарантируем наличие ника при старте — атомарно, без гонки и двойной генерации.
    getOrCreateName().then((name) => log.debug("Nickname ready:", name));

    onMessage(async (msg, sender) => {
        const tabId = msg.activeTabId ?? sender.tab?.id;
        log.debug("IPC сообщение:", msg.type, "tab", tabId);
        if (!tabId) return { error: "No tab" };
        switch (msg.type) {
            case BrowserMessageTypes.GET_ROOM: {
                const rooms = await loadRooms();
                log.debug("Message get room:", rooms[tabId]);
                return rooms[tabId];
            }
            case BrowserMessageTypes.SET_ROOM: {
                const room = await withRoomsLock(async () => {
                    const rooms = await loadRooms();
                    rooms[tabId] = msg.room;
                    await saveRooms(rooms);
                    return rooms[tabId];
                });
                log.debug("Message set room:", room);
                return { success: true };
            }
            case BrowserMessageTypes.ADD_TO_ROOM: {
                const merged = await updateRoom(tabId, msg.room);
                log.debug("Message add to room:", merged);
                return { success: true };
            }
            default:
                log.warn("Неизвестное IPC сообщение:", msg.type);
                return { error: "Unknown message" };
        }
    });

    browser.webRequest.onBeforeRequest.addListener(
        (details) => {
            const tabId = details.tabId;
            if (tabId < 0) return;

            let roomDetails: ReturnType<typeof parseUrl>;
            try {
                roomDetails = parseUrl(details.url);
            } catch (e) {
                log.error("Failed to parse URL:", e);
                return;
            }
            if (!roomDetails) return;

            log.debug("webRequest: сохраняем состояние комнаты для tab", tabId);
            // Fire-and-forget — webRequest listener должен возвращать синхронно.
            updateRoom(tabId, roomDetails).catch((e) =>
                log.error("Failed to persist room state:", e),
            );
            return undefined;
        },
        // Парсим только навигации (main_frame), а не каждый подресурс страницы.
        { urls: parseUrls, types: ["main_frame"] },
    );

    browser.tabs.onRemoved.addListener(async (tabId) => {
        await withRoomsLock(async () => {
            const rooms = await loadRooms();
            if (rooms[tabId]) {
                log.debug("tab закрыт — чистим комнату", tabId);
                delete rooms[tabId];
                await saveRooms(rooms);
            }
        });
    });
});
