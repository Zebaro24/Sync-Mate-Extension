export default class BaseLocators {
    transformToElements() {
        for (const key of Object.keys(this)) {
            const value = this[key];

            if (value && typeof value === "object" && "selector" in value) {
                if (value.all) {
                    this[key] = document.querySelectorAll(value.selector);
                } else {
                    this[key] = document.querySelector(value.selector);
                }
            }
        }
    }
}