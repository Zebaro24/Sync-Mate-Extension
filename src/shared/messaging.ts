import { BrowserMessageTypes } from "@/features/room/model/messageTypes";
import type { Browser } from "#imports";
import { browser } from "#imports";
import Promise from "lie";

export { BrowserMessageTypes };

type BrowserMessage = { type: BrowserMessageTypes } & Record<string, any>;

export function sendMessage<R = any>(message: BrowserMessage): Promise<R> {
    return new Promise((resolve, reject) => {
        browser.runtime.sendMessage(message, (resp: R) => {
            const err = browser.runtime.lastError;
            if (err) reject(err);
            else resolve(resp);
        });
    });
}

export function onMessage<R = any>(
    handler: (
        msg: BrowserMessage,
        sender: Browser.runtime.MessageSender,
    ) => R | Promise<R>,
): () => void {
    const wrapped = (
        msg: BrowserMessage,
        sender: Browser.runtime.MessageSender,
        sendResponse: (
            res?:
                | R
                | {
                      error: string;
                  },
        ) => void,
    ) => {
        try {
            const maybePromise = handler(msg, sender);

            if (
                maybePromise &&
                typeof maybePromise === "object" &&
                "then" in maybePromise
            ) {
                (maybePromise as Promise<R>)
                    .then(sendResponse)
                    .catch((e) => sendResponse({ error: String(e) }));
                return true;
            }

            sendResponse(maybePromise as R);
        } catch (e: any) {
            sendResponse({ error: String(e) });
        }
    };
    browser.runtime.onMessage.addListener(wrapped);
    return () => browser.runtime.onMessage.removeListener(wrapped);
}
