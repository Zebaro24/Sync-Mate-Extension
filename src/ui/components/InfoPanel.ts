// Участников, от которых дольше этого времени не было апдейтов, считаем ушедшими.
const PARTICIPANT_TTL_MS = 12000;

interface ParticipantInfo {
    downloadedTime: number;
    lastSeen: number;
}

export default class InfoPanel {
    private panel!: HTMLDivElement;
    private observer?: MutationObserver;
    private playerFrame: HTMLElement;
    private readonly playerControlTimeline: HTMLElement;
    private information: Record<string, ParticipantInfo> = {};
    // Последнее действие в комнате (пауза/воспроизведение) — короткая строка с авто-сбросом.
    private lastAction: string = "";
    private lastActionTimer?: ReturnType<typeof setTimeout>;

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

        this.observer = new MutationObserver(() => {
            const visible =
                window.getComputedStyle(this.playerControlTimeline)
                    .visibility !== "hidden";
            this.panel.style.visibility = visible ? "visible" : "hidden";
        });

        this.observer.observe(this.playerControlTimeline, {
            attributes: true,
            attributeFilter: ["style"],
        });
    }

    updatePanel() {
        // Убираем «призраков» — участников, от которых давно не было апдейтов.
        const now = Date.now();
        for (const [person, info] of Object.entries(this.information)) {
            if (now - info.lastSeen > PARTICIPANT_TTL_MS) {
                delete this.information[person];
            }
        }

        const hasParticipants = Object.keys(this.information).length > 0;
        // Нечего показывать — прячем панель.
        if (!hasParticipants && !this.lastAction) {
            this.panel.style.opacity = "0";
            return;
        }
        this.panel.style.opacity = "0.7";

        let text = "";
        if (this.lastAction) text += `${this.lastAction}\n`;
        if (hasParticipants) {
            text += "Загружено:\n";
            for (const [person, info] of Object.entries(this.information)) {
                text += `${person}: ${info.downloadedTime}s\n`;
            }
        }
        this.panel.innerText = text;
    }

    updateInformation(person: string, downloaded_time: number) {
        // Ключуем по имени: входящий info-кадр сервера user_id не несёт.
        this.information[person] = {
            downloadedTime: Math.round(downloaded_time),
            lastSeen: Date.now(),
        };

        this.updatePanel();
    }

    // Короткое уведомление о действии в комнате (пауза/воспроизведение), гаснет само.
    setLastAction(text: string) {
        this.lastAction = text;
        this.updatePanel();
        if (this.lastActionTimer) clearTimeout(this.lastActionTimer);
        this.lastActionTimer = setTimeout(() => {
            this.lastAction = "";
            this.updatePanel();
        }, 4000);
    }

    dispose() {
        // Симметрично teardown: отписываем observer и убираем панель из DOM.
        if (this.lastActionTimer) clearTimeout(this.lastActionTimer);
        this.observer?.disconnect();
        this.observer = undefined;
        this.panel?.remove();
        this.information = {};
    }
}
