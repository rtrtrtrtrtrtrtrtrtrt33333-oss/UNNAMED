(() => {
    const config = window.siteMusic || {};
    const audio = document.getElementById('site-music-audio');
    const status = document.getElementById('site-music-status');
    const play = document.getElementById('music-play');
    const seek = document.getElementById('music-seek');
    const volume = document.getElementById('music-volume');
    const elapsed = document.getElementById('music-elapsed');
    const duration = document.getElementById('music-duration');
    const format = seconds => {
        const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
        return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
    };
    document.getElementById('site-music-title').textContent = config.title || 'Music';
    document.getElementById('site-music-artist').textContent = config.artist || '';
    audio.volume = Number.isFinite(config.volume) ? Math.max(0, Math.min(1, config.volume)) : 0.4;
    volume.value = audio.volume;
    audio.loop = config.loop === true;
    volume.addEventListener('input', () => { audio.volume = Number(volume.value); });
    function update() {
        const ready = Number.isFinite(audio.duration) && audio.duration > 0;
        seek.disabled = !ready || Boolean(audio.error);
        seek.value = ready ? audio.currentTime / audio.duration * 100 : 0;
        seek.setAttribute('aria-valuetext', `${format(audio.currentTime)} / ${format(audio.duration)}`);
        elapsed.textContent = format(audio.currentTime);
        duration.textContent = format(audio.duration);
        play.textContent = audio.paused ? '\u25B6' : '\u275A\u275A';
        play.setAttribute('aria-label', audio.paused ? 'Play music' : 'Pause music');
    }
    play.addEventListener('click', async () => {
        if (!audio.paused) { audio.pause(); return; }
        try { await audio.play(); status.textContent = ''; }
        catch { status.textContent = 'Unable to play this track. Try again.'; }
    });
    seek.addEventListener('input', () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
            audio.currentTime = Number(seek.value) / 100 * audio.duration;
            update();
        }
    });
    ['loadedmetadata', 'durationchange', 'timeupdate', 'play', 'pause', 'ended'].forEach(event => audio.addEventListener(event, update));
    audio.addEventListener('error', () => {
        status.textContent = 'This track could not be loaded.';
        play.disabled = true;
        update();
    });
    audio.addEventListener('canplay', () => { play.disabled = false; status.textContent = ''; });
    if (config.src) {
        audio.src = config.src;
        play.disabled = false;
    }
    update();
})();
