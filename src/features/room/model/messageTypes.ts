export enum BrowserMessageTypes {
    GET_ROOM,
    SET_ROOM,
    ADD_TO_ROOM,
}

export enum WSMessageTypes {
    CONNECT = "connect",
    INFO = "info",
    PLAY = "play",
    PAUSE = "pause",
    SEEK = "seek",
    REMOVE_BLOCK_PAUSE = "remove_block_pause",
}
