import { BrowserMessageTypes, WSMessageTypes } from "./model/messageTypes";
import type WebSocketClient from "./sockets/WebSocketClient";
import type RoomService from "./services/RoomService";
import type ParseInfo from "./utills/ParseInfo";

import type PlayerCoordinator from "@/features/player/PlayerCoordinator";

import { sendMessage } from "@/shared/messaging";
import { getItem } from "@/shared/storage";

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
        this.socket.disconnect();
        this.unsub.forEach((fn) => fn?.());
        this.unsub = [];
    }

    private async createRoom() {
        try {
            // TODO: Add name for create room
            const { room_id: roomId, link } = await this.service.createRoom(
                "Name",
                window.location.href,
            );
            navigator.clipboard
                .writeText(import.meta.env.WXT_API_URL + link)
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

    private async connect(roomId: string) {
        const name = (await getItem("name")) || "Guest";
        const connected = await this.socket.connect(roomId, name);
        if (!connected) {
            this.ui.statusBox.setText("Error connecting");
            this.ui.statusBox.onClick(() => {
                this.ui.statusBox.setText("Create room");
                this.ui.statusBox.onClick(this.createRoom.bind(this));
            });
            return;
        }

        this.unsub.push(this.socket.onMessage(this.handleWsMessage.bind(this)));
        this.unsub.push(this.socket.onClose(this.handleWsClose.bind(this)));

        this.unsub.push(
            this.playerCoordinator.onStatus(this.handleStatus.bind(this)),
        );

        this.socket.send(this.ui.parseInfo.parse());
        this.unsub.push(
            this.ui.parseInfo.setWatchInfo(this.handleInfo.bind(this)),
        );

        this.playerCoordinator.enable();

        this.ui.statusBox.setText("Connected ✅");
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
        }
    }

    private handleWsClose() {
        this.playerCoordinator.disable();
        this.dispose();
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
