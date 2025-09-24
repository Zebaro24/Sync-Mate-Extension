import { useEffect, useState } from "react";

import { browser } from "#imports";

import { sendMessage } from "@/shared/messaging";
import { getItem } from "@/shared/storage";
import { deepCompare } from "@/shared/utils/deepCompare";
import { formatTime } from "@/shared/utils/time";
import RoomService from "@/features/room/services/RoomService";
import { BrowserMessageTypes } from "@/features/room/model/messageTypes";

import { UserList } from "./User";
import type { RoomInfo } from "../types/room";

export default function Room() {
    const [room, setRoom] = useState<RoomInfo | null>(null);

    useEffect(() => {
        (async () => {
            const data = await getRoomInfo();
            if (!data) return;
            setRoom(data);
        })();
    }, []);

    return (
        <div className="w-[350px]">
            {!room ? (
                <div className="text-white">Загрузка...</div>
            ) : (
                <>
                    <header className="flex justify-center items-center gap-2 border-b-2 border-white/10 p-2 mb-2">
                        <img
                            src={browser.runtime.getURL("icon/48.png" as any)}
                            alt="App icon"
                            className="w-8 h-8"
                        />
                        <h2 className="text-2xl font-bold text-white">
                            Room: {room.name}
                        </h2>
                    </header>

                    <UserList users={room.users} />
                </>
            )}
        </div>
    );
}

async function getRoomInfo(): Promise<RoomInfo | null> {
    const activeTabId = (
        await browser["tabs"].query({ active: true, currentWindow: true })
    )[0]?.id;
    if (!activeTabId) return null;
    console.log("Active tab id:", activeTabId);

    const { roomId } =
        (await sendMessage({
            type: BrowserMessageTypes.GET_ROOM,
            activeTabId: activeTabId,
        })) ?? {};
    if (!roomId) return null;
    console.log("RoomId:", roomId);

    const roomService = new RoomService();
    const room_response = await roomService.getRoom(roomId);
    if (!room_response) return null;

    const id = await getItem("id");
    const meUser = room_response.users.find(
        (user: any) => user["user_id"] === id,
    );

    const users = room_response.users.map((user: any) => {
        return {
            name: user.name,
            downloadTime: formatTime(user.downloaded_time),
            translator: user.info.translator,
            episode:
                user.info.episode &&
                `S:${user.info.season} E:${user.info.episode}`,
            synchronized: deepCompare(meUser, user, [
                "user_id",
                "name",
                "downloaded_time",
                "info.translator",
                "info.url",
            ]),
            isMe: user["user_id"] === id,
        };
    });

    return {
        name: room_response.name,
        users: users,
    };
}
