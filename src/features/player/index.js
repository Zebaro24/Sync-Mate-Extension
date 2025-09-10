import PlayerCoordinator from "./PlayerCoordinator";
import OverlayLoader from "@/ui/components/OverlayLoader";

export function initPlayerFeatured(locators) {
    const ui = {
        overlayLoader: new OverlayLoader(locators),
        getPlayer: locators.player,
    }

    return new PlayerCoordinator(ui);
}