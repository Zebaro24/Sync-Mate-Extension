import BaseLocators from "@/locators/BaseLocators";

export default class RezkaLocators extends BaseLocators {
    playerFrame!: HTMLElement;
    ratingTable!: HTMLElement;
    socialWrapper!: HTMLElement;
    title!: HTMLElement;

    // lazy
    changeTranslator!: () => HTMLElement | null;
    changeEpisode!: () => HTMLElement | null;
    translator!: () => HTMLElement | null;
    episode!: () => HTMLElement | null;

    constructor() {
        super();

        // --- Information Panel ---
        this.playerFrame = this.defineSelector("#oframecdnplayer");
        this.playerControlTimeline = this.defineSelector(
            "#cdnplayer_control_timeline",
        );

        // --- Overlay Loader ---
        this.playerPlayBtn = this.defineSelector(
            "#oframecdnplayer > pjsdiv:nth-child(20)",
        );

        // --- Status Box ---
        this.ratingTable = this.defineSelector("table.b-post__rating_table");
        this.socialWrapper = this.defineSelector(
            "div.b-post__social_holder_wrapper",
        );

        // --- Player ---
        this.player = this.defineSelectorLazy("video");

        // --- Parse Info ---
        this.title = this.defineSelector("h1");
        this.translator = this.defineSelectorLazy(".b-translator__item.active");
        this.episode = this.defineSelectorLazy(
            ".b-simple_episode__item.active",
        );

        // --- Change ---
        this.changeTranslator = this.defineSelectorLazy("#translators-list");
        this.changeEpisode = this.defineSelectorLazy("#simple-episodes-tabs");
    }
}
