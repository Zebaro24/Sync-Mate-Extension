import {StatusBox, OverlayLoader} from "./UIIntegrate";


const MSG_TYPES = {
    GET_ROOM_ID: "GET_ROOM_ID",
    SET_ROOM_ID: "SET_ROOM_ID",
};

const URLS = {
    API_URL: import.meta.env.WXT_API_URL || "http://127.0.0.1:8000/api/",
    WS_URL: import.meta.env.WXT_WS_URL || "ws://127.0.0.1:8000/ws/",
};

export default class Room {
    constructor(controlPlayer) {
        this.controlPlayer = controlPlayer;

        this.statusBox = new StatusBox();
        this.socket = null;

        this.initRoom();
    }

    initRoom() {
        const onMessage = (msg) => {
            if (msg.roomId) {
                this.connect(msg.roomId);
            } else {
                this.prepareRoomCreation();
            }
            browser.runtime.onMessage.removeListener(onMessage);
        };

        browser.runtime.onMessage.addListener(onMessage);
        browser.runtime.sendMessage({type: MSG_TYPES.GET_ROOM_ID});
    }

    prepareRoomCreation() {
        this.statusBox.changeText("Create room");
        this.statusBox.onClickHandler = this.createRoom.bind(this);
    }

    connect(roomId) {
        this.disconnect();

        this.socket = new WebSocket(`${URLS.WS_URL}/${roomId}`);

        this.socket.addEventListener("open", () => {
            console.log("Connected ✅");
            this.statusBox.changeText("Connected ✅");
            browser.storage.local.get("name", (result) => {
                if (!result.name) result.name = "Guest"
                this.socket.send(JSON.stringify({type: "connect", name: result.name}));
            });
        });

        this.socket.addEventListener("message", this.messageHandler);

        this.socket.addEventListener("close", (event) => {
            this.controlPlayer.setSendStatusFunc(() => {
            })
            console.log("Disconnected ❌");
            console.log("Code:", event.code);
            console.log("Reason:", event.reason);
            if (event.code === 4000) {
                this.disconnect()
                this.prepareRoomCreation();
            }
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }

    async createRoom() {
        try {
            const response = await fetch(`${URLS.API_URL}/room/create`, {
                method: "POST",
            });

            if (!response.ok) {
                return Promise.reject(new Error("Ошибка сети: " + response.status));
            }

            const data = await response.json();

            browser.runtime.sendMessage({
                type: MSG_TYPES.SET_ROOM_ID,
                roomId: data["room_id"],
            });

            this.connect(data["room_id"]);
        } catch (error) {
            console.error("Ошибка запроса:", error);
        }
    }

    messageHandler = (event) => {
        console.log("Message:", event.data);

        const data = JSON.parse(event.data);
        if (data.type === "connect") {
            if (data.message === "success") {
                this.controlPlayer.setSendStatusFunc(this.sendStatus.bind(this));
            }
        } else if (data.type === "play") {
            this.controlPlayer.play();
        } else if (data.type === "pause") {
            this.controlPlayer.pause();
        } else if (data.type === "seek") {
            this.controlPlayer.seek(data.current_time);
        } else if (data.type === "remove_block_pause") {
            this.controlPlayer.setIsBlockPause(false);
        }
    };

    sendStatus(type = "status") {
        console.log("Send", type, this.controlPlayer.player.currentTime)
        this.send({
            type: type,
            current_time: Math.round(this.controlPlayer.player.currentTime * 1000) / 1000,
            downloaded_time: Math.round(this.controlPlayer.bufferedTime.getCurrDownTime(this.controlPlayer.player.currentTime) * 1000) / 1000
        })
    }

    send(data) {
        this.socket.send(JSON.stringify(data));
    }
}
