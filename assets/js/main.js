// Language switcher
document.addEventListener('DOMContentLoaded', function () {
  var langBtn = document.querySelector('.lang-btn');
  var langList = document.querySelector('.lang-list');
  if (!langBtn || !langList) return;
  langBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    var expanded = langBtn.getAttribute('aria-expanded') === 'true';
    langBtn.setAttribute('aria-expanded', !expanded);
    langList.hidden = expanded;
  });
  langList.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
      langList.hidden = true;
      langBtn.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('click', function (e) {
    if (!langList.hidden) {
      langList.hidden = true;
      langBtn.setAttribute('aria-expanded', 'false');
    }
  });
});
const qs = (s, el = document) => el.querySelector(s);
const qsa = (s, el = document) => [...el.querySelectorAll(s)];

document.addEventListener('DOMContentLoaded', () => {
  heroSlider();
  carousels();
  sliders();
  // Show contact form success notice if redirected with ?sent=1
  try {
    const p = new URLSearchParams(window.location.search);
    if (p.get('sent') === '1') {
      const n = document.getElementById('form-success');
      if (n) n.hidden = false;
    }
  } catch {}
  // Contact form validation (client-side)
  initContactFormValidation();
  // Header search toggle (click icon to open hidden search field)
  const toggle = qs('.search-toggle');
  const actions = qs('.header-actions-right');
  const form = qs('.header-search');
  const input = form ? form.querySelector('input') : null;
  if (toggle && actions && form && input) {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = actions.classList.toggle('search-open');
      toggle.setAttribute('aria-expanded', open);
      if (open) {
        setTimeout(() => input.focus(), 0);
      }
    });
    document.addEventListener('click', (e) => {
      if (!actions.classList.contains('search-open')) return;
      if (!actions.contains(e.target)) {
        actions.classList.remove('search-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && actions.classList.contains('search-open')) {
        actions.classList.remove('search-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Mobile burger menu toggle
  const menuBtn = qs('.menu-toggle');
  const menu = qs('.header-menu-row');
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('menu-open', open);
      menuBtn.classList.toggle('open', open);
    });
    document.addEventListener('click', (e) => {
      if (!menu.classList.contains('open')) return;
      const within = menu.contains(e.target) || menuBtn.contains(e.target);
      if (!within) {
        menu.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('menu-open');
      }
    });
  }
});

function heroSlider() {
  const root = qs('.hero');
  if (!root) return;
  // Support both the existing .slides/.slide and generic .flex-row/.card
  const track = qs('.slides', root) || qs('.flex-row', root);
  const slides = qsa('.slide', track).length ? qsa('.slide', track) : qsa('.card', track);
  const dots = qsa('.dots button', root);

  const updateActive = () => {
    const idx = Math.round(track.scrollLeft / track.clientWidth);
    dots.forEach((b, k) => b.classList.toggle('active', k === idx));
  };

  // Dots jump to slide (mobile primarily)
  dots.forEach((b, k) =>
    b.addEventListener('click', () => track.scrollTo({ left: k * track.clientWidth, behavior: 'smooth' }))
  );

  // Desktop drag-to-scroll
  const isDesktop = window.matchMedia('(min-width: 901px)').matches;
  if (isDesktop) {
    let isDown = false,
      startX = 0,
      startLeft = 0;
    track.addEventListener('mousedown', (e) => {
      isDown = true;
      startX = e.pageX;
      startLeft = track.scrollLeft;
    });
    window.addEventListener('mouseup', () => {
      isDown = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      const dx = e.pageX - startX;
      track.scrollLeft = startLeft - dx;
    });
  }

  track.addEventListener('scroll', updateActive);
  updateActive();
}

function carousels() {
  qsa('.carousel').forEach((c) => {
    const track = qs('.carousel-track', c);
    const prev = qs('.carousel .nav .prev', c);
    const next = qs('.carousel .nav .next', c);
    prev.addEventListener('click', () => track.scrollBy({ left: -340, behavior: 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: 340, behavior: 'smooth' }));
  });
}

// Generic sliders (multiple per page)
function sliders(){
  qsa('.slider').forEach((root) => {
    const track = root.querySelector('.slider-track');
    const slides = qsa('.slide', track);
    const dots = qsa('.dots button', root);
    const prev = root.querySelector('.nav .prev');
    const next = root.querySelector('.nav .next');
    const interval = parseInt((track && track.getAttribute('data-interval'))||'6000',10);
    let timer = null;

    const show = (idx) => {
      if (!track) return;
      const off = idx * track.clientWidth;
      track.scrollTo({ left: off, behavior: 'smooth' });
      dots.forEach((b,k)=>b.classList.toggle('active',k===idx));
    };
    const activeIndex = () => track ? Math.round(track.scrollLeft / track.clientWidth) : 0;
    const step = (d) => show((activeIndex()+d+slides.length)%slides.length);
    const auto = () => { timer = setInterval(()=>step(1), interval); };
    const stop = () => { if (timer) clearInterval(timer); timer=null; };

    if (prev) prev.addEventListener('click',()=>step(-1));
    if (next) next.addEventListener('click',()=>step(1));
    dots.forEach((b,k)=>b.addEventListener('click',()=>show(k)));
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', auto);
    if (slides.length) { show(0); auto(); }
  });
}

// Simple client-side validation for contact form
function initContactFormValidation() {
  const form = document.querySelector('.contact-form');
  if (!form) return;

  const getMsg = (key, fallback = '') => form.dataset[key] || fallback;
  const errorEl = (name) => form.querySelector(`.error-msg[data-error-for="${name}"]`);
  const fieldWrap = (el) => el.closest('label') || el.parentElement;

  const clearError = (el) => {
    const wrap = fieldWrap(el);
    if (wrap) wrap.classList.remove('field-error');
    const em = errorEl(el.name);
    if (em) em.hidden = true, em.textContent = '';
    el.setAttribute('aria-invalid', 'false');
  };

  const setError = (el, msg) => {
    const wrap = fieldWrap(el);
    if (wrap) wrap.classList.add('field-error');
    const em = errorEl(el.name);
    if (em) { em.textContent = msg; em.hidden = false; }
    el.setAttribute('aria-invalid', 'true');
  };

  const validators = {
    name: (v) => v.trim().length >= 2,
    email: (v) => /.+@.+\..+/.test(v.trim()),
    message: (v) => v.trim().length >= 10,
  };

  // Live validation
  ['input', 'blur'].forEach((evt) => {
    form.addEventListener(evt, (e) => {
      const el = e.target;
      if (!el.name) return;
      clearError(el);
      const v = String(el.value || '');
      if (el.name in validators) {
        const ok = validators[el.name](v);
        if (!ok) {
          const key =
            el.name === 'name' ? 'nameRequired' :
            el.name === 'email' && v ? 'emailInvalid' :
            el.name === 'email' ? 'emailRequired' :
            el.name === 'message' && v.length > 0 ? 'messageMin' : 'messageRequired';
          setError(el, getMsg(key));
        }
      }
    }, true);
  });

  // Submit validation
  form.addEventListener('submit', (e) => {
    let hasErrors = false;
    const name = form.querySelector('[name="name"]');
    const email = form.querySelector('[name="email"]');
    const message = form.querySelector('[name="message"]');

    [name, email, message].forEach((el) => clearError(el));

    if (!validators.name(name.value)) {
      setError(name, getMsg('nameRequired'));
      hasErrors = true;
    }
    if (!email.value.trim()) {
      setError(email, getMsg('emailRequired'));
      hasErrors = true;
    } else if (!validators.email(email.value)) {
      setError(email, getMsg('emailInvalid'));
      hasErrors = true;
    }
    if (!validators.message(message.value)) {
      const key = message.value.trim().length ? 'messageMin' : 'messageRequired';
      setError(message, getMsg(key));
      hasErrors = true;
    }

    if (hasErrors) {
      e.preventDefault();
      const first = form.querySelector('.field-error input, .field-error textarea');
      if (first) first.focus();
    }
  });
}
