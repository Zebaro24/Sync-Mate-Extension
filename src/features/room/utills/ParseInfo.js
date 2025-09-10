export default class ParseInfo {
    constructor(locators) {
        this.locators = locators;
    }

    parse() {
        let title = this.locators.title.textContent
        if (title.includes("в озвучке")) title = title.split("в озвучке")[0].trim();

        let translator = this.locators.translator();
        if (translator) translator = translator.title.trim();

        let seriesInfo = {};
        let episode = this.locators.episode();
        if (episode) {
            seriesInfo = {
                episode: episode.getAttribute("data-episode_id"),
                season: episode.getAttribute("data-season_id"),
            }
        }

        const info = {
            type: "info",
            title: title,
            translator: translator,
            ...seriesInfo,
            url: location.href,
        }
        console.log(info);
        return info;
    }

    // FIXME: When I change the translator, it is called twice
    setWatchInfo(callback) {
        const observers = [];

        const watch = container => {
            const observed = new WeakMap();

            const observer = new MutationObserver(mutations => {
                mutations.forEach(({ type, attributeName, target }) => {
                    if (type !== "attributes" || attributeName !== "class") return;

                    const isActive = target.classList.contains("active") && !target.classList.contains("disabled");

                    if (observed.get(target) !== isActive) {
                        observed.set(target, isActive);
                        if (isActive) callback(target);
                    }
                });
            });

            observer.observe(container, { attributes: true, subtree: true });
            observers.push(observer);
        };

        [this.locators.changeTranslator, this.locators.changeEpisode].filter(Boolean).forEach(watch);

        return () => observers.forEach(obs => obs.disconnect());
    }
}