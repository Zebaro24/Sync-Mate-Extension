export function deepCompare(obj1, obj2, ignoreKeys = []) {
    function clean(obj, parentKey = "") {
        const result = {};
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
