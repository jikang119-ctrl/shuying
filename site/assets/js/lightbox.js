// 全屏看图。别的模块这样用：
//   import { openLightbox, itemsFrom } from './lightbox.js';
//   const items = itemsFrom(imgEls, caps);   // caps 可省
//   el.addEventListener('click', () => openLightbox(items, i, imgEls[i]));
import { reduced, clamp } from './util.js';

const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
const EASE_IN = 'cubic-bezier(0.7, 0, 0.84, 0)';
const pad = (n) => String(n).padStart(2, '0');

export function itemsFrom(imgEls, caps = []) {
  return imgEls.map((im, i) => ({
    src: bigSrc(im),
    srcset: im.getAttribute('srcset') || '',
    w: +im.getAttribute('width') || im.naturalWidth || 1,
    h: +im.getAttribute('height') || im.naturalHeight || 1,
    cap: caps[i] ?? '',
    alt: im.alt || '',
    lqip: im.style.backgroundImage || '',
    color: im.style.backgroundColor || '',
    el: im,
  }));
}

function bigSrc(im) {
  const set = (im.getAttribute('srcset') || '').split(',').map((s) => s.trim().split(/\s+/)).filter((p) => p[0]);
  set.sort((a, b) => parseInt(a[1], 10) - parseInt(b[1], 10));
  return set.length ? set[set.length - 1][0] : im.currentSrc || im.src;
}

let root, bg, track, capEl, countEl, btnPrev, btnNext, btnClose;
let items = [], idx = 0, opener = null, isOpen = false, closing = false;
let slides = [];

function build() {
  root = document.createElement('div');
  root.className = 'lb night';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', '看照片');
  root.hidden = true;
  root.innerHTML = `<div class="lb__bg"></div>
<div class="lb__track"></div>
<div class="lb__top"><p class="lb__count num"></p><button class="lb__btn lb__close" type="button">关闭</button></div>
<p class="lb__cap"></p>
<button class="lb__btn lb__nav lb__prev" type="button">上一张</button>
<button class="lb__btn lb__nav lb__next" type="button">下一张</button>`;
  document.body.append(root);
  bg = root.querySelector('.lb__bg');
  track = root.querySelector('.lb__track');
  capEl = root.querySelector('.lb__cap');
  countEl = root.querySelector('.lb__count');
  btnPrev = root.querySelector('.lb__prev');
  btnNext = root.querySelector('.lb__next');
  btnClose = root.querySelector('.lb__close');

  btnClose.addEventListener('click', close);
  btnPrev.addEventListener('click', () => go(idx - 1));
  btnNext.addEventListener('click', () => go(idx + 1));
  // 点空白处关闭（点在图上不关）
  track.addEventListener('click', (e) => { if (!e.target.closest('.lb__img')) close(); });

  let raf = 0;
  track.addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const w = track.clientWidth || 1;
      const i = clamp(Math.round(track.scrollLeft / w), 0, items.length - 1);
      if (i !== idx) { idx = i; chrome(); load(); }
    });
  }, { passive: true });

  addEventListener('resize', () => { if (isOpen) { fit(); track.scrollLeft = idx * track.clientWidth; } }, { passive: true });
  document.addEventListener('keydown', onKey);
  swipeDown();
}

// 每张图按「装得下」算好像素宽高，这样 <img> 的框就是图本身，FLIP 才对得上
function fit() {
  const vw = root.clientWidth, vh = root.clientHeight;
  const wide = vw >= 960;
  const padX = wide ? 96 : 0, padTop = wide ? 72 : 56, padBot = wide ? 88 : 96;
  const bw = vw - padX * 2, bh = vh - padTop - padBot;
  slides.forEach((s, i) => {
    const it = items[i];
    const k = Math.min(bw / it.w, bh / it.h);
    s.img.style.width = Math.round(it.w * k) + 'px';
    s.img.style.height = Math.round(it.h * k) + 'px';
    s.el.style.paddingTop = padTop + 'px';
    s.el.style.paddingBottom = padBot + 'px';
  });
}

function render() {
  track.innerHTML = items.map((it) => `<div class="lb__slide"><img class="lb__img" alt="${(it.alt || '').replace(/"/g, '&quot;')}" draggable="false" decoding="async"></div>`).join('');
  slides = [...track.children].map((el) => ({ el, img: el.firstElementChild, loaded: false }));
  slides.forEach((s, i) => {
    if (items[i].lqip) s.img.style.backgroundImage = items[i].lqip;
    if (items[i].color) s.img.style.backgroundColor = items[i].color;
  });
}

// 只载当前和左右各一张
function load() {
  for (let i = idx - 1; i <= idx + 1; i++) {
    const s = slides[i];
    if (!s || s.loaded) continue;
    s.loaded = true;
    const it = items[i];
    if (it.srcset) { s.img.sizes = '100vw'; s.img.srcset = it.srcset; }
    s.img.src = it.src;
  }
}

function chrome() {
  countEl.textContent = `${pad(idx + 1)} / ${pad(items.length)}`;
  capEl.textContent = items[idx]?.cap || '';
  btnPrev.disabled = idx <= 0;
  btnNext.disabled = idx >= items.length - 1;
}

function go(i) {
  i = clamp(i, 0, items.length - 1);
  track.scrollTo({ left: i * track.clientWidth, behavior: reduced() ? 'auto' : 'smooth' });
}

