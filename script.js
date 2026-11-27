// Mobile sidebar toggle
function initSidebar(){
  const toggle = document.querySelector('.sidebar__toggle');
  const sidebar = document.querySelector('.sidebar');
  if(!toggle || !sidebar) return;

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    toggle.textContent = sidebar.classList.contains('open') ? '✕' : '☰';
  });

  document.querySelectorAll('.sidebar__nav a').forEach(a => {
    a.addEventListener('click', () => sidebar.classList.remove('open'));
  });
}

// Highlight current nav link
function markActiveNav(){
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.sidebar__nav a').forEach(a => {
    const href = a.getAttribute('href');
    if(href === path || (path === '' && href === 'index.html')){
      a.classList.add('active');
    }
  });
}

// Pause every Motion Graphics video. Used when switching category, leaving the page or closing a viewer.
function pauseAllVideos(){
  document.querySelectorAll('.motion-card video').forEach(video => {
    if(!video.paused) video.pause();
  });
}

// Motion graphics: custom video player.
// Play / pause, time, seek, mute, full screen, and a three-dot menu with Download and Share.
function initVideoCards(){
  const cards = [...document.querySelectorAll('.motion-card')];
  if(!cards.length) return;

  const IDLE_DELAY = 2600; // controls fade out this long after the last touch while a video plays
  const PLAY_INTENT_WINDOW = 3000; // a video may only start within this many ms of a visitor pressing play
  const PAUSE_WHEN_VIEWER_CLOSES = true; // leaving full screen / the expanded player pauses the video
  const videos = cards.map(card => card.querySelector('video')).filter(Boolean);

  // Videos never start by themselves: make sure nothing is set to autoplay and everything begins paused
  videos.forEach(video => {
    video.autoplay = false;
    video.removeAttribute('autoplay');
    video.setAttribute('webkit-playsinline', ''); // older iOS: play inside the page instead of jumping to the phone's player
    if(!video.paused) video.pause();
  });

  // Leaving the page or switching to another app/tab pauses playback
  document.addEventListener('visibilitychange', () => {
    if(document.hidden && !document.pictureInPictureElement) pauseAllVideos();
  });
  window.addEventListener('pagehide', pauseAllVideos);
  window.addEventListener('pageshow', event => { if(event.persisted) pauseAllVideos(); });

  const formatTime = seconds => {
    const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
    return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, '0')}`;
  };

  const currentFullscreen = () => document.fullscreenElement || document.webkitFullscreenElement || null;

  cards.forEach(card => {
    const video = card.querySelector('video');
    const playButton = card.querySelector('.mc-play');
    const muteButton = card.querySelector('.mc-mute');
    const fullscreenButton = card.querySelector('.mc-fs');
    const moreButton = card.querySelector('.mc-more');
    const menu = card.querySelector('.mc-menu');
    const shareItem = card.querySelector('.mc-share');
    const seek = card.querySelector('.mc-seek');
    const timeLabel = card.querySelector('.mc-time');
    const toast = card.querySelector('.mc-toast');
    if(!video || !playButton || !muteButton || !fullscreenButton || !moreButton || !menu || !seek || !timeLabel) return;

    let idleTimer = 0;
    let playIntent = 0;      // when the visitor last pressed play
    let placeholder = null;  // keeps the card's spot in the page while it is expanded
    let wasFullscreen = false;
    let fullscreenAttempt = 0;
    let toastTimer = 0;
    let frame = 0;
    let scrubbing = false;
    let wasIdle = false;
    let menuWasOpen = false;

    const isPlaying = () => !video.paused && !video.ended;
    const isExpanded = () => card.classList.contains('is-expanded');
    const isFullscreen = () => currentFullscreen() === card || isExpanded();
    const allowPlay = () => { playIntent = Date.now(); };
    const playAllowed = () => Date.now() - playIntent < PLAY_INTENT_WINDOW;

    // ----- Showing the current state
    const render = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const current = video.currentTime || 0;
      const ratio = duration ? Math.min(current / duration, 1) : 0;

      timeLabel.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
      if(!scrubbing){
        seek.value = String(Math.round(ratio * 1000));
        seek.style.setProperty('--p', `${ratio * 100}%`);
      }
      seek.setAttribute('aria-valuetext', `${formatTime(current)} of ${formatTime(duration)}`);

      const playing = isPlaying();
      card.classList.toggle('is-playing', playing);
      playButton.setAttribute('aria-label', playing ? 'Pause' : 'Play');

      const muted = video.muted || video.volume === 0;
      card.classList.toggle('is-muted', muted);
      muteButton.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    };

    // Smooth progress while playing
    const tick = () => {
      render();
      frame = isPlaying() ? requestAnimationFrame(tick) : 0;
    };

    // ----- Controls fade out while playing, and come back on touch / mouse move
    const keyboardFocusInside = () => {
      try {
        return !!card.querySelector('.mc-controls :focus-visible, .mc-menu :focus-visible');
      } catch (error) {
        return false;
      }
    };
    const canHide = () => isPlaying() && menu.hidden && !scrubbing && !keyboardFocusInside();
    const hideNow = () => { if(canHide()) card.classList.add('is-idle'); };
    const showControls = () => {
      card.classList.remove('is-idle');
      clearTimeout(idleTimer);
      if(canHide()) idleTimer = setTimeout(hideNow, IDLE_DELAY);
    };

    // ----- Actions
    const togglePlay = () => {
      if(video.paused || video.ended){
        allowPlay();
        const result = video.play();
        if(result && typeof result.catch === 'function') result.catch(() => {});
      } else {
        video.pause();
      }
    };

    const toggleMute = () => {
      if(video.muted || video.volume === 0){
        video.muted = false;
        if(video.volume === 0) video.volume = 1;
      } else {
        video.muted = true;
      }
    };

    // Native full screen is used where the browser really supports it for a whole element
    // (desktop, Android, iPad). iPhone Safari has no element full screen, so the player expands to fill the screen instead.
    const nativeFullscreenAvailable = () => {
      const request = card.requestFullscreen || card.webkitRequestFullscreen;
      const enabled = document.fullscreenEnabled !== undefined ? document.fullscreenEnabled : document.webkitFullscreenEnabled;
      return !!request && enabled !== false;
    };

    // After the player is moved in the page, a playing video can be paused by the browser: carry on where it was
    const resumeIfNeeded = wasPlaying => {
      if(!wasPlaying) return;
      requestAnimationFrame(() => {
        if(!video.paused) return;
        allowPlay();
        const result = video.play();
        if(result && typeof result.catch === 'function') result.catch(() => {});
      });
    };

    const expandCard = () => {
      if(isExpanded()) return;
      const wasPlaying = isPlaying();
      // Move the player to <body>: its normal parent clips fixed-position content (overflow + backdrop blur)
      placeholder = document.createElement('div');
      placeholder.className = 'mc-placeholder';
      placeholder.style.height = `${card.offsetHeight}px`;
      card.parentNode.insertBefore(placeholder, card);
      document.body.appendChild(card);
      card.classList.add('is-expanded');
      document.documentElement.classList.add('mc-expanded-open');
      syncFullscreen();
      resumeIfNeeded(wasPlaying);
    };

    const collapseCard = () => {
      if(!isExpanded()) return;
      const wasPlaying = isPlaying();
      card.classList.remove('is-expanded');
      document.documentElement.classList.remove('mc-expanded-open');
      if(placeholder && placeholder.parentNode) placeholder.parentNode.replaceChild(card, placeholder);
      placeholder = null;
      syncFullscreen();
      if(!PAUSE_WHEN_VIEWER_CLOSES) resumeIfNeeded(wasPlaying);
    };

    const toggleFullscreen = () => {
      fullscreenAttempt++;
      if(isExpanded()){
        collapseCard();
        return;
      }
      if(currentFullscreen() === card){
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if(exit){
          const result = exit.call(document);
          if(result && typeof result.catch === 'function') result.catch(() => {});
        }
        return;
      }
      if(!nativeFullscreenAvailable()){
        expandCard();
        return;
      }
      const attempt = fullscreenAttempt;
      const request = card.requestFullscreen || card.webkitRequestFullscreen;
      try {
        const result = request.call(card);
        if(result && typeof result.catch === 'function') result.catch(() => { if(attempt === fullscreenAttempt) expandCard(); });
      } catch (error) {
        expandCard();
        return;
      }
      // Some browsers neither refuse nor enter full screen: if nothing happened, use the expanded player
      setTimeout(() => { if(attempt === fullscreenAttempt && !isFullscreen()) expandCard(); }, 800);
    };

    const syncFullscreen = () => {
      const active = isFullscreen();
      card.classList.toggle('is-fullscreen', active);
      const holder = card.closest('.gallery-card');
      if(holder) holder.classList.toggle('has-fullscreen', currentFullscreen() === card);
      fullscreenButton.setAttribute('aria-label', active ? 'Exit full screen' : 'Full screen');
      // Closing the viewer pauses the video
      if(wasFullscreen && !active && PAUSE_WHEN_VIEWER_CLOSES && !video.paused) video.pause();
      wasFullscreen = active;
    };

    // Esc closes the expanded player (native full screen already handles Esc itself)
    document.addEventListener('keydown', event => {
      if(event.key === 'Escape' && isExpanded() && !event.defaultPrevented){
        event.preventDefault();
        collapseCard();
      }
    });

    // ----- Three-dot menu
    const menuItems = () => [...menu.querySelectorAll('[role="menuitem"]')];

    const openMenu = () => {
      menu.hidden = false;
      moreButton.setAttribute('aria-expanded', 'true');
      card.classList.remove('is-idle');
      clearTimeout(idleTimer);
      const first = menuItems()[0];
      if(first) first.focus();
    };

    const closeMenu = restoreFocus => {
      if(menu.hidden) return;
      menu.hidden = true;
      moreButton.setAttribute('aria-expanded', 'false');
      if(restoreFocus) moreButton.focus();
      showControls();
    };

    const showToast = message => {
      if(!toast) return;
      toast.textContent = message;
      toast.classList.add('is-visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 1800);
    };

    // ----- Video events
    video.addEventListener('play', () => {
      // Playback nobody asked for (not started from the player's own controls) is stopped straight away
      const nativeViewer = document.pictureInPictureElement === video || video.webkitDisplayingFullscreen;
      if(!playAllowed() && !nativeViewer){
        video.pause();
        return;
      }
      // Only one video plays at a time
      videos.forEach(other => { if(other !== video && !other.paused) other.pause(); });
      if(!frame) frame = requestAnimationFrame(tick);
      render();
      showControls();
    });
    ['pause', 'ended'].forEach(name => video.addEventListener(name, () => {
      render();
      showControls();
    }));
    ['loadedmetadata', 'durationchange', 'timeupdate', 'seeked', 'volumechange'].forEach(name => {
      video.addEventListener(name, render);
    });

    // ----- Taps on the video itself
    card.addEventListener('pointerdown', () => {
      wasIdle = card.classList.contains('is-idle');
      menuWasOpen = !menu.hidden;
    }, true);

    video.addEventListener('click', () => {
      // First tap only brings the controls back, or closes the menu. The next one plays / pauses.
      if(menuWasOpen || wasIdle){
        showControls();
        return;
      }
      togglePlay();
      showControls();
    });

    card.addEventListener('pointermove', event => { if(event.pointerType === 'mouse') showControls(); });
    card.addEventListener('pointerleave', event => {
      if(event.pointerType === 'mouse' && canHide()){
        clearTimeout(idleTimer);
        idleTimer = setTimeout(hideNow, 700);
      }
    });
    card.addEventListener('focusin', showControls);

    // ----- Buttons
    playButton.addEventListener('click', () => { togglePlay(); showControls(); });
    muteButton.addEventListener('click', () => { toggleMute(); showControls(); });
    fullscreenButton.addEventListener('click', () => { toggleFullscreen(); showControls(); });

    // ----- Seek bar
    seek.addEventListener('pointerdown', () => { scrubbing = true; });
    const endScrub = () => {
      if(!scrubbing) return;
      scrubbing = false;
      render();
      showControls();
    };
    window.addEventListener('pointerup', endScrub);
    window.addEventListener('pointercancel', endScrub);
    seek.addEventListener('input', () => {
      const duration = video.duration;
      if(!Number.isFinite(duration) || !duration) return;
      const ratio = Number(seek.value) / 1000;
      video.currentTime = ratio * duration;
      seek.style.setProperty('--p', `${ratio * 100}%`);
      render();
      showControls();
    });

    // Arrow keys jump 5 seconds, like the browser's own player
    seek.addEventListener('keydown', event => {
      const jump = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5 }[event.key];
      const duration = video.duration;
      if(jump === undefined || !Number.isFinite(duration)) return;
      event.preventDefault();
      video.currentTime = Math.min(Math.max(video.currentTime + jump, 0), duration);
      render();
      showControls();
    });

    // ----- Menu behavior
    moreButton.addEventListener('click', () => {
      if(menu.hidden) openMenu(); else closeMenu(true);
    });
    document.addEventListener('pointerdown', event => {
      if(!menu.hidden && !menu.contains(event.target) && !moreButton.contains(event.target)) closeMenu(false);
    });
    menu.addEventListener('click', event => {
      if(event.target.closest('[role="menuitem"]')) closeMenu(event.detail === 0); // keep focus only for keyboard users
    });
    card.addEventListener('keydown', event => {
      if(menu.hidden) return;
      const list = menuItems();
      const index = list.indexOf(document.activeElement);
      if(event.key === 'Escape'){
        event.preventDefault();
        closeMenu(true);
      } else if(event.key === 'ArrowDown' && list.length){
        event.preventDefault();
        list[(index + 1) % list.length].focus();
      } else if(event.key === 'ArrowUp' && list.length){
        event.preventDefault();
        list[(index - 1 + list.length) % list.length].focus();
      } else if(event.key === 'Tab'){
        closeMenu(false);
      }
    });

    if(shareItem){
      shareItem.addEventListener('click', async () => {
        const data = { title: card.dataset.title, url: location.href };
        try {
          if(navigator.share){
            await navigator.share(data);
          } else if(navigator.clipboard && navigator.clipboard.writeText){
            await navigator.clipboard.writeText(location.href);
            showToast('Link copied');
          } else {
            window.prompt('Copy this link', location.href);
          }
        } catch (error) {
          // The share sheet was closed, nothing to do
        }
      });
    }

    // ----- Full screen state (also when the user leaves with Esc or a swipe)
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    video.addEventListener('webkitendfullscreen', render);

    render();
  });
}

function initPortfolioTabs(){
  const tabs = [...document.querySelectorAll('.portfolio-tab')];
  const cards = [...document.querySelectorAll('.gallery-card')];
  if(!tabs.length || !cards.length) return;

  const BATCH_SIZE = 12; // how many projects show at a time
  const loadMore = document.querySelector('.load-more');
  const loadMoreButton = loadMore ? loadMore.querySelector('.load-more__btn') : null;
  const loadMoreStatus = loadMore ? loadMore.querySelector('.load-more__status') : null;

  let currentFilter = 'all';
  let shownCount = BATCH_SIZE;

  const getMatching = () => cards.filter(card => currentFilter === 'all' || card.dataset.category === currentFilter);

  // Show the first `shownCount` projects of the current filter and hide the rest
  const render = () => {
    const matching = getMatching();
    const shown = new Set(matching.slice(0, shownCount));
    cards.forEach(card => {
      const isVisible = shown.has(card);
      card.hidden = !isVisible;
      card.style.display = isVisible ? '' : 'none';
      if(!isVisible){
        card.querySelectorAll('video').forEach(video => { if(!video.paused) video.pause(); });
      }
    });
    if(loadMore){
      loadMore.hidden = matching.length <= shown.size;
      if(loadMoreStatus) loadMoreStatus.textContent = `Showing ${shown.size} of ${matching.length}`;
    }
  };

  const applyFilter = (filter, options = {}) => {
    // Moving to another category never carries playback along
    if(filter !== currentFilter) pauseAllVideos();
    currentFilter = filter;
    shownCount = BATCH_SIZE;
    tabs.forEach(tab => {
      const active = tab.dataset.filter === filter;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      if(active && options.scrollTab && typeof tab.scrollIntoView === 'function'){
        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        tab.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', inline: 'nearest', block: 'nearest' });
      }
    });
    render();
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => applyFilter(tab.dataset.filter, { scrollTab: true }));
  });

  if(loadMoreButton){
    loadMoreButton.addEventListener('click', () => {
      const firstNewIndex = shownCount;
      shownCount += BATCH_SIZE;
      render();
      // Move keyboard focus to the first new project without jumping the page
      const firstNew = getMatching()[firstNewIndex];
      const target = firstNew ? firstNew.querySelector('button, a') : null;
      if(target) target.focus({ preventScroll: true });
    });
  }

  const defaultTab = tabs.find(t => t.classList.contains('is-active')) || tabs[0];
  applyFilter(defaultTab.dataset.filter);
}

// Connect editable work cards to the project lightbox
function renderWorkGrid(){
  const workCards = [...document.querySelectorAll('.work-card')];
  const lightbox = document.querySelector('.lightbox');
  if(!workCards.length || !lightbox) return;

  const lightboxImage = lightbox.querySelector('.lightbox__image');
  const previousButton = lightbox.querySelector('.lightbox__prev');
  const nextButton = lightbox.querySelector('.lightbox__next');
  let currentIndex = 0;
  let lastFocusedCard = null;
  let usingFallback = false; // true when the browser has no <dialog>.showModal() (older iOS Safari)
  const root = document.documentElement;

  const getProject = card => {
    const media = card.querySelector('img, video');
    return {
      card,
      image: media?.tagName === 'VIDEO' ? media.poster : media?.currentSrc || media?.src || '',
      alt: media?.alt || media?.getAttribute('aria-label') || '',
      title: card.querySelector('.name')?.childNodes[0]?.textContent.trim() || ''
    };
  };

  const getVisibleCards = () => workCards.filter(card => !card.closest('.gallery-card')?.hidden);

  const showProject = index => {
    const visibleCards = getVisibleCards();
    if(!visibleCards.length) return;
    currentIndex = (index + visibleCards.length) % visibleCards.length;
    const project = getProject(visibleCards[currentIndex]);
    // Large images can take a moment on a phone connection: show a small spinner until the picture is ready
    if(lightboxImage.getAttribute('src') !== project.image) lightbox.classList.add('is-loading');
    lightboxImage.src = project.image;
    lightboxImage.alt = project.alt;
    lightbox.setAttribute('aria-label', `${project.title} project viewer`);
  };

  const stopLoading = () => lightbox.classList.remove('is-loading');
  lightboxImage.addEventListener('load', stopLoading);
  lightboxImage.addEventListener('error', stopLoading);

  const openDialog = () => {
    root.classList.add('lightbox-open'); // stops the page behind from scrolling
    if(typeof lightbox.showModal === 'function'){
      try {
        lightbox.showModal();
        return;
      } catch (error) {
        // fall through to the manual version below
      }
    }
    usingFallback = true;
    lightbox.classList.add('is-fallback');
    lightbox.setAttribute('open', '');
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    const closeButton = lightbox.querySelector('.lightbox__close');
    if(closeButton) closeButton.focus();
  };

  const finishClose = () => {
    root.classList.remove('lightbox-open');
    lightbox.classList.remove('is-fallback', 'is-loading');
    if(lastFocusedCard) lastFocusedCard.focus({ preventScroll: true });
  };

  const closeLightbox = () => {
    if(!lightbox.hasAttribute('open')) return;
    if(usingFallback || typeof lightbox.close !== 'function'){
      usingFallback = false;
      lightbox.removeAttribute('open');
      finishClose();
    } else {
      lightbox.close();
    }
  };

  const openLightbox = index => {
    const visibleCards = getVisibleCards();
    const selectedIndex = visibleCards.indexOf(workCards[index]);
    if(selectedIndex < 0) return;
    lastFocusedCard = workCards[index];
    showProject(selectedIndex);
    openDialog();
  };

  const showNext = () => {
    const visibleCards = getVisibleCards();
    if(!visibleCards.length) return;
    const nextIndex = (currentIndex + 1) % visibleCards.length;
    showProject(nextIndex);
  };

  const showPrevious = () => {
    const visibleCards = getVisibleCards();
    if(!visibleCards.length) return;
    const prevIndex = (currentIndex - 1 + visibleCards.length) % visibleCards.length;
    showProject(prevIndex);
  };

  workCards.forEach((card, index) => {
    card.addEventListener('click', () => openLightbox(index));
  });

  previousButton?.addEventListener('click', showPrevious);
  nextButton?.addEventListener('click', showNext);
  lightbox.querySelector('.lightbox__close')?.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', event => {
    if(swiped){ // the end of a swipe is not a tap
      swiped = false;
      return;
    }
    // The dialog fills the screen, so a tap on the empty area around the image closes it
    if(event.target === lightbox || event.target.classList.contains('lightbox__content')) closeLightbox();
  });
  lightbox.addEventListener('cancel', () => {
    lightbox.close();
  });
  lightbox.addEventListener('close', finishClose);

  // Swipe left / right to move between projects (works with touch, pen and mouse)
  let swipeStartX = 0;
  let swipeStartY = 0;
  let swipeTracking = false;
  let swiped = false;
  lightbox.addEventListener('pointerdown', event => {
    if(event.target.closest('button')) return;
    swipeTracking = true;
    swiped = false;
    swipeStartX = event.clientX;
    swipeStartY = event.clientY;
  });
  lightbox.addEventListener('pointerup', event => {
    if(!swipeTracking) return;
    swipeTracking = false;
    const dx = event.clientX - swipeStartX;
    const dy = event.clientY - swipeStartY;
    if(Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5){
      swiped = true;
      if(dx < 0) showNext(); else showPrevious();
    }
  });
  lightbox.addEventListener('pointercancel', () => { swipeTracking = false; });

  lightbox.addEventListener('keydown', event => {
    if(event.key === 'Escape' && usingFallback){
      event.preventDefault();
      closeLightbox();
    }
    if(event.key === 'ArrowLeft'){
      event.preventDefault();
      showPrevious();
    }
    if(event.key === 'ArrowRight'){
      event.preventDefault();
      showNext();
    }
  });

}

// Populate a project detail page from ?p=slug
function renderProject(){
  const container = document.querySelector('[data-project-page]');
  if(!container || typeof PROJECTS === 'undefined') return;
  const params = new URLSearchParams(location.search);
  const slug = params.get('p') || PROJECTS[0].slug;
  const idx = PROJECTS.findIndex(p => p.slug === slug);
  const project = PROJECTS[idx] || PROJECTS[0];
  const prev = PROJECTS[(idx - 1 + PROJECTS.length) % PROJECTS.length];
  const next = PROJECTS[(idx + 1) % PROJECTS.length];

  document.title = `${project.title} — Moufick Art`;
  document.querySelector('.project-title').textContent = project.title;
  document.querySelector('.project-intro').textContent = project.intro;
  document.querySelector('.project-body').textContent = project.body;

  document.querySelector('[data-meta-timeline]').textContent = project.timeline;
  document.querySelector('[data-meta-role]').textContent = project.role;
  document.querySelector('[data-meta-category]').textContent = project.category;

  document.querySelector('[data-tags]').innerHTML =
    project.tags.map(t => `<span>${t}</span>`).join('');

  document.querySelector('[data-visual-main]').className = `project-visual cover ${project.cover}`;

  const row = document.querySelector('[data-visual-row]');
  row.innerHTML = `
    <div class="cover ${prev.cover}"></div>
    <div class="cover ${next.cover}"></div>
  `;

  document.querySelector('[data-nav-prev]').href = `project.html?p=${prev.slug}`;
  document.querySelector('[data-nav-prev-name]').textContent = prev.title;
  document.querySelector('[data-nav-next]').href = `project.html?p=${next.slug}`;
  document.querySelector('[data-nav-next-name]').textContent = next.title;
}

// ==========================================================================
// Custom Error & Network Management System
// Handles: Media loading failures, Offline/Online status, Fetch/Network errors
// ==========================================================================
// Offline & Online Connectivity Monitor
// Displays "You’re currently offline" pop-up banner at the top of the page
// ==========================================================================

function initConnectivityMonitor(){
  let banner = document.getElementById('networkOfflineBanner');
  if(!banner){
    banner = document.createElement('div');
    banner.id = 'networkOfflineBanner';
    banner.className = 'network-offline-banner';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.innerHTML = `
      <div class="nob-content">
        <span class="nob-dot" aria-hidden="true"></span>
        <svg class="nob-icon nob-icon-offline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="1" y1="1" x2="23" y2="23"/>
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
          <path d="M10.71 5.05A16 16 0 0 1 22.58 9"/>
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
          <line x1="12" y1="20" x2="12.01" y2="20"/>
        </svg>
        <svg class="nob-icon nob-icon-online" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
          <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
          <line x1="12" y1="20" x2="12.01" y2="20"/>
        </svg>
        <div class="nob-text">
          <strong class="nob-title">You’re currently offline</strong>
          <span class="nob-desc">Some content may not load until your connection is restored.</span>
        </div>
      </div>
    `;
    document.body.appendChild(banner);
  }

  const titleEl = banner.querySelector('.nob-title');
  const descEl = banner.querySelector('.nob-desc');
  let hideTimer = null;

  const showOfflineState = () => {
    if(hideTimer) clearTimeout(hideTimer);
    banner.classList.remove('is-online');
    banner.classList.add('is-offline', 'is-visible');
    if(titleEl) titleEl.textContent = 'You’re currently offline';
    if(descEl) descEl.textContent = 'Some content may not load until your connection is restored.';
  };

  const showOnlineState = () => {
    if(hideTimer) clearTimeout(hideTimer);
    banner.classList.remove('is-offline');
    banner.classList.add('is-online', 'is-visible');
    if(titleEl) titleEl.textContent = 'Back online';
    if(descEl) descEl.textContent = 'Connection restored.';

    hideTimer = setTimeout(() => {
      banner.classList.remove('is-visible');
    }, 3500);
  };

  window.addEventListener('offline', showOfflineState);
  window.addEventListener('online', showOnlineState);

  if(!navigator.onLine){
    showOfflineState();
  }
}

// Back to top button: appears after scrolling down
function initBackToTop(){
  const button = document.querySelector('.back-to-top');
  if(!button) return;

  const SHOW_AFTER = 400; // pixels scrolled before the button appears
  let ticking = false;

  const update = () => {
    ticking = false;
    button.classList.toggle('is-visible', window.scrollY > SHOW_AFTER);
  };

  window.addEventListener('scroll', () => {
    if(!ticking){
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });

  button.addEventListener('click', () => {
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  update();
}

document.addEventListener('DOMContentLoaded', () => {
  initConnectivityMonitor();
  initSidebar();
  markActiveNav();
  initVideoCards();
  initPortfolioTabs();
  initBackToTop();
  renderWorkGrid();
  renderProject();
});