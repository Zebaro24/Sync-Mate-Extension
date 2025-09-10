import {sendMessage} from "@/shared/messaging";
import {BrowserMessageTypes, WSMessageTypes} from "@/features/room/model/messageTypes";
import {getItem} from "@/shared/storage";

export default class RoomCoordinator {
    constructor(socket, service, ui, playerCoordinator) {
        this.socket = socket;
        this.service = service;
        this.ui = ui;
        this.playerCoordinator = playerCoordinator;

        this._unsub = [];
    }

    async init() {
        const {roomId} = (await sendMessage({type: BrowserMessageTypes.GET_ROOM})) ?? {};
        console.log("RoomId:", roomId);

        if (roomId) {
            await this._connect(roomId);
        } else {
            this.ui.statusBox.setText("Create room");
            this.ui.statusBox.onClick(this._createRoom.bind(this));
        }
    }

    dispose() {
        this.socket.disconnect();
        this._unsub.forEach((fn) => fn?.());
        this._unsub = [];
    }

    async _createRoom() {
        try {
            // TODO: Add name for create room
            const {room_id: roomId, link} = await this.service.createRoom("Name", window.location.href);
            navigator.clipboard.writeText(import.meta.env.WXT_API_URL + link).then(() => console.log("Room link copied to clipboard"));
            console.log("Room created:", roomId);
            await sendMessage({type: BrowserMessageTypes.ADD_TO_ROOM, room: {roomId}});
            await this._connect(roomId);
        } catch (e) {
            this.ui.statusBox.setText("Error creating room");
            console.error(e);
        }
    }

    async _connect(roomId) {
        const name = (await getItem("name")) || "Guest"
        const connected = await this.socket.connect(roomId, name)
        if (!connected) {
            this.ui.statusBox.setText("Error connecting");
            this.ui.statusBox.onClick(() => {
                this.ui.statusBox.setText("Create room");
                this.ui.statusBox.onClick(this._createRoom.bind(this));
            });
            return;
        }

        this._unsub.push(this.socket.onMessage(this._handleWsMessage.bind(this)));
        this._unsub.push(this.socket.onClose(this._handleWsClose.bind(this)));

        this._unsub.push(this.playerCoordinator.onStatus(this._handleStatus.bind(this)))

        this.playerCoordinator.enable();

        this.ui.statusBox.setText("Connected ✅");
    }

    _handleWsMessage(data) {
        switch (data.type) {
            case WSMessageTypes.INFO:
                this.ui.infoPanel.updateInformation(data.name, data.downloaded_time)
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

    _handleWsClose() {
        this.playerCoordinator.disable()
        this.dispose();
    }

    _handleStatus(data) {
        this.socket.send(data);
    }
}