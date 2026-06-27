// Ждёт появления элемента в DOM. Резолвит сразу, если элемент уже есть; по
// таймауту резолвит null. Наблюдает за всем деревом через MutationObserver и
// всегда отключает наблюдатель перед резолвом.
export function waitForElement(
    selector: string,
    timeout = 15000,
): Promise<HTMLElement | null> {
    return new Promise((resolve) => {
        const existing = document.querySelector<HTMLElement>(selector);
        if (existing) {
            resolve(existing);
            return;
        }

        let timer: ReturnType<typeof setTimeout>;

        const observer = new MutationObserver(() => {
            const el = document.querySelector<HTMLElement>(selector);
            if (!el) return;
            clearTimeout(timer);
            observer.disconnect();
            resolve(el);
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
        });

        timer = setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, timeout);
    });
}
