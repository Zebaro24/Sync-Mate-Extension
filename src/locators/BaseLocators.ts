import { createLogger } from "@/shared/logger";

const log = createLogger("Locators");

export default class BaseLocators {
    public player!: () => HTMLElement | null;

    public playerPlayBtn!: () => HTMLElement | null;
    public playerControlTimeline!: HTMLElement;

    defineSelector<T extends boolean = false>(
        selector: string,
        all?: T,
    ): T extends true ? NodeListOf<HTMLElement> : HTMLElement {
        if (all) {
            const nodes = document.querySelectorAll<HTMLElement>(selector);
            if (nodes.length === 0) {
                log.warn(`miss (all): "${selector}"`);
                throw new Error(
                    `[${this.constructor.name}] no elements found for selector "${selector}"`,
                );
            }
            log.debug(`hit (all): "${selector}" ×${nodes.length}`);
            return nodes as any;
        } else {
            const el = document.querySelector<HTMLElement>(selector);
            if (!el) {
                log.warn(`miss: "${selector}"`);
                throw new Error(
                    `[${this.constructor.name}] element not found for selector "${selector}"`,
                );
            }
            log.debug(`hit: "${selector}"`);
            return el as any;
        }
    }

    defineSelectorLazy<T extends boolean = false>(
        selector: string,
        all?: T,
    ): () => T extends true ? NodeListOf<HTMLElement> : HTMLElement | null {
        const query = all
            ? document.querySelectorAll.bind(document)
            : document.querySelector.bind(document);
        return () => {
            const result = query(selector) as any;
            // Ленивые резолверы дёргаются на действиях/парсинге, а не в горячих
            // циклах (хендлеры используют закэшированный this.player), поэтому
            // умеренный лог hit/miss безопасен.
            const found = all
                ? (result as NodeListOf<HTMLElement>).length > 0
                : result !== null;
            log.debug(`lazy ${found ? "hit" : "miss"}: "${selector}"`);
            return result;
        };
    }
}
