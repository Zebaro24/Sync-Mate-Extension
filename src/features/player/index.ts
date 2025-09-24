import PlayerCoordinator from "./PlayerCoordinator";
import OverlayLoader from "@/ui/components/OverlayLoader";
import type BaseLocators from "@/locators/BaseLocators";

export function initPlayerFeatured(locators: BaseLocators) {
    const ui = {
        overlayLoader: new OverlayLoader(locators),
        getPlayer: locators.player as () => HTMLVideoElement | null,
    };

    return new PlayerCoordinator(ui);
}
