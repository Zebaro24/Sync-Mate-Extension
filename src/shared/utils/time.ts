export function roundTime(t: string | number) {
    return Math.round(Number(t || 0) * 1000) / 1000;
}

export function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const paddedSecs = secs.toString().padStart(2, "0");
    return `${mins}:${paddedSecs}`;
}
