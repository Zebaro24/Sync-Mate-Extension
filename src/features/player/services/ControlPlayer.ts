import BufferedTime from "@/features/player/utills/BufferedTime";
import type OverlayLoader from "@/ui/components/OverlayLoader";
import { roundTime } from "@/shared/utils/time";
import { createLogger } from "@/shared/logger";

const log = createLogger("Player");

export interface SendStatusCallback {
    (arg?: {
        type: string;
        current_time: number;
        downloaded_time: number;
        duration: number;
    }): void;
}

export class ControlPlayer {
    private player: HTMLVideoElement;
    private overlayLoader: OverlayLoader;

    private bufferedTime: BufferedTime = new BufferedTime();

    private currentTime: number | null = null;

    private isBlockPause: boolean = false;
    private isManualPlay: boolean = false;
    private isManualPause: boolean = false;
    private isManualSeek: boolean = false;
    private isSkipWaiting: boolean = false;
    private isLoadedMetaData: boolean = false;
    private isFirstStart: boolean = false;
    private send: SendStatusCallback = () => {};

    // Троттлинг периодических status-апдейтов: на progress их несколько/с —
    // шлём не чаще ~1/с, не теряя последний (trailing).
    private statusThrottleMs: number = 1000;
    private lastStatusTime: number = 0;
    private statusTimer: ReturnType<typeof setTimeout> | null = null;

    constructor({
        overlayLoader,
        getPlayer,
    }: {
        overlayLoader: OverlayLoader;
        getPlayer: () => HTMLVideoElement | null;
    }) {
        const player = getPlayer();
        if (!player) throw new Error("Player didn't find");
        this.player = player;
        this.overlayLoader = overlayLoader;
    }

    // Снимок состояния/флагов — печатаем на ключевых решениях, чтобы видеть,
    // почему действие применилось или было погашено как «эхо».
    private snapshot() {
        return {
            t: roundTime(this.player.currentTime),
            paused: this.player.paused,
            blockPause: this.isBlockPause,
            manualPlay: this.isManualPlay,
            manualPause: this.isManualPause,
            manualSeek: this.isManualSeek,
            skipWaiting: this.isSkipWaiting,
            loadedMeta: this.isLoadedMetaData,
            firstStart: this.isFirstStart,
        };
    }

    // region <--- Handlers for listeners --->
    onLoadedMetadata = () => {
        log.debug("Медиа загружено, длительность:", this.player.duration);
        this.isLoadedMetaData = true;
    };

    onUserPlay = () => {
        log.debug("Запрос на play", this.snapshot());
        if (this.isManualPlay) {
            log.debug("Manual play");
            this.isManualPlay = false;
            return;
        }
        if (this.bufferedTime.getCurrDownTime(this.player.currentTime) === 0) {
            this.isSkipWaiting = true;
        }
        if (!this.isLoadedMetaData) {
            log.debug("Skip first play");
            return;
        }
        if (this.isBlockPause) {
            this.pause();
            log.debug("Play blocked by pause");
            return;
        }
        log.debug("Play применен");
        this.pause();
        this.setIsBlockPause(true);
        this.sendStatus("play");
    };

    onUserPause = () => {
        log.debug("Запрос на pause", this.snapshot());
        if (this.isManualPause) {
            log.debug("Manual pause");
            this.isManualPause = false;
            return;
        }
        if (!this.isLoadedMetaData) return;
        if (this.isFirstStart) {
            this.isFirstStart = false;
            return;
        }
        log.debug("Pause применена");
        if (this.isBlockPause) return;
        this.setIsBlockPause(true);
        this.sendStatus("pause");
    };

    onTimeUpdate = () => {
        this.currentTime = this.player.currentTime;
    };

    onSeeking = () => {
        log.debug(
            "Запрос на seeking",
            this.player.currentTime,
            this.snapshot(),
        );
        if (this.isManualSeek) {
            this.isManualSeek = false;
            return;
        }
        if (this.player.currentTime === 0.1) {
            this.player.currentTime = 0;
            return;
        }
        if (this.isFirstStart) {
            this.player.pause();
            return;
        }
        if (
            this.currentTime !== null &&
            this.currentTime - 0.3 < this.player.currentTime &&
            this.player.currentTime < this.currentTime + 0.3 &&
            this.player.currentTime !== 0
        ) {
            log.debug("Ложное перематывание");
            return;
        }

        log.debug("Seeking применен");
        // Реальная перемотка: если буфера в новой точке нет — пропускаем ближайший waiting
        if (this.bufferedTime.getCurrDownTime(this.player.currentTime) === 0) {
            this.isSkipWaiting = true;
        }
        this.sendStatus(this.player.paused ? "pause" : "play");
        this.pause();
        this.setIsBlockPause(true);
    };

