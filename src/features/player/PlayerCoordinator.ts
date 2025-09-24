import type { SendStatusCallback } from "./services/ControlPlayer";
import { ControlPlayer } from "./services/ControlPlayer";
import type OverlayLoader from "@/ui/components/OverlayLoader";
import EventListeners from "./services/EventListeners";

interface UI {
    overlayLoader: OverlayLoader;
    getPlayer: () => HTMLVideoElement | null;
}

export default class PlayerCoordinator {
    private readonly ui: UI;
    private controlPlayer: ControlPlayer;
    private eventListener: EventListeners;
    private statusCallback: SendStatusCallback | null = null;

    constructor(ui: UI) {
        this.ui = ui;
        this.controlPlayer = new ControlPlayer(this.ui);
        this.eventListener = new EventListeners(
            this.ui.getPlayer,
            this.controlPlayer,
        );
    }

    get play() {
        return this.controlPlayer.play.bind(this.controlPlayer);
    }

    get pause() {
        return this.controlPlayer.pause.bind(this.controlPlayer);
    }

    get seek() {
        return this.controlPlayer.seek.bind(this.controlPlayer);
    }

    get setIsBlockPause() {
        return this.controlPlayer.setIsBlockPause.bind(this.controlPlayer);
    }

    get enable() {
        return this.eventListener.enable.bind(this.eventListener);
    }

    get disable() {
        return this.eventListener.disable.bind(this.eventListener);
    }

    onStatus(callback: SendStatusCallback) {
        this.statusCallback = callback;
        return this.controlPlayer.onStatus(callback);
    }

    updatePlayer() {
        this.eventListener.disable();
        this.controlPlayer = new ControlPlayer(this.ui);
        this.eventListener = new EventListeners(
            this.ui.getPlayer,
            this.controlPlayer,
        );

        if (this.statusCallback)
            this.controlPlayer.onStatus(this.statusCallback);
    }
}
