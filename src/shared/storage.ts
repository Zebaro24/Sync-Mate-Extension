import { browser } from "#imports";

export async function getItem<T = string>(key: string): Promise<T | undefined> {
    const data = await browser["storage"].local.get(key);
    return data?.[key] as T | undefined;
}

export async function setItem(key: string, value: any) {
    await browser["storage"].local.set({ [key]: value });
}
