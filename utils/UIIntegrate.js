export class StatusBox {
    constructor() {
        this.onClickHandler = () => {
        }

        this.statusBox = this.createStatusBox();
        this.container = this.setUpStatusBox(this.statusBox);
    }

    setUpStatusBox(statusBox) {
        document.querySelectorAll(".b-post__rating_table td").forEach(td => {
            td.style.setProperty("width", "auto", "important");
        });

        const table = document.body.querySelector("table.b-post__rating_table")
        table.style.setProperty("width", "auto", "important");
        table.style.setProperty("margin-left", "10px", "important");
        table.remove()

        const container = document.createElement("div");
        container.style.display = "flex"
        container.style.position = 'relative';

        container.append(statusBox)
        container.append(table)

        const prevElem = document.body.querySelector("div.b-post__social_holder_wrapper")
        prevElem.insertAdjacentElement("afterend", container);

        return container;
    }

    createStatusBox() {
        const box = document.createElement('div');
        box.style.backgroundColor = '#03001d';
        box.style.borderRadius = '5px';
        box.style.width = "200px";
        box.style.height = "40px";
        box.style.transform = "translateY(-10px)";
        box.style.display = "flex";
        box.style.alignItems = "center";
        box.style.cursor = "pointer";
        box.style.userSelect = "none";

        const img = document.createElement('img');
        img.src = browser.runtime.getURL('icon/48.png');
        img.style.width = '30px';
        img.style.height = '30px';
        img.style.padding = '0 8px';

        this.textEl = document.createElement('div');
        this.textEl.textContent = "Connecting...";
        this.textEl.style.flex = '1';
        this.textEl.style.textAlign = 'center';
        this.textEl.style.color = '#fff';
        this.textEl.style.fontSize = '14px';
        this.textEl.style.paddingRight = "8px"

        box.appendChild(img);
        box.appendChild(this.textEl);

        box.addEventListener('click', this.#onClickHandlerListener.bind(this));
        return box;
    }

    #onClickHandlerListener() {
        this.onClickHandler()
    }

    changeText(text) {
        this.textEl.textContent = text
    }

    togglePopup() {
        console.log(this.container)
        if (!this.popup) {
            this.popup = document.createElement('div');
            this.popup.className = 'my-popup';
            this.popup.textContent = "Это панель справа!";
            this.popup.style.position = 'absolute';
            this.popup.style.backgroundColor = '#03001d';
            this.popup.style.color = '#fff';
            this.popup.style.borderRadius = '5px';
            this.popup.style.width = '260px';
            this.popup.style.height = '300px';
            this.popup.style.boxShadow = '0 8px 20px rgba(0,0,0,0.5)';
            this.popup.style.zIndex = '9999';
            this.popup.style.transition = 'transform 0.5s ease, opacity 0.5s ease';
            this.popup.style.opacity = '0';
            this.popup.style.transform = 'translateX(-20px)';

            const rect = this.statusBox.getBoundingClientRect();
            this.popup.style.top = `-10px`;
            this.popup.style.left = `${rect.width + 10}px`;

            this.container.appendChild(this.popup);

            setTimeout(() => {
                this.popup.style.transform = 'translateX(0)';
                this.popup.style.opacity = '1';
            }, 0);
        } else {
            this.popup.style.transform = 'translateX(-20px)';
            this.popup.style.opacity = '0';

            setTimeout(() => {
                if (this.popup) this.popup.remove();
                this.popup = null;
            }, 500);
        }
    }
}

export class OverlayLoader {
    constructor() {
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

        this.playBtn = document.querySelector("#oframecdnplayer > pjsdiv:nth-child(20)");
        this.overlapElem = document.querySelector("#cdnplayer_control_timeline");
    }

    show() {
        this.playBtn.style.filter = "grayscale(90%)";
        this.playBtn.style.opacity = "0.7";

        this.overlapElem.before(this.overlay)
        this.overlapElem.parentElement.appendChild(this.wrapperLoader)

        this.#blockSpace();
    }

    hide() {
        this.overlay.remove();
        this.wrapperLoader.remove();

        this.playBtn.style.filter = "";
        this.playBtn.style.opacity = "";

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

export class InformationPanel {
    constructor() {
        this.panel = null;
        this.information = {}

        this.setUpInformationPanel();
    }

    setUpInformationPanel() {
        const inform_parent = document.querySelector("#oframecdnplayer");

        this.panel = document.createElement("div");
        this.panel.style.position = "absolute";
        this.panel.style.bottom = "60px";
        this.panel.style.left = "10px";
        this.panel.style.padding = "8px";
        this.panel.style.borderRadius = "2.3px";
        this.panel.style.opacity = "0";
        this.panel.style.fontSize = "12px";
        this.panel.style.background = "rgb(23, 35, 34)";
        this.panel.style.display = "flex";
        this.panel.textContent = "Hello";

        inform_parent.append(this.panel);

        const controls = document.querySelector('#cdnplayer_control_timeline');

        const observer = new MutationObserver(() => {
            const visible = window.getComputedStyle(controls).visibility !== 'hidden';
            this.panel.style.visibility = visible ? 'visible' : 'hidden';
        });

        observer.observe(controls, { attributes: true, attributeFilter: ['style'] });

    }

    updatePanel() {
        if (!this.information) {
            this.panel.style.opacity = "0";
            return;
        } else this.panel.style.opacity = "0.7";

        let text = "Загружено:\n";
        for (const [person, downloaded_time] of Object.entries(this.information)) {
            text += `${person}: ${downloaded_time}s\n`;
        }
        this.panel.innerText = text;
    }

    updateInformation(person, downloaded_time) {
        this.information[person] = Math.round(downloaded_time);

        this.updatePanel();
    }
}

