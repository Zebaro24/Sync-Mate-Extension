import BaseLocators from "@/locators/BaseLocators";

export default class RezkaLocators extends BaseLocators {
    constructor() {
        super();

        this.setSelectorsForInformationPanel()
        this.setSelectorsForOverlayLoader()
        this.setSelectorsForStatusBox()

        this.setSelectorsForPlayer()

        this.transformToElements();
    }

    setSelectorsForInformationPanel() {
        this.playerFrame = {selector: "#oframecdnplayer", all: false};
        this.playerControlTimeline = {selector: "#cdnplayer_control_timeline", all: false};
    }

    setSelectorsForOverlayLoader() {
        this.playerPlayBtn = {selector: "#oframecdnplayer > pjsdiv:nth-child(20)", all: false};
        this.playerControlTimeline = {selector: "#cdnplayer_control_timeline", all: false};
    }

    setSelectorsForStatusBox() {
        this.ratingTable = {selector: "table.b-post__rating_table", all: false};
        this.socialWrapper = {selector: "div.b-post__social_holder_wrapper", all: false};
    }

    setSelectorsForPlayer() {
        this.player = {selector: "video", all: false};
    }
}