import { onScreen } from './util.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
// 按需加载的模块也带上 main.js 的版本号（/assets/ 缓存 30 天，不带号手机上会一直用旧的）
const ver = new URL(import.meta.url).search;

// ---- 进门放一首她的歌：右下角小唱片 ----
import(`./bgm.js${ver}`).then((m) => m.init()).catch((err) => console.warn('[shuying] 背景音乐加载失败', err));

// ---- 各章模块：快进入视口时才加载 ----
const loaded = new WeakSet();
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting || loaded.has(e.target)) continue;
    loaded.add(e.target);
    io.unobserve(e.target);
    const name = e.target.dataset.module;
    import(`./${name}.js${ver}`)
      .then((m) => m.init(e.target))
      .catch((err) => console.warn(`[shuying] 模块 ${name} 加载失败`, err));
  }
}, { rootMargin: '120% 0px' });
$$('[data-module]').forEach((el) => io.observe(el));

// ---- 逐行显出的文字 ----
const rv = new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add('is-in'); rv.unobserve(e.target); }
}), { rootMargin: '0px 0px -12% 0px' });
$$('.rv').forEach((el) => rv.observe(el));

// ---- 书签条 + 右侧目录：当前章节、夜间章节反色、阅读进度 ----
const mark = $('.bookmark');
const markCh = $('.bookmark__ch');
const toc = $('.toc');
const cover = $('#cover');
const chapters = $$('[data-chapter]');
let current = null;

const chIo = new IntersectionObserver((es) => {
  for (const e of es) {
    if (!e.isIntersecting) continue;
    current = e.target;
    markCh.textContent = current.dataset.chapter;
    const night = current.hasAttribute('data-night');
    mark.classList.toggle('is-night', night);
    toc?.classList.toggle('is-night', night);
    toc?.classList.toggle('is-dim', current.id === 'you');
    $$('a[data-toc]', toc).forEach((a) => a.setAttribute('aria-current', a.dataset.toc === current.id ? 'true' : 'false'));
  }
}, { rootMargin: '-48% 0px -50% 0px' });
chapters.forEach((c) => chIo.observe(c));

onScreen(cover, (vis) => {
  mark.classList.toggle('is-on', !vis);
  toc?.classList.toggle('is-on', !vis);
});

let ticking = false;
addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const max = document.documentElement.scrollHeight - innerHeight;
    mark.style.setProperty('--p', max > 0 ? (scrollY / max).toFixed(4) : 0);
    ticking = false;
  });
}, { passive: true });

// ---- 一 遇见：电脑端左侧大日期跟着换 ----
const big = $('.tl__big-date');
if (big) {
  const items = $$('.tl__item');
  const tIo = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    items.forEach((it) => it.classList.toggle('is-current', it === e.target));
    if (big.textContent !== e.target.dataset.date) {
      big.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
      big.textContent = e.target.dataset.date;
    }
  }), { rootMargin: '-40% 0px -55% 0px' });
  items.forEach((it) => tIo.observe(it));
}
