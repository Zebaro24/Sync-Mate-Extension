export default class BaseLocators {
    public player!: () => HTMLElement | null;

    public playerPlayBtn!: HTMLElement;
    public playerControlTimeline!: HTMLElement;

    defineSelector<T extends boolean = false>(
        selector: string,
        all?: T,
    ): T extends true ? NodeListOf<HTMLElement> : HTMLElement {
        if (all) {
            const nodes = document.querySelectorAll<HTMLElement>(selector);
            if (nodes.length === 0)
                throw new Error(`No elements found for selector "${selector}"`);
            return nodes as any;
        } else {
            const el = document.querySelector<HTMLElement>(selector);
            if (!el)
                throw new Error(`Element not found for selector "${selector}"`);
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
        return () => query(selector) as any;
    }
}
