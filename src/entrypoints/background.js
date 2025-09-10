import {browser} from '#imports';
import {onMessage, BrowserMessageTypes} from "@/shared/messaging";
import {parseUrls, parseUrl} from "@/shared/utils/parseUrl";
import {getItem, setItem} from "@/shared/storage.js";
import {generateNickname} from "@/shared/utils/nickname.js";


// noinspection ALL
export default defineUnlistedScript(() => {
    console.log("Background running...")

    getItem("name").then(name => {
        if (!name) setItem("name", generateNickname()).then(() => console.log("Nickname created!"));
    })

    const rooms = {};
    onMessage(async (msg, sender) => {
        if (!sender.tab && !msg.activeTabId) return {error: "No tab"};
        switch (msg.type) {
            case BrowserMessageTypes.GET_ROOM: {
                if (msg.activeTabId) return rooms[msg.activeTabId];
                console.log("Message get room:", rooms[sender.tab.id])
                return rooms[sender.tab.id];
            }
            case BrowserMessageTypes.SET_ROOM: {
                rooms[sender.tab.id] = msg.room;
                console.log("Message set room:", rooms[sender.tab.id])
                return {"success": true};
            }
            case BrowserMessageTypes.ADD_TO_ROOM: {
                rooms[sender.tab.id] = {
                    ...(rooms[sender.tab.id] || {}),
                    ...msg.room,
                };
                console.log("Message add to room:", rooms[sender.tab.id])
                return {"success": true};
            }
            default:
                return {error: "Unknown message"};
        }
    });

    browser["webRequest"].onBeforeRequest.addListener(
        (details) => {
            const roomDetails = parseUrl(details.url);
            if (!roomDetails) return;
            rooms[details.tabId] = {
                ...(rooms[details.tabId] || {}),
                ...roomDetails,
            }
        },
        {urls: parseUrls},
    );
});