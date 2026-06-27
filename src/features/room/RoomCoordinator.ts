import { BrowserMessageTypes } from "@/shared/constants/message-types";
import { WSMessageTypes } from "./model/messageTypes";
import type WebSocketClient from "./sockets/WebSocketClient";
import type RoomService from "./services/RoomService";
import type ParseInfo from "./utills/ParseInfo";

import type PlayerCoordinator from "@/features/player/PlayerCoordinator";

import { sendMessage } from "@/shared/messaging";
import { getItem } from "@/shared/storage";
import { API_URL } from "@/shared/constants/api";

import type OverlayLoader from "@/ui/components/OverlayLoader";
import type InfoPanel from "@/ui/components/InfoPanel";
import type StatusBox from "@/ui/components/StatusBox";

interface UI {
    infoPanel: InfoPanel;
    overlayLoader: OverlayLoader;
    statusBox: StatusBox;
    parseInfo: ParseInfo;
}

export default class RoomCoordinator {
    private socket: WebSocketClient;
    private service: RoomService;
    private ui: UI;
    private playerCoordinator: PlayerCoordinator;

    private unsub: (() => void)[] = [];

    // Параметры сессии — нужны для переподключения при аварийном close.
    private roomId: string | null = null;
    private name: string | null = null;
    private intentionalClose = false;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectDelay = 1000;

    constructor(
        socket: WebSocketClient,
        service: RoomService,
        ui: UI,
        playerCoordinator: PlayerCoordinator,
    ) {
        this.socket = socket;
        this.service = service;
        this.ui = ui;
        this.playerCoordinator = playerCoordinator;
    }

    async init() {
        const { roomId } =
            (await sendMessage({ type: BrowserMessageTypes.GET_ROOM })) ?? {};
        console.log("RoomId:", roomId);

        if (roomId) {
            await this.connect(roomId);
        } else {
            this.ui.statusBox.setText("Create room");
            this.ui.statusBox.onClick(this.createRoom.bind(this));
        }
    }

    dispose() {
        // Помечаем закрытие намеренным — handleWsClose не должен реконнектиться.
        this.intentionalClose = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        // Сначала снимаем подписки, потом рвём сокет — иначе наш же close-листенер
        // отработает на собственном disconnect.
        this.clearSubscriptions();
        this.socket.disconnect();
    }

    private clearSubscriptions() {
        this.unsub.forEach((fn) => fn?.());
        this.unsub = [];
    }

    private async createRoom() {
        try {
            const userName = (await getItem("name")) || "Guest";
            const { room_id: roomId, link } = await this.service.createRoom(
                `${userName}'s room`,
                window.location.href,
            );
            navigator.clipboard
                .writeText(new URL(link, API_URL).href)
                .then(() => console.log("Room link copied to clipboard"));
            console.log("Room created:", roomId);
            await sendMessage({
                type: BrowserMessageTypes.ADD_TO_ROOM,
                room: { roomId },
            });
            await this.connect(roomId);
        } catch (e) {
            this.ui.statusBox.setText("Error creating room");
            console.error(e);
        }
    }

    private async connect(
        roomId: string,
        isReconnect = false,
    ): Promise<boolean> {
        // Сохраняем параметры сессии. При реконнекте имя берём прежнее —
        // активная WS-сессия живёт под именем, переданным при первом connect.
        this.roomId = roomId;
        let name: string;
        if (isReconnect && this.name) {
            name = this.name;
        } else {
            name = (await getItem("name")) || "Guest";
            this.name = name;
        }

        let connected = false;
        try {
            connected = await this.socket.connect(roomId, name);
        } catch (e) {
            // Без try/catch таймаут/ошибка WS превращалась в unhandled promise rejection.
            console.error("WS connect failed:", e);
        }

        if (!connected) {
            // При реконнекте статусом управляет цикл переподключения.
            if (!isReconnect) {
                this.ui.statusBox.setText("Error connecting");
                this.ui.statusBox.onClick(() => {
                    this.ui.statusBox.setText("Create room");
                    this.ui.statusBox.onClick(this.createRoom.bind(this));
                });
            }
            return false;
        }

        // Перед повторной подпиской чистим старые — иначе плодятся дубли.
        this.clearSubscriptions();

        this.unsub.push(this.socket.onMessage(this.handleWsMessage.bind(this)));
        this.unsub.push(this.socket.onClose(this.handleWsClose.bind(this)));

        // Возврат на вкладку: фоновая вкладка могла отстать от комнаты —
        // просим пересинхронизировать позицию.
        const onVisibility = this.handleVisibilityChange.bind(this);
        document.addEventListener("visibilitychange", onVisibility);
        this.unsub.push(() =>
            document.removeEventListener("visibilitychange", onVisibility),
        );

        this.unsub.push(
            this.playerCoordinator.onStatus(this.handleStatus.bind(this)),
        );

        this.socket.send(this.ui.parseInfo.parse());
        this.unsub.push(
            this.ui.parseInfo.setWatchInfo(this.handleInfo.bind(this)),
        );

        this.playerCoordinator.enable();

        this.ui.statusBox.setText("Connected ✅");
        return true;
    }

