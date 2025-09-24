import { browser, defineBackground } from "#imports";
import { onMessage, BrowserMessageTypes } from "@/shared/messaging";
import { parseUrls, parseUrl } from "@/shared/utils/parseUrl";
import { getItem, setItem } from "@/shared/storage";
import { generateNickname } from "@/shared/utils/nickname";

// noinspection JSUnusedGlobalSymbols
export default defineBackground(() => {
    console.log("Background running...");

    getItem("name").then((name) => {
        if (!name)
            setItem("name", generateNickname()).then(() =>
                console.log("Nickname created!"),
            );
    });

    const rooms: Record<number, any> = {};
    onMessage(async (msg, sender) => {
        const tabId = msg.activeTabId ?? sender.tab?.id;
        if (!tabId) return { error: "No tab" };
        switch (msg.type) {
            case BrowserMessageTypes.GET_ROOM: {
                console.log("Message get room:", rooms[tabId]);
                return rooms[tabId];
            }
            case BrowserMessageTypes.SET_ROOM: {
                rooms[tabId] = msg.room;
                console.log("Message set room:", rooms[tabId]);
                return { success: true };
            }
            case BrowserMessageTypes.ADD_TO_ROOM: {
                rooms[tabId] = {
                    ...(rooms[tabId] || {}),
                    ...msg.room,
                };
                console.log("Message add to room:", rooms[tabId]);
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

            rooms[tabId] = {
                ...(rooms[tabId] || {}),
                ...roomDetails,
            };
            return undefined;
        },
        { urls: parseUrls },
    );
});
