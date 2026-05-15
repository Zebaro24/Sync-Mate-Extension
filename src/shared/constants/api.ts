export const API_URL = import.meta.env.WXT_API_URL as string;
export const WS_URL = import.meta.env.WXT_WS_URL as string;

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
