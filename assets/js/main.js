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
