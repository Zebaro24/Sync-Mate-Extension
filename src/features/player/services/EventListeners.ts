import type { ControlPlayer } from "./ControlPlayer";

export default class EventListeners {
    private player: HTMLVideoElement;
    private controller: ControlPlayer;

    private unsub: (() => void)[] = [];
    private enabled: boolean = false;

    private readonly hLoaded: () => void;
    private readonly hPlay: () => void;
    private readonly hPause: () => void;
    private readonly hTimeUpdate: () => void;
    private readonly hSeeking: () => void;
    private readonly hProgress: () => void;
    private readonly hWaiting: () => void;

    constructor(
        getPlayer: () => HTMLVideoElement | null,
        controller: ControlPlayer,
    ) {
        const player = getPlayer();
        if (!player) throw new Error("Player didn't find");
        this.player = player;
        this.controller = controller;

        this.hLoaded = () => this.controller.onLoadedMetadata();
        this.hPlay = () => this.controller.onUserPlay();
        this.hPause = () => this.controller.onUserPause();
        this.hTimeUpdate = () => this.controller.onTimeUpdate();
        this.hSeeking = () => this.controller.onSeeking();
        this.hProgress = () => this.controller.onProgress();
        this.hWaiting = () => this.controller.onWaiting();
    }

    onEventListener<K extends keyof HTMLMediaElementEventMap>(
        eventName: K,
        callback: (ev: HTMLMediaElementEventMap[K]) => void,
        options?: boolean | AddEventListenerOptions,
    ) {
        this.player.addEventListener(eventName, callback, options);
        const unsub = () =>
            this.player.removeEventListener(eventName, callback, options);
        this.unsub.push(unsub);
        return unsub;
    }

    enable() {
        if (this.enabled) return;
        this.enabled = true;

        this.onEventListener("loadedmetadata", this.hLoaded);
        this.onEventListener("play", this.hPlay, { capture: true });
        this.onEventListener("pause", this.hPause, { capture: true });

        this.onEventListener("timeupdate", this.hTimeUpdate);
        this.onEventListener("seeking", this.hSeeking);
        this.onEventListener("progress", this.hProgress);
        this.onEventListener("waiting", this.hWaiting);

        console.log("Player event listeners enabled");
    }

    disable() {
        if (!this.enabled) return;
        this.enabled = false;
        this.unsub.forEach((fn) => fn?.());
        this.unsub = [];
    }
}
