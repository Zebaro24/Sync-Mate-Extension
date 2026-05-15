export { BrowserMessageTypes } from "@/shared/constants/message-types";

export enum WSMessageTypes {
    CONNECT = "connect",
    INFO = "info",
    PLAY = "play",
    PAUSE = "pause",
    SEEK = "seek",
    STATUS = "status",
    LOAD = "load",
    SET_VIDEO = "set_video",
    REMOVE_BLOCK_PAUSE = "remove_block_pause",
}
