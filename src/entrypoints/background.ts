import { browser, defineBackground } from "#imports";
import { onMessage } from "@/shared/messaging";
import { BrowserMessageTypes } from "@/shared/constants/message-types";
import { parseUrls, parseUrl } from "@/shared/utils/parseUrl";
import { getItem, setItem } from "@/shared/storage";
import { generateNickname } from "@/shared/utils/nickname";

type RoomState = Record<string, unknown>;

// Сохраняем комнаты в session storage — MV3 Service Worker может быть выгружен
// в любой момент, и обычный модульный Record при этом обнуляется.
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

async function saveRooms(rooms: Record<number, RoomState>): Promise<void> {
    const sessionStorage = (browser.storage as any).session;
    if (sessionStorage) {
        await sessionStorage.set({ rooms });
    }
}

async function updateRoom(tabId: number, patch: RoomState): Promise<RoomState> {
    const rooms = await loadRooms();
    rooms[tabId] = { ...(rooms[tabId] || {}), ...patch };
    await saveRooms(rooms);
    return rooms[tabId];
}

// noinspection JSUnusedGlobalSymbols
export default defineBackground(() => {
    console.log("Background running...");

    getItem("name").then((name) => {
        if (!name)
            setItem("name", generateNickname()).then(() =>
                console.log("Nickname created!"),
            );
    });

    onMessage(async (msg, sender) => {
        const tabId = msg.activeTabId ?? sender.tab?.id;
        if (!tabId) return { error: "No tab" };
        switch (msg.type) {
            case BrowserMessageTypes.GET_ROOM: {
                const rooms = await loadRooms();
                console.log("Message get room:", rooms[tabId]);
                return rooms[tabId];
            }
            case BrowserMessageTypes.SET_ROOM: {
                const rooms = await loadRooms();
                rooms[tabId] = msg.room;
                await saveRooms(rooms);
                console.log("Message set room:", rooms[tabId]);
                return { success: true };
            }
            case BrowserMessageTypes.ADD_TO_ROOM: {
                const merged = await updateRoom(tabId, msg.room);
                console.log("Message add to room:", merged);
                return { success: true };
            }
            default:
                return { error: "Unknown message" };
        }
    });

    browser.webRequest.onBeforeRequest.addListener(
        (details) => {
            const tabId = details.tabId;
            if (tabId < 0) return;

            const roomDetails = parseUrl(details.url);
            if (!roomDetails) return;

            // Fire-and-forget — webRequest listener должен возвращать синхронно.
            updateRoom(tabId, roomDetails).catch((e) =>
                console.error("Failed to persist room state:", e),
            );
            return undefined;
        },
        { urls: parseUrls },
    );

    browser.tabs.onRemoved.addListener(async (tabId) => {
        const rooms = await loadRooms();
        if (rooms[tabId]) {
            delete rooms[tabId];
            await saveRooms(rooms);
        }
    });
});
