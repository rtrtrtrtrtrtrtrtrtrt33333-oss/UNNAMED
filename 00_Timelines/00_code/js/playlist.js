console.log('playlist loaded');

document.addEventListener('DOMContentLoaded', () => {
    console.log('playlist init');

    const tracks = [...document.querySelectorAll('.track')];

    console.log('tracks:', tracks.length);
});

document.addEventListener('DOMContentLoaded', () => {
  const tracks = [...document.querySelectorAll('.track')];
  if (!tracks.length) return;

  const nowPlayingTrack = document.querySelector('.now-playing-track');
  const nowPlayingArtist = document.querySelector('.now-playing-artist');
  const playPauseBtn = document.querySelector('.play-pause-btn');
  const prevBtn = document.querySelector('.prev-btn');
  const nextBtn = document.querySelector('.next-btn');
  const progressBar = document.querySelector('.progress-bar');
  const progressFill = document.querySelector('.progress-fill');
  const progressTimeStart = document.querySelector('.progress-time-start');
  const progressTimeEnd = document.querySelector('.progress-time-end');

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
    if (nowPlayingArtist) nowPlayingArtist.textContent = trackArtist || '—';
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
    document.querySelectorAll('.track-play').forEach((btn) => {
      btn.textContent = '▶';
    });

    if (activeTrack) {
      const button = activeTrack.querySelector('.track-play');
      if (button) button.textContent = '❚❚';
    }
  }

  function stopCurrentTrack(resetTime = true) {
    if (!currentAudio || !currentTrack) return;

    currentAudio.pause();
    if (resetTime) currentAudio.currentTime = 0;
    currentTrack.classList.remove('playing');
  }

  function playTrack(track) {
    const audio = track.querySelector('.audio-player');
    if (!audio) return;

    const trackName = track.querySelector('.track-name')?.textContent || 'Unknown track';
    const trackArtist = track.querySelector('.track-artist')?.textContent || '—';

    if (currentAudio && currentTrack && currentTrack !== track) {
      stopCurrentTrack(true);
    }

    currentAudio = audio;
    currentTrack = track;
    isPlaying = true;

    updateNowPlaying(trackName, trackArtist);
    track.classList.add('playing');
    if (playPauseBtn) playPauseBtn.textContent = '❚❚';
    setPlayButtons(track);

    audio.play().then(() => {
      updateProgress();
      startProgressTracking();
    }).catch((error) => {
      isPlaying = false;
      track.classList.remove('playing');
      if (playPauseBtn) playPauseBtn.textContent = '▶';
      setPlayButtons(null);
      stopProgressTracking();
      console.error('Error playing audio:', error);
    });

    audio.onended = playNext;
  }

  function pauseTrack() {
    if (!currentAudio || !isPlaying) return;

    currentAudio.pause();
    isPlaying = false;
    currentTrack?.classList.remove('playing');
    if (playPauseBtn) playPauseBtn.textContent = '▶';
    setPlayButtons(null);
    stopProgressTracking();
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
    if (playPauseBtn) playPauseBtn.textContent = '❚❚';
    setPlayButtons(currentTrack);

    currentAudio.play().then(startProgressTracking).catch((error) => {
      isPlaying = false;
      currentTrack?.classList.remove('playing');
      if (playPauseBtn) playPauseBtn.textContent = '▶';
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
