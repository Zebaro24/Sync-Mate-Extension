import { BrowserMessageTypes } from "@/shared/constants/message-types";
import { WSMessageTypes } from "./model/messageTypes";
import type WebSocketClient from "./sockets/WebSocketClient";
import type RoomService from "./services/RoomService";
import type ParseInfo from "./utills/ParseInfo";
import type { RoomResponse } from "./types/dtos";

import type PlayerCoordinator from "@/features/player/PlayerCoordinator";

import { sendMessage } from "@/shared/messaging";
import { getItem } from "@/shared/storage";
import { API_URL } from "@/shared/constants/api";
import { waitForElement } from "@/shared/utils/waitForElement";
import { createLogger } from "@/shared/logger";

import type InfoPanel from "@/ui/components/InfoPanel";
import type StatusBox from "@/ui/components/StatusBox";

interface UI {
    infoPanel: InfoPanel;
    statusBox: StatusBox;
    parseInfo: ParseInfo;
}

const log = createLogger("Room");

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
        const roomId = await this.getStoredRoomId();
        log.debug("init: stored roomId =", roomId);

        if (!roomId) {
            log.debug("init: нет сохранённой комнаты → показываем Create room");
            this.showCreateRoom();
            return;
        }

        // Перед подключением убеждаемся, что комната ещё жива (NAV-2). Иначе
        // цеплялись бы к мёртвой/чужой комнате после рестарта API или смены фильма.
        let room: RoomResponse | null = null;
        try {
            room = await this.service.getRoom(roomId);
        } catch (e) {
            // 404 — комнаты нет: предлагаем создать новую и не подключаемся.
            // Сетевые сбои/5xx считаем временными — поведение как раньше: пробуем
            // подключиться, дальше решит WS (close 4000) и цикл реконнекта.
            const status = (e as { response?: { status?: number } })?.response
                ?.status;
            if (status === 404) {
                log.warn("комната не найдена (404) — нужна новая");
                this.showCreateRoom();
                return;
            }
            log.warn(
                "не удалось проверить комнату (трактуем как временный сбой)",
                e,
            );
        }

        // Комната жива, но её видео не совпадает с текущей страницей — значит мы
        // перешли на другой фильм. Подключаемся и переводим комнату на новое
        // видео (NAV-1). От циклов защищает сравнение URL: тот, кто пришёл по
        // set_video, уже находится на нужном адресе и ничего не отправит.
        const shouldSetVideo =
            !!room &&
            this.isRezkaUrl(location.href) &&
            !this.isSameVideo(room.video_url, location.href);

        log.debug("init: shouldSetVideo =", shouldSetVideo, {
            roomVideo: room?.video_url,
            here: location.href,
        });
        const connected = await this.connect(roomId);
        if (connected && shouldSetVideo) {
            log.debug("переводим комнату на новое видео", location.href);
            this.socket.send({
                type: WSMessageTypes.SET_VIDEO,
                video_url: location.href,
            });
        }
    }

    // GET_ROOM может упасть, если service worker ещё спит ("Receiving end does
    // not exist") — без обёртки это unhandled rejection и комната не стартует.
    // Делаем один короткий ретрай (SW успевает проснуться), затем трактуем как
    // «комнаты нет» — вызывающий покажет создание комнаты.
    private async getStoredRoomId(): Promise<string | null> {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const { roomId } =
                    (await sendMessage({
                        type: BrowserMessageTypes.GET_ROOM,
                    })) ?? {};
                return roomId ?? null;
            } catch (e) {
                log.warn("GET_ROOM не ответил (SW спит?), попытка", attempt, e);
                if (attempt === 0) {
                    await new Promise<void>((resolve) =>
                        setTimeout(resolve, 200),
                    );
                }
            }
        }
        return null;
    }

    private showCreateRoom() {
        this.ui.statusBox.setText("Create room");
        this.ui.statusBox.onClick(this.createRoom.bind(this));
    }

    // Считаем URL валидным источником, только если это сама Rezka по https.
    private isRezkaUrl(raw: string): boolean {
        try {
            const u = new URL(raw);
            return u.protocol === "https:" && u.hostname === "rezka.ag";
        } catch {
            return false;
        }
    }

    // Сравниваем видео по origin+pathname: у Rezka идентичность фильма задаёт
    // путь, а смена эпизода/перевода идёт через AJAX и URL не меняет. Если что-то
    // не парсится — считаем «то же видео», чтобы не отправить set_video впустую.
    private isSameVideo(a: string, b: string): boolean {
        try {
            const ua = new URL(a);
            const ub = new URL(b);
            return ua.origin + ua.pathname === ub.origin + ub.pathname;
        } catch {
            return true;
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
        // Освобождаем InfoPanel: отписываем MutationObserver и убираем панель из DOM.
        this.ui.infoPanel.dispose();
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
            // Запись в буфер может быть отклонена (нет фокуса/политика страницы).
            // Без обработки это unhandled rejection и пользователь не знает,
            // скопировалась ли ссылка (WS-7) — даём короткий фидбэк в StatusBox.
            try {
                await navigator.clipboard.writeText(
                    new URL(link, API_URL).href,
                );
                this.ui.statusBox.setText("Скопировано");
            } catch (e) {
                log.warn("не удалось скопировать ссылку в буфер", e);
                this.ui.statusBox.setText("Скопируйте ссылку вручную");
            }
            log.debug("комната создана:", roomId);
            await sendMessage({
                type: BrowserMessageTypes.ADD_TO_ROOM,
                room: { roomId },
            });
            await this.connect(roomId);
        } catch (e) {
            this.ui.statusBox.setText("Error creating room");
            log.error("ошибка создания комнаты", e);
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

        log.debug("connect()", { roomId, name, isReconnect });
        let connected = false;
        try {
            connected = await this.socket.connect(roomId, name);
        } catch (e) {
            // Без try/catch таймаут/ошибка WS превращалась в unhandled promise rejection.
            log.error("WS connect failed:", e);
        }
        log.debug("connect() result =", connected);

        if (!connected) {
            // При реконнекте статусом управляет цикл переподключения.
            if (!isReconnect) {
                this.ui.statusBox.setText("Error connecting");
                // Клик повторяет подключение к ТОЙ ЖЕ комнате (WS-5), а не создаёт
                // новую — иначе комната терялась и требовалось два клика. При
                // неуспехе connect снова повесит этот же обработчик.
                this.ui.statusBox.onClick(() => {
                    this.ui.statusBox.setText("Подключение…");
                    this.connect(roomId);
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
        log.debug("dispatch", data.type, data);
        switch (data.type) {
            case WSMessageTypes.INFO:
                this.ui.infoPanel.updateInformation(
                    data.name,
                    data.downloaded_time,
                );
                break;
            case WSMessageTypes.PLAY:
                this.ui.infoPanel.setLastAction("▶ Воспроизведение");
                this.playerCoordinator.play();
                break;
            case WSMessageTypes.PAUSE:
                this.ui.infoPanel.setLastAction("⏸ Пауза");
                this.playerCoordinator.pause();
                break;
            case WSMessageTypes.SEEK:
                this.playerCoordinator.seek(data.current_time);
                break;
            case WSMessageTypes.REMOVE_BLOCK_PAUSE:
                this.playerCoordinator.setIsBlockPause(false);
                break;
            case WSMessageTypes.SET_VIDEO: {
                // Навигируем только на валидный https-URL самой Rezka и только
                // если он отличается от текущего — иначе зациклимся на set_video.
                if (
                    this.isRezkaUrl(data.video_url) &&
                    data.video_url !== location.href
                ) {
                    log.debug("set_video → navigating:", data.video_url);
                    window.location.href = data.video_url;
                } else {
                    log.debug(
                        "set_video проигнорирован (невалидный URL или тот же)",
                        data.video_url,
                    );
                }
                break;
            }
            default:
                log.warn("неизвестный тип WS-сообщения:", data.type);
        }
    }

    private handleWsClose(evt: CloseEvent) {
        // Намеренное закрытие (dispose/выход пользователя) — реконнект не нужен.
        if (this.intentionalClose) {
            log.debug("close: намеренное закрытие — реконнект не нужен");
            return;
        }

        log.warn("close (аварийное) code=", evt.code, "→ обработка реконнекта");
        this.playerCoordinator.disable();
        this.clearSubscriptions();

        // 4000 — комната не найдена / сервер перезапущен: реконнектиться некуда.
        if (evt.code === 4000) {
            log.warn(
                "close 4000: комната закрыта/сервер перезапущен — реконнекта нет",
            );
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

        log.debug("реконнект запланирован через", this.reconnectDelay, "мс");
        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            const roomId = this.roomId;
            if (this.intentionalClose || !roomId) return;

            log.debug("реконнект: попытка к", roomId);
            const ok = await this.connect(roomId, true);
            if (ok) {
                // Переподключились — просим комнату пересинхронизировать позицию.
                log.debug("реконнект успешен → load для пересинхронизации");
                this.reconnectDelay = 1000;
                this.socket.send({
                    type: WSMessageTypes.LOAD,
                    current_time: this.getCurrentTime(),
                });
            } else {
                // Не вышло — следующая попытка с увеличенной задержкой (cap 30s).
                this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
                log.warn(
                    "реконнект не удался → новая задержка",
                    this.reconnectDelay,
                );
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
        log.debug("вкладка снова видима → load для пересинхронизации");
        this.socket.send({
            type: WSMessageTypes.LOAD,
            current_time: this.getCurrentTime(),
        });
    }

    private handleStatus(data: any) {
        this.socket.send(data);
        // Сервер свой info обратно не присылает — показываем собственный буфер
        // в панели рядом с участниками, с пометкой «(вы)».
        if (this.name && typeof data.downloaded_time === "number") {
            this.ui.infoPanel.updateInformation(
                `${this.name} (вы)`,
                data.downloaded_time,
            );
        }
    }

    private async handleInfo() {
        // При смене эпизода/перевода Rezka заменяет <video> новым элементом.
        // Ждём его появления, иначе переинициализируем плеер на старый/пустой узел.
        log.debug("смена эпизода/перевода — ждём новый <video>");
        const v = await waitForElement("video");
        if (!v) {
            log.warn("video не появился после смены эпизода/перевода");
            return;
        }

        log.debug("новый <video> найден → переинициализация плеера");
        this.playerCoordinator.updatePlayer();
        this.playerCoordinator.enable();

        this.socket.send(this.ui.parseInfo.parse());
    }
}
