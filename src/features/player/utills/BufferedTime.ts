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
        return currEnd - currentTime;
    }

    update(buffered: TimeRanges): void {
        console.log(this.ranges);
        this.ranges = [];
        for (let i = 0; i < buffered.length; i++) {
            let bufferedStart = buffered.start(i);
            if (bufferedStart < 0.1) bufferedStart = 0;
            this.ranges.push({
                start: bufferedStart,
                end: buffered.end(i),
            });
        }
    }
}
