import {initPlayerFeatured} from "@/features/player";
import {initRoomFeatured} from "@/features/room";
import {getItem} from "@/shared/storage";
import {pickLocators} from "@/locators";


// noinspection ALL
export default defineUnlistedScript({
    matches: ["https://www.youtube.com/watch*", "https://rezka.ag/*.html"],
    async main() {
        console.log("Content running...")

        getItem("name").then(name => console.log("Name:", name));

        const locators = pickLocators(location.hostname)
        if (!locators) return;

        const playerCoordinator = initPlayerFeatured(locators);
        await initRoomFeatured(locators, playerCoordinator);
    }
});

