import {useEffect, useState} from "react";

import {browser} from "#imports";

import {sendMessage} from "@/shared/messaging.js";
import {getItem} from "@/shared/storage.js";
import {deepCompare} from "@/shared/utils/deepCompare.js";
import {formatTime} from "@/shared/utils/time.js";
import RoomService from "@/features/room/services/RoomService.js";
import {BrowserMessageTypes} from "@/features/room/model/messageTypes.js";

import {UserList} from "./User.jsx";


export default function Room() {
    const [room, setRoom] = useState(null);

    useEffect(() => {
        (async () => {
            const data = await getRoomInfo();
            setRoom(data);
        })();
    }, []);

    return (
        <div className="w-[350px]">
            {!room ? (
                <div className="text-white">Загрузка...</div>
            ) : (
                <>
                    <header
                        className="flex justify-center items-center gap-2 border-b-2 border-white/10 p-2 mb-2">
                        <img
                            src={browser.runtime.getURL("icon/48.png")}
                            alt="App icon"
                            className="w-8 h-8"
                        />
                        <h2 className="text-2xl font-bold text-white">
                            Room: {room.name}
                        </h2>
                    </header>

                    <UserList users={room.users}/>
                </>
            )}
        </div>
    );
}

async function getRoomInfo() {
    const activeTabId = (await browser["tabs"].query({active: true, currentWindow: true}))[0]?.id;
    if (!activeTabId) return null;
    console.log("Active tab id:", activeTabId);

    const {roomId} = (await sendMessage({type: BrowserMessageTypes.GET_ROOM, activeTabId: activeTabId})) ?? {};
    if (!roomId) return null;
    console.log("RoomId:", roomId);

    const roomService = new RoomService()
    const room_response = await roomService.getRoom(roomId)
    if (!room_response) return null;

    const id = await getItem("id");
    const meUser = room_response.users.find(user => user["user_id"] === id);

    const users = room_response.users.map(user => {
        return {
            name: user.name,
            downloadTime: formatTime(user.downloaded_time),
            translator: user.info.translator,
            episode: user.info.episode && `S:${user.info.season} E:${user.info.episode}`,
            synchronized: deepCompare(meUser, user, ["user_id", "name", "downloaded_time", "info.translator", "info.url"]),
            isMe: user["user_id"] === id,
        }
    })

    return {
        name: room_response.name,
        users: users,
    };
}
