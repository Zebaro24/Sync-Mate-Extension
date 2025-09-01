export default class OverlayLoader {
    constructor({playerPlayBtn, playerControlTimeline}) {
        this.playerPlayBtn = playerPlayBtn;
        this.playerControlTimeline = playerControlTimeline;

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
        this.loader.style.animation = "spin 1s linear infinite";

        this.wrapperLoader.appendChild(this.loader);
    }

    show() {
        this.playerPlayBtn.style.filter = "grayscale(90%)";
        this.playerPlayBtn.style.opacity = "0.7";

        this.playerControlTimeline.before(this.overlay)
        this.playerControlTimeline.parentElement.appendChild(this.wrapperLoader)

        this.#blockSpace();
    }

    hide() {
        this.overlay.remove();
        this.wrapperLoader.remove();

        this.playerPlayBtn.style.filter = "";
        this.playerPlayBtn.style.opacity = "";

        this.#unblockSpace();
    }

    #blockSpace() {
        this.handler = (e) => {
            if (e.code === "Space") {
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        };
        document.addEventListener("keydown", this.handler, true);
    }

    #unblockSpace() {
        if (this.handler) {
            document.removeEventListener("keydown", this.handler, true);
        }
    }
}