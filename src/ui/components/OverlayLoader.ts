// Ключевые кадры для спиннера — на странице Rezka может не быть подходящих
// @keyframes spin, поэтому добавляем свои с уникальным именем.
const SPIN_KEYFRAMES_ID = "sync-mate-spin-keyframes";
const SPIN_ANIMATION_NAME = "sync-mate-spin";

function ensureSpinKeyframes() {
    if (document.getElementById(SPIN_KEYFRAMES_ID)) return;
    const style = document.createElement("style");
    style.id = SPIN_KEYFRAMES_ID;
    style.textContent = `@keyframes ${SPIN_ANIMATION_NAME} { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
}

export default class OverlayLoader {
    private overlay!: HTMLDivElement;
    private wrapperLoader!: HTMLDivElement;
    private loader!: HTMLDivElement;

    private playerPlayBtn: HTMLElement;
    private playerControlTimeline: HTMLElement;

    private handler?: (e: KeyboardEvent) => void;

    constructor({
        playerPlayBtn,
        playerControlTimeline,
    }: {
        playerPlayBtn: HTMLElement;
        playerControlTimeline: HTMLElement;
    }) {
        this.playerPlayBtn = playerPlayBtn;
        this.playerControlTimeline = playerControlTimeline;

        ensureSpinKeyframes();
        this.setUpOverlayLoader();
    }

    setUpOverlayLoader() {
        this.overlay = document.createElement("div");
        this.overlay.style.position = "absolute";
        this.overlay.style.top = "0";
        this.overlay.style.left = "0";
        this.overlay.style.width = "100%";
        this.overlay.style.height = "100%";
        this.overlay.style.background = "rgba(255,255,255,0)";

        this.wrapperLoader = document.createElement("div");
        this.wrapperLoader.style.position = "absolute";
        this.wrapperLoader.style.top = "50%";
        this.wrapperLoader.style.left = "50%";
        this.wrapperLoader.style.transform = "translate(-50%, -50%)";

        this.loader = document.createElement("div");
        this.loader.style.width = "110px";
        this.loader.style.height = "110px";
        this.loader.style.border = "10px solid rgba(63, 60, 89, 0.7)";
        this.loader.style.borderTop = "10px solid rgba(33, 30, 59, 0.7)";
        this.loader.style.borderBottom = "10px solid rgba(33, 30, 59, 0.7)";
        this.loader.style.borderRadius = "50%";
        this.loader.style.animation = `${SPIN_ANIMATION_NAME} 1s linear infinite`;

        this.wrapperLoader.appendChild(this.loader);
    }

    show() {
        this.playerPlayBtn.style.filter = "grayscale(90%)";
        this.playerPlayBtn.style.opacity = "0.7";

        this.playerControlTimeline.before(this.overlay);
        this.playerControlTimeline.parentElement!.appendChild(
            this.wrapperLoader,
        );

        this.blockSpace();
    }

    hide() {
        // Идемпотентно: remove() безопасен для неприсоединённых узлов, а
        // unblockSpace() корректно отрабатывает даже если show() не вызывался.
        this.overlay.remove();
        this.wrapperLoader.remove();

        this.playerPlayBtn.style.filter = "";
        this.playerPlayBtn.style.opacity = "";

        this.unblockSpace();
    }

    private blockSpace() {
        // Снимаем прежний слушатель, если show() вызвали повторно без hide(),
        // иначе хендлеры накапливаются и пробел «залипает».
        this.unblockSpace();
        this.handler = (e) => {
            if (e.code === "Space") {
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        };
        document.addEventListener("keydown", this.handler, true);
    }

    private unblockSpace() {
        if (this.handler) {
            document.removeEventListener("keydown", this.handler, true);
            // Сбрасываем ссылку — повторный hide() безопасен и не держит
            // устаревший хендлер.
            this.handler = undefined;
        }
    }
}
