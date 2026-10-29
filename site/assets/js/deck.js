// 五 一起吃饭：一叠卡片。拖顶上那张，按位移旋转；拖得够远或甩得够快就飞走、压到最底，循环。
import { reduced, clamp, lerp } from './util.js';

const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
const EASE_IN = 'cubic-bezier(0.7, 0, 0.84, 0)';
// 第 k 张在堆里的姿态：[x, y, 旋转, 缩放, 透明度]
const POSE = [
  [0, 0, 0, 1, 1],
  [0, 14, -2.6, 0.95, 1],
  [0, 26, 2.2, 0.9, 1],
  [0, 34, 0, 0.86, 0],
];
const pad = (n) => String(n).padStart(2, '0');

export function init(el) {
  const stack = el.querySelector('.deck__stack');
  const cards = [...stack.querySelectorAll('.deck__card')];
  const n = cards.length;
  const count = el.querySelector('.deck__count');
  const index = [...el.querySelectorAll('[data-go]')];
  let order = cards.map((_, i) => i);
  let busy = false;
  let W = stack.clientWidth || 320;
  addEventListener('resize', () => { W = stack.clientWidth || W; }, { passive: true });

  cards.forEach((c) => c.querySelector('img')?.addEventListener('dragstart', (e) => e.preventDefault()));

  const pose = (k, p = 0) => {
    const a = POSE[Math.min(k, 3)], b = POSE[Math.max(0, Math.min(k - 1, 3))];
    const t = k > 0 ? p : 0;
    const v = a.map((x, i) => lerp(x, b[i], t));
    return { transform: `translate3d(${v[0]}px, ${v[1]}px, 0) rotate(${v[2]}deg) scale(${v[3]})`, opacity: v[4] };
  };

  function place(animate = true) {
    order.forEach((ci, k) => {
      const c = cards[ci];
      const p = pose(k);
      c.style.transition = animate ? '' : 'none';
      c.style.zIndex = String(n - k);
      c.style.transform = p.transform;
      c.style.opacity = String(p.opacity);
      c.classList.toggle('is-top', k === 0);
      c.inert = k !== 0;
      c.setAttribute('aria-hidden', k === 0 ? 'false' : 'true');
    });
    const top = order[0];
    count.textContent = `${pad(top + 1)} / ${pad(n)}`;
    index.forEach((b) => b.setAttribute('aria-current', +b.dataset.go === top ? 'true' : 'false'));
  }

  const dur = () => (reduced() ? 150 : 360);

  // 顶上那张飞出去，压到最底
  function fling(dir, from) {
    if (busy) return;
    busy = true;
    const ci = order[0];
    const c = cards[ci];
    const x = dir * (W * 1.25 + 80);
    const end = `translate3d(${x}px, ${from ? from.y * 1.6 : 24}px, 0) rotate(${dir * 20}deg) scale(1)`;
    c.style.transition = 'none';
    c.style.zIndex = String(n + 1);
    const a = c.animate(
      [{ transform: from ? from.transform : c.style.transform, opacity: 1 }, { transform: end, opacity: 0 }],
      { duration: dur(), easing: EASE_IN, fill: 'forwards' },
    );
    order.push(order.shift());
    order.forEach((cj, k) => {
      if (cj === ci) return;
      const p = pose(k);
      const o = cards[cj];
      o.style.transition = '';
      o.style.zIndex = String(n - k);
      o.style.transform = p.transform;
      o.style.opacity = String(p.opacity);
    });
    a.finished.then(() => {
      a.cancel();
      place(false);
      // 下一帧恢复过渡，免得最底那张从飞出位置滑回来
      requestAnimationFrame(() => { cards.forEach((o) => (o.style.transition = '')); busy = false; });
    });
    updateMeta();
  }

  // 上一张：从最底抽回来，从左边飞进顶上
  function back() {
    if (busy) return;
    busy = true;
    const ci = order.pop();
    order.unshift(ci);
    const c = cards[ci];
    c.style.transition = 'none';
    c.style.zIndex = String(n + 1);
    const start = `translate3d(${-(W * 1.25 + 80)}px, 24px, 0) rotate(-20deg) scale(1)`;
    const a = c.animate([{ transform: start, opacity: 0 }, { transform: pose(0).transform, opacity: 1 }], { duration: dur() + 60, easing: EASE_OUT });
    place(true);
    c.style.transition = 'none';
    a.finished.then(() => { c.style.transition = ''; busy = false; });
  }

  function jump(i) {
    if (busy || order[0] === i) return;
    const k = order.indexOf(i);
    order = order.slice(k).concat(order.slice(0, k));
    place(true);
  }

  function updateMeta() {
    const top = order[0];
    count.textContent = `${pad(top + 1)} / ${pad(n)}`;
    index.forEach((b) => b.setAttribute('aria-current', +b.dataset.go === top ? 'true' : 'false'));
  }

  // ---- 拖动 ----
  let id = null, x0 = 0, y0 = 0, dx = 0, dy = 0, lastX = 0, lastT = 0, vx = 0, raf = 0, axis = '';
  const paint = () => {
    raf = 0;
    const c = cards[order[0]];
    const tf = `translate3d(${dx}px, ${dy * 0.25}px, 0) rotate(${dx * 0.05}deg)`;
    c.style.transform = tf;
    const p = clamp(Math.abs(dx) / (W * 0.55), 0, 1);
    order.slice(1, 4).forEach((cj, j) => {
      const o = cards[cj];
      const q = pose(j + 1, p);
      o.style.transform = q.transform;
      o.style.opacity = String(q.opacity);
    });
  };
  stack.addEventListener('pointerdown', (e) => {
    if (busy || id !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const top = cards[order[0]];
    if (!top.contains(e.target)) return;
    id = e.pointerId; x0 = lastX = e.clientX; y0 = e.clientY; lastT = performance.now(); dx = dy = vx = 0; axis = '';
    cards.forEach((o) => (o.style.transition = 'none'));
    stack.classList.add('is-dragging');
  });
  stack.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const ddx = e.clientX - x0, ddy = e.clientY - y0;
    if (!axis && Math.hypot(ddx, ddy) > 6) {
      axis = Math.abs(ddx) >= Math.abs(ddy) ? 'x' : 'y';
      if (axis === 'x') stack.setPointerCapture(id);
    }
    if (axis !== 'x') return;
    const now = performance.now();
    vx = lerp(vx, (e.clientX - lastX) / Math.max(1, now - lastT), 0.5);
    lastX = e.clientX; lastT = now;
    dx = ddx; dy = ddy;
    if (!raf) raf = requestAnimationFrame(paint);
  }, { passive: true });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    stack.classList.remove('is-dragging');
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (axis === 'x' && (Math.abs(dx) > W * 0.3 || Math.abs(vx) > 0.55)) {
      const c = cards[order[0]];
      fling(Math.sign(dx || vx) || 1, { transform: c.style.transform, y: dy * 0.25 });
    } else {
      cards.forEach((o) => (o.style.transition = ''));
      place(true);
    }
    dx = dy = 0;
  };
  stack.addEventListener('pointerup', end);
  stack.addEventListener('pointercancel', end);

  // ---- 按钮、键盘、目录 ----
  el.querySelectorAll('[data-dir]').forEach((b) => b.addEventListener('click', () => (+b.dataset.dir > 0 ? fling(-1) : back())));
  index.forEach((b) => b.addEventListener('click', () => jump(+b.dataset.go)));
  stack.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); fling(-1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
  });

  place(false);
  requestAnimationFrame(() => { el.classList.add('is-ready'); cards.forEach((o) => (o.style.transition = '')); });
}
