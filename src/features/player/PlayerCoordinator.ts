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

    disable() {
        this.eventListener.disable();
        // При teardown/дисконнекте снимаем оверлей и блок Space — иначе спиннер
        // и перехват пробела остаются висеть после закрытия комнаты.
        this.ui.overlayLoader.hide();
    }

    onStatus(callback: SendStatusCallback) {
        this.statusCallback = callback;
        return this.controlPlayer.onStatus(callback);
    }

    updatePlayer() {
        try {
            // Сначала пробуем собрать сервисы на новый <video>. Если он ещё не
            // готов (null), конструктор бросит — тогда оставляем старые
            // слушатели нетронутыми и не падаем.
            const controlPlayer = new ControlPlayer(this.ui);
            const eventListener = new EventListeners(
                this.ui.getPlayer,
                controlPlayer,
            );

            // Новый плеер готов: снимаем старые слушатели и оверлей, затем
            // переключаемся, чтобы старый блок Space не висел поверх нового.
            this.eventListener.disable();
            this.ui.overlayLoader.hide();

            this.controlPlayer = controlPlayer;
            this.eventListener = eventListener;

            if (this.statusCallback)
                this.controlPlayer.onStatus(this.statusCallback);
        } catch (e) {
            console.error("Sync-Mate updatePlayer failed:", e);
        }
    }
}
