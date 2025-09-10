import BaseLocators from "@/locators/BaseLocators";

export default class RezkaLocators extends BaseLocators {
    constructor() {
        super();

        this.setSelectorsForInformationPanel();
        this.setSelectorsForOverlayLoader();
        this.setSelectorsForStatusBox();

        this.setSelectorsForPlayer();

        this.setSelectorsForParseInfo();
        this.setSelectorsForChange();
    }

    setSelectorsForInformationPanel() {
        this.playerFrame = this.defineSelector("#oframecdnplayer");
        this.playerControlTimeline = this.defineSelector("#cdnplayer_control_timeline");
    }

    setSelectorsForOverlayLoader() {
        this.playerPlayBtn = this.defineSelector("#oframecdnplayer > pjsdiv:nth-child(20)");
        this.playerControlTimeline = this.defineSelector("#cdnplayer_control_timeline");
    }

    setSelectorsForStatusBox() {
        this.ratingTable = this.defineSelector("table.b-post__rating_table");
        this.socialWrapper = this.defineSelector("div.b-post__social_holder_wrapper");
    }

    setSelectorsForPlayer() {
        this.player = this.defineSelector("video", false, true);
    }

    setSelectorsForParseInfo() {
        this.title = this.defineSelector("h1");
        this.translator = this.defineSelector(".b-translator__item.active", false, true);
        this.episode = this.defineSelector(".b-simple_episode__item.active", false, true);
    }

    setSelectorsForChange() {
        this.changeTranslator = this.defineSelector("#translators-list");
        this.changeEpisode = this.defineSelector("#simple-episodes-tabs");
    }
}