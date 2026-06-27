import RezkaLocators from "./RezkaLocators";
import { createLogger } from "@/shared/logger";

const log = createLogger("Locators");

export function pickLocators(hostname: string) {
    if (hostname.endsWith("rezka.ag")) {
        log.debug("pickLocators →", "RezkaLocators", `(${hostname})`);
        return new RezkaLocators();
    }
    log.debug("pickLocators → undefined (нет локаторов для", hostname + ")");
}
