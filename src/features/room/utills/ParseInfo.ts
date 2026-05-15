// FIXME: Add BaseLocators
import type RezkaLocators from "@/locators/RezkaLocators";
import { WSMessageTypes } from "../model/messageTypes";

export default class ParseInfo {
    private locators: RezkaLocators;

    constructor(locators: RezkaLocators) {
        this.locators = locators;
    }

    parse() {
        let title = this.locators.title!.textContent;
        if (title.includes("в озвучке"))
            title = title.split("в озвучке")[0].trim();

        let translator = null;
        let translatorElem = this.locators.translator();
        if (translatorElem) {
            translator = translatorElem.title.trim();
        }

        let seriesInfo = {};
        let episode = this.locators.episode();
        if (episode) {
            seriesInfo = {
                episode: episode.getAttribute("data-episode_id"),
                season: episode.getAttribute("data-season_id"),
            };
        }

        const info = {
            type: WSMessageTypes.INFO,
            title: title,
            translator: translator,
            ...seriesInfo,
            url: location.href,
        };
        console.log(info);
        return info;
    }

    setWatchInfo(callback: (target: HTMLElement) => void) {
        const observers: MutationObserver[] = [];
        // Rezka при смене переводчика снимает active со старого элемента и ставит
        // на новый в одной микрозадаче — без дебаунса колбэк улетает дважды.
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        let pendingTarget: HTMLElement | null = null;
        const fire = (target: HTMLElement) => {
            pendingTarget = target;
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                debounceTimer = null;
                if (pendingTarget) callback(pendingTarget);
                pendingTarget = null;
            }, 50);
        };

        const watch = (container: Node) => {
            const observed = new WeakMap();

            const observer = new MutationObserver((mutations) => {
                mutations.forEach(({ type, attributeName, target }) => {
                    if (!(target instanceof HTMLElement)) return;
                    if (type !== "attributes" || attributeName !== "class")
                        return;

                    const isActive =
                        target.classList.contains("active") &&
                        !target.classList.contains("disabled");

                    if (observed.get(target) !== isActive) {
                        observed.set(target, isActive);
                        if (isActive) fire(target);
                    }
                });
            });

            observer.observe(container, { attributes: true, subtree: true });
            observers.push(observer);
        };

        (
            [
                this.locators.changeTranslator(),
                this.locators.changeEpisode(),
            ].filter(Boolean) as HTMLElement[]
        ).forEach(watch);

        return () => {
            observers.forEach((obs) => obs.disconnect());
            if (debounceTimer) clearTimeout(debounceTimer);
        };
    }
}
