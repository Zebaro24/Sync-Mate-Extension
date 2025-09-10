import ControlPlayer from "./services/ControlPlayer.js";
import EventListeners from "./services/EventListeners.js";

export default class PlayerCoordinator {
    constructor(ui) {
        this._ui = ui;
        this._controlPlayer = new ControlPlayer(this._ui);
        this._eventListener = new EventListeners(this._ui.getPlayer, this._controlPlayer);

        this._statusCallback = null;
    }

    get play() {
        return this._controlPlayer.play.bind(this._controlPlayer);
    }

    get pause() {
        return this._controlPlayer.pause.bind(this._controlPlayer);
    }

    get seek() {
        return this._controlPlayer.seek.bind(this._controlPlayer);
    }

    get setIsBlockPause() {
        return this._controlPlayer.setIsBlockPause.bind(this._controlPlayer);
    }

    get enable() {
        return this._eventListener.enable.bind(this._eventListener);
    }

    get disable() {
        return this._eventListener.disable.bind(this._eventListener);
    }

    onStatus(callback) {
        this._statusCallback = callback;
        return this._controlPlayer.onStatus(callback);
    }

    updatePlayer() {
        this._eventListener.disable();
        this._controlPlayer = new ControlPlayer(this._ui);
        this._eventListener = new EventListeners(this._ui.getPlayer, this._controlPlayer);

        if (this._statusCallback) this._controlPlayer.onStatus(this._statusCallback);
    }
}