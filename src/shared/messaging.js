import {browser} from '#imports';
import {BrowserMessageTypes} from "@/features/room/model/messageTypes.js";

export {BrowserMessageTypes};


export function sendMessage(message) {
    return new Promise((resolve, reject) => {
        try {
            browser.runtime.sendMessage(message, (resp) => {
                const err = browser.runtime.lastError;
                if (err) reject(err); else resolve(resp);
            });
        } catch (e) {
            reject(e);
        }
    });
}

export function onMessage(handler) {
    const wrapped = (msg, sender, sendResponse) => {
        const maybePromise = handler(msg, sender);
        if (maybePromise && typeof maybePromise.then === "function") {
            maybePromise.then(sendResponse).catch((e) => sendResponse({error: String(e)}));
            return true;
        }
        sendResponse(maybePromise);
        return undefined;
    };
    browser.runtime.onMessage.addListener(wrapped);
    return () => browser.runtime.onMessage.removeListener(wrapped);
}