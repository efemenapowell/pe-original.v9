/* ==========================================================
   PE_ORIGINALS — animations.js
   anime.js-powered animations: hero entrance, scroll reveals,
   grid staggers, count-ups, marquee, hover micro-interactions
   ========================================================== */

'use strict';

/* Namespace so main.js can re-trigger reveals after
   dynamic rendering (e.g. filters on shop page) */
window.PEAnim = window.PEAnim || {};

/* Wait for anime.js CDN (kept at end of <body>) */
function waitForAnime(cb) {
  if (typeof anime !== 'undefined') { cb(); return; }
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (typeof anime !== 'undefined') { clearInterval(t); cb(); }
    else if (tries > 80) clearInterval(t); // ~4s, give up silently
  }, 50);
}

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ══ 1. Hero entrance (home) ═════════════════════════════ */
function heroEntrance() {
  const hero = $('#hero .hero-copy, .hero-visual');
  if (!hero) return;

  const els = $('#hero .hero-copy') ? [
    $('#hero .eyebrow'),
    $('#hero h1'),
    $('#hero .hero-sub'),
    $('#hero .hero-cta'),
    $('#hero .hero-trust')
  ].filter(Boolean) : [];

  if (els.length) {
    anime({
      targets: els,
      opacity: [0, 1],
      translateY: [40, 0],
      duration: 900,
      easing: 'easeOutExpo',
      delay: anime.stagger(140, { start: 150 })
    });
  }

  // hero image rise + float cards
  const imgWrap = $('#hero .hero-img-wrap');
  if (imgWrap) {
    anime({
      targets: imgWrap,
      opacity: [0, 1],
      scale: [0.94, 1],
      translateY: [30, 0],
      duration: 1100,
      easing: 'easeOutExpo',
      delay: 250
    });
  }
  const fc = $$('#hero .hero-float-card');
  if (fc.length) {
    anime({
      targets: fc,
      opacity: [0, 1],
      scale: [0.8, 1],
      translateY: [20, 0],
      duration: 700,
      easing: 'easeOutBack',
      delay: anime.stagger(250, { start: 800 })
    });
  }

  // hero scroll hint fade
  const hint = $('#hero .hero-scroll-hint');
  if (hint) {
    anime({ targets: hint, opacity: [0, 1], duration: 800, delay: 1600, easing: 'easeOutQuad' });
  }
}

/* ══ 2. Scroll reveals ═══════════════════════════════════ */
function initReveals() {
  const items = $$('.reveal:not(.in-view)');
  if (!items.length) return;

  if (!('IntersectionObserver' in window) || REDUCED) {
    items.forEach(el => el.classList.add('in-view'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        el.classList.add('in-view');
        io.unobserve(el);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  items.forEach(el => io.observe(el));
}

/* ══ 3. Stagger containers (children fade up) ════════════ */
function initStaggers() {
  const containers = $$('.stagger:not(.in-view)');
  if (!containers.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        el.classList.add('in-view');

        // anime.js children stagger for a smoother feel
        const kids = $$(':scope > *', el);
        if (kids.length && typeof anime !== 'undefined') {
          anime({
            targets: kids,
            opacity: [0, 1],
            translateY: [28, 0],
            duration: 750,
            easing: 'easeOutExpo',
            delay: anime.stagger(70)
          });
        }
        io.unobserve(el);
      }
    });
  }, { threshold: 0.15 });

  containers.forEach(el => io.observe(el));
}

/* ══ 4. Section heading entrance (eyebrow + title) ═══════ */
function initSectionHeads() {
  const heads = $$('.section-head:not(.in-view)');
  if (!heads.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('in-view');
      const parts = el.querySelectorAll('.eyebrow, h2, p, .script-accent');
      if (parts.length && typeof anime !== 'undefined') {
        anime({
          targets: parts,
          opacity: [0, 1],
          translateY: [26, 0],
          duration: 800,
          easing: 'easeOutExpo',
          delay: anime.stagger(110)
        });
      }
      io.unobserve(el);
    });
  }, { threshold: 0.3 });

  heads.forEach(el => io.observe(el));
}

/* ══ 5. Count-up stats ═══════════════════════════════════ */
function initCounters() {
  const nums = $$('.stat-num[data-target]');
  if (!nums.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.target, 10) || 0;

      if (typeof anime !== 'undefined') {
        const obj = { v: 0 };
        anime({
          targets: obj,
          v: target,
          round: 1,
          duration: 1800,
          easing: 'easeOutExpo',
          update: () => { el.textContent = obj.v; }
        });
      } else {
        el.textContent = target;
      }
      io.unobserve(el);
    });
  }, { threshold: 0.5 });

  nums.forEach(el => io.observe(el));
}

/* ══ 6. Marquee (duplicate track if needed) ══════════════ */
function initMarquee() {
  const track = $('.marquee');
  if (!track) return;
  // ensure enough items for seamless loop
  if (track.children.length < 8) {
    const html = track.innerHTML;
    track.innerHTML = html + html;
  }
}

/* ══ 7. Product card hover micro-interaction ═════════════ */
function initCardHovers() {
  const cards = $$('.product-card, .category-card, .value-card, .team-card, .testimonial-card, .step-card');
  if (!cards.length || typeof anime === 'undefined') return;

  cards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      anime({
        targets: card.querySelector('.product-media img, img'),
        scale: 1.06,
        duration: 700,
        easing: 'easeOutQuad'
      });
    });
    card.addEventListener('mouseleave', () => {
      anime({
        targets: card.querySelector('.product-media img, img'),
        scale: 1,
        duration: 600,
        easing: 'easeOutQuad'
      });
    });
  });
}

/* ══ 8. Cart count badge pop when it updates ═════════════ */
function initBadgePop() {
  const badge = $('.cart-count');
  if (!badge || typeof anime === 'undefined') return;
  const obs = new MutationObserver(() => {
    anime({
      targets: badge,
      scale: [1, 1.35, 1],
      duration: 400,
      easing: 'easeOutBack'
    });
  });
  obs.observe(badge, { childList: true, characterData: true, subtree: true });
}

/* ══ 9. Page-transition fade on load ═════════════════════ */
function initPageLoad() {
  document.body.classList.add('loaded');
  anime({
    targets: 'body',
    opacity: [0, 1],
    duration: 500,
    easing: 'easeOutQuad'
  });
}

/* ══ 10. Refresh reveals (called by main.js after renders) */
function refreshReveals() {
  initReveals();
  initStaggers();
  initSectionHeads();
}

window.PEAnim.refreshReveals = refreshReveals;

/* ══ Boot ════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  if (REDUCED) {
    // show everything instantly for reduced-motion users
    $$('.reveal, .stagger').forEach(el => el.classList.add('in-view'));
    return;
  }
  initPageLoad();
  waitForAnime(() => {
    heroEntrance();
    initCardHovers();
    initBadgePop();
  });
  initReveals();
  initStaggers();
  initSectionHeads();
  initCounters();
  initMarquee();
});
