import { apiClient } from "@/shared/api/axios";
import { API_ROUTES } from "@/shared/constants/api";
import type { RoomCreate, RoomResponse, RoomUpdate } from "../types/dtos";

export const roomApi = {
    list: () => apiClient.get<RoomResponse[]>(API_ROUTES.ROOMS),

    get: (roomId: string) =>
        apiClient.get<RoomResponse>(API_ROUTES.ROOM(roomId)),

    create: (data: RoomCreate) =>
        apiClient.post<RoomResponse>(API_ROUTES.ROOMS, data),

    update: (roomId: string, data: RoomUpdate) =>
        apiClient.patch<RoomResponse>(API_ROUTES.ROOM(roomId), data),

    delete: (roomId: string) =>
        apiClient.delete<Record<string, any>>(API_ROUTES.ROOM(roomId)),
};
