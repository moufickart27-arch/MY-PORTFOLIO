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

function initVideoCards(){
  const videos = [...document.querySelectorAll('.video-card video, .motion-card video')];
  if(!videos.length) return;

  const MAX_PATH = 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5';
  const MIN_PATH = 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5';

  const isFullscreen = (card, video) => {
    return !!(
      document.fullscreenElement === card ||
      document.webkitFullscreenElement === card ||
      document.mozFullScreenElement === card ||
      document.msFullscreenElement === card ||
      card.classList.contains('is-fullscreen') ||
      video?.webkitDisplayingFullscreen
    );
  };

  const updateButtonState = (maxBtn, inFullscreen) => {
    if(!maxBtn) return;
    maxBtn.classList.toggle('is-fullscreen', inFullscreen);
    maxBtn.setAttribute('aria-label', inFullscreen ? 'Exit full screen' : 'Full screen');
    maxBtn.setAttribute('title', inFullscreen ? 'Exit full screen' : 'Full screen');
    const path = maxBtn.querySelector('svg path');
    if(path){
      path.setAttribute('d', inFullscreen ? MIN_PATH : MAX_PATH);
    }
  };

  const exitFullscreen = (card, video, maxBtn) => {
    if(card.classList.contains('is-fullscreen')){
      card.classList.remove('is-fullscreen');
      document.body.classList.remove('has-fullscreen-card');
    }
    if(document.exitFullscreen){
      document.exitFullscreen().catch(() => {});
    } else if(document.webkitExitFullscreen){
      document.webkitExitFullscreen().catch(() => {});
    } else if(document.mozCancelFullScreen){
      document.mozCancelFullScreen().catch(() => {});
    } else if(document.msExitFullscreen){
      document.msExitFullscreen().catch(() => {});
    }
    if(video && typeof video.webkitExitFullscreen === 'function'){
      try { video.webkitExitFullscreen(); } catch(e) {}
    }
    updateButtonState(maxBtn, false);
  };

  const fallbackFullscreen = (card, video, maxBtn) => {
    // iOS Safari: <video> element supports webkitEnterFullscreen
    if(video && typeof video.webkitEnterFullscreen === 'function'){
      try {
        video.play().catch(() => {});
        video.webkitEnterFullscreen();
        updateButtonState(maxBtn, true);
        return;
      } catch(e) {}
    }
    // Universal CSS fallback for mobile / in-app browsers
    card.classList.add('is-fullscreen');
    document.body.classList.add('has-fullscreen-card');
    updateButtonState(maxBtn, true);
  };

  const enterFullscreen = (card, video, maxBtn) => {
    if(video && !video.paused){
      video.play().catch(() => {});
    }

    const requestFS = card.requestFullscreen ||
                      card.webkitRequestFullscreen ||
                      card.mozRequestFullScreen ||
                      card.msRequestFullscreen;

    if(requestFS){
      const res = requestFS.call(card);
      if(res && typeof res.catch === 'function'){
        res.then(() => {
          updateButtonState(maxBtn, true);
        }).catch(() => {
          fallbackFullscreen(card, video, maxBtn);
        });
      } else {
        updateButtonState(maxBtn, true);
      }
    } else {
      fallbackFullscreen(card, video, maxBtn);
    }
  };

  const toggleFullscreen = (card, video, maxBtn) => {
    if(isFullscreen(card, video)){
      exitFullscreen(card, video, maxBtn);
    } else {
      enterFullscreen(card, video, maxBtn);
    }
  };

  // Helper to reliably handle mobile touch (touchend) and desktop click without double-firing
  const bindTap = (element, handler) => {
    if(!element) return;
    let lastTouch = 0;
    element.addEventListener('touchend', e => {
      lastTouch = Date.now();
      e.preventDefault();
      handler(e);
    }, { passive: false });

    element.addEventListener('click', e => {
      if(Date.now() - lastTouch < 500){
        e.preventDefault();
        return;
      }
      handler(e);
    });
  };

  videos.forEach(video => {
    video.parentElement.addEventListener('mouseenter', () => {
      video.play().catch(() => {});
    });
    video.parentElement.addEventListener('mouseleave', () => {
      video.pause();
      video.currentTime = 0;
    });

    const card = video.closest('.motion-card');
    if(!card) return;

    const soundButton = card.querySelector('.mc-sound');
    if(soundButton){
      bindTap(soundButton, () => {
        video.muted = !video.muted;
        soundButton.classList.toggle('muted', video.muted);
        soundButton.setAttribute('aria-pressed', String(!video.muted));
      });
    }

    const maxBtn = card.querySelector('.mc-max');
    if(maxBtn){
      bindTap(maxBtn, () => {
        toggleFullscreen(card, video, maxBtn);
      });
    }

    const shareButton = card.querySelector('.mc-share');
    if(shareButton){
      bindTap(shareButton, async () => {
        try {
          if(navigator.share){
            await navigator.share({ title: card.dataset.title, url: location.href });
          } else {
            await navigator.clipboard.writeText(location.href);
            alert('Link copied');
          }
        } catch (error) {}
      });
    }

    // Sync fullscreen button state if native fullscreen is closed via Esc or gesture
    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evt => {
      document.addEventListener(evt, () => {
        const active = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
        if(active !== card && !card.classList.contains('is-fullscreen')){
          updateButtonState(maxBtn, false);
        } else if(active === card){
          updateButtonState(maxBtn, true);
        }
      });
    });

    video.addEventListener('webkitendfullscreen', () => {
      updateButtonState(maxBtn, false);
    });
  });

  document.addEventListener('keydown', e => {
    if(e.key === 'Escape'){
      document.querySelectorAll('.motion-card.is-fullscreen').forEach(card => {
        const video = card.querySelector('video');
        const maxBtn = card.querySelector('.mc-max');
        exitFullscreen(card, video, maxBtn);
      });
    }
  });

  if(matchMedia('(hover: none)').matches && 'IntersectionObserver' in window){
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          entry.target.play().catch(() => {});
        } else {
          entry.target.pause();
        }
      });
    }, { threshold: 0.6 });

    videos.forEach(video => observer.observe(video));
  }
}

