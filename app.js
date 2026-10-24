/**
 * AI 学习音频随身听 - 核心播放引擎与交互逻辑
 */

(function () {
  'use strict';

  // ==========================================
  // 常量与配置
  // ==========================================
  const STORAGE_KEYS = {
    PROGRESS: 'ai_audio_progress_v1',
    SPEED: 'ai_audio_speed_v1',
    LAST_ID: 'ai_audio_last_id_v1',
    PLAY_MODE: 'ai_audio_play_mode_v1',
    VOLUME: 'ai_audio_volume_v1'
  };

  const PLAY_MODES = ['sequential', 'all-repeat', 'single-repeat'];
  const PLAY_MODE_LABELS = {
    'sequential': '播放模式：顺序播放',
    'all-repeat': '播放模式：列表循环',
    'single-repeat': '播放模式：单曲循环'
  };

  const SPEED_STEPS = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

  // ==========================================
  // 状态管理
  // ==========================================
  const state = {
    playlist: [],
    filteredList: [],
    currentIndex: -1,
    currentTrack: null,
    isPlaying: false,
    playMode: localStorage.getItem(STORAGE_KEYS.PLAY_MODE) || 'sequential',
    playbackSpeed: parseFloat(localStorage.getItem(STORAGE_KEYS.SPEED)) || 1.0,
    searchKeyword: '',
    sortAsc: true,
    sleepTimerId: null,
    sleepTimerRemaining: 0,
    stopOnTrackEnd: false,
    progressMap: JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESS) || '{}'),
    isDraggingProgress: false
  };

  // ==========================================
  // DOM 节点引用
  // ==========================================
  const elements = {
    audio: document.getElementById('audioPlayer'),
    playlistContainer: document.getElementById('playlistContainer'),
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    filteredCount: document.getElementById('filteredCount'),
    sortOrderBtn: document.getElementById('sortOrderBtn'),
    audioCountBadge: document.getElementById('audioCountBadge'),
    
    // 播放器主界面
    waveformBox: document.getElementById('waveformBox'),
    playingStatus: document.getElementById('playingStatus'),
    currentTrackTitle: document.getElementById('currentTrackTitle'),
    currentTrackSize: document.getElementById('currentTrackSize'),
    currentTrackProgressTag: document.getElementById('currentTrackProgressTag'),
    
    // 进度条
    progressBarContainer: document.getElementById('progressBarContainer'),
    progressBar: document.getElementById('progressBar'),
    progressHandle: document.getElementById('progressHandle'),
    currentTime: document.getElementById('currentTime'),
    totalDuration: document.getElementById('totalDuration'),
    
    // 按钮群
    playPauseBtn: document.getElementById('playPauseBtn'),
    playIcon: document.getElementById('playIcon'),
    pauseIcon: document.getElementById('pauseIcon'),
    rewindBtn: document.getElementById('rewindBtn'),
    forwardBtn: document.getElementById('forwardBtn'),
    nextTrackBtn: document.getElementById('nextTrackBtn'),
    playModeBtn: document.getElementById('playModeBtn'),
    speedSelector: document.getElementById('speedSelector'),
    
    // 音量与静音
    muteBtn: document.getElementById('muteBtn'),
    volumeSlider: document.getElementById('volumeSlider'),
    volumeIcon: document.getElementById('volumeIcon'),
    
    // 本地文件导入
    dropZone: document.getElementById('dropZone'),
    localFileInput: document.getElementById('localFileInput'),
    
    // 弹层
    sleepTimerBtn: document.getElementById('sleepTimerBtn'),
    timerTag: document.getElementById('timerTag'),
    timerModal: document.getElementById('timerModal'),
    closeTimerModal: document.getElementById('closeTimerModal'),
    shortcutsBtn: document.getElementById('shortcutsBtn'),
    shortcutsModal: document.getElementById('shortcutsModal'),
    closeShortcutsModal: document.getElementById('closeShortcutsModal')
  };

  // ==========================================
  // 工具函数
  // ==========================================
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  // ==========================================
  // 初始化与数据加载
  // ==========================================
  async function init() {
    setupEventListeners();
    setupMediaSession();
    restoreSettings();

    try {
      const response = await fetch('data/playlist.json');
      if (!response.ok) throw new Error('Failed to load playlist.json');
      const data = await response.json();
      state.playlist = data;
      state.filteredList = [...data];
      
      elements.audioCountBadge.textContent = `${data.length} 期音频`;
      renderPlaylist();

      // 恢复上次收听的音频
      const lastId = localStorage.getItem(STORAGE_KEYS.LAST_ID);
      const targetIndex = state.playlist.findIndex(item => item.id === lastId);
      if (targetIndex >= 0) {
        loadTrack(targetIndex, false);
      } else if (state.playlist.length > 0) {
        loadTrack(0, false);
      }
    } catch (err) {
      console.error('音频清单加载异常:', err);
      elements.playlistContainer.innerHTML = `
        <div class="loading-state">
          <p style="color: #ef4444;">音频清单加载失败，请检查网络或刷新重试</p>
        </div>
      `;
    }
  }

  function restoreSettings() {
    // 恢复音量
    const savedVolume = localStorage.getItem(STORAGE_KEYS.VOLUME);
    if (savedVolume !== null) {
      const vol = parseFloat(savedVolume);
      elements.audio.volume = vol;
      elements.volumeSlider.value = vol;
    }
    // 恢复倍速
    setPlaybackSpeed(state.playbackSpeed);
    // 恢复播放模式提示
    updatePlayModeUI();
  }

  // ==========================================
  // 播放列表渲染与筛选
  // ==========================================
  function renderPlaylist() {
    if (state.filteredList.length === 0) {
      elements.playlistContainer.innerHTML = `
        <div class="loading-state">
          <p>没有找到匹配的音频</p>
        </div>
      `;
      elements.filteredCount.textContent = '共 0 个结果';
      return;
    }

    elements.filteredCount.textContent = state.searchKeyword 
      ? `搜索结果：${state.filteredList.length} 条` 
      : `全部音频 (${state.filteredList.length})`;

    const html = state.filteredList.map((track) => {
      const isActive = state.currentTrack && state.currentTrack.id === track.id;
      const progressData = state.progressMap[track.id];
      const pct = progressData ? Math.min(100, Math.round(progressData.percentage || 0)) : 0;
      
      let progressTag = '';
      if (pct > 0) {
        progressTag = pct >= 98 
          ? `<span class="progress-pill" style="color: #10b981; background: rgba(16,185,129,0.15);">已学完</span>`
          : `<span class="progress-pill">已学 ${pct}%</span>`;
      }

      return `
        <div class="audio-card ${isActive ? 'active' : ''}" data-id="${track.id}">
          <div class="audio-card-left">
            <span class="order-num">${track.order < 100 ? String(track.order).padStart(2, '0') : '#'}</span>
            <div class="card-content">
              <div class="card-title" title="${track.title}">${track.title}</div>
              <div class="card-subtext">
                <span>${track.sizeFormatted || ''}</span>
                ${progressTag}
              </div>
            </div>
          </div>
          <div class="audio-card-right">
            <svg class="play-indicator-icon" width="20" height="20" viewBox="0 0 24 24" fill="${isActive && state.isPlaying ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              ${isActive && state.isPlaying 
                ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>' 
                : '<polygon points="5 3 19 12 5 21 5 3"/>'}
            </svg>
          </div>
          ${pct > 0 ? `<div class="card-progress-line" style="width: ${pct}%;"></div>` : ''}
        </div>
      `;
    }).join('');

    elements.playlistContainer.innerHTML = html;
  }

  function filterPlaylist() {
    const kw = state.searchKeyword.trim().toLowerCase();
    elements.clearSearchBtn.style.display = kw ? 'block' : 'none';

    if (!kw) {
      state.filteredList = [...state.playlist];
    } else {
      state.filteredList = state.playlist.filter(item => 
        item.title.toLowerCase().includes(kw) || item.filename.toLowerCase().includes(kw)
      );
    }

    if (!state.sortAsc) {
      state.filteredList.reverse();
    }
    renderPlaylist();
  }

  // ==========================================
  // 核心播放控制
  // ==========================================
  function loadTrack(index, autoPlay = true) {
    if (index < 0 || index >= state.playlist.length) return;
    
    state.currentIndex = index;
    state.currentTrack = state.playlist[index];
    const track = state.currentTrack;

    localStorage.setItem(STORAGE_KEYS.LAST_ID, track.id);

    elements.currentTrackTitle.textContent = track.title;
    elements.currentTrackTitle.title = track.title;
    elements.currentTrackSize.textContent = track.sizeFormatted || '';

    // 检查历史断点
    const saved = state.progressMap[track.id];
    let resumeTime = 0;
    if (saved && saved.currentTime && saved.percentage < 98) {
      resumeTime = saved.currentTime;
      elements.currentTrackProgressTag.textContent = `上次听到 ${formatTime(saved.currentTime)}`;
    } else if (saved && saved.percentage >= 98) {
      elements.currentTrackProgressTag.textContent = '已学完 (再次收听)';
    } else {
      elements.currentTrackProgressTag.textContent = '首次收听';
    }

    // 设置音频源
    elements.audio.src = track.url;
    elements.audio.playbackRate = state.playbackSpeed;
    if ('preservesPitch' in elements.audio) {
      elements.audio.preservesPitch = true;
    }

    // 监听 loadedmetadata 恢复进度
    const onLoadedMetadata = () => {
      elements.totalDuration.textContent = formatTime(elements.audio.duration);
      if (resumeTime > 0 && resumeTime < elements.audio.duration) {
        elements.audio.currentTime = resumeTime;
        updateProgressUI(resumeTime, elements.audio.duration);
      }
      elements.audio.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
    elements.audio.addEventListener('loadedmetadata', onLoadedMetadata);

    updateMediaSessionMetadata(track);
    renderPlaylist();

    if (autoPlay) {
      playAudio();
    } else {
      pauseAudio();
    }
  }

  function playAudio() {
    elements.audio.play().then(() => {
      state.isPlaying = true;
      updatePlayStateUI();
    }).catch(err => {
      console.warn('播放被阻止或失败:', err);
      state.isPlaying = false;
      updatePlayStateUI();
    });
  }

  function pauseAudio() {
    elements.audio.pause();
    state.isPlaying = false;
    updatePlayStateUI();
  }

  function togglePlayPause() {
    if (state.currentIndex === -1 && state.playlist.length > 0) {
      loadTrack(0, true);
      return;
    }
    if (elements.audio.paused) {
      playAudio();
    } else {
      pauseAudio();
    }
  }

  function updatePlayStateUI() {
    if (state.isPlaying) {
      elements.playIcon.style.display = 'none';
      elements.pauseIcon.style.display = 'block';
      elements.waveformBox.classList.add('playing');
      elements.playingStatus.textContent = '正在播放';
    } else {
      elements.playIcon.style.display = 'block';
      elements.pauseIcon.style.display = 'none';
      elements.waveformBox.classList.remove('playing');
      elements.playingStatus.textContent = '已暂停';
    }
    renderPlaylist();
  }

  function seekRelative(seconds) {
    if (!elements.audio.duration) return;
    const target = Math.min(elements.audio.duration, Math.max(0, elements.audio.currentTime + seconds));
    elements.audio.currentTime = target;
  }

  function playNextTrack() {
    if (state.playlist.length === 0) return;

    if (state.playMode === 'single-repeat') {
      elements.audio.currentTime = 0;
      playAudio();
      return;
    }

    let nextIndex = state.currentIndex + 1;
    if (nextIndex >= state.playlist.length) {
      if (state.playMode === 'all-repeat') {
        nextIndex = 0;
      } else {
        pauseAudio();
        elements.playingStatus.textContent = '播放完毕';
        return;
      }
    }
    loadTrack(nextIndex, true);
  }

  function playPreviousTrack() {
    if (state.playlist.length === 0) return;
    // 如果播放超过 3 秒，先回到本曲开头
    if (elements.audio.currentTime > 3) {
      elements.audio.currentTime = 0;
      return;
    }
    let prevIndex = state.currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = state.playlist.length - 1;
    }
    loadTrack(prevIndex, true);
  }

  // ==========================================
  // 倍速控制
  // ==========================================
  function setPlaybackSpeed(speed) {
    state.playbackSpeed = speed;
    elements.audio.playbackRate = speed;
    if ('preservesPitch' in elements.audio) {
      elements.audio.preservesPitch = true;
    }
    localStorage.setItem(STORAGE_KEYS.SPEED, speed);

    // 更新按钮状态
    const buttons = elements.speedSelector.querySelectorAll('.speed-pill');
    buttons.forEach(btn => {
      const s = parseFloat(btn.dataset.speed);
      btn.classList.toggle('active', Math.abs(s - speed) < 0.01);
    });
  }

  function cycleSpeed() {
    const current = state.playbackSpeed;
    const idx = SPEED_STEPS.findIndex(s => Math.abs(s - current) < 0.01);
    const nextIdx = (idx + 1) % SPEED_STEPS.length;
    setPlaybackSpeed(SPEED_STEPS[nextIdx]);
  }

  // ==========================================
  // 进度保存与显示
  // ==========================================
  function updateProgressUI(current, duration) {
    elements.currentTime.textContent = formatTime(current);
    if (duration && !isNaN(duration)) {
      elements.totalDuration.textContent = formatTime(duration);
      const pct = Math.min(100, (current / duration) * 100);
      elements.progressBar.style.width = `${pct}%`;
      elements.progressHandle.style.left = `${pct}%`;
    }
  }

  const saveProgressThrottled = throttle((trackId, current, duration) => {
    if (!trackId || !duration || isNaN(duration)) return;
    const percentage = (current / duration) * 100;
    state.progressMap[trackId] = {
      currentTime: current,
      duration: duration,
      percentage: percentage,
      updatedAt: Date.now()
    };
    try {
      localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(state.progressMap));
    } catch (e) {
      console.warn('存储进度失败:', e);
    }
  }, 1000);

  // ==========================================
  // 播放模式切换
  // ==========================================
  function cyclePlayMode() {
    const currentIdx = PLAY_MODES.indexOf(state.playMode);
    const nextIdx = (currentIdx + 1) % PLAY_MODES.length;
    state.playMode = PLAY_MODES[nextIdx];
    localStorage.setItem(STORAGE_KEYS.PLAY_MODE, state.playMode);
    updatePlayModeUI();
  }

  function updatePlayModeUI() {
    elements.playModeBtn.title = PLAY_MODE_LABELS[state.playMode];
    let iconSvg = '';
    if (state.playMode === 'single-repeat') {
      iconSvg = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          <text x="10" y="15" font-size="8" font-weight="bold" fill="currentColor">1</text>
        </svg>
      `;
    } else if (state.playMode === 'all-repeat') {
      iconSvg = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      `;
    } else {
      // 顺序播放
      iconSvg = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="16" y2="12" />
          <line x1="4" y1="18" x2="12" y2="18" />
          <polygon points="18 15 22 18 18 21" fill="currentColor"/>
        </svg>
      `;
    }
    elements.playModeBtn.innerHTML = iconSvg;
  }

  // ==========================================
  // 定时睡眠逻辑
  // ==========================================
  function setSleepTimer(minutes) {
    if (state.sleepTimerId) {
      clearInterval(state.sleepTimerId);
      state.sleepTimerId = null;
    }
    state.stopOnTrackEnd = false;

    if (minutes === 0) {
      elements.timerTag.style.display = 'none';
      return;
    }

    if (minutes === -1) {
      // 播完当前停止
      state.stopOnTrackEnd = true;
      elements.timerTag.textContent = '本期';
      elements.timerTag.style.display = 'block';
      return;
    }

    state.sleepTimerRemaining = minutes * 60;
    elements.timerTag.textContent = `${minutes}m`;
    elements.timerTag.style.display = 'block';

    state.sleepTimerId = setInterval(() => {
      state.sleepTimerRemaining--;
      if (state.sleepTimerRemaining <= 0) {
        clearInterval(state.sleepTimerId);
        state.sleepTimerId = null;
        elements.timerTag.style.display = 'none';
        pauseAudio();
      } else {
        const m = Math.ceil(state.sleepTimerRemaining / 60);
        elements.timerTag.textContent = `${m}m`;
      }
    }, 1000);
  }

  // ==========================================
  // MediaSession API 系统锁屏集成
  // ==========================================
  function setupMediaSession() {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => playAudio());
      navigator.mediaSession.setActionHandler('pause', () => pauseAudio());
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        seekRelative(-(details.seekOffset || 15));
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        seekRelative(details.seekOffset || 15);
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => playPreviousTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => playNextTrack());
    } catch (e) {
      console.warn('MediaSession action handler error:', e);
    }
  }

  function updateMediaSessionMetadata(track) {
    if (!('mediaSession' in navigator) || !track) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: 'AI 学习专精',
      album: '大模型与智能体核心课程',
      artwork: [
        { src: 'assets/logo.svg', sizes: '96x96', type: 'image/svg+xml' },
        { src: 'assets/logo.svg', sizes: '256x256', type: 'image/svg+xml' }
      ]
    });
  }

  // ==========================================
  // 本地文件即时试听支持
  // ==========================================
  function handleLocalAudioFile(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const localTrack = {
      id: `local-${Date.now()}`,
      title: `[本地试听] ${file.name.replace(/\.[^/.]+$/, '')}`,
      filename: file.name,
      url: url,
      size: file.size,
      sizeFormatted: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      order: 0
    };

    state.playlist.unshift(localTrack);
    state.filteredList.unshift(localTrack);
    renderPlaylist();
    loadTrack(0, true);
  }

  // ==========================================
  // 事件监听绑定
  // ==========================================
  function setupEventListeners() {
    // 播放/暂停
    elements.playPauseBtn.addEventListener('click', togglePlayPause);
    elements.rewindBtn.addEventListener('click', () => seekRelative(-15));
    elements.forwardBtn.addEventListener('click', () => seekRelative(15));
    elements.nextTrackBtn.addEventListener('click', playNextTrack);
    elements.playModeBtn.addEventListener('click', cyclePlayMode);

    // 音频核心事件
    elements.audio.addEventListener('timeupdate', () => {
      if (!state.isDraggingProgress) {
        updateProgressUI(elements.audio.currentTime, elements.audio.duration);
      }
      if (state.currentTrack) {
        saveProgressThrottled(state.currentTrack.id, elements.audio.currentTime, elements.audio.duration);
      }
    });

    elements.audio.addEventListener('ended', () => {
      if (state.stopOnTrackEnd) {
        pauseAudio();
        state.stopOnTrackEnd = false;
        elements.timerTag.style.display = 'none';
        return;
      }
      playNextTrack();
    });

    // 进度条拖拽与点击
    function handleSeek(e) {
      const rect = elements.progressBarContainer.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      const pos = Math.min(Math.max(0, clientX - rect.left), rect.width);
      const percentage = pos / rect.width;
      if (elements.audio.duration) {
        const targetTime = percentage * elements.audio.duration;
        elements.audio.currentTime = targetTime;
        updateProgressUI(targetTime, elements.audio.duration);
      }
    }

    elements.progressBarContainer.addEventListener('click', handleSeek);

    elements.progressBarContainer.addEventListener('mousedown', (e) => {
      state.isDraggingProgress = true;
      handleSeek(e);
      const onMouseMove = (moveEvt) => handleSeek(moveEvt);
      const onMouseUp = () => {
        state.isDraggingProgress = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    // 触摸拖拽支持
    elements.progressBarContainer.addEventListener('touchstart', (e) => {
      state.isDraggingProgress = true;
      handleSeek(e);
    });
    elements.progressBarContainer.addEventListener('touchmove', (e) => {
      if (state.isDraggingProgress) handleSeek(e);
    });
    elements.progressBarContainer.addEventListener('touchend', () => {
      state.isDraggingProgress = false;
    });

    // 列表项点击
    elements.playlistContainer.addEventListener('click', (e) => {
      const card = e.target.closest('.audio-card');
      if (!card) return;
      const trackId = card.dataset.id;
      const index = state.playlist.findIndex(item => item.id === trackId);
      if (index !== -1) {
        if (state.currentIndex === index) {
          togglePlayPause();
        } else {
          loadTrack(index, true);
        }
      }
    });

    // 搜索过滤
    elements.searchInput.addEventListener('input', (e) => {
      state.searchKeyword = e.target.value;
      filterPlaylist();
    });
    elements.clearSearchBtn.addEventListener('click', () => {
      elements.searchInput.value = '';
      state.searchKeyword = '';
      filterPlaylist();
      elements.searchInput.focus();
    });

    // 排序切换
    elements.sortOrderBtn.addEventListener('click', () => {
      state.sortAsc = !state.sortAsc;
      elements.sortOrderBtn.textContent = state.sortAsc ? '序号正序 ↑' : '序号倒序 ↓';
      state.filteredList.reverse();
      renderPlaylist();
    });

    // 倍速选择
    elements.speedSelector.addEventListener('click', (e) => {
      const pill = e.target.closest('.speed-pill');
      if (!pill) return;
      const speed = parseFloat(pill.dataset.speed);
      setPlaybackSpeed(speed);
    });

    // 音量与静音
    elements.volumeSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      elements.audio.volume = val;
      localStorage.setItem(STORAGE_KEYS.VOLUME, val);
      updateVolumeIcon(val);
    });

    elements.muteBtn.addEventListener('click', () => {
      if (elements.audio.volume > 0) {
        elements.audio.volume = 0;
        elements.volumeSlider.value = 0;
      } else {
        elements.audio.volume = 1;
        elements.volumeSlider.value = 1;
      }
      updateVolumeIcon(elements.audio.volume);
    });

    function updateVolumeIcon(vol) {
      if (vol === 0) {
        elements.volumeIcon.innerHTML = `
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        `;
      } else {
        elements.volumeIcon.innerHTML = `
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
        `;
      }
    }

    // 本地文件拖入
    elements.dropZone.addEventListener('click', () => elements.localFileInput.click());
    elements.localFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleLocalAudioFile(e.target.files[0]);
      }
    });

    elements.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      elements.dropZone.classList.add('dragover');
    });
    elements.dropZone.addEventListener('dragleave', () => {
      elements.dropZone.classList.remove('dragover');
    });
    elements.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      elements.dropZone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleLocalAudioFile(e.dataTransfer.files[0]);
      }
    });

    // 模态框事件
    elements.sleepTimerBtn.addEventListener('click', () => {
      elements.timerModal.style.display = 'flex';
    });
    elements.closeTimerModal.addEventListener('click', () => {
      elements.timerModal.style.display = 'none';
    });
    elements.timerModal.addEventListener('click', (e) => {
      if (e.target === elements.timerModal) elements.timerModal.style.display = 'none';
    });

    // 定时器选项点击
    elements.timerModal.querySelectorAll('.timer-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mins = parseInt(btn.dataset.minutes, 10);
        setSleepTimer(mins);
        elements.timerModal.querySelectorAll('.timer-opt-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        elements.timerModal.style.display = 'none';
      });
    });

    elements.shortcutsBtn.addEventListener('click', () => {
      elements.shortcutsModal.style.display = 'flex';
    });
    elements.closeShortcutsModal.addEventListener('click', () => {
      elements.shortcutsModal.style.display = 'none';
    });
    elements.shortcutsModal.addEventListener('click', (e) => {
      if (e.target === elements.shortcutsModal) elements.shortcutsModal.style.display = 'none';
    });

    // 键盘全局快捷键
    window.addEventListener('keydown', (e) => {
      // 如果正在输入搜索框，不响应快捷键
      if (document.activeElement === elements.searchInput) {
        if (e.key === 'Escape') {
          elements.searchInput.blur();
        }
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekRelative(-5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekRelative(5);
          break;
        case 'j':
        case 'J':
          seekRelative(-15);
          break;
        case 'l':
        case 'L':
          seekRelative(15);
          break;
        case 'ArrowUp':
          e.preventDefault();
          elements.audio.volume = Math.min(1, elements.audio.volume + 0.1);
          elements.volumeSlider.value = elements.audio.volume;
          break;
        case 'ArrowDown':
          e.preventDefault();
          elements.audio.volume = Math.max(0, elements.audio.volume - 0.1);
          elements.volumeSlider.value = elements.audio.volume;
          break;
        case '[':
        case ']':
          cycleSpeed();
          break;
        case 'm':
        case 'M':
          elements.muteBtn.click();
          break;
        case 'n':
        case 'N':
          playNextTrack();
          break;
        case 'Escape':
          elements.timerModal.style.display = 'none';
          elements.shortcutsModal.style.display = 'none';
          break;
      }
    });
  }

  // 页面加载完成后启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
