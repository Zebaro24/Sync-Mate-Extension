/* global browser */
// import {StatusBox} from "../utils/UIIntegrate";
import Room from "../utils/Room";
import ControlPlayer from "../utils/ControlPlayer";


// noinspection ALL
export default defineUnlistedScript({
    matches: ["https://www.youtube.com/watch*", "https://rezka.ag/*.html"],
    main() {
        console.log("Content running...")
        browser.storage.local.get(["name"], (result) => {
            console.log("Текущие настройки:", result);
        });

        const videoEl = document.querySelector("video");
        if (!videoEl) return;

        const controlPlayer = new ControlPlayer(videoEl);
        new Room(controlPlayer)
    }
});

