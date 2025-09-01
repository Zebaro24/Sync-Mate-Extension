export const parseUrls = ["https://rezka.ag/*",]


export function parseIdUrl(text_url) {
    const url = new URL(text_url);
    return url.searchParams.get("room_id")
}
