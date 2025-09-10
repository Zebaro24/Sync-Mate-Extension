import BufferedTime from "@/features/player/utills/BuferedTime";
import {roundTime} from "@/shared/utils/time"

export default class ControlPlayer {
    constructor({overlayLoader, getPlayer}) {
        this.player = getPlayer();

        this.overlayLoader = overlayLoader;

        this.bufferedTime = new BufferedTime();

        this.currentTime = null

        this.isBlockPause = false;

        this.isManualPlay = false;
        this.isManualPause = false;
        this.isManualSeek = false;

        this.isSkipWaiting = false;

        this.isLoadedMetaData = false;
        this.isFirstStart = false;

        this._send = () => {
        };
    }

    // region <--- Handlers for listeners --->
    onLoadedMetadata = () => {
        console.log("Медиа загружено, длительность:", this.player.duration);
        this.isLoadedMetaData = true;
    }

    onUserPlay = () => {
        console.log("Запрос на play")
        if (this.isManualPlay) {
            console.log("Manual play")
            this.isManualPlay = false;
            return;
        }
        if (this.bufferedTime.getCurrDownTime(this.player.currentTime) === 0) {
            this.isSkipWaiting = true;
        }
        if (!this.isLoadedMetaData) {
            console.log("Skip first play")
            return;
        }
        if (this.isBlockPause) {
            this.pause();
            console.log("Play blocked by pause")
            return;
        }
        console.log("Play применен");
        this.pause()
        this.setIsBlockPause(true);
        this.sendStatus("play");
    }

    onUserPause = () => {
        console.log("Запрос на pause");
        if (this.isManualPause) {
            console.log("Manual pause")
            this.isManualPause = false;
            return;
        }
        if (!this.isLoadedMetaData) return;
        if (this.isFirstStart) {
            this.isFirstStart = false;
            return;
        }
        console.log("Pause применена")
        if (this.isBlockPause) return;
        this.setIsBlockPause(true);
        this.sendStatus("pause");
    }

    onTimeUpdate = () => {
        console.log(
            "Текущее время:",
            this.player.currentTime,
            this.bufferedTime.getCurrDownTime(this.player.currentTime)
        );

        this.currentTime = this.player.currentTime;
    }

    onSeeking = () => {
        console.log("Запрос на seeking", this.player.currentTime);
        if (this.bufferedTime.getCurrDownTime(this.player.currentTime) === 0) {
            this.isSkipWaiting = true;
        }
        if (this.isManualSeek) {
            this.isManualSeek = false;
            return;
        }
        if (this.player.currentTime === 0.1) {
            this.player.currentTime = 0;
            return;
        }
        if (this.isFirstStart) {
            this.player.pause()
            return;
        }
        if (
            this.currentTime - 0.3 < this.player.currentTime &&
            this.player.currentTime < this.currentTime + 0.3 &&
            this.player.currentTime !== 0
        ) {
            console.log("Ложное перематывание")
            return;
        }

        console.log("Seeking применен")
        this.sendStatus(this.player.paused ? "pause" : "play")
        this.pause()
        this.setIsBlockPause(true);
    }

    onProgress = () => {
        if (!this.player.duration) return;
        this.bufferedTime.update(this.player.buffered);
        this.sendStatus()
        console.log("Download time:", this.bufferedTime.getCurrDownTime(this.player.currentTime))
    }

    onWaiting = () => {
        if (this.isSkipWaiting) {
            this.isSkipWaiting = false;
            return;
        }
        if (this.bufferedTime.getCurrDownTime(this.player.currentTime) > 0) return;
        console.log("Waiting")
        this.pause()
        this.sendStatus("play")
        this.setIsBlockPause(true);
    }
    // endregion

    // region <--- Actions in player --->
    setIsBlockPause(isBlock) {
        if (this.isBlockPause === isBlock) return;
        this.isBlockPause = isBlock;
        if (isBlock) {
            this.overlayLoader.show()
        } else {
            this.overlayLoader.hide()
        }
    }

    play() {
        console.log("Запуск функции play")
        this.isManualPlay = true;
        this.setIsBlockPause(false);
        this.player.play();
    }

    pause() {
        if (!this.player.paused) {
            console.log("Запуск функции pause")
            this.isManualPause = true;
            this.player.pause();
        }

        this.sendStatus()
    }

    seek(time) {
        console.log("Запуск функции seek", time)
        if (!this.isLoadedMetaData) {
            this.player.play()
            this.isFirstStart = true;
            return;
        }
        this.pause()
        this.setIsBlockPause(true);

        this.sendStatus()

        this.isManualSeek = true;
        this.player.currentTime = time;
    }
    // endregion

    sendStatus(type = "status") {
        console.log("Send", type, this.player.currentTime)
        this._send({
            type: type,
            current_time: roundTime(this.player.currentTime),
            downloaded_time: roundTime(this.bufferedTime.getCurrDownTime(this.player.currentTime))
        })
    }


    onStatus(callback) {
        this._send = callback;
        return () => {
            this._send = () => {
            };
        }
    }
}