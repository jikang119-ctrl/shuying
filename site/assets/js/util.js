// 各章模块共用的小工具。模块写法：export function init(el) { ... }，el 是带 data-module 的那个元素。
export const mqFine = matchMedia('(hover: hover) and (pointer: fine)');
export const mqDesk = matchMedia('(min-width: 60rem)');
export const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');

export const isFine = () => mqFine.matches;
// 「电脑端交互」= 宽屏 + 鼠标。平板横屏用手指，仍走手机交互。
export const isDesktop = () => mqDesk.matches && mqFine.matches;
export const reduced = () => mqReduce.matches;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dpr = (cap = 2) => Math.min(window.devicePixelRatio || 1, cap);

// 元素进出视口时回调 cb(true/false)，返回取消函数
export function onScreen(el, cb, rootMargin = '0px') {
  const io = new IntersectionObserver((es) => es.forEach((e) => cb(e.isIntersecting, e)), { rootMargin });
  io.observe(el);
  return () => io.disconnect();
}

// 只在需要时跑的 rAF 循环：fn(now, dt) 返回 false 就自己停
export function loop(fn) {
  let id = 0, last = 0;
  const tick = (now) => {
    const dt = last ? Math.min(64, now - last) : 16;
    last = now;
    if (fn(now, dt) === false) { id = 0; last = 0; return; }
    id = requestAnimationFrame(tick);
  };
  return {
    start() { if (!id) id = requestAnimationFrame(tick); },
    stop() { if (id) cancelAnimationFrame(id); id = 0; last = 0; },
    get running() { return !!id; },
  };
}

// 图片换成大图：从 srcset 里挑 >= w 的那张
export function bigSrc(imgEl, w = 1600) {
  const set = (imgEl.getAttribute('srcset') || '').split(',').map((s) => s.trim().split(' ')).map(([u, d]) => [u, parseInt(d, 10)]);
  set.sort((a, b) => a[1] - b[1]);
  return (set.find(([, d]) => d >= w) || set[set.length - 1] || [imgEl.currentSrc || imgEl.src])[0];
}