    onProgress = () => {
        if (!this.player.duration) return;
        this.bufferedTime.update(this.player.buffered);
        this.sendStatus();
    };

    onWaiting = () => {
        if (this.isSkipWaiting) {
            this.isSkipWaiting = false;
            return;
        }
        if (this.bufferedTime.getCurrDownTime(this.player.currentTime) > 0)
            return;
        log.debug("Waiting (буфера нет → пауза)", this.snapshot());
        this.pause();
        this.sendStatus("play");
        this.setIsBlockPause(true);
    };
    // endregion

    // region <--- Actions in player --->
    setIsBlockPause(isBlock: boolean) {
        if (this.isBlockPause === isBlock) return;
        log.debug("setIsBlockPause →", isBlock);
        this.isBlockPause = isBlock;
        if (isBlock) {
            this.overlayLoader.show();
        } else {
            this.overlayLoader.hide();
        }
    }

    play() {
        log.debug("Запуск функции play");
        // Метим ручной play только если плеер реально на паузе
        if (this.player.paused) {
            this.isManualPlay = true;
        }
        this.setIsBlockPause(false);
        // При отказе промиса сбрасываем флаг, чтобы не проглотить будущее эхо
        this.player.play()?.catch(() => {
            this.isManualPlay = false;
        });
    }

    pause() {
        if (!this.player.paused) {
            log.debug("Запуск функции pause");
            this.isManualPause = true;
            this.player.pause();
        }

        this.sendStatus();
    }

    seek(time: number) {
        log.debug("Запуск функции seek", time);
        if (!this.isLoadedMetaData) {
            this.player.play();
            this.isFirstStart = true;
            return;
        }
        this.pause();
        this.setIsBlockPause(true);

        this.sendStatus();

        // Перематываем только при заметной разнице — иначе это эхо без реальной перемотки
        if (Math.abs(this.player.currentTime - time) > 0.05) {
            this.isManualSeek = true;
            this.player.currentTime = time;
        }
    }

    // endregion

    sendStatus(type: string = "status") {
        // Явные действия (play/pause/seek и т.п.) шлём сразу; периодический
        // status троттлим до ~1/с, не теряя последний апдейт (trailing).
        if (type !== "status") {
            this.flushStatus(type);
            return;
        }

        const elapsed = Date.now() - this.lastStatusTime;
        if (elapsed >= this.statusThrottleMs) {
            this.flushStatus(type);
        } else if (this.statusTimer === null) {
            this.statusTimer = setTimeout(() => {
                this.statusTimer = null;
                this.flushStatus("status");
            }, this.statusThrottleMs - elapsed);
        }
    }

    private flushStatus(type: string) {
        // Любая реальная отправка перезапускает окно троттлинга и снимает
        // отложенный trailing — чтобы явное действие не задублировалось status'ом.
        if (this.statusTimer !== null) {
            clearTimeout(this.statusTimer);
            this.statusTimer = null;
        }
        this.lastStatusTime = Date.now();
        this.send({
            type: type,
            current_time: roundTime(this.player.currentTime),
            downloaded_time: roundTime(
                this.bufferedTime.getCurrDownTime(this.player.currentTime),
            ),
            // Длительность ролика — безопасно от NaN, чтобы бэкенд знал длину
            duration: Number.isFinite(this.player.duration)
                ? roundTime(this.player.duration)
                : 0,
        });
    }

    onStatus(callback: SendStatusCallback) {
        this.send = callback;
        return () => {
            this.send = () => {};
            // Снимаем отложенный trailing-status, чтобы таймер не держал ссылку.
            if (this.statusTimer !== null) {
                clearTimeout(this.statusTimer);
                this.statusTimer = null;
            }
        };
    }
}
