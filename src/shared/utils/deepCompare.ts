export function deepCompare(
    obj1: Record<string, any>,
    obj2: Record<string, any>,
    ignoreKeys: string[] = [],
): boolean {
    function clean(obj: Record<string, any>, parentKey = "") {
        const result: Record<string, any> = {};
        for (const [key, value] of Object.entries(obj)) {
            const fullKey = parentKey ? `${parentKey}.${key}` : key;
            if (!ignoreKeys.includes(fullKey)) {
                if (typeof value === "object" && value !== null) {
                    result[key] = clean(value, fullKey);
                } else {
                    result[key] = value;
                }
            }
        }
        return result;
    }

    return JSON.stringify(clean(obj1)) === JSON.stringify(clean(obj2));
}
