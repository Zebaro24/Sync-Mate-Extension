export interface UserResponse {
    user_id: string;
    name: string;
    current_time: number;
    downloaded_time: number;
    info: {
        translator?: string | null;
        episode?: number | null;
        season?: number | null;
        url?: string;
        [key: string]: any;
    };
}

export interface RoomResponse {
    name: string;
    video_url: string;
    current_time: number;
    room_id: string;
    created_at: string;
    status: string;
    users: UserResponse[];
    link: string;
}

export interface RoomCreate {
    name: string;
    video_url: string;
    current_time?: number;
}

export interface RoomUpdate {
    name?: string | null;
    video_url?: string | null;
    current_time?: number | null;
}
