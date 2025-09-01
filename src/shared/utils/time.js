export function roundTime(t) {
    return Math.round(Number(t || 0) * 1000) / 1000;
}