function initPortfolioTabs(){
  const tabs = [...document.querySelectorAll('.portfolio-tab')];
  const cards = [...document.querySelectorAll('.gallery-card')];
  if(!tabs.length || !cards.length) return;

  const applyFilter = filter => {
    tabs.forEach(tab => {
      const active = tab.dataset.filter === filter;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });

    cards.forEach(card => {
      const isVisible = filter === 'all' || card.dataset.category === filter;
      card.hidden = !isVisible;
      card.style.display = isVisible ? '' : 'none';
    });

    const visibleCards = cards.filter(card => !card.hidden);
    const visibleWorkCards = visibleCards.map(card => card.querySelector('.work-card')).filter(Boolean);
    const lightbox = document.querySelector('.lightbox');
    if(lightbox && typeof window.updateWorkCards === 'function') {
      window.updateWorkCards(visibleWorkCards);
    }
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => applyFilter(tab.dataset.filter));
  });

  const defaultTab = tabs.find(t => t.classList.contains('is-active')) || tabs[0];
  applyFilter(defaultTab.dataset.filter);
}

// Connect editable work cards to the project lightbox
function renderWorkGrid(){
  const workCards = [...document.querySelectorAll('.work-card')];
  const lightbox = document.querySelector('.lightbox');
  if(!workCards.length || !lightbox) return;

  const lightboxImage = lightbox.querySelector('.lightbox__image');
  const lightboxCategory = lightbox.querySelector('.lightbox__category');
  const lightboxTitle = lightbox.querySelector('.lightbox__title');
  const lightboxDescription = lightbox.querySelector('.lightbox__description');
  const previousButton = lightbox.querySelector('.lightbox__prev');
  const nextButton = lightbox.querySelector('.lightbox__next');
  let currentIndex = 0;
  let lastFocusedCard = null;

  const getProject = card => {
    const media = card.querySelector('img, video');
    return {
      card,
      image: media?.tagName === 'VIDEO' ? media.poster : media?.currentSrc || media?.src || '',
      alt: media?.alt || media?.getAttribute('aria-label') || '',
      category: card.querySelector('.cat')?.textContent.trim() || '',
      title: card.querySelector('.name')?.childNodes[0]?.textContent.trim() || '',
      description: card.querySelector('.description')?.textContent.trim() || ''
    };
  };

  const getVisibleCards = () => workCards.filter(card => !card.closest('.gallery-card')?.hidden);

  const showProject = index => {
    const visibleCards = getVisibleCards();
    if(!visibleCards.length) return;
    currentIndex = (index + visibleCards.length) % visibleCards.length;
    const project = getProject(visibleCards[currentIndex]);
    const existingPlaceholder = lightbox.querySelector('.media-error-placeholder');
    if(existingPlaceholder) existingPlaceholder.remove();
    lightboxImage.style.display = '';
    lightboxImage._mepHandled = false;
    lightboxImage.src = project.image;
    lightboxImage.alt = project.alt;
    lightboxCategory.textContent = project.category;
    lightboxTitle.textContent = project.title;
    lightboxDescription.textContent = project.description;
    lightbox.setAttribute('aria-label', `${project.title} project viewer`);
  };

  const closeLightbox = () => {
    if(lightbox.open) lightbox.close();
  };

  const openLightbox = index => {
    const visibleCards = getVisibleCards();
    const selectedIndex = visibleCards.indexOf(workCards[index]);
    if(selectedIndex < 0) return;
    lastFocusedCard = workCards[index];
    showProject(selectedIndex);
    lightbox.showModal();
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
    if(event.target === lightbox) closeLightbox();
  });
  lightbox.addEventListener('cancel', () => {
    lightbox.close();
  });
  lightbox.addEventListener('close', () => {
    lastFocusedCard?.focus();
  });
  lightbox.addEventListener('keydown', event => {
    if(event.key === 'ArrowLeft'){
      event.preventDefault();
      showPrevious();
    }
    if(event.key === 'ArrowRight'){
      event.preventDefault();
      showNext();
    }
  });

  window.updateWorkCards = updatedCards => {
    const nextCards = updatedCards.length ? updatedCards : workCards;
    const cardsToBind = nextCards.filter(Boolean);
    // Rebind only when the filter changed; this keeps the project lightbox stable.
    cardsToBind.forEach((card, index) => {
      card.onclick = null;
      card.addEventListener('click', () => {
        const visibleCards = nextCards.filter(Boolean);
        const selectedIndex = visibleCards.indexOf(card);
        if(selectedIndex < 0) return;
        lastFocusedCard = card;
        const project = getProject(card);
        const existingPlaceholder = lightbox.querySelector('.media-error-placeholder');
        if(existingPlaceholder) existingPlaceholder.remove();
        lightboxImage.style.display = '';
        lightboxImage._mepHandled = false;
        lightboxImage.src = project.image;
        lightboxImage.alt = project.alt;
        lightboxCategory.textContent = project.category;
        lightboxTitle.textContent = project.title;
        lightboxDescription.textContent = project.description;
        lightbox.setAttribute('aria-label', `${project.title} project viewer`);
        lightbox.showModal();
      });
    });
  };
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

