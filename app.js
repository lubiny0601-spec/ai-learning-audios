/**
 * AI 学习音频随身听 - 核心播放引擎、移动端稳健性与教材讲义内嵌联动
 * (Impeccable Production Grade)
 */

(function () {
  'use strict';

  // ==========================================
  // 常量与配置
  // ==========================================
  const STORAGE_KEYS = {
    PROGRESS: 'ai_audio_progress_v2',
    SPEED: 'ai_audio_speed_v2',
    LAST_ID: 'ai_audio_last_id_v2',
    PLAY_MODE: 'ai_audio_play_mode_v2',
    VOLUME: 'ai_audio_volume_v2'
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
    books: [],
    currentIndex: -1,
    currentTrack: null,
    isPlaying: false,
    isBuffering: false,
    playMode: localStorage.getItem(STORAGE_KEYS.PLAY_MODE) || 'sequential',
    playbackSpeed: parseFloat(localStorage.getItem(STORAGE_KEYS.SPEED)) || 1.0,
    searchKeyword: '',
    sortAsc: true,
    sleepTimerId: null,
    sleepTimerRemaining: 0,
    stopOnTrackEnd: false,
    progressMap: JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESS) || '{}'),
    isDraggingProgress: false,
    targetResumeTime: 0
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
    audioErrorBanner: document.getElementById('audioErrorBanner'),
    audioErrorMsg: document.getElementById('audioErrorMsg'),
    audioRetryBtn: document.getElementById('audioRetryBtn'),
    
    // 播放器主界面
    playerCard: document.getElementById('playerCard'),
    waveformBox: document.getElementById('waveformBox'),
    playingStatus: document.getElementById('playingStatus'),
    currentTrackTitle: document.getElementById('currentTrackTitle'),
    currentTrackSize: document.getElementById('currentTrackSize'),
    currentTrackProgressTag: document.getElementById('currentTrackProgressTag'),
    heroPdfBox: document.getElementById('heroPdfBox'),
    currentTrackPdfBtn: document.getElementById('currentTrackPdfBtn'),
    currentTrackPdfText: document.getElementById('currentTrackPdfText'),
    
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
    playSpinner: document.getElementById('playSpinner'),
    rewindBtn: document.getElementById('rewindBtn'),
    forwardBtn: document.getElementById('forwardBtn'),
    nextTrackBtn: document.getElementById('nextTrackBtn'),
    playModeBtn: document.getElementById('playModeBtn'),
    speedSelector: document.getElementById('speedSelector'),
    currentSpeedVal: document.getElementById('currentSpeedVal'),
    
    // 音量与静音
    muteBtn: document.getElementById('muteBtn'),
    volumeSlider: document.getElementById('volumeSlider'),
    volumeIcon: document.getElementById('volumeIcon'),
    
    // 本地文件导入
    dropZone: document.getElementById('dropZone'),
    localFileInput: document.getElementById('localFileInput'),
    
    // 内置 PDF 阅读器
    pdfReaderModal: document.getElementById('pdfReaderModal'),
    pdfReaderTitle: document.getElementById('pdfReaderTitle'),
    pdfIframe: document.getElementById('pdfIframe'),
    pdfLoadingIndicator: document.getElementById('pdfLoadingIndicator'),
    pdfExternalLink: document.getElementById('pdfExternalLink'),
    pdfDownloadLink: document.getElementById('pdfDownloadLink'),
    pdfDirectBtn: document.getElementById('pdfDirectBtn'),
    pdfMobileFallback: document.getElementById('pdfMobileFallback'),
    closePdfModal: document.getElementById('closePdfModal'),
    
    // 教材库
    booksBtn: document.getElementById('booksBtn'),
    booksCountBadge: document.getElementById('booksCountBadge'),
    booksModal: document.getElementById('booksModal'),
    closeBooksModal: document.getElementById('closeBooksModal'),
    booksGrid: document.getElementById('booksGrid'),
    
    // 睡眠与快捷键弹层
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
  // 初始化与数据加载 (含防缓存机制)
  // ==========================================
  async function init() {
    setupEventListeners();
    setupMediaSession();
    restoreSettings();

    // 防缓存时间戳，确保用户每次都能拿到最新的清单与讲义绑定
    const cacheBuster = `t=${Date.now()}`;

    // 1. 加载音频清单
    try {
      const response = await fetch(`data/playlist.json?${cacheBuster}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
          <p style="color: #ef4444;">音频清单加载异常，请检查网络或点击刷新</p>
        </div>
      `;
    }

    // 2. 加载教材书籍库
    try {
      const booksRes = await fetch(`data/books.json?${cacheBuster}`);
      if (booksRes.ok) {
        state.books = await booksRes.json();
        elements.booksCountBadge.textContent = `${state.books.length}本`;
        renderBooksModal();
      }
    } catch (e) {
      console.warn('教材清单加载异常:', e);
    }
  }

  function restoreSettings() {
    const savedVolume = localStorage.getItem(STORAGE_KEYS.VOLUME);
    if (savedVolume !== null && elements.volumeSlider) {
      const vol = parseFloat(savedVolume);
      elements.audio.volume = vol;
      elements.volumeSlider.value = vol;
    }
    setPlaybackSpeed(state.playbackSpeed);
    updatePlayModeUI();
  }

  // ==========================================
  // 播放列表渲染与高可见度“讲义”按钮
  // ==========================================
  function renderPlaylist() {
    if (state.filteredList.length === 0) {
      elements.playlistContainer.innerHTML = `
        <div class="loading-state">
          <p>没有找到匹配的音频，请尝试其他关键词</p>
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

      // 高可见度讲义按钮：直接在卡片上，电脑手机都能直接点
      let pdfActionBtn = '';
      if (track.pdfUrl) {
        pdfActionBtn = `
          <button class="card-pdf-action" data-pdf="${track.pdfUrl}" data-title="${track.pdfTitle || track.title}" title="查看本章配套讲义 (PDF)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span>讲义</span>
          </button>
        `;
      }

      return `
        <div class="audio-card ${isActive ? 'active' : ''}" data-id="${track.id}">
          <div class="audio-card-left">
            <div class="card-play-trigger" title="${isActive && state.isPlaying ? '暂停' : '播放'}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="${isActive && state.isPlaying ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                ${isActive && state.isPlaying 
                  ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>' 
                  : '<polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>'}
              </svg>
            </div>
            <div class="card-content">
              <div class="card-title" title="${track.title}">${track.title}</div>
              <div class="card-subtext">
                <span>${track.sizeFormatted || ''}</span>
                ${progressTag}
              </div>
            </div>
          </div>
          <div class="audio-card-actions">
            ${pdfActionBtn}
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
  // 全屏/宽屏内嵌 PDF 讲义阅读器 (边听边看核心)
  // ==========================================
  function openPdfModal(pdfUrl, title) {
    if (!pdfUrl) return;

    elements.pdfReaderTitle.textContent = title || '配套讲义';
    elements.pdfExternalLink.href = pdfUrl;
    elements.pdfDownloadLink.href = pdfUrl;
    elements.pdfDirectBtn.href = pdfUrl;
    
    // 显示加载指示
    elements.pdfLoadingIndicator.style.display = 'flex';
    elements.pdfReaderModal.style.display = 'flex';

    // 设置 iframe 地址
    elements.pdfIframe.src = pdfUrl;

    elements.pdfIframe.onload = () => {
      elements.pdfLoadingIndicator.style.display = 'none';
    };

    // 移动端安全回退判断
    const isMobile = window.innerWidth <= 880;
    if (isMobile) {
      elements.pdfMobileFallback.style.display = 'flex';
    } else {
      elements.pdfMobileFallback.style.display = 'none';
    }
  }

  function closePdfModal() {
    elements.pdfReaderModal.style.display = 'none';
    elements.pdfIframe.src = '';
  }

  // ==========================================
  // 教材资料库弹层渲染
  // ==========================================
  function renderBooksModal() {
    if (state.books.length === 0) {
      elements.booksGrid.innerHTML = '<p class="modal-desc">暂无可用教材</p>';
      return;
    }

    const html = state.books.map(book => {
      return `
        <div class="book-item-card ${book.isGeneral ? 'general' : ''}">
          <div class="book-info-left">
            <div class="book-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </div>
            <div class="book-title-wrap">
              <div class="book-title" title="${book.title}">${book.isGeneral ? '⭐ ' : ''}${book.title}</div>
              <div class="book-size">${book.sizeFormatted} · PDF 教材</div>
            </div>
          </div>
          <div class="book-actions-right">
            <button class="book-action-btn read-btn" data-url="${book.url}" data-title="${book.title}" title="在应用内打开阅读 (不断音)">
              在线阅读
            </button>
            <a href="${book.url}" download="${book.filename}" class="book-action-btn download-btn" title="下载至本地">
              下载
            </a>
          </div>
        </div>
      `;
    }).join('');

    elements.booksGrid.innerHTML = html;
  }

  // ==========================================
  // 核心播放控制 (移动端深度加固)
  // ==========================================
  function loadTrack(index, autoPlay = true) {
    if (index < 0 || index >= state.playlist.length) return;
    
    state.currentIndex = index;
    state.currentTrack = state.playlist[index];
    const track = state.currentTrack;

    localStorage.setItem(STORAGE_KEYS.LAST_ID, track.id);

    // 隐藏之前的错误提示
    elements.audioErrorBanner.style.display = 'none';

    elements.currentTrackTitle.textContent = track.title;
    elements.currentTrackTitle.title = track.title;
    elements.currentTrackSize.textContent = track.sizeFormatted || '';

    // 右侧大卡片上的本章讲义直达入口
    if (track.pdfUrl) {
      elements.heroPdfBox.style.display = 'block';
      elements.currentTrackPdfText.textContent = `📖 查看《${track.pdfTitle || '本章配套讲义'}》`;
      elements.currentTrackPdfBtn.onclick = () => openPdfModal(track.pdfUrl, track.pdfTitle || track.title);
    } else {
      elements.heroPdfBox.style.display = 'none';
    }

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

    state.targetResumeTime = resumeTime;

    // 设置音频源
    elements.audio.src = track.url;
    elements.audio.playbackRate = state.playbackSpeed;
    if ('preservesPitch' in elements.audio) {
      elements.audio.preservesPitch = true;
    }

    updateMediaSessionMetadata(track);
    renderPlaylist();

    if (autoPlay) {
      playAudio();
    } else {
      updatePlayStateUI();
    }
  }

  function playAudio() {
    setBufferingState(true);
    elements.audioErrorBanner.style.display = 'none';

    const playPromise = elements.audio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        state.isPlaying = true;
        setBufferingState(false);
        updatePlayStateUI();
      }).catch(err => {
        console.warn('播放需要用户交互或被拦截:', err);
        state.isPlaying = false;
        setBufferingState(false);
        updatePlayStateUI();
        
        // 呈现友好重试提示
        elements.audioErrorMsg.textContent = '点击此处继续播放该章节音频';
        elements.audioErrorBanner.style.display = 'flex';
      });
    }
  }

  function pauseAudio() {
    elements.audio.pause();
    state.isPlaying = false;
    setBufferingState(false);
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

  function setBufferingState(buffering) {
    state.isBuffering = buffering;
    if (buffering) {
      elements.playSpinner.style.display = 'block';
      elements.playIcon.style.display = 'none';
      elements.pauseIcon.style.display = 'none';
      elements.playingStatus.textContent = '正在缓冲...';
    } else {
      elements.playSpinner.style.display = 'none';
    }
  }

  function updatePlayStateUI() {
    if (state.isBuffering) return;

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

    if (elements.currentSpeedVal) {
      elements.currentSpeedVal.textContent = `${speed}x`;
    }

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
    if (duration && !isNaN(duration) && duration > 0) {
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
      console.warn('MediaSession handler warning:', e);
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
      order: 0,
      pdfUrl: null
    };

    state.playlist.unshift(localTrack);
    state.filteredList.unshift(localTrack);
    renderPlaylist();
    loadTrack(0, true);
  }

  // ==========================================
  // 事件监听绑定 (移动端无缝交互)
  // ==========================================
  function setupEventListeners() {
    // 播放/暂停
    elements.playPauseBtn.addEventListener('click', togglePlayPause);
    elements.rewindBtn.addEventListener('click', () => seekRelative(-15));
    elements.forwardBtn.addEventListener('click', () => seekRelative(15));
    elements.nextTrackBtn.addEventListener('click', playNextTrack);
    elements.playModeBtn.addEventListener('click', cyclePlayMode);

    // 重试按钮
    elements.audioRetryBtn.addEventListener('click', () => {
      if (state.currentTrack) {
        elements.audio.load();
        playAudio();
      }
    });

    // 音频核心生命周期事件监听
    elements.audio.addEventListener('loadstart', () => setBufferingState(true));
    elements.audio.addEventListener('waiting', () => setBufferingState(true));
    elements.audio.addEventListener('canplay', () => {
      setBufferingState(false);
      elements.totalDuration.textContent = formatTime(elements.audio.duration);
      // 安全恢复历史断点 (必须在 canplay 之后)
      if (state.targetResumeTime > 0 && elements.audio.duration && state.targetResumeTime < elements.audio.duration) {
        try {
          elements.audio.currentTime = state.targetResumeTime;
        } catch (e) {
          console.warn('Seek error:', e);
        }
        state.targetResumeTime = 0;
      }
    });

    elements.audio.addEventListener('playing', () => {
      state.isPlaying = true;
      setBufferingState(false);
      updatePlayStateUI();
    });

    elements.audio.addEventListener('pause', () => {
      state.isPlaying = false;
      setBufferingState(false);
      updatePlayStateUI();
    });

    elements.audio.addEventListener('error', (e) => {
      console.error('Audio load error:', e);
      state.isPlaying = false;
      setBufferingState(false);
      updatePlayStateUI();
      elements.audioErrorMsg.textContent = '音频连接中断，请检查网络或点击重试';
      elements.audioErrorBanner.style.display = 'flex';
    });

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

    // 播放列表项点击处理 (区分“点击卡片听音频”与“点击讲义按钮看讲义”)
    elements.playlistContainer.addEventListener('click', (e) => {
      // 1. 如果点击的是“讲义”按钮
      const pdfBtn = e.target.closest('.card-pdf-action');
      if (pdfBtn) {
        e.stopPropagation();
        const pdfUrl = pdfBtn.dataset.pdf;
        const title = pdfBtn.dataset.title;
        openPdfModal(pdfUrl, title);
        return;
      }

      // 2. 否则是点击卡片选择/播放音频
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
    if (elements.volumeSlider) {
      elements.volumeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        elements.audio.volume = val;
        localStorage.setItem(STORAGE_KEYS.VOLUME, val);
        updateVolumeIcon(val);
      });
    }

    if (elements.muteBtn) {
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
    }

    function updateVolumeIcon(vol) {
      if (!elements.volumeIcon) return;
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

    // 教材库模态框
    elements.booksBtn.addEventListener('click', () => {
      elements.booksModal.style.display = 'flex';
    });
    elements.closeBooksModal.addEventListener('click', () => {
      elements.booksModal.style.display = 'none';
    });
    elements.booksModal.addEventListener('click', (e) => {
      if (e.target === elements.booksModal) elements.booksModal.style.display = 'none';
    });

    // 教材库内点击“在线阅读”
    elements.booksGrid.addEventListener('click', (e) => {
      const readBtn = e.target.closest('.book-action-btn.read-btn');
      if (readBtn) {
        const url = readBtn.dataset.url;
        const title = readBtn.dataset.title;
        elements.booksModal.style.display = 'none';
        openPdfModal(url, title);
      }
    });

    // PDF 阅读器关闭
    elements.closePdfModal.addEventListener('click', closePdfModal);
    elements.pdfReaderModal.addEventListener('click', (e) => {
      if (e.target === elements.pdfReaderModal) closePdfModal();
    });

    // 睡眠定时器模态框
    elements.sleepTimerBtn.addEventListener('click', () => {
      elements.timerModal.style.display = 'flex';
    });
    elements.closeTimerModal.addEventListener('click', () => {
      elements.timerModal.style.display = 'none';
    });
    elements.timerModal.addEventListener('click', (e) => {
      if (e.target === elements.timerModal) elements.timerModal.style.display = 'none';
    });

    elements.timerModal.querySelectorAll('.timer-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mins = parseInt(btn.dataset.minutes, 10);
        setSleepTimer(mins);
        elements.timerModal.querySelectorAll('.timer-opt-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        elements.timerModal.style.display = 'none';
      });
    });

    // 快捷键指南模态框
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
      if (document.activeElement === elements.searchInput) {
        if (e.key === 'Escape') elements.searchInput.blur();
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
          if (elements.volumeSlider) elements.volumeSlider.value = elements.audio.volume;
          break;
        case 'ArrowDown':
          e.preventDefault();
          elements.audio.volume = Math.max(0, elements.audio.volume - 0.1);
          if (elements.volumeSlider) elements.volumeSlider.value = elements.audio.volume;
          break;
        case '[':
        case ']':
          cycleSpeed();
          break;
        case 'm':
        case 'M':
          if (elements.muteBtn) elements.muteBtn.click();
          break;
        case 'n':
        case 'N':
          playNextTrack();
          break;
        case 'b':
        case 'B':
          elements.booksBtn.click();
          break;
        case 'Escape':
          closePdfModal();
          elements.booksModal.style.display = 'none';
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
