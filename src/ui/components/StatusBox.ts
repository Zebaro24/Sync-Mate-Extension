import { browser } from "#imports";

export default class StatusBox {
    private ratingTable: HTMLElement;
    private socialWrapper: HTMLElement;

    private container!: HTMLElement;
    private textEl!: HTMLElement;
    private popup!: HTMLElement | null;
    private _onClick: ((event: MouseEvent) => void) | null = null;

    constructor({
        ratingTable,
        socialWrapper,
    }: {
        ratingTable: HTMLElement;
        socialWrapper: HTMLElement;
    }) {
        this.ratingTable = ratingTable;
        this.socialWrapper = socialWrapper;

        this.setUpStatusBox();
    }

    setUpStatusBox() {
        const statusBox = this.createStatusBox();

        this.ratingTable.style.setProperty("width", "auto", "important");
        this.ratingTable.style.setProperty("margin-left", "10px", "important");
        this.ratingTable.remove();

        this.container = document.createElement("div");
        this.container.style.display = "flex";
        this.container.style.position = "relative";

        this.container.append(statusBox);
        this.container.append(this.ratingTable);

        this.socialWrapper.insertAdjacentElement("afterend", this.container);
    }

    createStatusBox() {
        const box = document.createElement("div");
        box.style.backgroundColor = "#03001d";
        box.style.borderRadius = "5px";
        box.style.width = "200px";
        box.style.height = "40px";
        box.style.transform = "translateY(-10px)";
        box.style.display = "flex";
        box.style.alignItems = "center";
        box.style.cursor = "pointer";
        box.style.userSelect = "none";

        const img = document.createElement("img");
        img.src = browser.runtime.getURL("icon/48.png" as any);
        img.style.width = "30px";
        img.style.height = "30px";
        img.style.padding = "0 8px";

        this.textEl = document.createElement("div");
        this.textEl.textContent = "Connecting...";
        this.textEl.style.flex = "1";
        this.textEl.style.textAlign = "center";
        this.textEl.style.color = "#fff";
        this.textEl.style.fontSize = "14px";
        this.textEl.style.paddingRight = "8px";

        box.appendChild(img);
        box.appendChild(this.textEl);

        box.addEventListener("click", (event) => this._onClick?.(event));
        return box;
    }

    onClick(fn: (event: MouseEvent) => void) {
        this._onClick = fn;
    }

    setText(text: string) {
        this.textEl.textContent = text;
    }

    togglePopup() {
        console.log(this.container);
        if (!this.popup) {
            this.popup = document.createElement("div");
            this.popup.className = "my-popup";
            this.popup.textContent = "Это панель справа!";
            this.popup.style.position = "absolute";
            this.popup.style.backgroundColor = "#03001d";
            this.popup.style.color = "#fff";
            this.popup.style.borderRadius = "5px";
            this.popup.style.width = "260px";
            this.popup.style.height = "300px";
            this.popup.style.boxShadow = "0 8px 20px rgba(0,0,0,0.5)";
            this.popup.style.zIndex = "9999";
            this.popup.style.transition =
                "transform 0.5s ease, opacity 0.5s ease";
            this.popup.style.opacity = "0";
            this.popup.style.transform = "translateX(-20px)";

            // const rect = this.statusBox.getBoundingClientRect();
            // this.popup.style.top = `-10px`;
            // this.popup.style.left = `${rect.width + 10}px`;

            this.container.appendChild(this.popup);

            setTimeout(() => {
                this.popup!.style.transform = "translateX(0)";
                this.popup!.style.opacity = "1";
            }, 0);
        } else {
            this.popup.style.transform = "translateX(-20px)";
            this.popup.style.opacity = "0";

            setTimeout(() => {
                if (this.popup) this.popup.remove();
                this.popup = null;
            }, 500);
        }
    }
}
