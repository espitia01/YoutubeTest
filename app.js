(function () {
  'use strict';

  var DPAD = {
    UP: 'ArrowUp',
    DOWN: 'ArrowDown',
    LEFT: 'ArrowLeft',
    RIGHT: 'ArrowRight',
    SELECT: 'Enter',
    BACK: 'Escape'
  };

  var VIDEOS = [
    { id: '_TJFqEhxQg4', title: 'Bill Ackman: Investment Strategy', channel: 'All-In Podcast' },
    { id: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', channel: 'Rick Astley' },
    { id: 'jNQXAC9IVRw', title: 'Me at the zoo', channel: 'jawed' },
    { id: 'YE7VzlLtp-4', title: 'Big Buck Bunny', channel: 'Blender Foundation' },
    { id: 'eRsGyueVLZo', title: 'Sintel', channel: 'Blender Foundation' },
    { id: 'J---aiyznGQ', title: 'Keyboard Cat', channel: 'Keyboard Cat' },
    { id: '9bZkp7q19f0', title: 'Gangnam Style', channel: 'PSY' }
  ];

  var STORAGE_KEY = 'youtube_last_index';
  var PLAYER_VIEW = { w: 552, h: 311 };
  var PLAYER_FULL_VIEW = { w: 600, h: 600 };
  // YouTube picks stream quality from iframe size; 1280px width unlocks up to 720p.
  var PLAYER_HD = { w: 1280, h: 720 };

  var browseScreen = document.getElementById('browse');
  var playerScreen = document.getElementById('player-screen');
  var videoListEl = document.getElementById('video-list');
  var videoCountEl = document.getElementById('video-count');
  var nowPlayingTitle = document.getElementById('now-playing-title');
  var playBtn = document.getElementById('play-btn');
  var nextBtn = document.getElementById('next-btn');
  var fullscreenBtn = document.getElementById('fullscreen-btn');
  var fullscreenExitBtn = document.querySelector('[data-action="exit-fullscreen"]');
  var playerEl = document.getElementById('player');

  var selectedIndex = 0;
  var currentIndex = 0;
  var player = null;
  var apiReady = false;
  var apiLoading = false;
  var playerMode = false;
  var isFullscreen = false;
  var lastFocusedControl = null;

  function loadLastIndex() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === null) return 0;
      var idx = parseInt(saved, 10);
      return idx >= 0 && idx < VIDEOS.length ? idx : 0;
    } catch (e) {
      return 0;
    }
  }

  function saveLastIndex(index) {
    try {
      localStorage.setItem(STORAGE_KEY, String(index));
    } catch (e) {}
  }

  function rememberFocus(el) {
    if (el && el.classList && el.classList.contains('focusable')) {
      lastFocusedControl = el;
    }
  }

  function restoreFocus() {
    if (
      lastFocusedControl &&
      document.contains(lastFocusedControl) &&
      lastFocusedControl.offsetParent !== null
    ) {
      lastFocusedControl.focus();
      return;
    }
    var focusables = getVisibleFocusables();
    if (focusables.length) focusables[0].focus();
  }

  function renderVideoList() {
    videoListEl.innerHTML = '';
    videoCountEl.textContent = String(VIDEOS.length).padStart(2, '0') + ' titles';

    VIDEOS.forEach(function (video, index) {
      var btn = document.createElement('button');
      btn.className = 'video-item focusable' + (index === selectedIndex ? ' selected' : '');
      btn.type = 'button';
      btn.tabIndex = 0;
      btn.setAttribute('role', 'listitem');
      btn.dataset.index = String(index);
      btn.dataset.action = 'select-video';

      btn.innerHTML =
        '<span class="video-index">' + String(index + 1).padStart(2, '0') + '</span>' +
        '<span class="video-thumb" aria-hidden="true"></span>' +
        '<div class="video-info">' +
          '<div class="video-title">' + video.title + '</div>' +
          '<div class="video-channel">' + video.channel + '</div>' +
        '</div>';

      videoListEl.appendChild(btn);
    });
  }

  function updateSelection(index) {
    selectedIndex = index;
    var items = videoListEl.querySelectorAll('.video-item');
    items.forEach(function (item, i) {
      item.classList.toggle('selected', i === index);
    });
  }

  function showScreen(name) {
    browseScreen.classList.toggle('hidden', name !== 'browse');
    playerScreen.classList.toggle('hidden', name !== 'player');
    playerMode = name === 'player';
    if (name !== 'player') setFullscreen(false);
  }

  function focusFirstVisible() {
    var focusables = getVisibleFocusables();
    if (focusables.length) focusables[0].focus();
  }

  function loadYouTubeAPI(callback) {
    if (apiReady) {
      callback();
      return;
    }
    if (apiLoading) {
      var wait = setInterval(function () {
        if (apiReady) {
          clearInterval(wait);
          callback();
        }
      }, 50);
      return;
    }

    apiLoading = true;
    window.onYouTubeIframeAPIReady = function () {
      apiReady = true;
      callback();
    };

    var tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }

  function destroyPlayer() {
    if (player && player.destroy) {
      player.destroy();
    }
    player = null;
    playerEl.innerHTML = '';
  }

  function playerViewSize() {
    return isFullscreen ? PLAYER_FULL_VIEW : PLAYER_VIEW;
  }

  function resizePlayer() {
    if (!player || !player.setSize) return;
    player.setSize(PLAYER_HD.w, PLAYER_HD.h);
    updatePlayerScale();
  }

  function updatePlayerScale() {
    var view = playerViewSize();
    var brandScale = isFullscreen ? 1.22 : 1.18;
    var scale = (view.w / PLAYER_HD.w) * brandScale;
    playerEl.style.setProperty('--embed-scale', String(scale));
  }

  function setFullscreen(on) {
    isFullscreen = on;
    playerScreen.classList.toggle('fullscreen', on);
    fullscreenExitBtn.classList.toggle('hidden', !on);
    fullscreenBtn.textContent = on ? 'Exit' : 'Full';
    playerEl.classList.toggle('embed-full', on);
    resizePlayer();
    if (on) {
      rememberFocus(fullscreenExitBtn);
      fullscreenExitBtn.focus();
    } else {
      rememberFocus(fullscreenBtn);
      restoreFocus();
    }
  }

  function toggleFullscreen() {
    setFullscreen(!isFullscreen);
  }

  function createPlayer(index) {
    currentIndex = index;
    var video = VIDEOS[index];
    nowPlayingTitle.textContent = video.title;
    saveLastIndex(index);
    destroyPlayer();

    playerEl.classList.toggle('embed-full', isFullscreen);
    updatePlayerScale();

    player = new YT.Player('player', {
      width: String(PLAYER_HD.w),
      height: String(PLAYER_HD.h),
      videoId: video.id,
      host: 'https://www.youtube-nocookie.com',
      playerVars: {
        autoplay: 1,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        fs: 0,
        iv_load_policy: 3,
        cc_load_policy: 0,
        disablekb: 1,
        enablejsapi: 1,
        origin: window.location.origin
      },
      events: {
        onReady: function () {
          restoreFocus();
        },
        onStateChange: onPlayerStateChange
      }
    });
  }

  function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
      playBtn.textContent = 'Pause';
    } else if (
      event.data === YT.PlayerState.PAUSED ||
      event.data === YT.PlayerState.ENDED
    ) {
      playBtn.textContent = 'Play';
    }
  }

  function openPlayer(index, triggerEl) {
    rememberFocus(triggerEl || document.activeElement);
    selectedIndex = index;
    updateSelection(index);
    showScreen('player');

    loadYouTubeAPI(function () {
      createPlayer(index);
    });
  }

  function goBack() {
    if (isFullscreen) {
      setFullscreen(false);
      return;
    }
    destroyPlayer();
    showScreen('browse');
    var items = videoListEl.querySelectorAll('.video-item');
    if (items[selectedIndex]) items[selectedIndex].focus();
  }

  function togglePlayPause() {
    if (!player || !player.getPlayerState) return;
    var state = player.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  }

  function playNext() {
    rememberFocus(nextBtn);
    var next = (currentIndex + 1) % VIDEOS.length;
    createPlayer(next);
  }

  function getVisibleFocusables() {
    var screen = playerMode ? playerScreen : browseScreen;
    return Array.from(
      screen.querySelectorAll('.focusable:not([disabled]):not(.hidden)')
    ).filter(function (el) {
      return el.offsetParent !== null;
    });
  }

  function keepFocusOnControls() {
    if (!playerMode) return;
    var active = document.activeElement;
    var focusables = getVisibleFocusables();
    if (focusables.indexOf(active) === -1) {
      restoreFocus();
    }
  }

  function moveFocus(direction) {
    var focusables = getVisibleFocusables();
    if (!focusables.length) return;

    var idx = focusables.indexOf(document.activeElement);
    if (idx === -1) {
      restoreFocus();
      return;
    }

    var next;
    if (direction === 'up' || direction === 'left') {
      next = idx > 0 ? idx - 1 : focusables.length - 1;
    } else {
      next = idx < focusables.length - 1 ? idx + 1 : 0;
    }

    focusables[next].focus();
    rememberFocus(focusables[next]);
  }

  document.addEventListener('click', function (e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;

    rememberFocus(target);

    switch (target.dataset.action) {
      case 'select-video': {
        var idx = parseInt(target.dataset.index, 10);
        if (idx === selectedIndex) {
          openPlayer(idx, target);
        } else {
          updateSelection(idx);
          target.focus();
        }
        break;
      }
      case 'play-selected':
        openPlayer(selectedIndex, target);
        break;
      case 'back':
        goBack();
        break;
      case 'toggle-play':
        togglePlayPause();
        break;
      case 'next-video':
        playNext();
        break;
      case 'toggle-fullscreen':
        toggleFullscreen();
        break;
      case 'exit-fullscreen':
        setFullscreen(false);
        break;
    }
  });

  document.addEventListener('keydown', function (e) {
    switch (e.key) {
      case DPAD.UP:
        moveFocus('up');
        e.preventDefault();
        break;
      case DPAD.DOWN:
        moveFocus('down');
        e.preventDefault();
        break;
      case DPAD.LEFT:
        moveFocus('left');
        e.preventDefault();
        break;
      case DPAD.RIGHT:
        moveFocus('right');
        e.preventDefault();
        break;
      case DPAD.SELECT:
        if (document.activeElement.classList.contains('focusable')) {
          document.activeElement.click();
        }
        e.preventDefault();
        break;
      case DPAD.BACK:
        if (playerMode) goBack();
        e.preventDefault();
        break;
    }
  });

  document.addEventListener('focusin', function (e) {
    if (e.target.classList && e.target.classList.contains('focusable')) {
      rememberFocus(e.target);
    }
    if (!playerMode) return;
    if (e.target.closest('#player') || e.target.tagName === 'IFRAME') {
      keepFocusOnControls();
    }
  });

  selectedIndex = loadLastIndex();
  try {
    renderVideoList();
    showScreen('browse');
    focusFirstVisible();
  } catch (e) {
    updateSelection(selectedIndex);
  }
})();
