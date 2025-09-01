import RezkaLocators from "./RezkaLocators";

export function pickLocators(hostname) {
    if (hostname.endsWith("rezka.ag")) return new RezkaLocators();
}
