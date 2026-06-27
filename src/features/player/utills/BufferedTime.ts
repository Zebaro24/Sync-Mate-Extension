import { createLogger } from "@/shared/logger";

const log = createLogger("Buffer");

export default class BufferedTime {
    private ranges: { start: number; end: number }[] = [];

    getCurrBuffer(
        currentTime: number,
    ): { start: number; end: number } | undefined {
        // FIXME: Can be less then real
        return this.ranges.find(
            (range) => range.start <= currentTime && range.end >= currentTime,
        );
    }

    getCurrEnd(currentTime: number): number {
        const currBuffer = this.getCurrBuffer(currentTime);
        if (!currBuffer) return currentTime;
        return currBuffer.end;
    }

    getCurrDownTime(currentTime: number): number {
        const currEnd = this.getCurrEnd(currentTime);
        const downTime = currEnd - currentTime;
        // Вызывается с троттлингом (~1/с) и на действиях — не горячий путь.
        log.debug("getCurrDownTime", currentTime, "→", downTime);
        return downTime;
    }

    update(buffered: TimeRanges): void {
        // update() дёргается на каждый progress — логируем только когда меняется
        // число буферных сегментов, чтобы не спамить на каждый тик загрузки.
        const prevCount = this.ranges.length;
        this.ranges = [];
        for (let i = 0; i < buffered.length; i++) {
            let bufferedStart = buffered.start(i);
            if (bufferedStart < 0.1) bufferedStart = 0;
            this.ranges.push({
                start: bufferedStart,
                end: buffered.end(i),
            });
        }
        if (this.ranges.length !== prevCount) {
            log.debug("buffer обновлён, сегментов:", this.ranges.length);
        }
    }
}