    private handleWsMessage(data: {
        [key: string]: any;
        type: WSMessageTypes;
    }) {
        switch (data.type) {
            case WSMessageTypes.INFO:
                this.ui.infoPanel.updateInformation(
                    data.name,
                    data.downloaded_time,
                );
                break;
            case WSMessageTypes.PLAY:
                this.playerCoordinator.play();
                break;
            case WSMessageTypes.PAUSE:
                this.playerCoordinator.pause();
                break;
            case WSMessageTypes.SEEK:
                this.playerCoordinator.seek(data.current_time);
                break;
            case WSMessageTypes.REMOVE_BLOCK_PAUSE:
                this.playerCoordinator.setIsBlockPause(false);
                break;
            case WSMessageTypes.SET_VIDEO: {
                // Навигируем только на валидный https-URL самой Rezka.
                const ok = (() => {
                    try {
                        const u = new URL(data.video_url);
                        return (
                            u.protocol === "https:" && u.hostname === "rezka.ag"
                        );
                    } catch {
                        return false;
                    }
                })();
                if (ok && data.video_url !== location.href) {
                    console.log("Room set_video → navigating:", data.video_url);
                    window.location.href = data.video_url;
                }
                break;
            }
        }
    }

    private handleWsClose(evt: CloseEvent) {
        // Намеренное закрытие (dispose/выход пользователя) — реконнект не нужен.
        if (this.intentionalClose) return;

        this.playerCoordinator.disable();
        this.clearSubscriptions();

        // 4000 — комната не найдена / сервер перезапущен: реконнектиться некуда.
        if (evt.code === 4000) {
            this.ui.statusBox.setText("Комната закрыта");
            this.ui.statusBox.onClick(this.createRoom.bind(this));
            return;
        }

        this.ui.statusBox.setText("Переподключение…");
        this.reconnectDelay = 1000;
        this.scheduleReconnect();
    }

    private scheduleReconnect() {
        if (this.intentionalClose || !this.roomId) return;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            const roomId = this.roomId;
            if (this.intentionalClose || !roomId) return;

            const ok = await this.connect(roomId, true);
            if (ok) {
                // Переподключились — просим комнату пересинхронизировать позицию.
                this.reconnectDelay = 1000;
                this.socket.send({
                    type: WSMessageTypes.LOAD,
                    current_time: this.getCurrentTime(),
                });
            } else {
                // Не вышло — следующая попытка с увеличенной задержкой (cap 30s).
                this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
                this.scheduleReconnect();
            }
        }, this.reconnectDelay);
    }

    private getCurrentTime(): number {
        const video = document.querySelector("video");
        return video ? video.currentTime : 0;
    }

    private handleVisibilityChange() {
        if (document.visibilityState !== "visible") return;
        this.socket.send({
            type: WSMessageTypes.LOAD,
            current_time: this.getCurrentTime(),
        });
    }

    private handleStatus(data: any) {
        this.socket.send(data);
    }

    private handleInfo() {
        console.log("Update player");
        this.playerCoordinator.updatePlayer();
        this.playerCoordinator.enable();

        this.socket.send(this.ui.parseInfo.parse());
    }
}
