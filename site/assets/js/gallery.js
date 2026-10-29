// 六 你
// 手机：按宽高比把照片分进两列，哪列短放哪列，顺序不乱。
// 电脑：100svh 的窗口里一块约 2.3 倍大的平面，三层景深；按住拖动带惯性，不拖时随鼠标轻微视差。
import { isDesktop, mqDesk, mqFine, onScreen, loop, clamp, lerp, reduced } from './util.js';
import { openLightbox, itemsFrom } from './lightbox.js';

export function init(el) {
  const box = el.querySelector('.gal');
  const tiles = [...box.querySelectorAll('.gal__tile')];
  const imgs = tiles.map((t) => t.querySelector('img'));
  const items = itemsFrom(imgs);
  let mode = '', wall = null;

  tiles.forEach((t, i) => {
    t.addEventListener('click', (e) => {
      if (wall && wall.wasDrag()) { e.preventDefault(); return; }
      openLightbox(items, i, imgs[i]);
    });
  });
  imgs.forEach((im) => im.addEventListener('dragstart', (e) => e.preventDefault()));

  const apply = () => {
    const m = isDesktop() ? 'wall' : 'cols';
    if (m === mode) { wall?.layout(); return; }
    wall?.destroy(); wall = null;
    mode = m;
    if (m === 'wall') wall = makeWall(box, tiles);
    else makeCols(box, tiles);
  };
  apply();
  mqDesk.addEventListener('change', apply);
  mqFine.addEventListener('change', apply);
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(apply, 160); }, { passive: true });
}

const ratio = (t) => parseFloat(t.style.getPropertyValue('--ar')) || 1.33;

function makeCols(box, tiles) {
  box.className = 'gal gal--cols';
  box.removeAttribute('style');
  const cols = [document.createElement('div'), document.createElement('div')];
  cols.forEach((c) => (c.className = 'gal__col'));
  const h = [0, 0];
  tiles.forEach((t) => {
    t.removeAttribute('data-layer');
    t.style.width = t.style.height = t.style.transform = '';
    const c = h[0] <= h[1] ? 0 : 1;
    cols[c].append(t);
    h[c] += ratio(t) + 0.06;
  });
  box.replaceChildren(...cols);
}

// 景深层：0 远、1 中、2 近。远的小、拖动时慢；近的大、拖动时快
const LAYERS = [1, 0, 2, 1, 2, 0, 1, 2, 0, 1, 0, 2];
const SIZE = [0.56, 0.7, 0.84];
const DRAG_K = [0.88, 1, 1.12];
const HOVER_D = [10, 20, 34];

