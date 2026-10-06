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
    soundButton?.addEventListener('click', () => {
      video.muted = !video.muted;
      soundButton.classList.toggle('muted', video.muted);
      soundButton.setAttribute('aria-pressed', String(!video.muted));
    });

    card.querySelector('.mc-max')?.addEventListener('click', () => {
      if(document.fullscreenElement){
        document.exitFullscreen().catch(() => {});
      } else {
        card.requestFullscreen?.().catch(() => {});
      }
    });

    card.querySelector('.mc-share')?.addEventListener('click', async () => {
      try {
        if(navigator.share){
          await navigator.share({ title: card.dataset.title, url: location.href });
        } else {
          await navigator.clipboard.writeText(location.href);
          alert('Link copied');
        }
      } catch (error) {}
    });
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

  applyFilter('gallery');
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

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  markActiveNav();
  initVideoCards();
  initPortfolioTabs();
  renderWorkGrid();
  renderProject();
});