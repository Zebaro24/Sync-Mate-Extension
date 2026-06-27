import { WSMessageTypes } from "../model/messageTypes";
import { setItem } from "@/shared/storage";

type WSMessage<T extends WSMessageTypes = WSMessageTypes> = {
    type: T;
    [key: string]: any;
};

import { WS_URL } from "@/shared/constants/api";
import { createLogger } from "@/shared/logger";

const log = createLogger("WS");

export default class WebSocketClient {
    private ws: WebSocket | null = null;

    // Keep-alive: на паузе с полным буфером трафика нет, и Cloudflare режет
    // простаивающий WS примерно через 100с. Периодически шлём status, чтобы
    // соединение считалось активным.
    private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
    private static readonly KEEP_ALIVE_INTERVAL = 30000;

    async connect(roomId: string, name: string): Promise<boolean> {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            log.warn("already connected");
            return true;
        }
        log.debug("connecting", { roomId, name });
        return new Promise<boolean>((resolve) => {
            this.ws = new WebSocket(`${WS_URL}/${roomId}`);

            let settled = false;
            const finish = (ok: boolean) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                removeAuthMessageHandler();
                removeCloseHandler();
                this.ws?.removeEventListener("error", authErrorHandler);
                resolve(ok);
            };

            const timeout = setTimeout(() => {
                log.warn("connection timeout ❌");
                this.ws?.close();
                finish(false);
            }, 5000);

            this.ws.addEventListener("open", () => {
                log.debug("socket open ✅ — sending connect");
                this.send({ type: WSMessageTypes.CONNECT, name: name });
                this.startKeepAlive();
            });

            // Соединение закрылось — останавливаем keep-alive, чтобы не тикал впустую.
            this.ws.addEventListener("close", () => this.stopKeepAlive());

            const removeAuthMessageHandler = this.onMessage((data) => {
                if (data.type === "connect") {
                    // id привязан к комнате — иначе мультитаб перетирает чужой
                    setItem("id:" + roomId, data["id"]);
                    log.debug("auth completed ✅ id=", data["id"]);
                    finish(true);
                }
            });

            const removeCloseHandler = this.onClose(() => {
                log.warn("unable to connect ❌");
                finish(false);
            });

            const authErrorHandler = (err: Event) => {
                log.error("error during connect:", err);
                finish(false);
            };
            this.ws.addEventListener("error", authErrorHandler);
        });
    }

    disconnect() {
        this.stopKeepAlive();
        if (this.ws) {
            log.debug("disconnect requested");
            try {
                this.ws.close();
            } catch (err) {
                log.error("ошибка при закрытии:", err);
            } finally {
                this.ws = null;
            }
        }
    }

    private startKeepAlive() {
        this.stopKeepAlive();
        this.keepAliveTimer = setInterval(() => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
            this.send({
                type: WSMessageTypes.STATUS,
                current_time: 0,
                downloaded_time: 0,
            });
        }, WebSocketClient.KEEP_ALIVE_INTERVAL);
    }

    private stopKeepAlive() {
        if (this.keepAliveTimer) {
            clearInterval(this.keepAliveTimer);
            this.keepAliveTimer = null;
        }
    }

    send<T extends WSMessageTypes>(obj: WSMessage<T>) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            // Отправка в закрытый сокет — частый источник «потерянных» действий.
            log.debug("→ send skipped (socket not open)", obj?.type);
            return;
        }
        log.debug("→ send", obj?.type, obj);
        this.ws.send(JSON.stringify(obj));
    }

    onMessage(handler: (data: any) => void) {
        if (!this.ws) throw new Error("WebSocket is not connected");

        // Замыкаем текущий сокет: к моменту отписки this.ws уже может быть null.
        const ws = this.ws;
        const listener = (evt: MessageEvent) => {
            try {
                const data = JSON.parse(evt.data);
                log.debug("← recv", data?.type, data);
                handler(data);
            } catch (e) {
                log.error("bad WS message (not JSON)", e, evt.data);
            }
        };

        ws.addEventListener("message", listener);

        return () => ws.removeEventListener("message", listener);
    }

    onClose(handler: (evt: CloseEvent) => void) {
        if (!this.ws) throw new Error("WebSocket is not connected");

        // Замыкаем текущий сокет: к моменту отписки this.ws уже может быть null.
        const ws = this.ws;
        const listener = (evt: CloseEvent) => {
            log.debug(
                "disconnected ❌ code=",
                evt.code,
                "reason=",
                evt.reason || "(empty)",
            );
            handler(evt);
        };

        ws.addEventListener("close", listener);

        return () => ws.removeEventListener("close", listener);
    }
}
