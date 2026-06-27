import { createLogger } from "@/shared/logger";

const log = createLogger("Config");

// Константа: домен видеохостинга. Не конфигурируется через env — её нет смысла менять.
export const REZKA_URL = "https://rezka.ag";

// Базовый URL бэкенда (без trailing /). Пример: http://localhost:8000 или https://example.com.
// Берётся из .env.{development,production} локально и из repo variable в CI (см. release.yml).
const BACKEND_URL = ((import.meta.env.WXT_BACKEND_URL as string) || "").replace(
    /\/+$/,
    "",
);

if (!BACKEND_URL) {
    // Видно сразу в DevTools, чтобы не искать молча сломанные запросы.
    log.error("WXT_BACKEND_URL is not set — API/WS calls will fail.");
}

export const API_URL = `${BACKEND_URL}/api`;
// http://...  → ws://...,  https://... → wss://...
export const WS_URL = `${BACKEND_URL.replace(/^http/, "ws")}/ws`;

export const API_ROUTES = {
    ROOMS: "/rooms",
    ROOM: (id: string) => `/rooms/${id}`,
    ROOM_REDIRECT: (id: string) => `/rooms/${id}/redirect`,
    REZKA_QUICK_SEARCH: "/rezka/quick_search",
    REZKA_SEARCH: "/rezka/search",
    REZKA_QUICK_INFO: "/rezka/quick_info_movie",
    REZKA_INFO_MOVIE: "/rezka/info_movie",
    REZKA_MOVIE_SOURCE: "/rezka/movie_source",
    REZKA_SERIES_SOURCE: "/rezka/series_source",
    INFO: "/info",
} as const;
