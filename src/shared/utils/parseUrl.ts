const API_URL = import.meta.env.WXT_API_URL;
const REZKA_URL = import.meta.env.WXT_REZKA_URL;

export const parseUrls = [API_URL + "/rooms/*", REZKA_URL + "/*"];

export function parseUrl(text_url: string) {
    const url = new URL(text_url);
    const parts = url.pathname.split("/");

    if (text_url.startsWith(REZKA_URL)) {
        if (!["films", "series", "cartoons", "animation"].includes(parts[1]))
            return;
        const content = parts[1];
        const genre = parts[2];
        const name = parts[3].replace(".html", "");
        return { content, genre, name };
    } else if (text_url.startsWith(API_URL)) {
        if (text_url.endsWith("/redirect")) {
            const redirectIndex = parts.indexOf("redirect");
            return { roomId: parts[redirectIndex - 1] };
        }
    }
}
