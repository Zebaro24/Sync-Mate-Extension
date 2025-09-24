import { browser } from "#imports";

export async function getItem(key: string) {
    const data = await browser["storage"].local.get(key);
    return data?.[key];
}

export async function setItem(key: string, value: any) {
    await browser["storage"].local.set({ [key]: value });
}
