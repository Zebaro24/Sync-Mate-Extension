const video = document.querySelector('video');
if (!video) {
    console.log('Video element not found');
}

const statusBox = document.createElement('div');
statusBox.style.position = 'fixed';
statusBox.style.top = '20px';
statusBox.style.right = '20px';
statusBox.style.padding = '10px 15px';
statusBox.style.backgroundColor = 'rgba(0,0,0,0.7)';
statusBox.style.color = '#fff';
statusBox.style.fontSize = '14px';
statusBox.style.borderRadius = '5px';
statusBox.style.zIndex = 10000;
statusBox.textContent = 'Paused';

document.body.appendChild(statusBox);

let timerInterval;

function startTimer() {
    timerInterval = setInterval(() => {
        const currentTime = Math.floor(video.currentTime);
        statusBox.textContent = `Playing - ${currentTime}s`;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}


video.addEventListener('play', () => {
    statusBox.textContent = `Playing - ${Math.floor(video.currentTime)}s`;
    startTimer();
});

video.addEventListener('pause', () => {
    stopTimer();
    statusBox.textContent = `Paused - ${Math.floor(video.currentTime)}s`;
});

video.addEventListener('ended', () => {
    stopTimer();
    statusBox.textContent = 'Ended';
});
