import RezkaLocators from "./RezkaLocators";

export function pickLocators(hostname: string) {
    if (hostname.endsWith("rezka.ag")) return new RezkaLocators();
}
