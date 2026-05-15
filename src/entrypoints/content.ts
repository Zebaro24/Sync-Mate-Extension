import { defineContentScript } from "#imports";
import { initPlayerFeatured } from "@/features/player";
import { initRoomFeatured } from "@/features/room";
import { getItem } from "@/shared/storage";
import { pickLocators } from "@/locators";

// noinspection JSUnusedGlobalSymbols
export default defineContentScript({
    // YouTube пока не поддерживается (нет реализации locators). Возвращать
    // matches на YT нужно одновременно с реализацией YouTubeLocators.
    matches: ["https://rezka.ag/*.html"],
    async main() {
        console.log("Content running...");

        getItem("name").then((name) => console.log("Name:", name));

        const locators = pickLocators(location.hostname);
        if (!locators) return;

        const playerCoordinator = initPlayerFeatured(locators);
        await initRoomFeatured(locators, playerCoordinator);
    },
});
