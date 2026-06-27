import { defineContentScript } from "#imports";
import { initPlayerFeatured } from "@/features/player";
import { initRoomFeatured } from "@/features/room";
import { getItem } from "@/shared/storage";
import { pickLocators } from "@/locators";
import { waitForElement } from "@/shared/utils/waitForElement";

// noinspection JSUnusedGlobalSymbols
export default defineContentScript({
    // YouTube пока не поддерживается (нет реализации locators). Возвращать
    // matches на YT нужно одновременно с реализацией YouTubeLocators.
    matches: ["https://rezka.ag/*.html"],
    async main() {
        try {
            console.log("Content running...");

            getItem("name").then((name) => console.log("Name:", name));

            const locators = pickLocators(location.hostname);
            if (!locators) return;

            // <video> на Rezka появляется асинхронно (его вставляет плеер).
            // Ждём элемент, иначе ControlPlayer/EventListeners упадут в
            // конструкторе. Если не дождались — не инициализируем плеер.
            const video = await waitForElement("video");
            if (!video) {
                console.warn(
                    "Sync-Mate: видео не найдено, плеер не инициализирован",
                );
                return;
            }

            const playerCoordinator = initPlayerFeatured(locators);
            await initRoomFeatured(locators, playerCoordinator);
        } catch (e) {
            console.error("Sync-Mate init failed:", e);
        }
    },
});
