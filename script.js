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
    // Fallback that makes the viewer fill the screen with position: fixed; inset: 0; width: 100dvw; height: 100dvh
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

document.addEventListener('DOMContentLoaded', () => {
  initConnectivityMonitor();
  initSidebar();
  markActiveNav();
  initVideoCards();
  initPortfolioTabs();
  renderWorkGrid();
  renderProject();
});