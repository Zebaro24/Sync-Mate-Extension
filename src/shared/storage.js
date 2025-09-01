import {browser} from '#imports';


export async function getItem(key) {
    const data = await browser["storage"].local.get(key);
    return data?.[key];
}

export async function setItem(key, value) {
    await browser["storage"].local.set({[key]: value});
}
