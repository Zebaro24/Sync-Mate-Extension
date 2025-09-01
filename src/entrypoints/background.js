import {browser} from '#imports';
import {onMessage, BrowserMessageTypes} from "@/shared/messaging";
import {parseUrls, parseIdUrl} from "@/shared/utils/parseUrl";


// noinspection ALL
export default defineUnlistedScript(() => {
    console.log("Background running...")

    const roomIds = {};
    onMessage(async (msg, sender) => {
        if (!sender.tab) return {error: "No tab"};
        switch (msg.type) {
            case BrowserMessageTypes.GET_ROOM_ID: {
                return {roomId: roomIds[sender.tab.id]};
            }
            case BrowserMessageTypes.SET_ROOM_ID: {
                roomIds[sender.tab.id] = msg.roomId;
                return {"success": true};
            }
            default:
                return {error: "Unknown message"};
        }
    });

    browser["webRequest"].onBeforeRequest.addListener(
        (details) => {
            const roomId = parseIdUrl(details.url);
            if (!roomId) return;
            roomIds[details.tabId] = roomId;
        },
        {urls: parseUrls},
    );
});