function makeWall(box, tiles) {
  box.className = 'gal gal--wall';
  const layers = [0, 1, 2].map((d) => {
    const l = document.createElement('div');
    l.className = 'wall__layer';
    l.dataset.d = d;
    return l;
  });
  box.replaceChildren(...layers);

  let W = 0, H = 0, PW = 0, PH = 0;
  let minX = 0, minY = 0, cx0 = 0, cy0 = 0;
  const cam = { x: 0, y: 0 }, vel = { x: 0, y: 0 };
  const par = { x: 0, y: 0 }, parT = { x: 0, y: 0 };
  let target = null;
  let dragging = false, moved = false, lastDragEnd = 0;
  let px = 0, py = 0, pt = 0, sx = 0, sy = 0;
  const still = reduced();

  // 先按「哪列短放哪列」排一遍，挑一个让平面高度最接近 2.1 屏的列数
  function place(cols) {
    const colW = PW / cols, gap = H * 0.09;
    const colH = new Array(cols).fill(0);
    const pos = tiles.map((t, i) => {
      const d = LAYERS[i % LAYERS.length];
      const w = colW * SIZE[d];
      const h = w * ratio(t);
      let c = 0;
      for (let k = 1; k < cols; k++) if (colH[k] < colH[c]) c = k;
      const jitter = ((((i * 53) % 21) - 10) / 10) * colW * 0.1;
      const p = { x: c * colW + (colW - w) / 2 + jitter, y: colH[c], w, h, d, c };
      colH[c] += h + gap;
      return p;
    });
    return { pos, colH: colH.map((v) => v - gap), tall: Math.max(...colH) - gap };
  }

  function layout() {
    W = box.clientWidth; H = box.clientHeight;
    PW = Math.round(W * 2.3);
    let best = null;
    for (let cols = 4; cols <= 10; cols++) {
      const r = place(cols);
      const score = Math.abs(r.tall - H * 1.9) + (r.colH.some((v) => v <= 0) ? 1e6 : 0);
      if (!best || score < best.score) best = { ...r, score };
    }
    const pad = H * 0.14;
    PH = Math.round(best.tall + pad * 2);
    // 每一列在平面里竖直居中，再错开一点，空白分在上下两头而不是全堆在底部
    const shift = best.colH.map((v, c) => (best.tall - v) / 2 + pad + (((c * 2) % 3) - 1) * H * 0.06);
    tiles.forEach((t, i) => {
      const p = best.pos[i];
      p.y = clamp(p.y + shift[p.c], H * 0.04, PH - p.h - H * 0.04);
      const { x, y, w, h, d } = p;
      t.dataset.layer = d;
      t.style.width = w + 'px';
      t.style.height = h + 'px';
      t.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      t._pos = { x, y, w, h, d };
      if (t.parentNode !== layers[d]) layers[d].append(t);
    });
    layers.forEach((l) => { l.style.width = PW + 'px'; l.style.height = PH + 'px'; });
    minX = Math.min(0, W - PW); minY = Math.min(0, H - PH);
    cx0 = minX / 2; cy0 = minY / 2;
    cam.x = cx0; cam.y = cy0; vel.x = vel.y = 0; target = null;
    paint();
  }

  function paint() {
    layers.forEach((l, d) => {
      const x = cx0 + (cam.x - cx0) * DRAG_K[d] + par.x * HOVER_D[d];
      const y = cy0 + (cam.y - cy0) * DRAG_K[d] + par.y * HOVER_D[d];
      l.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    });
  }

  const over = (v, lo, hi) => (v > hi ? v - hi : v < lo ? v - lo : 0);

  const anim = loop((now, dt) => {
    const f = dt / 16.67;
    if (target) {
      cam.x = lerp(cam.x, target.x, 1 - Math.pow(0.86, f));
      cam.y = lerp(cam.y, target.y, 1 - Math.pow(0.86, f));
      if (Math.abs(cam.x - target.x) < 0.5 && Math.abs(cam.y - target.y) < 0.5) { cam.x = target.x; cam.y = target.y; target = null; }
    } else if (!dragging) {
      cam.x += vel.x * dt; cam.y += vel.y * dt;
      const fr = Math.pow(0.93, f);
      vel.x *= fr; vel.y *= fr;
      const ox = over(cam.x, minX, 0), oy = over(cam.y, minY, 0);
      if (ox) { cam.x -= ox * (1 - Math.pow(0.8, f)); vel.x *= 0.5; }
      if (oy) { cam.y -= oy * (1 - Math.pow(0.8, f)); vel.y *= 0.5; }
    }
    if (!still) {
      par.x = lerp(par.x, parT.x, 1 - Math.pow(0.9, f));
      par.y = lerp(par.y, parT.y, 1 - Math.pow(0.9, f));
    }
    paint();
    const settled = !dragging && !target
      && Math.abs(vel.x) < 0.005 && Math.abs(vel.y) < 0.005
      && !over(cam.x, minX, 0) && !over(cam.y, minY, 0)
      && Math.abs(par.x - parT.x) < 0.002 && Math.abs(par.y - parT.y) < 0.002;
    return !settled;
  });

  let visible = false;
  const offScreen = onScreen(box, (v) => { visible = v; if (!v) { anim.stop(); dragging = false; } });
  const kick = () => { if (visible) anim.start(); };

  const onDown = (e) => {
    if (e.button !== 0 || !e.isPrimary) return;
    dragging = true; moved = false; target = null;
    sx = px = e.clientX; sy = py = e.clientY; pt = performance.now();
    vel.x = vel.y = 0;
    box.classList.add('is-grabbing');
    addEventListener('pointermove', onDrag, { passive: true });
    addEventListener('pointerup', onUp, { passive: true });
    addEventListener('pointercancel', onUp, { passive: true });
    kick();
  };
  const onDrag = (e) => {
    const now = performance.now();
    let dx = e.clientX - px, dy = e.clientY - py;
    if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) > 6) moved = true;
    // 出界后像橡皮筋一样拖不动
    if (over(cam.x, minX, 0)) dx *= 0.35;
    if (over(cam.y, minY, 0)) dy *= 0.35;
    cam.x += dx; cam.y += dy;
    const dt = Math.max(1, now - pt);
    vel.x = lerp(vel.x, dx / dt, 0.4); vel.y = lerp(vel.y, dy / dt, 0.4);
    px = e.clientX; py = e.clientY; pt = now;
  };
  const onUp = () => {
    dragging = false;
    box.classList.remove('is-grabbing');
    if (performance.now() - pt > 80) vel.x = vel.y = 0;
    vel.x = clamp(vel.x, -3, 3); vel.y = clamp(vel.y, -3, 3);
    if (moved) lastDragEnd = performance.now();
    removeEventListener('pointermove', onDrag);
    removeEventListener('pointerup', onUp);
    removeEventListener('pointercancel', onUp);
    kick();
  };
  // 鼠标位置驱动视差
  const onHover = (e) => {
    if (still) return;
    const r = box.getBoundingClientRect();
    parT.x = -((e.clientX - r.left) / r.width - 0.5) * 2;
    parT.y = -((e.clientY - r.top) / r.height - 0.5) * 2;
    kick();
  };
  const onLeave = () => { parT.x = 0; parT.y = 0; kick(); };
  // 触控板横向滑动可以平移；竖向滚轮不拦，页面照常滚
  const onWheel = (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    target = null;
    cam.x = clamp(cam.x - e.deltaX, minX - 40, 40);
    kick();
  };
  // 键盘 Tab 到某张照片时，把它挪进窗口中间
  const onFocus = (e) => {
    const t = e.target.closest('.gal__tile');
    if (!t || !t._pos) return;
    const { x, y, w, h, d } = t._pos;
    const k = DRAG_K[d];
    const tx = cx0 + (W / 2 - x - w / 2 - cx0) / k;
    const ty = cy0 + (H / 2 - y - h / 2 - cy0) / k;
    target = { x: clamp(tx, minX, 0), y: clamp(ty, minY, 0) };
    kick();
  };

  box.addEventListener('pointerdown', onDown);
  box.addEventListener('pointermove', onHover, { passive: true });
  box.addEventListener('pointerleave', onLeave, { passive: true });
  box.addEventListener('wheel', onWheel, { passive: false });
  box.addEventListener('focusin', onFocus);

  layout();

  return {
    layout,
    wasDrag: () => performance.now() - lastDragEnd < 60 || (dragging && moved),
    destroy() {
      anim.stop();
      offScreen();
      box.removeEventListener('pointerdown', onDown);
      box.removeEventListener('pointermove', onHover);
      box.removeEventListener('pointerleave', onLeave);
      box.removeEventListener('wheel', onWheel);
      box.removeEventListener('focusin', onFocus);
    },
  };
}