const failedMediaSet = new Set();

function initErrorHandling(){
  initConnectivityMonitor();
  initMediaErrorHandling();
  initNetworkInterceptor();
}

// 1. Offline & Online Connectivity Monitor
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

    // Automatically re-attempt failed media when returning online
    failedMediaSet.forEach(item => {
      if(typeof item.retry === 'function') item.retry();
    });

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

// 2. Media Loading Error Handling (Images, Videos, Sources)
function createMediaErrorPlaceholder(media, onRetry){
  const placeholder = document.createElement('div');
  placeholder.className = 'media-error-placeholder';
  placeholder.setAttribute('role', 'alert');
  placeholder.setAttribute('aria-live', 'polite');
  placeholder.innerHTML = `
    <div class="mep-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
        <circle cx="9" cy="9" r="2"/>
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
        <line x1="2" y1="2" x2="22" y2="22"/>
      </svg>
    </div>
    <h3 class="mep-title">This content couldn’t load</h3>
    <p class="mep-subtitle">Please check your internet connection.</p>
    <button type="button" class="mep-retry-btn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
        <path d="M16 21h5v-5"/>
      </svg>
      <span>Try Again</span>
    </button>
  `;

  const btn = placeholder.querySelector('.mep-retry-btn');
  btn.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();
    btn.classList.add('is-loading');
    btn.disabled = true;
    if(onRetry) onRetry();
  });

  return placeholder;
}

function handleMediaError(element){
  const media = element.tagName === 'SOURCE' ? element.parentElement : element;
  if(!media || media._mepHandled) return;

  const currentSrc = media.currentSrc || media.src || (element.tagName === 'SOURCE' ? element.src : '');
  if(!currentSrc || currentSrc.trim() === '' || currentSrc.endsWith('#none')) return;

  media._mepHandled = true;

  const retryFn = () => {
    media._mepHandled = false;
    const retryParam = `_retry=${Date.now()}`;
    if(media.tagName === 'IMG'){
      const base = (media.dataset.origSrc || media.src).replace(/([?&])_retry=\d+/, '');
      media.dataset.origSrc = base;
      const cleanUrl = base + (base.includes('?') ? '&' : '?') + retryParam;
      media.src = cleanUrl;
    } else if(media.tagName === 'VIDEO'){
      media.load();
      media.play().catch(() => {});
    }

    const handleSuccess = () => {
      media.removeEventListener('load', handleSuccess);
      media.removeEventListener('loadeddata', handleSuccess);
      placeholder.remove();
      media.style.display = '';
      failedMediaSet.delete(trackingObj);
    };

    media.addEventListener('load', handleSuccess, { once: true });
    media.addEventListener('loadeddata', handleSuccess, { once: true });
  };

  const trackingObj = { media, retry: retryFn };
  failedMediaSet.add(trackingObj);

  const placeholder = createMediaErrorPlaceholder(media, retryFn);

  // Hide broken media element
  media.style.display = 'none';

  // Smart placement based on layout container
  if(media.classList.contains('lightbox__image')){
    const container = media.closest('.lightbox__content') || media.parentElement;
    container.insertBefore(placeholder, media);
  } else if(media.closest('.work-card')){
    const workCard = media.closest('.work-card');
    const label = workCard.querySelector('.work-card__label');
    if(label){
      workCard.insertBefore(placeholder, label);
    } else {
      workCard.appendChild(placeholder);
    }
  } else if(media.closest('.motion-card')){
    const motionCard = media.closest('.motion-card');
    motionCard.appendChild(placeholder);
  } else if(media.parentElement){
    media.parentElement.insertBefore(placeholder, media.nextSibling);
  }
}

