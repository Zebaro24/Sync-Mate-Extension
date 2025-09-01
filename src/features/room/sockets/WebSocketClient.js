const WS_URL = import.meta.env.WXT_WS_URL;

export default class WebSocketClient {
    constructor() {
        this._ws = null;
    }

    async connect(roomId, name) {
        if (this._ws && this._ws.readyState === WebSocket.OPEN) {
            console.warn("WS is already connected");
            return true;
        }
        return new Promise((resolve, reject) => {
            this._ws = new WebSocket(`${WS_URL}/${roomId}`);

            const timeout = setTimeout(() => reject(new Error("WS connection timeout ❌")), 5000);

            this._ws.addEventListener("open", () => {
                console.log("WS connected ✅");
                this.send({type: "connect", name: name})
            });

            const removeAuthMessageHandler = this.onMessage((data) => {
                if (data.type === "connect") {
                    if (data.message === "success") {
                        clearTimeout(timeout);
                        console.log("WS authentication completed ✅");
                        removeAuthMessageHandler();
                        resolve(true);
                    }
                }
            })

            const removeCloseHandler = this.onClose(() => {
                clearTimeout(timeout);
                console.log("WS unable to connect ❌");
                resolve(false);
                removeCloseHandler();
            })

            const authErrorHandler = (err) => {
                clearTimeout(timeout);
                this._ws.removeEventListener("error", authErrorHandler);
                reject(err);
            }
            this._ws.addEventListener("error", authErrorHandler);
        });
    }

    disconnect() {
        if (this._ws) {
            try {
                this._ws.close();
            } catch {
            }
            this._ws = null;
        }
    }

    send(obj) {
        if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
        this._ws.send(JSON.stringify(obj));
    }

    onMessage(handler) {
        if (!this._ws) throw new Error("WebSocket is not connected");

        const listener = (evt) => {
            try {
                const data = JSON.parse(evt.data);
                handler(data);
            } catch (e) {
                console.error("Bad WS message", e);
            }
        };

        this._ws.addEventListener("message", listener);

        return () => this._ws.removeEventListener("message", listener);
    }

    onClose(handler) {
        if (!this._ws) throw new Error("WebSocket is not connected");

        const listener = (evt) => {
            console.log("Disconnected ❌");
            console.log("Code:", evt.code);
            console.log("Reason:", evt.reason);
            handler(evt);
        };

        this._ws.addEventListener("close", listener);

        return () => this._ws.removeEventListener("close", listener);
    }
}