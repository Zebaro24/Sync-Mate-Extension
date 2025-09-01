export default class PlayerCoordinator {
    constructor(controlPlayer, eventListener) {
        this._controlPlayer = controlPlayer;
        this._eventListener = eventListener;

        this.setIsBlockPause = this._controlPlayer.setIsBlockPause.bind(this._controlPlayer);
        this.play = this._controlPlayer.play.bind(this._controlPlayer);
        this.pause = this._controlPlayer.pause.bind(this._controlPlayer);
        this.seek = this._controlPlayer.seek.bind(this._controlPlayer);

        this.enable = this._eventListener.enable.bind(this._eventListener);
        this.disable = this._eventListener.disable.bind(this._eventListener);

        this.onStatus = this._controlPlayer.onStatus.bind(this._controlPlayer);
    }
}