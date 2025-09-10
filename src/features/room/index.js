import RoomCoordinator from "./RoomCoordinator";

import InfoPanel from "@/ui/components/InfoPanel";
import OverlayLoader from "@/ui/components/OverlayLoader";
import StatusBox from "@/ui/components/StatusBox";

import WebSocketClient from "./sockets/WebSocketClient";
import RoomService from "./services/RoomService";
import ParseInfo from "./utills/ParseInfo.js";

export async function initRoomFeatured(locators, playerCoordinator) {
    const ui = {
        infoPanel: new InfoPanel(locators),
        overlayLoader: new OverlayLoader(locators),
        statusBox: new StatusBox(locators),
        parseInfo: new ParseInfo(locators),
    };

    const socket = new WebSocketClient();
    const service = new RoomService();

    const coordinator = new RoomCoordinator(socket, service, ui, playerCoordinator);
    await coordinator.init();
}
