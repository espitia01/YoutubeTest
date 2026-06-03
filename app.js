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
    { id: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', channel: 'Rick Astley' },
    { id: 'jNQXAC9IVRw', title: 'Me at the zoo', channel: 'jawed' },
    { id: 'YE7VzlLtp-4', title: 'Big Buck Bunny', channel: 'Blender Foundation' },
    { id: 'eRsGyueVLZo', title: 'Sintel', channel: 'Blender Foundation' },
    { id: 'J---aiyznGQ', title: 'Keyboard Cat', channel: 'Keyboard Cat' },
    { id: '9bZkp7q19f0', title: 'Gangnam Style', channel: 'PSY' }
  ];

  var STORAGE_KEY = 'youtube_last_index';

  var browseScreen = document.getElementById('browse');
  var playerScreen = document.getElementById('player-screen');
  var videoListEl = document.getElementById('video-list');
  var videoCountEl = document.getElementById('video-count');
  var nowPlayingTitle = document.getElementById('now-playing-title');
  var playBtn = document.getElementById('play-btn');

  var selectedIndex = 0;
  var currentIndex = 0;
  var player = null;
  var apiReady = false;
  var apiLoading = false;
  var playerMode = false;

  function loadLastIndex() {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return 0;
    var idx = parseInt(saved, 10);
    return idx >= 0 && idx < VIDEOS.length ? idx : 0;
  }

  function saveLastIndex(index) {
    localStorage.setItem(STORAGE_KEY, String(index));
  }

  function thumbUrl(videoId) {
    return 'https://img.youtube.com/vi/' + videoId + '/mqdefault.jpg';
  }

  function renderVideoList() {
    videoListEl.innerHTML = '';
    videoCountEl.textContent = VIDEOS.length + ' videos';

    VIDEOS.forEach(function (video, index) {
      var btn = document.createElement('button');
      btn.className = 'video-item focusable' + (index === selectedIndex ? ' selected' : '');
      btn.type = 'button';
      btn.tabIndex = 0;
      btn.setAttribute('role', 'listitem');
      btn.dataset.index = String(index);
      btn.dataset.action = 'select-video';

      btn.innerHTML =
        '<img class="video-thumb" src="' + thumbUrl(video.id) + '" alt="" loading="lazy">' +
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
    document.getElementById('player').innerHTML = '';
  }

  function createPlayer(index) {
    currentIndex = index;
    var video = VIDEOS[index];
    nowPlayingTitle.textContent = video.title;
    saveLastIndex(index);
    destroyPlayer();

    player = new YT.Player('player', {
      width: '560',
      height: '315',
      videoId: video.id,
      playerVars: {
        autoplay: 1,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        fs: 0,
        iv_load_policy: 3
      },
      events: {
        onStateChange: onPlayerStateChange
      }
    });
  }

  function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
      playBtn.textContent = '⏸ Pause';
    } else if (
      event.data === YT.PlayerState.PAUSED ||
      event.data === YT.PlayerState.ENDED
    ) {
      playBtn.textContent = '▶ Play';
    }
  }

  function openPlayer(index) {
    selectedIndex = index;
    updateSelection(index);
    showScreen('player');

    loadYouTubeAPI(function () {
      createPlayer(index);
      playBtn.focus();
    });
  }

  function goBack() {
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
    var next = (currentIndex + 1) % VIDEOS.length;
    createPlayer(next);
  }

  function getVisibleFocusables() {
    return Array.from(
      document.querySelectorAll('.focusable:not([disabled]):not(.hidden *)')
    ).filter(function (el) {
      return el.offsetParent !== null;
    });
  }

  function moveFocus(direction) {
    var focusables = getVisibleFocusables();
    if (!focusables.length) return;

    var idx = focusables.indexOf(document.activeElement);
    if (idx === -1) {
      focusables[0].focus();
      return;
    }

    var next;
    if (direction === 'up' || direction === 'left') {
      next = idx > 0 ? idx - 1 : focusables.length - 1;
    } else {
      next = idx < focusables.length - 1 ? idx + 1 : 0;
    }

    focusables[next].focus();
  }

  document.addEventListener('click', function (e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;

    switch (target.dataset.action) {
      case 'select-video': {
        var idx = parseInt(target.dataset.index, 10);
        if (idx === selectedIndex) {
          openPlayer(idx);
        } else {
          updateSelection(idx);
          target.focus();
        }
        break;
      }
      case 'play-selected':
        openPlayer(selectedIndex);
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
        if (playerMode) {
          if (player && player.seekTo) {
            var pos = player.getCurrentTime();
            player.seekTo(Math.max(0, pos - 10), true);
          }
        } else {
          moveFocus('left');
        }
        e.preventDefault();
        break;
      case DPAD.RIGHT:
        if (playerMode) {
          if (player && player.seekTo) {
            var current = player.getCurrentTime();
            var duration = player.getDuration();
            player.seekTo(Math.min(duration, current + 10), true);
          }
        } else {
          moveFocus('right');
        }
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

  selectedIndex = loadLastIndex();
  renderVideoList();
  showScreen('browse');
  focusFirstVisible();
})();
