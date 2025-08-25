export default class BufferedTime {
    constructor() {
        this.ranges = []
    }

    getCurrBuffer(currentTime) {
        return this.ranges.find(range => range.start <= currentTime && range.end >= currentTime)
    }

    getCurrEnd(currentTime) {
        const currBuffer = this.getCurrBuffer(currentTime)
        if (!currBuffer) return currentTime
        return currBuffer.end
    }

    getCurrDownTime(currentTime) {
        const currEnd = this.getCurrEnd(currentTime)
        return currEnd - currentTime
    }

    update(buffered) {
        console.log(this.ranges)
        this.ranges = []
        for (let i = 0; i < buffered.length; i++) {
            let bufferedStart = buffered.start(i)
            if (bufferedStart < 0.1) bufferedStart = 0
            this.ranges.push({
                start: bufferedStart,
                end: buffered.end(i)
            });
        }
    }
}