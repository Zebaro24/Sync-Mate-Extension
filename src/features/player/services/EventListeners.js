export default class EventListeners {
    constructor(player, controller) {
        this.player = player;
        this.controller = controller;

        this._unsub = [];
        this._enabled = false;

        this._hLoaded = (e) => this.controller.onLoadedMetadata(e);
        this._hPlay = (e) => this.controller.onUserPlay(e);
        this._hPause = () => this.controller.onUserPause();
        this._hTimeUpdate = () => this.controller.onTimeUpdate();
        this._hSeeking = () => this.controller.onSeeking();
        this._hProgress = () => this.controller.onProgress();
        this._hWaiting = () => this.controller.onWaiting();

    }

    onEventListener(eventName, callback, options) {
        this.player.addEventListener(eventName, callback, options);
        const unsub = () => this.player.removeEventListener(eventName, callback, options);
        this._unsub.push(unsub);
        return unsub;
    }


    enable() {
        if (this._enabled) return;
        this._enabled = true;

        this.onEventListener("loadedmetadata", this._hLoaded);
        this.onEventListener("play", this._hPlay, { capture: true });
        this.onEventListener("pause", this._hPause, { capture: true });

        this.onEventListener("timeupdate", this._hTimeUpdate);
        this.onEventListener("seeking", this._hSeeking);
        this.onEventListener("progress", this._hProgress);
        this.onEventListener("waiting", this._hWaiting);

    }

    disable() {
        if (!this._enabled) return;
        this._enabled = false;
        this._unsub.forEach((fn) => fn?.());
        this._unsub = [];
    }
}