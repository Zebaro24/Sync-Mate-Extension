export default class InfoPanel {
    private panel!: HTMLDivElement;
    private playerFrame: HTMLElement;
    private readonly playerControlTimeline: HTMLElement;
    private information: Record<string, number> = {};

    constructor({
        playerFrame,
        playerControlTimeline,
    }: {
        playerFrame: HTMLElement;
        playerControlTimeline: HTMLElement;
    }) {
        this.playerFrame = playerFrame;
        this.playerControlTimeline = playerControlTimeline;

        this.setUpInformationPanel();
    }

    setUpInformationPanel() {
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

        this.playerFrame.append(this.panel);

        const observer = new MutationObserver(() => {
            const visible =
                window.getComputedStyle(this.playerControlTimeline)
                    .visibility !== "hidden";
            this.panel.style.visibility = visible ? "visible" : "hidden";
        });

        observer.observe(this.playerControlTimeline, {
            attributes: true,
            attributeFilter: ["style"],
        });
    }

    updatePanel() {
        if (!this.information) {
            this.panel.style.opacity = "0";
            return;
        } else this.panel.style.opacity = "0.7";

        let text = "Загружено:\n";
        for (const [person, downloaded_time] of Object.entries(
            this.information,
        )) {
            text += `${person}: ${downloaded_time}s\n`;
        }
        this.panel.innerText = text;
    }

    updateInformation(person: string, downloaded_time: number) {
        this.information[person] = Math.round(downloaded_time);

        this.updatePanel();
    }
}
