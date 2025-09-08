import BaseLocators from "@/locators/BaseLocators";

export default class RezkaLocators extends BaseLocators {
    constructor() {
        super();

        this.setSelectorsForInformationPanel()
        this.setSelectorsForOverlayLoader()
        this.setSelectorsForStatusBox()

        this.setSelectorsForPlayer()
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
        this.player = this.defineSelector("video");
    }
}