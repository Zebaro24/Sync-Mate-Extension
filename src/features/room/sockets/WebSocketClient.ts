import { WSMessageTypes } from "../model/messageTypes";
import { setItem } from "@/shared/storage";
import Promise from "lie";

type WSMessage<T extends WSMessageTypes = WSMessageTypes> = {
    type: T;
    [key: string]: any;
};

const WS_URL = import.meta.env.WXT_WS_URL;

export default class WebSocketClient {
    private ws: WebSocket | null = null;

    async connect(roomId: string, name: string) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.warn("WS is already connected");
            return true;
        }
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(`${WS_URL}/${roomId}`);

            const timeout = setTimeout(
                () => reject(new Error("WS connection timeout ❌")),
                5000,
            );

            this.ws.addEventListener("open", () => {
                console.log("WS connected ✅");
                this.send({ type: WSMessageTypes.CONNECT, name: name });
            });

            const removeAuthMessageHandler = this.onMessage((data) => {
                if (data.type === "connect") {
                    setItem("id", data["id"]);
                    clearTimeout(timeout);
                    console.log("WS authentication completed ✅");
                    removeAuthMessageHandler();
                    resolve(true);
                }
            });

            const removeCloseHandler = this.onClose(() => {
                clearTimeout(timeout);
                console.log("WS unable to connect ❌");
                resolve(false);
                removeCloseHandler();
            });

            const authErrorHandler = (err: Event) => {
                clearTimeout(timeout);
                this.ws?.removeEventListener("error", authErrorHandler);
                reject(err);
            };
            this.ws.addEventListener("error", authErrorHandler);
        });
    }

    disconnect() {
        if (this.ws) {
            try {
                this.ws.close();
            } catch (err) {
                console.error("Ошибка при закрытии WebSocket:", err);
            } finally {
                this.ws = null;
            }
        }
    }

    send<T extends WSMessageTypes>(obj: WSMessage<T>) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        this.ws.send(JSON.stringify(obj));
    }

    onMessage(handler: (data: any) => void) {
        if (!this.ws) throw new Error("WebSocket is not connected");

        const listener = (evt: MessageEvent) => {
            try {
                const data = JSON.parse(evt.data);
                handler(data);
            } catch (e) {
                console.error("Bad WS message", e);
            }
        };

        this.ws.addEventListener("message", listener);

        return () => this.ws?.removeEventListener("message", listener);
    }

    onClose(handler: (evt: CloseEvent) => void) {
        if (!this.ws) throw new Error("WebSocket is not connected");

        const listener = (evt: CloseEvent) => {
            console.log("Disconnected ❌");
            console.log("Code:", evt.code);
            console.log("Reason:", evt.reason);
            handler(evt);
        };

        this.ws.addEventListener("close", listener);

        return () => this.ws?.removeEventListener("close", listener);
    }
}