function onKey(e) {
  if (!isOpen) return;
  if (e.key === 'Escape') { e.preventDefault(); close(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
  else if (e.key === 'Tab') {
    const f = [...root.querySelectorAll('button:not([disabled])')].filter((b) => b.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!root.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  }
}

// 原图（可能被 object-fit: cover 裁过）到大图的变换：缩放 + 裁切
function flip(origin, img) {
  const r0 = origin.getBoundingClientRect();
  const r1 = img.getBoundingClientRect();
  if (!r0.width || !r1.width) return null;
  const s = Math.max(r0.width / r1.width, r0.height / r1.height);
  const dx = r0.left + r0.width / 2 - (r1.left + r1.width / 2);
  const dy = r0.top + r0.height / 2 - (r1.top + r1.height / 2);
  const ix = Math.max(0, (r1.width - r0.width / s) / 2);
  const iy = Math.max(0, (r1.height - r0.height / s) / 2);
  return { transform: `translate(${dx}px, ${dy}px) scale(${s})`, clipPath: `inset(${iy}px ${ix}px)` };
}

function visible(el) {
  if (!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
}

function lock(on) {
  const html = document.documentElement;
  if (on) {
    const sb = innerWidth - html.clientWidth;
    html.style.overflow = 'hidden';
    if (sb > 0) html.style.paddingRight = sb + 'px';
  } else {
    html.style.overflow = '';
    html.style.paddingRight = '';
  }
}

export function openLightbox(list, index = 0, originEl = null) {
  if (!list || !list.length || isOpen) return;
  if (!root) build();
  items = list;
  idx = clamp(index, 0, items.length - 1);
  opener = document.activeElement;
  render();
  lock(true);
  root.hidden = false;
  isOpen = true;
  closing = false;
  fit();
  track.style.scrollBehavior = 'auto';
  track.scrollLeft = idx * track.clientWidth;
  track.style.scrollBehavior = '';
  load();
  chrome();
  root.classList.add('is-open');

  const img = slides[idx].img;
  const from = !reduced() && visible(originEl || items[idx].el) ? flip(originEl || items[idx].el, img) : null;
  if (from) {
    img.animate([from, { transform: 'none', clipPath: 'inset(0px 0px)' }], { duration: 460, easing: EASE_OUT });
  } else {
    img.animate([{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: reduced() ? 150 : 320, easing: EASE_OUT });
  }
  bg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduced() ? 150 : 360, easing: EASE_OUT });
  btnClose.focus({ preventScroll: true });
}

function close(fromTransform) {
  if (!isOpen || closing) return;
  closing = true;
  const it = items[idx];
  const img = slides[idx]?.img;
  const target = it?.el;
  const done = () => {
    root.hidden = true;
    root.classList.remove('is-open');
    track.innerHTML = '';
    slides = [];
    lock(false);
    isOpen = false;
    closing = false;
    const back = target && target.closest('button, a, [tabindex]') || opener;
    back?.focus?.({ preventScroll: true });
  };
  const dur = reduced() ? 150 : 380;
  const to = !reduced() && img && visible(target) ? flip(target, img) : null;
  const start = typeof fromTransform === 'string' ? { transform: fromTransform, clipPath: 'inset(0px 0px)' } : { transform: 'none', clipPath: 'inset(0px 0px)' };
  root.classList.remove('is-open');
  const bgFrom = +getComputedStyle(bg).opacity || 1;
  bg.animate([{ opacity: bgFrom }, { opacity: 0 }], { duration: dur, easing: EASE_IN, fill: 'forwards' });
  const a = img
    ? img.animate(to ? [start, to] : [{ ...start, opacity: 1 }, { transform: 'scale(.96)', opacity: 0 }], { duration: dur, easing: to ? EASE_OUT : EASE_IN, fill: 'forwards' })
    : null;
  (a ? a.finished : Promise.resolve()).then(() => {
    bg.getAnimations().forEach((x) => x.cancel());
    done();
  });
}

// 手指往下拖关闭：轨道只放行横向原生滚动，竖向手势交给这里
function swipeDown() {
  let id = null, x0 = 0, y0 = 0, t0 = 0, axis = '', dy = 0;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !isOpen) return;
    id = e.pointerId; x0 = e.clientX; y0 = e.clientY; t0 = performance.now(); axis = ''; dy = 0;
  }, { passive: true });
  track.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - x0;
    dy = e.clientY - y0;
    if (!axis && Math.hypot(dx, dy) > 8) axis = Math.abs(dy) > Math.abs(dx) * 1.2 ? 'y' : 'x';
    if (axis !== 'y') return;
    const img = slides[idx]?.img;
    if (!img) return;
    const k = 1 - Math.min(Math.abs(dy) / 900, 0.18);
    img.style.transform = `translate(0, ${dy}px) scale(${k})`;
    bg.style.opacity = String(1 - Math.min(Math.abs(dy) / 420, 0.85));
  }, { passive: true });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    if (axis !== 'y') return;
    const img = slides[idx]?.img;
    const v = Math.abs(dy) / Math.max(1, performance.now() - t0);
    if (Math.abs(dy) > 110 || v > 0.6) {
      const tf = img?.style.transform || 'none';
      if (img) img.style.transform = '';
      bg.style.opacity = '';
      close(tf);
    } else if (img) {
      const tf = img.style.transform;
      img.style.transform = '';
      img.animate([{ transform: tf }, { transform: 'none' }], { duration: 260, easing: EASE_OUT });
      const o = bg.style.opacity;
      bg.style.opacity = '';
      bg.animate([{ opacity: o || 1 }, { opacity: 1 }], { duration: 260, easing: EASE_OUT });
    }
  };
  track.addEventListener('pointerup', end, { passive: true });
  track.addEventListener('pointercancel', end, { passive: true });
}
