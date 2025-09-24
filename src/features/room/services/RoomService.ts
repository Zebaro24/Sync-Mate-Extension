const API_URL = import.meta.env.WXT_API_URL;

export default class RoomService {
    async createRoom(name: string, videoUrl: string) {
        const res = await fetch(`${API_URL}/rooms`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: name,
                video_url: videoUrl,
            }),
        });
        if (!res.ok) throw new Error(`Network error: ${res.status}`);
        return await res.json();
    }

    async getRoom(roomId: string) {
        const res = await fetch(`${API_URL}/rooms/${roomId}`);
        if (!res.ok) throw new Error(`Network error: ${res.status}`);
        return await res.json();
    }
}
