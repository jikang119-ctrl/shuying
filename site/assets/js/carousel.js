// 四 平常的日子
// 地图：进入视口画一次线。轮播：原生横滑 + scroll-snap；按每张卡离中心的距离算 scale / 旋转 / 透明度
// 电脑端另加：按住拖动、左右按钮、方向键
import { isDesktop, reduced, onScreen, clamp } from './util.js';
import { openFrom } from './filmstrip.js';

export function init(el) {
  const mp = el.querySelector('.mp');
  onScreen(mp, (v) => { if (v) mp.classList.add('is-drawn'); }, '0px 0px -20% 0px');

  const vp = el.querySelector('.cr__viewport');
  const cards = [...el.querySelectorAll('.cr__card')];
  const ins = cards.map((c) => c.querySelector('.cr__in'));
  const imgs = cards.map((c) => c.querySelector('.cr__img'));
  const caps = cards.map((c) => `${c.querySelector('.cr__place').textContent}　${c.querySelector('.cr__cap').textContent}`);
  const now = el.querySelector('.cr__now');
  const prev = el.querySelector('.cr__prev');
  const next = el.querySelector('.cr__next');
  const still = reduced();

  let centers = [], cw = 1, raf = 0, cur = -1;

  const measure = () => {
    const vr = vp.getBoundingClientRect();
    centers = cards.map((c) => { const r = c.getBoundingClientRect(); return r.left - vr.left + vp.scrollLeft + r.width / 2; });
    cw = cards[0].offsetWidth || 1;
    update();
  };

  const update = () => {
    raf = 0;
    const mid = vp.scrollLeft + vp.clientWidth / 2;
    let best = 0, bd = Infinity;
    centers.forEach((c, i) => {
      const d = (c - mid) / cw;
      const a = Math.abs(d);
      if (a < bd) { bd = a; best = i; }
      if (still) return;
      const k = Math.min(a, 1.5);
      ins[i].style.transform = `translate3d(0,${(k * 14).toFixed(1)}px,0) scale(${(1 - Math.min(a, 1) * 0.12).toFixed(4)}) rotate(${clamp(d * 2.4, -3, 3).toFixed(2)}deg)`;
      ins[i].style.opacity = (1 - k * 0.3).toFixed(3);
    });
    if (best !== cur) {
      cur = best;
      cards.forEach((c, i) => c.classList.toggle('is-center', i === best));
      now.textContent = String(best + 1).padStart(2, '0');
      if (prev) prev.disabled = best === 0;
      if (next) next.disabled = best === cards.length - 1;
    }
  };
  const req = () => { if (!raf) raf = requestAnimationFrame(update); };

  const go = (i) => {
    i = clamp(i, 0, cards.length - 1);
    vp.scrollTo({ left: centers[i] - vp.clientWidth / 2, behavior: still ? 'auto' : 'smooth' });
  };

  vp.addEventListener('scroll', req, { passive: true });
  let rq = 0;
  const remeasure = () => { if (!rq) rq = requestAnimationFrame(() => { rq = 0; measure(); }); };
  addEventListener('resize', remeasure, { passive: true });
  onScreen(vp, (v) => { if (v) remeasure(); });
  measure();

  prev?.addEventListener('click', () => go(cur - 1));
  next?.addEventListener('click', () => go(cur + 1));
  vp.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
  });

  // 鼠标按住拖动（触屏走原生横滑，不接管）
  let drag = null, moved = false;
  vp.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !isDesktop()) return;
    drag = { x: e.clientX, left: vp.scrollLeft, id: e.pointerId, v: 0, t: e.timeStamp, lx: e.clientX };
    moved = false;
  });
  addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!moved && Math.abs(dx) > 6) {
      moved = true;
      vp.classList.add('is-drag');
      vp.setPointerCapture?.(drag.id);
    }
    if (!moved) return;
    const dt = Math.max(1, e.timeStamp - drag.t);
    drag.v = (e.clientX - drag.lx) / dt;
    drag.t = e.timeStamp; drag.lx = e.clientX;
    vp.scrollLeft = drag.left - dx;
  });
  const end = () => {
    if (!drag) return;
    const v = drag.v;
    drag = null;
    if (!moved) return;
    vp.classList.remove('is-drag');
    // 甩一下：按速度多走一两张，再吸附到最近那张
    const mid = vp.scrollLeft + vp.clientWidth / 2 - v * 220;
    let best = 0, bd = Infinity;
    centers.forEach((c, i) => { const d = Math.abs(c - mid); if (d < bd) { bd = d; best = i; } });
    go(best);
  };
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);

  vp.addEventListener('click', (e) => {
    if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; return; }
    const b = e.target.closest('.cr__shot');
    if (!b) return;
    const i = +b.dataset.i;
    if (i !== cur) { go(i); return; } // 点侧边的卡：先转到中间
    openFrom(imgs, i, caps);
  }, true);
}
