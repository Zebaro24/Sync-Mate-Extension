export default class BaseLocators {
    defineSelector(selector, all = false, lazy = false) {
        const query = all ? document.querySelectorAll.bind(document) : document.querySelector.bind(document);
        return lazy ? () => query(selector) : query(selector);
    }
}