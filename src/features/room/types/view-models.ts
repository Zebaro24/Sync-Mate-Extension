export interface UserViewModel {
    id: string;
    name: string;
    downloadTime: string;
    currentTime: string;
    translator: string | null;
    episode: string | null;
    synchronized: boolean;
    isMe: boolean;
}

export interface RoomViewModel {
    id: string;
    name: string;
    status: string;
    link: string;
    videoUrl: string;
    users: UserViewModel[];
}
