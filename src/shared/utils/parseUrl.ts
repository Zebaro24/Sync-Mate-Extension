import { API_URL, REZKA_URL } from "@/shared/constants/api";

export const parseUrls = [API_URL + "/*", REZKA_URL + "/*"];

export function parseUrl(text_url: string) {
    const url = new URL(text_url);
    const parts = url.pathname.split("/");

    if (text_url.startsWith(REZKA_URL)) {
        if (!["films", "series", "cartoons", "animation"].includes(parts[1]))
            return;
        // Без имени контента (parts[3]) разбор бессмыслен — защищаемся от коротких URL
        if (parts.length < 4 || !parts[3]) return;
        const content = parts[1];
        const genre = parts[2];
        const name = parts[3].replace(/\.html$/, "");
        return { content, genre, name };
    } else if (text_url.startsWith(API_URL)) {
        if (text_url.endsWith("/redirect")) {
            const redirectIndex = parts.indexOf("redirect");
            return { roomId: parts[redirectIndex - 1] };
        }
    }
}
