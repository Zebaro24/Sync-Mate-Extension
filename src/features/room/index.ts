import RoomCoordinator from "./RoomCoordinator";

import InfoPanel from "@/ui/components/InfoPanel";
import OverlayLoader from "@/ui/components/OverlayLoader";
import StatusBox from "@/ui/components/StatusBox";

import WebSocketClient from "./sockets/WebSocketClient";
import RoomService from "./services/RoomService";
import ParseInfo from "./utills/ParseInfo";
import type BaseLocators from "@/locators/BaseLocators";
import type PlayerCoordinator from "@/features/player/PlayerCoordinator";
import type RezkaLocators from "@/locators/RezkaLocators";

export async function initRoomFeatured(
    locators: BaseLocators,
    playerCoordinator: PlayerCoordinator,
) {
    // FIXME: Add BaseLocators
    const ui = {
        infoPanel: new InfoPanel(locators as RezkaLocators),
        overlayLoader: new OverlayLoader(locators),
        statusBox: new StatusBox(locators as RezkaLocators),
        parseInfo: new ParseInfo(locators as RezkaLocators),
    };

    const socket = new WebSocketClient();
    const service = new RoomService();

    const coordinator = new RoomCoordinator(
        socket,
        service,
        ui,
        playerCoordinator,
    );
    await coordinator.init();
}
