/* global browser */
// noinspection ALL
export default defineUnlistedScript(() => {
    console.log("Background running...")

    const MSG_TYPES = {
        GET_ROOM_ID: "GET_ROOM_ID",
        SET_ROOM_ID: "SET_ROOM_ID",
    };

    let roomIds = {};
    browser.runtime.onMessage.addListener((msg, sender) => {
        if (msg.type === MSG_TYPES.GET_ROOM_ID && sender.tab) {
            browser.tabs.sendMessage(sender.tab.id, {roomId: roomIds[sender.tab.id]});
        } else if (msg.type === MSG_TYPES.SET_ROOM_ID && sender.tab) {
            roomIds[sender.tab.id] = msg.roomId;
        }
    });

    browser.webRequest.onBeforeRequest.addListener(
        (details) => {
            // ловим URL с query до редиректа
            const url = new URL(details.url);
            const roomIdNew = url.searchParams.get("room_id");
            if (!roomIdNew) return;
            console.log(roomIdNew)
            roomIds[details.tabId] = roomIdNew;
        },
        {urls: ["https://rezka.ag/*"]},
    );
});