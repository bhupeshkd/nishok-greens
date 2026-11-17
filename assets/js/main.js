/* ==========================================================================
   Nishok Greens — motion & interaction
   Stack: GSAP 3 + ScrollTrigger + Lenis (all via CDN, loaded with `defer`)
   ========================================================================== */
(() => {
  'use strict';

  const qs = (s, el = document) => el.querySelector(s);
  const qsa = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = document.documentElement.classList.contains('reduced-motion');
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  // If the CDN fails, drop the "js" flag so all content is shown in its final state.
  if (!hasGSAP) {
    document.documentElement.classList.remove('js');
    document.documentElement.classList.add('reduced-motion');
  }

  const EASE = 'expo.out';
  let lenis = null;
  let heroPin = null; // ScrollTrigger for the pinned video scrub, once the film is live

  /* ------------------------------------------------------------------------
     1. Lenis inertial scroll, driven by GSAP's ticker
     - Lenis owns the scroll position; every Lenis scroll event tells
       ScrollTrigger to recompute, so pins/scrubs stay frame-accurate.
     - Lenis is advanced from gsap.ticker (one shared rAF loop), and
       lagSmoothing(0) stops GSAP from "catching up" after a dropped frame,
       which would otherwise make the scroll jump.
     ------------------------------------------------------------------------ */
  function initSmoothScroll() {
    if (!hasGSAP) return;
    gsap.registerPlugin(ScrollTrigger);
    if (reduceMotion || typeof window.Lenis === 'undefined') return;

    lenis = new Lenis({
      duration: 1.25,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // expo-out feel
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.4,
    });

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000)); // gsap time is seconds, Lenis wants ms
    gsap.ticker.lagSmoothing(0);
  }

  function scrollToTarget(target) {
    const el = typeof target === 'string' ? qs(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  /* ------------------------------------------------------------------------
     Header: transparent over hero → frosted stone; hides on scroll down
     ------------------------------------------------------------------------ */
  function initHeader() {
    const header = qs('[data-header]');
    const hero = qs('#hero');
    let lastY = 0;
    const onScroll = () => {
      const y = window.scrollY;
      // When the hero is pinned for the video scrub, it only starts leaving once the pin ends
      const heroBottom = (heroPin ? heroPin.end : 0) + hero.offsetHeight;
      const past = y > heroBottom - 80;
      header.classList.toggle('is-solid', past);
      header.classList.toggle('is-hidden', past && y > lastY + 2 && !document.body.classList.contains('drawer-open'));
      if (y < lastY - 2) header.classList.remove('is-hidden');
      lastY = y;
    };
    if (lenis) lenis.on('scroll', onScroll);
    else window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ------------------------------------------------------------------------
     Index drawer (01–07) with focus handling and Esc to close
     ------------------------------------------------------------------------ */
  function initDrawer() {
    const drawer = qs('[data-drawer]');
    const openBtn = qs('[data-drawer-open]');
    const panel = qs('.drawer__panel', drawer);

    const open = () => {
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      openBtn.setAttribute('aria-expanded', 'true');
      document.body.classList.add('drawer-open');
      lenis && lenis.stop();
      setTimeout(() => qs('.drawer__close', drawer).focus(), 50);
    };
    const close = (restoreFocus = true) => {
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      openBtn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('drawer-open');
      lenis && lenis.start();
      restoreFocus && openBtn.focus();
    };

    openBtn.addEventListener('click', open);
    qsa('[data-drawer-close]', drawer).forEach((b) => b.addEventListener('click', () => close()));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) close();
      // simple focus trap
      if (e.key === 'Tab' && drawer.classList.contains('is-open')) {
        const f = qsa('a, button', panel);
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });

    // All in-page links glide via Lenis
    qsa('[data-scroll-link]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const hash = a.getAttribute('href');
        if (!hash || !hash.startsWith('#')) return;
        e.preventDefault();
        if (drawer.classList.contains('is-open')) close(false);
        scrollToTarget(hash);
      });
    });
  }

  /* ------------------------------------------------------------------------
     2. Masked line reveals (hero on load, others on scroll)
     Lines are authored in markup (.line > span) so breaks are art-directed
     and never re-flow; the span slides from yPercent 105 → 0 inside its mask.
     ------------------------------------------------------------------------ */
  function revealLines(el, delay = 0) {
    const spans = qsa('.line > span', el);
    return gsap.fromTo(spans,
      { yPercent: 105, y: 0 },
      { yPercent: 0, duration: 1.5, ease: EASE, stagger: 0.12, delay });
  }

  function initHero() {
    const img = qs('[data-hero-img]');
    const title = qs('.hero__title');
    const fades = qsa('[data-hero-fade]');

    const start = () => {
      const tl = gsap.timeline();
      tl.fromTo(img, { scale: 1.18 }, { scale: 1, duration: 2.8, ease: 'power3.out' }, 0)
        .add(revealLines(title), 0.25)
        .fromTo(fades, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 1.4, ease: EASE, stagger: 0.1 }, 0.8);
    };
    // Start once the hero image has decoded so the zoom-out is never on a blank frame
    if (img.complete) start();
    else { img.addEventListener('load', start, { once: true }); img.addEventListener('error', start, { once: true }); }

    // Gentle parallax as the hero scrolls away (used while there is no film, or if it fails)
    const parallax = gsap.to('.hero__media', {
      yPercent: 14, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });

    initHeroFilm(parallax);
  }

  /* ------------------------------------------------------------------------
     Scroll-scrubbed hero film
     The hero pins, and scroll position (not playback) drives video.currentTime,
     so scrolling down walks forward through the clip and scrolling up rewinds it.
     - The still image stays underneath; the video only fades in after a test
       seek proves this browser can scrub the file. Missing file, slow network
       or a codec problem all leave the still hero exactly as it was.
     - currentTime chases its scroll target with a lerp on the GSAP ticker,
       which smooths out the stepping between frames.
     - Skipped on Save-Data / 2G connections.
     ------------------------------------------------------------------------ */
  const FILM = {
    span: 2.4,      // how much scroll the clip takes, in viewport heights. Higher = slower film
    zoom: 1.1,    // camera push-in layered over the film: the frame scales from 1 to this by the end
    scrub: 0.5,     // ScrollTrigger smoothing on the scroll value
    chase: 0.18,    // how quickly the frame catches up with scroll (0–1). Higher = snappier
  };

  function initHeroFilm(parallax) {
    const video = qs('[data-hero-video]');
    if (!video) return;
    const conn = navigator.connection || {};
    if (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '')) return;

    const hero = qs('#hero');
    const media = qs('.hero__media');
    const still = qs('[data-hero-img]');
    const bar = qs('[data-hero-progress]');
    const narrow = () => window.matchMedia('(max-width: 900px)').matches;

    let duration = 0;
    let target = 0;
    let shown = 0;
    let settled = false;

    const fail = (why) => {
      if (settled) return;
      settled = true;
      video.removeAttribute('src');
      video.load();
      console.info('[Nishok Greens] Hero film not used, keeping the still image:', why);
    };

    const goLive = () => {
      if (settled) return;
      settled = true;
      duration = video.duration;
      video.classList.add('is-live');

      // Hand the hero over from parallax to a pinned scrub
      parallax.scrollTrigger && parallax.scrollTrigger.kill();
      parallax.kill();
      gsap.set(media, { yPercent: 0 });

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: () => '+=' + window.innerHeight * FILM.span,
          scrub: FILM.scrub,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          refreshPriority: 1, // pinned first on the page: measure before everything below it
          onUpdate: (self) => { target = self.progress * Math.max(0, duration - 0.05); },
        },
      });
      tl.to(bar, { scaleX: 1 }, 0)
        .to(still, { scale: 1.06 }, 0)
        .fromTo(video, { scale: 1 }, { scale: FILM.zoom, ease: 'power1.in', duration: 1 }, 0)
        .to('.hero__foot', { opacity: 0, y: -12, duration: 0.25 }, 0)
        .to('.hero__badge', { opacity: 0, duration: 0.2 }, 0)
        .to('.hero__title', { yPercent: -10, duration: 1 }, 0)
        .to('.hero__veil', { opacity: 0.75, duration: 1 }, 0);
      heroPin = tl.scrollTrigger;

      ScrollTrigger.sort();
      ScrollTrigger.refresh();

      // Drive the frame by hand; never let it actually play
      gsap.ticker.add(() => {
        if (!video.paused) video.pause();
        if (video.seeking || !duration) return;
        shown += (target - shown) * FILM.chase;
        if (Math.abs(shown - video.currentTime) > 0.01) {
          try { video.currentTime = shown; } catch (_) { /* seek refused mid-load: next tick retries */ }
        }
      });
    };

    // Prove the file can seek before swapping it in: a film frozen on frame one is worse than the still
    const probe = () => {
      if (settled || video.readyState < 2 || !isFinite(video.duration) || !video.duration) return;
      video.removeEventListener('loadeddata', probe);
      const at = Math.min(0.3, video.duration * 0.1);
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        if (Math.abs(video.currentTime - at) < 0.2) { video.currentTime = 0; goLive(); }
        else retryAsBlob('seek did not land');
      };
      video.addEventListener('seeked', onSeeked);
      try { video.currentTime = at; } catch (_) { retryAsBlob('seek threw'); }
    };

    // Hosts that ignore HTTP Range requests make the browser refuse to seek a streamed file.
    // Loading the whole clip into memory first (a blob URL) is always seekable.
    let triedBlob = false;
    const retryAsBlob = (why) => {
      if (settled) return;
      if (triedBlob) return fail(why);
      triedBlob = true;
      fetch(video.currentSrc || video.src)
        .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
        .then((blob) => {
          if (settled) return;
          video.src = URL.createObjectURL(blob);
          video.load();
        })
        .catch((err) => fail(why + '; blob retry failed: ' + err.message));
    };

    const attach = () => {
      const src = narrow() && video.dataset.srcMobile ? video.dataset.srcMobile : video.dataset.src;
      // Fall back to the desktop cut if a mobile cut has not been exported
      video.addEventListener('error', () => {
        if (video.dataset.srcMobile && video.getAttribute('src') === video.dataset.srcMobile) {
          video.src = video.dataset.src; video.load();
        } else fail('file missing or unsupported');
      });
      video.addEventListener('loadeddata', probe);
      video.addEventListener('canplay', probe);
      video.addEventListener('loadedmetadata', probe);
      video.preload = 'auto';
      video.src = src;
      video.load();
      // Some browsers only decode a frame after play() has been called once
      video.addEventListener('loadeddata', () => {
        const p = video.play();
        p && p.then ? p.then(() => video.pause()).catch(() => {}) : video.pause();
      }, { once: true });
      setTimeout(() => fail('timed out loading'), 30000);
    };

    // The still is the first impression; spend bandwidth on the film only after the page has loaded
    const begin = () => ('requestIdleCallback' in window ? requestIdleCallback(attach, { timeout: 1500 }) : setTimeout(attach, 300));
    if (document.readyState === 'complete') begin();
    else window.addEventListener('load', begin, { once: true });
  }

  function initScrollReveals() {
    // Headings
    qsa('[data-split]:not([data-split="load"])').forEach((el) => {
      ScrollTrigger.create({ trigger: el, start: 'top 86%', once: true, onEnter: () => revealLines(el) });
    });

    // 3. Image uncropping: clip-path inset opens while the photo settles from 1.15 → 1
    qsa('.reveal-img').forEach((fig) => {
      const img = qs('img', fig);
      const tl = gsap.timeline({ scrollTrigger: { trigger: fig, start: 'top 82%', once: true } });
      tl.fromTo(fig, { clipPath: 'inset(14% 10% 14% 10%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.8, ease: 'power3.out' }, 0)
        .fromTo(img, { scale: 1.15 }, { scale: 1, duration: 2.2, ease: 'power3.out' }, 0);
    });

    // Copy blocks fade-rise in small batches
    ScrollTrigger.batch('[data-fade]', {
      start: 'top 88%',
      once: true,
      onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.3, ease: EASE, stagger: 0.09 }),
    });
  }

  /* ------------------------------------------------------------------------
     4. Animated metric counters (0 → target, Indian digit grouping)
     ------------------------------------------------------------------------ */
  function initCounters() {
    const fmt = new Intl.NumberFormat('en-IN');
    qsa('[data-count]').forEach((el) => {
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const state = { v: 0 };
      el.textContent = '0' + suffix;
      ScrollTrigger.create({
        trigger: el, start: 'top 90%', once: true,
        onEnter: () => gsap.to(state, {
          v: target, duration: 2.4, ease: 'power3.out',
          onUpdate: () => { el.textContent = fmt.format(Math.round(state.v)) + suffix; },
        }),
      });
    });
  }

  /* ------------------------------------------------------------------------
     5. Infinite marquee — one GSAP loop over a duplicated group (-50% = seamless).
     Scroll velocity from Lenis briefly accelerates it, then it eases back.
     ------------------------------------------------------------------------ */
  function initMarquee() {
    const track = qs('[data-marquee]');
    if (!track) return;
    const loop = gsap.to(track, { xPercent: -50, duration: 42, ease: 'none', repeat: -1 });
    if (lenis) {
      lenis.on('scroll', ({ velocity }) => {
        const boost = 1 + Math.min(Math.abs(velocity) * 0.12, 5);
        gsap.to(loop, { timeScale: boost, duration: 0.25, overwrite: true, onComplete: () => gsap.to(loop, { timeScale: 1, duration: 1.2, ease: 'power2.out' }) });
      });
    }
  }

  /* ------------------------------------------------------------------------
     Residences tabs (ARIA tabs + arrow keys). Panels share one grid cell,
     so switching never changes page height.
     ------------------------------------------------------------------------ */
  function initTabs() {
    const tabs = qsa('[data-tab]');
    const panels = qsa('[data-panel]');
    const ink = qs('[data-tab-ink]');
    let current = 0;

    const moveInk = (tab) => {
      ink.style.width = tab.offsetWidth + 'px';
      ink.style.transform = `translateX(${tab.offsetLeft}px)`;
    };

    const select = (i, focus = false) => {
      if (i === current) return;
      const prev = panels[current];
      const next = panels[i];
      tabs.forEach((t, n) => {
        const on = n === i;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on);
        t.tabIndex = on ? 0 : -1;
      });
      if (focus) tabs[i].focus();
      moveInk(tabs[i]);
      current = i;

      if (!hasGSAP || reduceMotion) { prev.hidden = true; next.hidden = false; return; }

      gsap.killTweensOf([prev, next]);
      gsap.to(prev, { opacity: 0, duration: 0.35, ease: 'power2.out', onComplete: () => { prev.hidden = true; gsap.set(prev, { opacity: 1 }); } });
      next.hidden = false;
      const media = qs('.panel__media', next);
      const img = qs('img', next);
      const items = qsa('.panel__kicker, .panel__title, .panel__body > p, .spec-table > div, .panel__cta', next);
      gsap.timeline({ delay: 0.2 })
        .fromTo(next, { opacity: 0 }, { opacity: 1, duration: 0.01 })
        .fromTo(media, { clipPath: 'inset(0% 0% 0% 100%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'power3.out' }, 0)
        .fromTo(img, { scale: 1.15 }, { scale: 1, duration: 1.6, ease: 'power3.out' }, 0)
        .fromTo(items, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 1, ease: EASE, stagger: 0.05 }, 0.15);
    };

    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i));
      t.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); select((current + 1) % tabs.length, true); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); select((current - 1 + tabs.length) % tabs.length, true); }
      });
    });

    const sync = () => moveInk(tabs[current]);
    window.addEventListener('resize', sync);
    document.fonts && document.fonts.ready.then(sync);
    sync();
  }

  /* ------------------------------------------------------------------------
     6. Spotlight masterplan
     The plan is generated once as SVG, then cloned into a dimmed base layer and
     a full-colour "lit" layer. The lit layer is masked by a radial-gradient
     centred on CSS vars --x / --y, which follow the cursor (or finger) with
     inertia via gsap.quickTo. When idle, the lantern drifts on its own.
     ------------------------------------------------------------------------ */
  function buildMasterplanSVG() {
    const W = 1200, H = 700, cx = 600, cy = 350;
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

    const landmarks = [
      [600, 329, 120], // clubhouse
      [336, 462, 120], // lake
      [864, 196, 120], // park
      [96, 350, 70],   // entrance
      [1008, 518, 110], // orchard
    ];
    const nearLandmark = (x, y, pad = 0) => landmarks.some(([lx, ly, r]) => Math.hypot(x - lx, y - ly) < r + pad);

    const plots = [];
    const ring = (rx, ry, count, w, h, premiumEvery) => {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const x = cx + Math.cos(a) * rx;
        const y = cy + Math.sin(a) * ry;
        if (nearLandmark(x, y, 10) || x < 150) continue;
        const ang = (Math.atan2(Math.cos(a) * ry, -Math.sin(a) * rx) * 180) / Math.PI;
        const premium = premiumEvery && i % premiumEvery === 0;
        plots.push(`<rect x="${(x - w / 2).toFixed(1)}" y="${(y - h / 2).toFixed(1)}" width="${w}" height="${h}" rx="2" transform="rotate(${ang.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${premium ? '#d6c39f' : '#efe6d2'}" stroke="#0c1610" stroke-width="1.2"/>`);
      }
    };
    ring(470, 290, 64, 30, 40, 5);
    ring(400, 238, 52, 28, 34, 0);
    ring(290, 160, 36, 26, 32, 4);

    const trees = [];
    for (let i = 0; i < 420; i++) {
      const x = 40 + rand() * (W - 80);
      const y = 30 + rand() * (H - 60);
      const e = ((x - cx) / 560) ** 2 + ((y - cy) / 330) ** 2;
      if (e > 1) continue;
      const onRing = [[470, 290], [400, 238], [290, 160], [345, 200], [435, 264]].some(([rx, ry]) => Math.abs(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 - 1) < 0.09);
      if (onRing || nearLandmark(x, y, -20)) continue;
      const r = 3 + rand() * 6;
      const g = ['#3f7a4f', '#4f8c5c', '#2f6340', '#6aa070'][Math.floor(rand() * 4)];
      trees.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${g}" opacity="${(0.7 + rand() * 0.3).toFixed(2)}"/>`);
    }

    const orchard = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) {
      orchard.push(`<circle cx="${955 + c * 21}" cy="${478 + r * 20}" r="6.5" fill="#6aa070"/>`);
    }

    return `
<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Illustrative masterplan of Nishok Greens showing the club house, swimming pool, temple and green enclave, entry gate and yoga deck, with sixty plots arranged around internal roads">
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#b59a6d" stroke-opacity="0.12" stroke-width="1"/></pattern>
    <radialGradient id="lake" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#6fa3a8"/><stop offset="1" stop-color="#2d5f66"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  <ellipse cx="${cx}" cy="${cy}" rx="560" ry="330" fill="#1f3b28" stroke="#b59a6d" stroke-width="2" stroke-dasharray="2 8"/>
  <ellipse cx="${cx}" cy="${cy}" rx="540" ry="312" fill="#24452f"/>
  <!-- roads -->
  <g fill="none" stroke="#cdbf9f" stroke-linecap="round">
    <ellipse cx="${cx}" cy="${cy}" rx="435" ry="264" stroke-width="14"/>
    <ellipse cx="${cx}" cy="${cy}" rx="345" ry="200" stroke-width="10"/>
    <path d="M20 350 H 470" stroke-width="22"/>
    <path d="M600 86 V 150 M600 550 V 614 M165 350 H 255 M945 350 H 1035" stroke-width="10"/>
  </g>
  <path d="M20 350 H 470" stroke="#0c1610" stroke-width="1.5" stroke-dasharray="10 10"/>
  <!-- lake -->
  <path d="M250 470 C 250 410, 330 400, 380 418 C 440 440, 430 500, 380 520 C 320 545, 250 530, 250 470 Z" fill="url(#lake)" stroke="#a9cdd0" stroke-opacity="0.6"/>
  <path d="M275 470 C 300 440, 350 440, 390 465" fill="none" stroke="#cfe6e6" stroke-opacity="0.5"/>
  <!-- central park + amphitheatre -->
  <path d="M780 160 C 800 120, 900 110, 945 150 C 985 190, 950 250, 880 255 C 810 260, 760 210, 780 160 Z" fill="#4f8c5c"/>
  <g fill="none" stroke="#efe6d2" stroke-width="2"><path d="M840 214 a 30 30 0 0 1 60 0"/><path d="M828 214 a 42 42 0 0 1 84 0"/><path d="M816 214 a 54 54 0 0 1 108 0"/></g>
  <!-- clubhouse -->
  <g>
    <circle cx="600" cy="329" r="74" fill="#1a3122" stroke="#b59a6d" stroke-width="1.5"/>
    <rect x="552" y="292" width="96" height="44" rx="4" fill="#efe6d2"/>
    <rect x="566" y="344" width="68" height="24" rx="3" fill="#7fb7c0"/>
    <path d="M552 292 L600 272 L648 292" fill="none" stroke="#b59a6d" stroke-width="2"/>
  </g>
  <!-- entrance plaza -->
  <circle cx="96" cy="350" r="34" fill="#1a3122" stroke="#b59a6d" stroke-width="2"/>
  <circle cx="96" cy="350" r="14" fill="#d6c39f"/>
  <!-- orchard -->
  <rect x="938" y="462" width="140" height="112" rx="10" fill="#2a4d34" stroke="#b59a6d" stroke-opacity="0.5"/>
  ${orchard.join('')}
  ${trees.join('')}
  ${plots.join('')}
  <!-- compass -->
  <g transform="translate(1120 80)" fill="none" stroke="#b59a6d"><circle r="26"/><path d="M0 -20 L6 0 L0 20 L-6 0 Z" fill="#b59a6d" fill-opacity="0.4"/><text y="-32" text-anchor="middle" fill="#b59a6d" stroke="none" font-family="JetBrains Mono, monospace" font-size="12">N</text></g>
</svg>`;
  }

  function initMasterplan() {
    const stage = qs('[data-mp-stage]');
    if (!stage) return;
    const svg = buildMasterplanSVG();
    qs('[data-mp-base]').innerHTML = svg;
    qs('[data-mp-lit]').innerHTML = svg.replace('role="img"', 'aria-hidden="true"').replace(/aria-label="[^"]*"/, '');

    const pos = { x: 0.5, y: 0.5 }; // normalised 0–1
    const write = () => {
      stage.style.setProperty('--x', (pos.x * 100).toFixed(2) + '%');
      stage.style.setProperty('--y', (pos.y * 100).toFixed(2) + '%');
    };
    write();
    if (!hasGSAP) {
      // still interactive without GSAP, just without inertia
      const raw = (cx, cy) => { const r = stage.getBoundingClientRect(); pos.x = (cx - r.left) / r.width; pos.y = (cy - r.top) / r.height; write(); };
      stage.addEventListener('pointermove', (e) => raw(e.clientX, e.clientY));
      stage.addEventListener('touchmove', (e) => raw(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
      return;
    }

    const toX = gsap.quickTo(pos, 'x', { duration: 0.9, ease: 'power3.out', onUpdate: write });
    const toY = gsap.quickTo(pos, 'y', { duration: 0.9, ease: 'power3.out', onUpdate: write });

    let lastInput = 0;
    const follow = (clientX, clientY) => {
      const r = stage.getBoundingClientRect();
      lastInput = performance.now();
      toX(Math.max(0, Math.min(1, (clientX - r.left) / r.width)));
      toY(Math.max(0, Math.min(1, (clientY - r.top) / r.height)));
    };

    // Mouse / pen
    stage.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') follow(e.clientX, e.clientY); });
    // Touch parity: illuminate on tap and drag. Listeners are passive so vertical page scroll is never blocked.
    stage.addEventListener('touchstart', (e) => follow(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    stage.addEventListener('touchmove', (e) => follow(e.touches[0].clientX, e.touches[0].clientY), { passive: true });

    // Idle drift: a slow Lissajous path keeps the lantern alive until the visitor takes over
    let visible = false;
    ScrollTrigger.create({ trigger: stage, start: 'top bottom', end: 'bottom top', onToggle: (s) => (visible = s.isActive) });
    gsap.ticker.add((t) => {
      if (!visible || reduceMotion || performance.now() - lastInput < 2600) return;
      toX(0.5 + Math.sin(t * 0.35) * 0.32);
      toY(0.5 + Math.sin(t * 0.52 + 1) * 0.28);
    });
  }

  /* ------------------------------------------------------------------------
     7. "A Day at Nishok Greens" — pinned for 3 viewport-heights, scrub: 1.
     One timeline unit per transition: next photo cross-fades in (with a slow
     settle from 1.12 → 1), current caption lifts away, next caption rises in.
     ------------------------------------------------------------------------ */
  function initDay() {
    const section = qs('[data-day]');
    if (!section || reduceMotion) return;
    const imgs = qsa('[data-day-img]', section);
    const steps = qsa('[data-day-step]', section);
    const bar = qs('[data-day-bar]', section);
    const n = steps.length - 1;

    // Lazy images inside a pinned stage: load them now so cross-fades never show blanks
    imgs.forEach((img) => (img.loading = 'eager'));
    gsap.set(imgs.slice(1), { opacity: 0, scale: 1.12 });
    gsap.set(steps.slice(1), { autoAlpha: 0, y: 48 });

    const tl = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => '+=' + window.innerHeight * n,
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    tl.to(bar, { scaleX: 1, ease: 'none', duration: n }, 0);
    tl.fromTo(imgs[0], { scale: 1.08 }, { scale: 1, ease: 'none', duration: 1 }, 0);
    for (let i = 1; i <= n; i++) {
      const at = i - 1;
      tl.to(imgs[i], { opacity: 1, duration: 0.6 }, at + 0.2)
        .to(imgs[i], { scale: 1, ease: 'none', duration: 1 }, at + 0.2)
        .to(steps[i - 1], { autoAlpha: 0, y: -48, duration: 0.25 }, at + 0.35)
        .to(steps[i], { autoAlpha: 1, y: 0, duration: 0.3 }, at + 0.5);
    }
  }

  /* ------------------------------------------------------------------------
     Modal (brochure / site visit) + forms
     ------------------------------------------------------------------------ */
  function initModal() {
    const modal = qs('[data-modal]');
    const copy = {
      brochure: { kicker: 'Brochure & Project Details', title: 'Request the brochure', lede: 'Share your details and we’ll send the official brochure and complete preliminary project details on WhatsApp.', submit: 'Send me the brochure' },
      visit: { kicker: 'Schedule a Site Visit', title: 'Book a site visit', lede: 'Choose a date and our sales team will coordinate a convenient time for your visit to Village Garra, Balaghat.', submit: 'Request my visit' },
    };

    qsa('[data-modal-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.modalOpen;
        const c = copy[type] || copy.brochure;
        const config = btn.dataset.config || '';
        qs('[data-modal-kicker]', modal).textContent = config ? `${c.kicker} · ${config}` : c.kicker;
        qs('[data-modal-title]', modal).textContent = c.title;
        qs('[data-modal-lede]', modal).textContent = c.lede;
        qs('[data-modal-submit]', modal).textContent = c.submit;
        qs('[data-modal-config]', modal).value = config;
        const isVisit = type === 'visit';
        qs('[data-visit-only]', modal).hidden = !isVisit;
        qs('#m-date', modal).required = isVisit;
        qs('.modal__form', modal).dataset.formType = isVisit ? 'Site Visit' : 'Brochure Request';
        const status = qs('[data-form-status]', modal);
        status.textContent = '';
        status.classList.remove('is-error');
        lenis && lenis.stop();
        modal.showModal();
      });
    });
    modal.addEventListener('close', () => lenis && lenis.start());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); }); // click on backdrop
  }

  /* ------------------------------------------------------------------------
     Lead capture. Endpoint and provider settings live in assets/js/config.js.
     Each lead carries the form type, page, timestamp and any UTM / ad-click
     parameters from the landing URL, so you can see which campaign it came from.
     ------------------------------------------------------------------------ */
  const ATTRIBUTION_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];

  function captureAttribution() {
    const params = new URLSearchParams(location.search);
    const found = {};
    ATTRIBUTION_KEYS.forEach((k) => params.get(k) && (found[k] = params.get(k)));
    try {
      // First touch wins for the session: keep the campaign that brought them here
      if (Object.keys(found).length && !sessionStorage.getItem('ng_attr')) sessionStorage.setItem('ng_attr', JSON.stringify(found));
      if (!sessionStorage.getItem('ng_ref')) sessionStorage.setItem('ng_ref', document.referrer || 'direct');
    } catch (_) { /* storage blocked: attribution is best-effort */ }
  }

  function readAttribution() {
    try {
      return { ...JSON.parse(sessionStorage.getItem('ng_attr') || '{}'), referrer: sessionStorage.getItem('ng_ref') || document.referrer || 'direct' };
    } catch (_) { return { referrer: document.referrer || 'direct' }; }
  }

  function buildPayload(form) {
    const data = {};
    new FormData(form).forEach((value, key) => {
      const v = value.toString().trim();
      if (v && key !== '_gotcha') data[key] = key === 'consent' ? 'Yes' : v;
    });
    const type = form.dataset.formType || 'Enquiry';
    return {
      form_type: type,
      subject: `Nishok Greens · ${type}${data.name ? ' · ' + data.name : ''}`,
      ...data,
      page: location.origin + location.pathname,
      submitted_at: new Date().toISOString(),
      ...readAttribution(),
    };
  }

  async function sendLead(payload) {
    const cfg = window.NISHOK_FORMS || {};
    if (!cfg.endpoint) {
      console.info('[Nishok Greens] Form endpoint not set (assets/js/config.js), so this lead was not sent:', payload);
      await new Promise((r) => setTimeout(r, 700));
      return;
    }
    if (cfg.accessKey) payload.access_key = cfg.accessKey; // Web3Forms

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs || 15000);
    try {
      if (cfg.mode === 'no-cors') {
        // Google Apps Script can't answer CORS preflights: send a "simple" request.
        // The response is opaque, so a network error is the only failure we can detect.
        await fetch(cfg.endpoint, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, signal: ctrl.signal });
        return;
      }
      const res = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      let body = null;
      try { body = await res.json(); } catch (_) { /* non-JSON reply is fine */ }
      // Some services (e.g. Web3Forms) return 200 with { success: false }
      if (!res.ok || (body && body.success === false)) throw new Error((body && body.message) || `HTTP ${res.status}`);
    } finally {
      clearTimeout(timer);
    }
  }

  function initForms() {
    captureAttribution();
    const today = new Date();
    const iso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    qsa('[data-min-today]').forEach((i) => (i.min = iso));

    qsa('[data-form]').forEach((form) => {
      const status = qs('[data-form-status]', form);
      const submit = qs('button[type="submit"]', form);
      const label = qs('span', submit);
      let busy = false;

      // Mobile numbers: allow spaces, dashes and +91, but require 10 digits
      const phone = qs('input[type="tel"]', form);
      phone && phone.addEventListener('input', () => {
        const digits = phone.value.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
        phone.setCustomValidity(digits.length === 10 ? '' : 'Please enter a 10-digit mobile number.');
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (busy) return;
        status.classList.remove('is-error');
        status.textContent = '';
        phone && phone.dispatchEvent(new Event('input'));
        if (!form.checkValidity()) { form.reportValidity(); return; }

        // Spam trap filled: pretend success, send nothing
        const trap = qs('[name="_gotcha"]', form);
        const payload = buildPayload(form);
        const firstName = (payload.name || '').split(' ')[0];

        busy = true;
        const original = label.textContent;
        label.textContent = 'Sending…';
        submit.setAttribute('aria-busy', 'true');
        submit.disabled = true;

        try {
          if (!(trap && trap.value)) await sendLead(payload);
          status.textContent = payload.form_type === 'Brochure Request'
            ? `Thank you, ${firstName}. The brochure is on its way to you on WhatsApp.`
            : `Thank you, ${firstName}. Our sales team will call you to confirm your visit.`;
          form.reset();
          qsa('[data-min-today]', form).forEach((i) => (i.min = iso));
        } catch (err) {
          console.error('[Nishok Greens] Lead submission failed:', err);
          const fallback = (window.NISHOK_FORMS && window.NISHOK_FORMS.fallbackPhone) || '';
          status.classList.add('is-error');
          status.textContent = `Sorry, we couldn’t send that just now. Please try again${fallback ? `, or call us on ${fallback}` : ''}.`;
        } finally {
          busy = false;
          label.textContent = original;
          submit.removeAttribute('aria-busy');
          submit.disabled = false;
        }
      });
    });
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */
  function boot() {
    initSmoothScroll();
    initDrawer();
    initHeader();
    initTabs();
    initModal();
    initForms();
    initMasterplan();

    if (!hasGSAP) return;
    // The hero film moves only when the visitor scrolls (it never autoplays), so it runs even with
    // "reduce motion" on — e.g. Windows with Animation effects off. The rest of the motion stays off.
    if (reduceMotion) { initHeroFilm({ kill() {} }); return; }
    initHero();
    initScrollReveals();
    initCounters();
    initMarquee();
    initDay();

    // Recalculate trigger positions once fonts & images have settled
    document.fonts && document.fonts.ready.then(() => ScrollTrigger.refresh());
    window.addEventListener('load', () => ScrollTrigger.refresh());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
