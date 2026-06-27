import { useQuery } from "@tanstack/react-query";
import { browser } from "#imports";
import { sendMessage } from "@/shared/messaging";
import { getItem } from "@/shared/storage";
import { BrowserMessageTypes } from "@/shared/constants/message-types";
import { API_URL } from "@/shared/constants/api";
import { deepCompare } from "@/shared/utils/deepCompare";
import { formatTime } from "@/shared/utils/time";
import { roomApi } from "../api/room-api";
import type { RoomViewModel } from "../types/view-models";

async function fetchCurrentRoom(): Promise<RoomViewModel> {
    const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
    });
    const tabId = tabs[0]?.id;
    if (!tabId) throw new Error("NO_TAB");

    const { roomId } =
        (await sendMessage({
            type: BrowserMessageTypes.GET_ROOM,
            activeTabId: tabId,
        })) ?? {};

    if (!roomId) throw new Error("NO_ROOM");

    const [{ data: roomData }, myId] = await Promise.all([
        roomApi.get(roomId),
        // id привязан к комнате — иначе в мультитабе meUser не находится
        getItem("id:" + roomId) as Promise<string | undefined>,
    ]);

    const meUser = roomData.users.find((u) => u.user_id === myId);

    return {
        id: roomData.room_id,
        name: roomData.name,
        status: roomData.status,
        link: new URL(roomData.link, API_URL).href,
        videoUrl: roomData.video_url,
        users: roomData.users.map((user) => ({
            id: user.user_id,
            name: user.name,
            downloadTime: formatTime(user.downloaded_time),
            currentTime: formatTime(user.current_time),
            translator: user.info?.translator ?? null,
            episode: user.info?.episode
                ? `S${user.info.season} E${user.info.episode}`
                : null,
            synchronized: meUser
                ? deepCompare(meUser, user, [
                      "user_id",
                      "name",
                      "downloaded_time",
                      // позиции всегда чуть разные — точное время не сравниваем
                      "current_time",
                  ])
                : false,
            isMe: user.user_id === myId,
        })),
    };
}

export function useRoom() {
    return useQuery<RoomViewModel, Error>({
        queryKey: ["room"],
        queryFn: fetchCurrentRoom,
        retry: false,
        refetchInterval: 5_000,
    });
}
