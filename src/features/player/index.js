import ControlPlayer from "./services/ControlPlayer";
import EventListeners from "@/features/player/services/EventListeners";
import PlayerCoordinator from "@/features/player/PlayerCoordinator";
import OverlayLoader from "@/ui/components/OverlayLoader";

export function initPlayerFeatured(locators) {
    const ui = {
        overlayLoader: new OverlayLoader(locators),
        player: locators.player,
    }

    const controlPlayer = new ControlPlayer(ui);
    const eventListener = new EventListeners(ui.player, controlPlayer);

    return new PlayerCoordinator(controlPlayer, eventListener);
}