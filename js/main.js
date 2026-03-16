/* ===========================
   seven8nine — Animation Engine v9 VIVID
   Cursor trail, gradient reveals, smooth scroll, magnetic, tilt, scramble,
   parallax, particles, accordion, drag, counter, theme — ALIVE.
   =========================== */

(function () {
  'use strict';

  /* --- Utilities --- */
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const map = (v, inMin, inMax, outMin, outMax) => outMin + (v - inMin) * (outMax - outMin) / (inMax - inMin);

  /* --- RAF Manager (single loop) --- */
  const Raf = (() => {
    const cbs = new Set();
    const loop = () => { cbs.forEach(fn => fn()); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    return { add(fn) { cbs.add(fn); }, remove(fn) { cbs.delete(fn); } };
  })();

  /* --- Smooth Scroll State --- */
  const scrollState = {
    y: 0,
    targetY: 0,
    velocity: 0,
    direction: 0,
    lastY: 0,
    update() {
      this.targetY = window.scrollY;
      this.velocity = lerp(this.velocity, (this.targetY - this.lastY), 0.1);
      this.y = lerp(this.y, this.targetY, 0.12);
      this.direction = this.targetY > this.lastY ? 1 : this.targetY < this.lastY ? -1 : 0;
      this.lastY = this.targetY;
    }
  };
  Raf.add(() => scrollState.update());

  /* --- Interactive Dot Grid Canvas --- */
  class DotGrid {
    constructor() {
      this.canvas = document.getElementById('heroCanvas');
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      this.dots = [];
      this.mouse = { x: -1000, y: -1000 };
      this.gap = 40;
      this.dotSize = 1;
      this.radius = 180;
      this.lightMode = !document.documentElement.hasAttribute('data-theme') || document.documentElement.getAttribute('data-theme') !== 'dark';
      window.__dotGrid = this;
      this.resize();
      window.addEventListener('resize', () => this.resize());
      document.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - rect.left;
        this.mouse.y = e.clientY - rect.top;
      });
      Raf.add(() => this.render());
    }

    resize() {
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = this.canvas.offsetWidth * dpr;
      this.canvas.height = this.canvas.offsetHeight * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.buildDots();
    }

    buildDots() {
      this.dots = [];
      const w = this.canvas.offsetWidth;
      const h = this.canvas.offsetHeight;
      for (let x = this.gap; x < w; x += this.gap) {
        for (let y = this.gap; y < h; y += this.gap) {
          this.dots.push({ x, y, baseX: x, baseY: y, scale: 1, alpha: 0.08 });
        }
      }
    }

    render() {
      const ctx = this.ctx;
      const w = this.canvas.offsetWidth;
      const h = this.canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      for (const dot of this.dots) {
        const dx = this.mouse.x - dot.baseX;
        const dy = this.mouse.y - dot.baseY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.radius) {
          const force = 1 - dist / this.radius;
          const angle = Math.atan2(dy, dx);
          const push = force * 18;
          dot.x = lerp(dot.x, dot.baseX - Math.cos(angle) * push, 0.12);
          dot.y = lerp(dot.y, dot.baseY - Math.sin(angle) * push, 0.12);
          dot.scale = lerp(dot.scale, 1 + force * 3, 0.12);
          dot.alpha = lerp(dot.alpha, 0.08 + force * 0.72, 0.12);
        } else {
          dot.x = lerp(dot.x, dot.baseX, 0.06);
          dot.y = lerp(dot.y, dot.baseY, 0.06);
          dot.scale = lerp(dot.scale, 1, 0.06);
          dot.alpha = lerp(dot.alpha, 0.08, 0.06);
        }

        ctx.beginPath();
        ctx.arc(dot.x, dot.y, this.dotSize * dot.scale, 0, Math.PI * 2);

        const c = this.lightMode ? '0, 0, 0' : '255, 255, 255';
        ctx.fillStyle = `rgba(${c}, ${dot.alpha})`;
        ctx.fill();
      }
    }
  }

  /* --- Scroll Overlay Darkening --- */
  class ScrollOverlay {
    constructor() {
      this.overlay = document.getElementById('heroOverlay');
      if (!this.overlay) return;
      Raf.add(() => {
        const progress = clamp(scrollState.y / (window.innerHeight * 0.6), 0, 1);
        this.overlay.style.opacity = progress * 0.88;
      });
    }
  }

  /* --- Character Splitter --- */
  class CharSplit {
    constructor() {
      const titles = document.querySelectorAll('.hero__title');
      titles.forEach(title => {
        const lines = title.querySelectorAll('.line__inner');
        lines.forEach(line => {
          const text = line.textContent;
          const dot = line.querySelector('.hero__dot');
          line.textContent = '';

          text.split('').forEach((char, i) => {
            if (char === ' ') {
              const span = document.createElement('span');
              span.className = 'char space';
              span.innerHTML = '&nbsp;';
              line.appendChild(span);
            } else {
              const span = document.createElement('span');
              span.className = 'char';
              span.textContent = char;
              span.style.transitionDelay = `${i * 0.025}s`;
              line.appendChild(span);
            }
          });

          if (dot) line.appendChild(dot);
        });
      });
    }

    static reveal() {
      const chars = document.querySelectorAll('.hero__title .char');
      chars.forEach((char, i) => {
        setTimeout(() => char.classList.add('revealed'), 50 + i * 22);
      });
    }
  }

  /* --- Custom Cursor with Trail --- */
  class Cursor {
    constructor() {
      this.el = document.getElementById('cursor');
      if (!this.el || window.innerWidth < 768) return;
      this.label = document.getElementById('cursorLabel');
      this.x = 0; this.y = 0;
      this.targetX = 0; this.targetY = 0;

      // Create trail dots
      this.trail = [];
      for (let i = 0; i < 5; i++) {
        const dot = document.createElement('div');
        dot.className = 'cursor-trail';
        dot.style.width = `${4 - i * 0.5}px`;
        dot.style.height = `${4 - i * 0.5}px`;
        document.body.appendChild(dot);
        this.trail.push({ el: dot, x: 0, y: 0 });
      }

      this.isMoving = false;
      this.moveTimeout = null;

      document.addEventListener('mousemove', (e) => {
        this.targetX = e.clientX;
        this.targetY = e.clientY;
        this.isMoving = true;
        this.trail.forEach(t => t.el.style.opacity = '0.4');
        clearTimeout(this.moveTimeout);
        this.moveTimeout = setTimeout(() => {
          this.isMoving = false;
          this.trail.forEach(t => t.el.style.opacity = '0');
        }, 150);
      });

      document.querySelectorAll('a, button, [data-cursor]').forEach(el => {
        el.addEventListener('mouseenter', () => {
          this.el.classList.add('hover');
          const label = el.getAttribute('data-cursor');
          if (label && this.label) this.label.textContent = label;
        });
        el.addEventListener('mouseleave', () => {
          this.el.classList.remove('hover');
          if (this.label) this.label.textContent = '';
        });
      });

      Raf.add(() => this.render());
    }

    render() {
      this.x = lerp(this.x, this.targetX, 0.1);
      this.y = lerp(this.y, this.targetY, 0.1);
      if (this.el) this.el.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;

      // Update trail
      let prevX = this.x;
      let prevY = this.y;
      for (let i = 0; i < this.trail.length; i++) {
        const t = this.trail[i];
        t.x = lerp(t.x, prevX, 0.2 - i * 0.025);
        t.y = lerp(t.y, prevY, 0.2 - i * 0.025);
        t.el.style.transform = `translate3d(${t.x}px, ${t.y}px, 0)`;
        prevX = t.x;
        prevY = t.y;
      }
    }
  }

  /* --- Magnetic Elements --- */
  class Magnetic {
    constructor() {
      if (window.innerWidth < 768) return;
      document.querySelectorAll('[data-magnetic]').forEach(el => {
        el.addEventListener('mousemove', (e) => {
          const rect = el.getBoundingClientRect();
          const x = e.clientX - rect.left - rect.width / 2;
          const y = e.clientY - rect.top - rect.height / 2;
          el.style.transform = `translate(${x * 0.25}px, ${y * 0.25}px)`;
        });
        el.addEventListener('mouseleave', () => {
          el.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
          el.style.transform = 'translate(0, 0)';
          setTimeout(() => { el.style.transition = ''; }, 600);
        });
      });
    }
  }

  /* --- Scroll Reveal --- */
  class ScrollReveal {
    constructor() {
      this.observed = new Set();

      const fadeObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !this.observed.has(entry.target)) {
            this.observed.add(entry.target);
            entry.target.classList.add('revealed');
          }
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

      document.querySelectorAll('[data-reveal-fade]').forEach(el => fadeObserver.observe(el));

      // Line reveals
      const headings = new Set();
      document.querySelectorAll('[data-reveal]').forEach(el => {
        const heading = el.closest('h1, h2, .contact__title, .section-title, .page-hero__title');
        if (heading) headings.add(heading);
        else fadeObserver.observe(el);
      });

      const headingObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !this.observed.has(entry.target)) {
            this.observed.add(entry.target);
            entry.target.querySelectorAll('[data-reveal]').forEach((child, i) => {
              setTimeout(() => child.classList.add('revealed'), i * 120);
            });
          }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -30px 0px' });

      headings.forEach(h => headingObserver.observe(h));

      // Visual dividers
      document.querySelectorAll('.visual-divider').forEach(el => fadeObserver.observe(el));
    }
  }

  /* --- Counter Animation --- */
  class Counter {
    constructor() {
      const animated = new Set();
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !animated.has(entry.target)) {
            animated.add(entry.target);
            const el = entry.target;
            const target = parseInt(el.dataset.count);
            const start = performance.now();
            const duration = 2000;
            const step = (now) => {
              const p = Math.min((now - start) / duration, 1);
              const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
              el.textContent = Math.round(target * eased);
              if (p < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
          }
        });
      }, { threshold: 0.5 });
      document.querySelectorAll('[data-count]').forEach(el => observer.observe(el));
    }
  }

  /* --- Accordion --- */
  class Accordion {
    constructor() {
      this.accords = document.querySelectorAll('[data-accord]');
      this.accords.forEach(accord => {
        const trigger = accord.querySelector('[data-accord-trigger]');
        if (!trigger) return;
        trigger.addEventListener('click', () => {
          const isActive = accord.classList.contains('active');
          this.accords.forEach(a => a.classList.remove('active'));
          if (!isActive) accord.classList.add('active');
        });
      });
    }
  }

  /* --- Draggable Testimonials with Momentum --- */
  class DragSlider {
    constructor() {
      this.track = document.querySelector('.testimonials__track');
      if (!this.track) return;
      this.isDragging = false;
      this.startX = 0;
      this.prevX = 0;
      this.velocity = 0;
      this.pos = 0;
      this.targetPos = 0;

      this.track.addEventListener('mousedown', (e) => this.onStart(e.clientX));
      this.track.addEventListener('touchstart', (e) => this.onStart(e.touches[0].clientX), { passive: true });
      document.addEventListener('mousemove', (e) => this.onMove(e.clientX));
      document.addEventListener('touchmove', (e) => this.onMove(e.touches[0].clientX), { passive: true });
      document.addEventListener('mouseup', () => this.onEnd());
      document.addEventListener('touchend', () => this.onEnd());
      Raf.add(() => this.animate());
    }

    onStart(x) {
      this.isDragging = true;
      this.startX = x;
      this.prevX = x;
      this.velocity = 0;
    }

    onMove(x) {
      if (!this.isDragging) return;
      const diff = x - this.prevX;
      this.velocity = diff;
      this.targetPos += diff;
      this.prevX = x;
    }

    onEnd() {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.targetPos += this.velocity * 12;
    }

    animate() {
      const maxScroll = -(this.track.scrollWidth - this.track.parentElement.offsetWidth + 48);
      this.targetPos = clamp(this.targetPos, maxScroll, 0);
      this.pos = lerp(this.pos, this.targetPos, this.isDragging ? 0.4 : 0.08);
      const skew = this.isDragging ? clamp(this.velocity * 0.04, -2, 2) : 0;
      this.track.style.transform = `translateX(${this.pos}px) skewX(${skew}deg)`;
    }
  }

  /* --- Navigation --- */
  class Nav {
    constructor() {
      this.nav = document.getElementById('nav');
      this.burger = document.getElementById('navBurger');
      this.menu = document.getElementById('mobileMenu');
      let lastScroll = 0;
      let navHidden = false;

      Raf.add(() => {
        const y = scrollState.targetY;
        if (this.nav) {
          this.nav.classList.toggle('scrolled', y > 60);
          if (y > lastScroll && y > 200 && !navHidden) {
            this.nav.style.transform = 'translateY(-100%)';
            navHidden = true;
          } else if (y < lastScroll && navHidden) {
            this.nav.style.transform = 'translateY(0)';
            navHidden = false;
          }
          lastScroll = y;
        }
      });

      if (this.burger && this.menu) {
        this.burger.addEventListener('click', () => {
          this.burger.classList.toggle('active');
          this.menu.classList.toggle('active');
          document.body.style.overflow = this.menu.classList.contains('active') ? 'hidden' : '';
        });
        this.menu.querySelectorAll('a').forEach(link => {
          link.addEventListener('click', () => {
            this.burger.classList.remove('active');
            this.menu.classList.remove('active');
            document.body.style.overflow = '';
          });
        });
      }

      // Smooth scroll for hash links only
      document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          const t = document.querySelector(a.getAttribute('href'));
          if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }
  }

  /* --- Marquee with Scroll-Reactive Speed & Skew --- */
  class MarqueeScroll {
    constructor() {
      this.marquees = document.querySelectorAll('.marquee[data-skew]');
      this.tracks = document.querySelectorAll('.marquee__track');
      this.skewTarget = 0;
      this.skew = 0;

      Raf.add(() => {
        const v = scrollState.velocity;
        this.skewTarget = clamp(v * 0.6, -6, 6);
        this.skew = lerp(this.skew, this.skewTarget, 0.06);

        this.marquees.forEach(m => {
          m.style.transform = `skewX(${this.skew}deg)`;
        });

        const speedFactor = clamp(Math.abs(v) * 0.3, 0, 40);
        this.tracks.forEach(t => {
          const base = t.classList.contains('marquee__track--reverse') ? 60 : 50;
          t.style.animationDuration = Math.max(8, base - speedFactor) + 's';
        });
      });
    }
  }

  /* --- Work Card Tilt Effect --- */
  class TiltCards {
    constructor() {
      if (window.innerWidth < 768) return;
      document.querySelectorAll('.work-card').forEach(card => {
        const wrap = card.querySelector('.work-card__img-wrap');
        if (!wrap) return;

        card.addEventListener('mousemove', (e) => {
          const rect = card.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width;
          const y = (e.clientY - rect.top) / rect.height;
          const rotateX = (0.5 - y) * 12;
          const rotateY = (x - 0.5) * 12;
          wrap.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
        });

        card.addEventListener('mouseleave', () => {
          wrap.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
          wrap.style.transform = 'rotateX(0) rotateY(0) scale(1)';
          setTimeout(() => { wrap.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'; }, 600);
        });

        card.addEventListener('mouseenter', () => {
          wrap.style.transition = 'none';
        });
      });
    }
  }

  /* --- Parallax Sections --- */
  class Parallax {
    constructor() {
      this.items = [];

      document.querySelectorAll('[data-parallax]').forEach(el => {
        this.items.push({
          el,
          speed: parseFloat(el.dataset.parallax) || 0.1,
        });
      });

      document.querySelectorAll('.about__left, .about__right, .reel__content').forEach((el, i) => {
        this.items.push({ el, speed: (i % 2 === 0 ? 0.03 : -0.02) });
      });

      Raf.add(() => this.update());
    }

    update() {
      const wh = window.innerHeight;
      for (const item of this.items) {
        const rect = item.el.getBoundingClientRect();
        if (rect.top < wh && rect.bottom > 0) {
          const center = rect.top + rect.height / 2 - wh / 2;
          const y = center * item.speed;
          item.el.style.transform = `translate3d(0, ${y}px, 0)`;
        }
      }
    }
  }

  /* --- Text Scramble Effect --- */
  class TextScramble {
    constructor(el) {
      this.el = el;
      this.chars = '!<>-_\\/[]{}—=+*^?#________';
      this.queue = [];
      this.frame = 0;
      this.resolve = null;
    }

    setText(newText) {
      const oldText = this.el.textContent;
      const length = Math.max(oldText.length, newText.length);
      this.queue = [];
      for (let i = 0; i < length; i++) {
        const from = oldText[i] || '';
        const to = newText[i] || '';
        const start = Math.floor(Math.random() * 30);
        const end = start + Math.floor(Math.random() * 30);
        this.queue.push({ from, to, start, end });
      }
      cancelAnimationFrame(this.frameRequest);
      this.frame = 0;
      return new Promise(resolve => {
        this.resolve = resolve;
        this.doUpdate();
      });
    }

    doUpdate() {
      let output = '';
      let complete = 0;
      for (let i = 0, n = this.queue.length; i < n; i++) {
        let { from, to, start, end, char } = this.queue[i];
        if (this.frame >= end) {
          complete++;
          output += to;
        } else if (this.frame >= start) {
          if (!char || Math.random() < 0.28) {
            char = this.chars[Math.floor(Math.random() * this.chars.length)];
            this.queue[i].char = char;
          }
          output += `<span style="color:var(--accent)">${char}</span>`;
        } else {
          output += from;
        }
      }
      this.el.innerHTML = output;
      if (complete === this.queue.length) {
        if (this.resolve) this.resolve();
      } else {
        this.frameRequest = requestAnimationFrame(() => {
          this.frame++;
          this.doUpdate();
        });
      }
    }
  }

  /* --- Hover Scramble on Nav Links --- */
  class NavScramble {
    constructor() {
      document.querySelectorAll('.nav__link, .contact__social, .mobile-menu__link span').forEach(el => {
        const original = el.textContent;
        const scrambler = new TextScramble(el);
        let isScrambling = false;

        el.addEventListener('mouseenter', () => {
          if (isScrambling) return;
          isScrambling = true;
          scrambler.setText(original).then(() => { isScrambling = false; });
        });
      });
    }
  }

  /* --- Smooth Section Wipe --- */
  class ScrollLines {
    constructor() {
      this.lines = document.querySelectorAll('.process__step-line');
      if (!this.lines.length) return;

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.closest('.process__step').classList.add('revealed');
          }
        });
      }, { threshold: 0.3 });

      this.lines.forEach(l => observer.observe(l));
    }
  }

  /* --- Staggered Work Card Reveals --- */
  class WorkReveal {
    constructor() {
      const cards = document.querySelectorAll('.work-card, .work-featured, .work-item');
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

      cards.forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(60px)';
        card.style.transition = `opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.1}s, transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.1}s`;
        observer.observe(card);
      });
    }
  }

  /* --- Floating Pixel Elements (Ambient 8-bit particles) --- */
  class FloatingPixels {
    constructor() {
      this.container = document.querySelector('.hero');
      if (!this.container) return;

      for (let i = 0; i < 8; i++) {
        const px = document.createElement('div');
        const size = 3 + Math.random() * 5;
        px.style.cssText = `
          position: absolute;
          width: ${size}px;
          height: ${size}px;
          background: var(--text);
          opacity: ${0.02 + Math.random() * 0.04};
          z-index: 1;
          pointer-events: none;
          left: ${10 + Math.random() * 80}%;
          top: ${10 + Math.random() * 80}%;
          animation: floatPixel ${8 + Math.random() * 12}s ease-in-out infinite alternate;
          animation-delay: ${Math.random() * -10}s;
        `;
        this.container.appendChild(px);
      }

      if (!document.getElementById('floatPixelKF')) {
        const style = document.createElement('style');
        style.id = 'floatPixelKF';
        style.textContent = `
          @keyframes floatPixel {
            0% { transform: translate(0, 0) rotate(0deg); }
            33% { transform: translate(20px, -30px) rotate(90deg); }
            66% { transform: translate(-15px, 20px) rotate(180deg); }
            100% { transform: translate(10px, -10px) rotate(270deg); }
          }
        `;
        document.head.appendChild(style);
      }
    }
  }

  /* --- Process Step Reveals --- */
  class ProcessReveal {
    constructor() {
      const steps = document.querySelectorAll('.process__step');
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.2, rootMargin: '0px 0px -50px 0px' });

      steps.forEach((step, i) => {
        step.style.opacity = '0';
        step.style.transform = 'translateY(40px)';
        step.style.transition = `opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.15}s, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.15}s`;
        observer.observe(step);
      });
    }
  }

  /* --- Section Divider Lines that Draw --- */
  class DrawLines {
    constructor() {
      document.querySelectorAll('.services__list, .about__stats, .about__manifesto-item').forEach(el => {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.style.clipPath = 'inset(0 0 0 0)';
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.1 });
        observer.observe(el);
      });
    }
  }

  /* --- Theme Toggle (Day/Night) --- */
  class ThemeToggle {
    constructor() {
      this.btn = document.getElementById('themeToggle');
      if (!this.btn) return;
      this.isDark = false;

      const saved = localStorage.getItem('s8n-theme');
      if (saved === 'dark') this.setDark(false);

      this.btn.addEventListener('click', () => {
        if (this.isDark) this.setLight(true);
        else this.setDark(true);
      });
    }

    setLight(animate) {
      this.isDark = false;
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('s8n-theme', 'light');
      if (window.__dotGrid) window.__dotGrid.lightMode = true;
      if (animate) this.flashTransition();
    }

    setDark(animate) {
      this.isDark = true;
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('s8n-theme', 'dark');
      if (window.__dotGrid) window.__dotGrid.lightMode = false;
      if (animate) this.flashTransition();
    }

    flashTransition() {
      // Brief flash effect on theme change
      const flash = document.createElement('div');
      flash.style.cssText = `
        position: fixed; inset: 0; z-index: 9995;
        background: var(--accent); opacity: 0.08;
        pointer-events: none;
        transition: opacity 0.6s ease;
      `;
      document.body.appendChild(flash);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          flash.style.opacity = '0';
          setTimeout(() => flash.remove(), 600);
        });
      });
    }
  }

  /* --- Rotating Hero Word --- */
  class RotatingWord {
    constructor() {
      this.el = document.getElementById('heroRotating');
      if (!this.el) return;
      this.words = ['work', 'sell', 'last', 'scale', 'ship'];
      this.current = 0;
      this.interval = setInterval(() => this.next(), 3000);
    }

    next() {
      this.current = (this.current + 1) % this.words.length;
      const newWord = this.words[this.current];

      this.el.style.transition = 'transform 0.4s var(--ease), opacity 0.25s';
      this.el.style.transform = 'translateY(-110%)';
      this.el.style.opacity = '0';
      this.el.style.display = 'inline-block';

      setTimeout(() => {
        this.el.textContent = newWord;
        this.el.style.transition = 'none';
        this.el.style.transform = 'translateY(110%)';
        this.el.style.opacity = '0';

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this.el.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s';
            this.el.style.transform = 'translateY(0)';
            this.el.style.opacity = '1';
          });
        });
      }, 350);
    }
  }

  /* --- Live Clock --- */
  class LiveClock {
    constructor() {
      this.el = document.getElementById('heroClock');
      if (!this.el) return;
      this.update();
      setInterval(() => this.update(), 1000);
    }

    update() {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      this.el.textContent = `${h}:${m}:${s}`;
    }
  }

  /* --- Scroll-triggered Section Wipes --- */
  class SectionWipes {
    constructor() {
      document.querySelectorAll('.section-wipe').forEach(wipe => {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('revealed');
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.5 });
        observer.observe(wipe);
      });
    }
  }

  /* --- Scroll-driven Scale on Reel --- */
  class ReelScroll {
    constructor() {
      this.reel = document.querySelector('.reel__inner');
      if (!this.reel) return;

      Raf.add(() => {
        const rect = this.reel.getBoundingClientRect();
        const wh = window.innerHeight;
        if (rect.top < wh && rect.bottom > 0) {
          const progress = clamp(1 - rect.top / wh, 0, 1);
          const scale = 0.92 + progress * 0.08;
          this.reel.style.transform = `scale(${scale})`;
        }
      });
    }
  }

  /* --- Horizontal Text Slide on Scroll --- */
  class HeroTextParallax {
    constructor() {
      this.lines = document.querySelectorAll('.hero__line');
      if (!this.lines.length) return;

      Raf.add(() => {
        const y = scrollState.y;
        this.lines.forEach((line, i) => {
          const direction = i === 1 ? -1 : 1;
          const offset = y * 0.08 * direction;
          line.style.transform = `translateX(${offset}px)`;
        });
      });
    }
  }

  /* --- Scroll Progress Bar --- */
  class ScrollProgress {
    constructor() {
      this.bar = document.createElement('div');
      this.bar.style.cssText = `
        position: fixed; top: 0; left: 0; height: 2px; z-index: 9999;
        background: var(--accent);
        transform-origin: left;
        transform: scaleX(0); pointer-events: none;
        transition: none; width: 100%;
      `;
      document.body.appendChild(this.bar);

      Raf.add(() => {
        const h = document.documentElement.scrollHeight - window.innerHeight;
        const progress = h > 0 ? scrollState.y / h : 0;
        this.bar.style.transform = `scaleX(${clamp(progress, 0, 1)})`;
      });
    }
  }

  /* --- Smooth Scroll Velocity Text Effect --- */
  class VelocityText {
    constructor() {
      this.elements = document.querySelectorAll('.section-title, .about__title, .contact__title, .page-hero__title');
      if (!this.elements.length) return;

      Raf.add(() => {
        const v = Math.abs(scrollState.velocity);
        const skew = clamp(scrollState.velocity * 0.15, -3, 3);
        const scale = 1 + clamp(v * 0.001, 0, 0.02);

        this.elements.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) {
            el.style.transform = `skewY(${skew * 0.3}deg) scaleX(${scale})`;
          }
        });
      });
    }
  }

  /* --- Staggered Card Hover Glow --- */
  class CardGlow {
    constructor() {
      if (window.innerWidth < 768) return;

      document.querySelectorAll('.work-card, .work-featured, .work-item, .testimonial-card, .process__step, .team-card, .value-item').forEach(card => {
        card.addEventListener('mousemove', (e) => {
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          card.style.setProperty('--glow-x', `${x}px`);
          card.style.setProperty('--glow-y', `${y}px`);

          if (!card.querySelector('.card-glow')) {
            const glow = document.createElement('div');
            glow.className = 'card-glow';
            glow.style.cssText = `
              position: absolute; top: 0; left: 0; right: 0; bottom: 0;
              pointer-events: none; z-index: 0;
              background: radial-gradient(300px circle at var(--glow-x) var(--glow-y), rgba(255,255,255,0.03), transparent 60%);
              transition: opacity 0.3s;
            `;
            card.style.position = 'relative';
            card.style.overflow = 'hidden';
            card.insertBefore(glow, card.firstChild);
          }
        });

        card.addEventListener('mouseleave', () => {
          const glow = card.querySelector('.card-glow');
          if (glow) {
            glow.style.opacity = '0';
            setTimeout(() => glow.remove(), 300);
          }
        });
      });
    }
  }

  /* --- Loader --- */
  class Loader {
    constructor(onComplete) {
      this.el = document.getElementById('loader');
      this.counter = document.getElementById('loaderCounter');

      if (!this.el) {
        if (onComplete) onComplete();
        return;
      }

      const duration = 1400;
      const start = performance.now();

      const step = (now) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        if (this.counter) this.counter.textContent = Math.round(100 * eased);

        if (p < 1) {
          requestAnimationFrame(step);
        } else {
          setTimeout(() => {
            if (this.el) this.el.classList.add('done');
            setTimeout(() => {
              if (onComplete) onComplete();
            }, 600);
          }, 150);
        }
      };
      requestAnimationFrame(step);
    }
  }

  /* --- Page Transition --- */
  class PageTransition {
    constructor() {
      // Add smooth page entry animation
      document.body.style.opacity = '0';
      requestAnimationFrame(() => {
        document.body.style.transition = 'opacity 0.4s ease';
        document.body.style.opacity = '1';
      });
    }
  }

  /* --- Filter Buttons (Work page) --- */
  class FilterButtons {
    constructor() {
      const buttons = document.querySelectorAll('[data-filter]');
      const cards = document.querySelectorAll('[data-category]');
      if (!buttons.length || !cards.length) return;

      buttons.forEach(btn => {
        btn.addEventListener('click', () => {
          buttons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          const filter = btn.dataset.filter;
          cards.forEach((card, i) => {
            const show = filter === 'all' || card.dataset.category.includes(filter);
            card.style.transition = `opacity 0.4s ${i * 0.05}s, transform 0.4s ${i * 0.05}s`;
            if (show) {
              card.style.opacity = '1';
              card.style.transform = 'translateY(0)';
              card.style.display = '';
            } else {
              card.style.opacity = '0';
              card.style.transform = 'translateY(20px)';
              setTimeout(() => { card.style.display = 'none'; }, 400 + i * 50);
            }
          });
        });
      });
    }
  }

  /* --- Clip Path Reveal on Scroll --- */
  class ClipReveal {
    constructor() {
      this.els = [];

      document.querySelectorAll('[data-clip]').forEach(el => {
        const type = el.dataset.clip;
        if (type === 'up') el.classList.add('clip-reveal');
        if (type === 'left') el.classList.add('slide-reveal-left');
        if (type === 'right') el.classList.add('slide-reveal-right');
        if (type === 'zoom') el.classList.add('zoom-reveal');
        this.els.push(el);
      });

      // Use RAF scroll check — more reliable than IntersectionObserver for clip-path elements
      Raf.add(() => this.check());
    }

    check() {
      const wh = window.innerHeight;
      for (let i = this.els.length - 1; i >= 0; i--) {
        const el = this.els[i];
        const rect = el.getBoundingClientRect();
        if (rect.top < wh * 0.92 && rect.bottom > 0) {
          const delay = el.dataset.clipDelay || 0;
          if (delay > 0) {
            setTimeout(() => el.classList.add('revealed'), delay * 1000);
          } else {
            el.classList.add('revealed');
          }
          this.els.splice(i, 1);
        }
      }
      if (!this.els.length) Raf.remove(this.check);
    }
  }

  /* --- Section Fold-In on Scroll --- */
  class SectionFold {
    constructor() {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.05 });

      document.querySelectorAll('.section-fold').forEach(el => observer.observe(el));

      // Initial check
      requestAnimationFrame(() => {
        document.querySelectorAll('.section-fold').forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) {
            el.classList.add('revealed');
          }
        });
      });
    }
  }

  /* --- Service Accordion Slide Reveal --- */
  class ServiceReveal {
    constructor() {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.2 });

      document.querySelectorAll('.service-accord').forEach(el => observer.observe(el));
    }
  }

  /* --- Image Parallax on Scroll --- */
  class ImageParallax {
    constructor() {
      this.images = [];
      document.querySelectorAll('.work-card__img img, .work-featured__img img, .work-item__img img, .project-image__inner img').forEach(img => {
        this.images.push(img);
      });

      if (this.images.length) {
        Raf.add(() => this.update());
      }
    }

    update() {
      const wh = window.innerHeight;
      for (const img of this.images) {
        const rect = img.getBoundingClientRect();
        if (rect.top < wh && rect.bottom > 0) {
          const progress = (rect.top + rect.height / 2 - wh / 2) / wh;
          const y = progress * -30;
          img.style.transform = `translateY(${y}px) scale(1.1)`;
        }
      }
    }
  }

  /* --- Smooth Spring Counter --- */
  class SpringCounter {
    constructor() {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target;
            const target = parseInt(el.dataset.count);
            const suffix = el.dataset.suffix || '';
            let current = 0;
            const spring = () => {
              current += (target - current) * 0.06;
              if (Math.abs(target - current) < 0.5) {
                el.textContent = target + suffix;
                return;
              }
              el.textContent = Math.round(current) + suffix;
              requestAnimationFrame(spring);
            };
            requestAnimationFrame(spring);
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.5 });

      document.querySelectorAll('[data-count]').forEach(el => observer.observe(el));
    }
  }

  /* --- Section Scale on Enter --- */
  class SectionScale {
    constructor() {
      this.sections = document.querySelectorAll('.work, .services, .process, .about, .testimonials');
      if (!this.sections.length) return;

      Raf.add(() => this.update());
    }

    update() {
      const wh = window.innerHeight;
      this.sections.forEach(section => {
        const rect = section.getBoundingClientRect();
        if (rect.top < wh && rect.bottom > 0) {
          const progress = clamp((wh - rect.top) / (wh * 0.4), 0, 1);
          const scale = 0.97 + progress * 0.03;
          const opacity = 0.6 + progress * 0.4;
          section.style.transform = `scale(${scale})`;
          section.style.opacity = opacity;
        }
      });
    }
  }

  /* --- Init --- */
  document.addEventListener('DOMContentLoaded', () => {
    // Character split the hero title BEFORE loader finishes
    new CharSplit();

    // Apply saved theme before loader (light is default)
    const savedTheme = localStorage.getItem('s8n-theme');
    if (savedTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

    new PageTransition();

    new Loader(() => {
      new DotGrid();
      new ScrollOverlay();
      new Cursor();
      new Magnetic();
      new ScrollReveal();
      new Counter();
      new Accordion();
      new DragSlider();
      new Nav();
      new MarqueeScroll();
      new TiltCards();
      new Parallax();
      new NavScramble();
      new ScrollLines();
      new WorkReveal();
      new FloatingPixels();
      new ProcessReveal();
      new ScrollProgress();
      new ThemeToggle();
      new RotatingWord();
      new LiveClock();
      new SectionWipes();
      new ReelScroll();
      new HeroTextParallax();
      new VelocityText();
      new CardGlow();
      new FilterButtons();
      new ClipReveal();
      new SectionFold();
      new ServiceReveal();
      new ImageParallax();
      new SectionScale();

      // Reveal hero characters
      CharSplit.reveal();

      // Reveal hero fades
      document.querySelectorAll('.hero [data-reveal-fade]').forEach((el, i) => {
        setTimeout(() => el.classList.add('revealed'), 600 + i * 100);
      });
    });
  });
})();
