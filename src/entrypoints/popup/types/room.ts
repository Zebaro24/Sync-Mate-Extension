export interface RoomInfo {
    name: string;
    users: User[];
}

export interface User {
    name: string;
    downloadTime: string;
    translator: string;
    episode?: string;
    synchronized: boolean;
    isMe: boolean;
}
