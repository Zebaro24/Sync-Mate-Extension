import { apiClient } from "@/shared/api/axios";
import { API_ROUTES } from "@/shared/constants/api";
import type { RoomCreate, RoomResponse } from "@/features/room/types/dtos";

export default class RoomService {
    async createRoom(name: string, videoUrl: string): Promise<RoomResponse> {
        const { data } = await apiClient.post<RoomResponse>(API_ROUTES.ROOMS, {
            name,
            video_url: videoUrl,
        } satisfies RoomCreate);
        return data;
    }

    async getRoom(roomId: string): Promise<RoomResponse> {
        const { data } = await apiClient.get<RoomResponse>(
            API_ROUTES.ROOM(roomId),
        );
        return data;
    }
}
