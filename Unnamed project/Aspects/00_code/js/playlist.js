document.addEventListener('DOMContentLoaded', () => {
  const ICONS = {
    play: '▶',
    pause: '⏸',
    prev: '⏮',
    next: '⏭',
  };

  const playlistRoots = [...document.querySelectorAll('.playlist-layout')]
    .filter((root) => root.querySelector('.track'));

  if (!playlistRoots.length && document.querySelector('.track')) {
    playlistRoots.push(document);
  }

  let activePlayer = null;

  playlistRoots.forEach((root) => {
    const tracks = [...root.querySelectorAll('.track')];
    if (!tracks.length) return;

    const nowPlayingTrack = root.querySelector('.now-playing-track');
    const nowPlayingArtist = root.querySelector('.now-playing-artist');
    const playPauseBtn = root.querySelector('.play-pause-btn');
    const prevBtn = root.querySelector('.prev-btn');
    const nextBtn = root.querySelector('.next-btn');
    const progressBar = root.querySelector('.progress-bar');
    const progressFill = root.querySelector('.progress-fill');
    const progressTimeStart = root.querySelector('.progress-time-start');
    const progressTimeEnd = root.querySelector('.progress-time-end');

    let currentAudio = null;
    let currentTrack = null;
    let isPlaying = false;
    let progressInterval = null;

    function formatTime(seconds) {
      if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function updateNowPlaying(trackName, trackArtist) {
      if (nowPlayingTrack) nowPlayingTrack.textContent = trackName || 'No track playing';
      if (nowPlayingArtist) nowPlayingArtist.textContent = trackArtist || '-';
    }

    function updateProgress() {
      if (!currentAudio || !progressFill || !progressTimeStart || !progressTimeEnd) return;

      if (!Number.isFinite(currentAudio.duration) || currentAudio.duration <= 0) {
        progressFill.style.width = '0%';
        progressTimeStart.textContent = formatTime(currentAudio.currentTime || 0);
        progressTimeEnd.textContent = '0:00';
        return;
      }

      const progress = (currentAudio.currentTime / currentAudio.duration) * 100;
      progressFill.style.width = `${progress}%`;
      progressTimeStart.textContent = formatTime(currentAudio.currentTime);
      progressTimeEnd.textContent = formatTime(currentAudio.duration);
    }

    function startProgressTracking() {
      clearInterval(progressInterval);
      progressInterval = setInterval(updateProgress, 100);
    }

    function stopProgressTracking() {
      clearInterval(progressInterval);
      progressInterval = null;
    }

    function setPlayButtons(activeTrack) {
      root.querySelectorAll('.track-play').forEach((btn) => {
        btn.textContent = ICONS.play;
      });

      if (activeTrack) {
        const button = activeTrack.querySelector('.track-play');
        if (button) button.textContent = ICONS.pause;
      }
    }

    function stopCurrentTrack(resetTime = true) {
      if (!currentAudio || !currentTrack) return;

      currentAudio.pause();
      if (resetTime) currentAudio.currentTime = 0;
      currentTrack.classList.remove('playing');
      isPlaying = false;
      if (playPauseBtn) playPauseBtn.textContent = ICONS.play;
      setPlayButtons(null);
      stopProgressTracking();
    }

    function pauseTrack() {
      stopCurrentTrack(false);
    }

    function playTrack(track) {
      const audio = track.querySelector('.audio-player');
      if (!audio) return;

      if (activePlayer && activePlayer !== player) {
        activePlayer.stopCurrentTrack(false);
      }
      activePlayer = player;

      const trackName = track.querySelector('.track-name')?.textContent || 'Unknown track';
      const trackArtist = track.querySelector('.track-artist')?.textContent || '-';

      if (currentAudio && currentTrack && currentTrack !== track) {
        stopCurrentTrack(true);
      }

      currentAudio = audio;
      currentTrack = track;
      isPlaying = true;

      updateNowPlaying(trackName, trackArtist);
      track.classList.add('playing');
      if (playPauseBtn) playPauseBtn.textContent = ICONS.pause;
      setPlayButtons(track);

      audio.play().then(() => {
        updateProgress();
        startProgressTracking();
      }).catch((error) => {
        isPlaying = false;
        track.classList.remove('playing');
        if (playPauseBtn) playPauseBtn.textContent = ICONS.play;
        setPlayButtons(null);
        stopProgressTracking();
        console.error('Error playing audio:', error);
      });

      audio.onended = playNext;
    }

    function togglePlayPause() {
      if (!currentAudio) {
        playTrack(tracks[0]);
        return;
      }

      if (isPlaying) {
        pauseTrack();
        return;
      }

      isPlaying = true;
      currentTrack?.classList.add('playing');
      if (playPauseBtn) playPauseBtn.textContent = ICONS.pause;
      setPlayButtons(currentTrack);

      currentAudio.play().then(startProgressTracking).catch((error) => {
        isPlaying = false;
        currentTrack?.classList.remove('playing');
        if (playPauseBtn) playPauseBtn.textContent = ICONS.play;
        setPlayButtons(null);
        console.error('Error playing audio:', error);
      });
    }

    function playNext() {
      const currentIndex = currentTrack ? tracks.indexOf(currentTrack) : -1;
      playTrack(tracks[(currentIndex + 1) % tracks.length]);
    }

    function playPrev() {
      const currentIndex = currentTrack ? tracks.indexOf(currentTrack) : 0;
      playTrack(tracks[currentIndex <= 0 ? tracks.length - 1 : currentIndex - 1]);
    }

    const player = {
      stopCurrentTrack,
    };

    if (prevBtn) prevBtn.textContent = ICONS.prev;
    if (playPauseBtn) playPauseBtn.textContent = ICONS.play;
    if (nextBtn) nextBtn.textContent = ICONS.next;

    tracks.forEach((track) => {
      const playBtn = track.querySelector('.track-play');
      const audio = track.querySelector('.audio-player');

      playBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentTrack === track && isPlaying) {
          pauseTrack();
        } else {
          playTrack(track);
        }
      });

      track.addEventListener('click', (e) => {
        if (e.target !== playBtn) playBtn?.click();
      });

      audio?.addEventListener('loadedmetadata', () => {
        const trackTime = track.querySelector('.track-time');
        if (trackTime) trackTime.textContent = formatTime(audio.duration);
        updateProgress();
      });
    });

    playPauseBtn?.addEventListener('click', togglePlayPause);
    nextBtn?.addEventListener('click', playNext);
    prevBtn?.addEventListener('click', playPrev);

    progressBar?.addEventListener('click', (e) => {
      if (!currentAudio || !Number.isFinite(currentAudio.duration) || currentAudio.duration <= 0) return;

      const rect = progressBar.getBoundingClientRect();
      currentAudio.currentTime = ((e.clientX - rect.left) / rect.width) * currentAudio.duration;
      updateProgress();
    });

    const firstTrack = tracks[0];
    updateNowPlaying(
      firstTrack.querySelector('.track-name')?.textContent,
      firstTrack.querySelector('.track-artist')?.textContent
    );
    setPlayButtons(null);
  });
});