function initMediaErrorHandling(){
  // Capture all media errors in the capturing phase (window 'error' with useCapture = true)
  window.addEventListener('error', event => {
    const target = event.target;
    if(!target) return;
    if(target.tagName === 'IMG' || target.tagName === 'VIDEO' || target.tagName === 'SOURCE'){
      handleMediaError(target);
    }
  }, true);

  // Check images already in the DOM that might have failed before script attached
  document.querySelectorAll('img').forEach(img => {
    if(img.complete && img.naturalWidth === 0 && img.src && img.src.trim() !== ''){
      handleMediaError(img);
    }
  });
}

// 3. Network & Fetch Interceptor with Styled Toasts
function getToastContainer(){
  let container = document.getElementById('networkToastContainer');
  if(!container){
    container = document.createElement('div');
    container.id = 'networkToastContainer';
    container.className = 'network-toast-container';
    container.setAttribute('aria-live', 'assertive');
    document.body.appendChild(container);
  }
  return container;
}

function showNetworkToast(opts = {}){
  const container = getToastContainer();
  const toast = document.createElement('div');
  const isWarning = opts.status === 404;
  toast.className = `network-toast ${isWarning ? 'toast-warning' : 'toast-error'}`;
  toast.setAttribute('role', 'alert');

  let title = 'Network Request Failed';
  let desc = 'Unable to complete network request. Please check your connection.';

  if(opts.status === 404){
    title = 'Content Not Found (404)';
    desc = opts.url ? `Unable to find the requested content: ${opts.url.split('/').pop() || 'resource'}` : 'The requested item could not be found.';
  } else if(opts.status >= 500){
    title = `Server Error (${opts.status})`;
    desc = 'The server encountered an issue. Please try again in a few moments.';
  } else if(!navigator.onLine){
    title = 'You’re Offline';
    desc = 'Network request could not proceed because your device is offline.';
  } else if(opts.error && String(opts.error).toLowerCase().includes('failed to fetch')){
    title = 'Connection Problem';
    desc = 'Unable to reach the server. Please verify your internet connection.';
  }

  toast.innerHTML = `
    <svg class="nt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    <div class="nt-body">
      <span class="nt-title">${title}</span>
      <span class="nt-desc">${desc}</span>
    </div>
    <button type="button" class="nt-close" aria-label="Dismiss notification">&times;</button>
  `;

  const dismiss = () => {
    toast.classList.add('is-hiding');
    setTimeout(() => toast.remove(), 320);
  };

  toast.querySelector('.nt-close')?.addEventListener('click', dismiss);
  setTimeout(dismiss, 5500);

  container.appendChild(toast);
}

function initNetworkInterceptor(){
  // Intercept window.fetch to catch 404s, 500s, and connection drops
  const nativeFetch = window.fetch;
  if(typeof nativeFetch === 'function'){
    window.fetch = async function(...args){
      try {
        const response = await nativeFetch.apply(this, args);
        if(!response.ok){
          const urlStr = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
          showNetworkToast({
            status: response.status,
            statusText: response.statusText,
            url: urlStr
          });
        }
        return response;
      } catch(err){
        const urlStr = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        showNetworkToast({
          error: err,
          url: urlStr
        });
        throw err;
      }
    };
  }

  // Intercept unhandled promise rejections that arise from failed network requests
  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason;
    if(reason && (reason.name === 'TypeError' || String(reason).toLowerCase().includes('fetch') || String(reason).toLowerCase().includes('network'))){
      showNetworkToast({ error: reason });
    }
  });
}

// Initialize error handling
initMediaErrorHandling();
initNetworkInterceptor();

document.addEventListener('DOMContentLoaded', () => {
  initErrorHandling();
  initSidebar();
  markActiveNav();
  initVideoCards();
  initPortfolioTabs();
  renderWorkGrid();
  renderProject();
});