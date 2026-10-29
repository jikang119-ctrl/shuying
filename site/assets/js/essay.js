// 三 高淳的一天
// 电脑端：.es 撑高，.es__pin 钉住，竖向滚动进度 p 推着 .es__rail 横移
// 手机端：.es__track 原生横滑，p = scrollLeft / 最大值
// 两端都用 p 驱动三层底色的 opacity、当前时间标签、进度线
import { isDesktop, reduced, onScreen, clamp } from './util.js';
import { openFrom } from './filmstrip.js';

const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function init(el) {
  const es = el.querySelector('.es');
  const pin = es.querySelector('.es__pin');
  const rail = es.querySelector('.es__rail');
  const track = es.querySelector('.es__track');
  const frames = [...es.querySelectorAll('.es__frame')];
  const [warm, dusk, night] = es.querySelectorAll('.es__sky i');
  const hudTime = es.querySelector('.es__hud-time');
  const hudBar = es.querySelector('.es__hud-bar');
  const imgs = frames.map((f) => f.querySelector('.es__img'));
  const caps = frames.map((f) => f.querySelector('.es__cap').textContent);

  let pinned = false, visible = false, raf = 0;
  let top = 0, dist = 0, centers = [], vw = 0, lastI = -1, lastDark = null;
  const still = reduced();

  const paint = (p, viewCenter) => {
    if (!still) {
      // 中午纸色 → 下午暖黄 → 黄昏暮色 → 入夜。暮色那段收得陡，中间发灰的过渡一闪而过
      warm.style.opacity = smooth(0.04, 0.4, p).toFixed(3);
      const d = smooth(0.52, 0.74, p);
      dusk.style.opacity = d.toFixed(3);
      night.style.opacity = (smooth(0.8, 1, p) * 0.8).toFixed(3);
      const dark = d > 0.55;
      if (dark !== lastDark) { es.classList.toggle('is-dark', dark); lastDark = dark; }
    }
    hudBar.style.setProperty('--p', p.toFixed(4));
    let best = 0, bd = Infinity;
    centers.forEach((c, i) => { const d = Math.abs(c - viewCenter); if (d < bd) { bd = d; best = i; } });
    if (best !== lastI) {
      lastI = best;
      const t = frames[best].dataset.time;
      if (hudTime.textContent !== t) hudTime.textContent = t;
    }
  };

  const update = () => {
    raf = 0;
    if (pinned) {
      const p = dist ? clamp((scrollY - top) / dist, 0, 1) : 0;
      rail.style.transform = `translate3d(${(-p * dist).toFixed(1)}px,0,0)`;
      paint(p, p * dist + vw / 2);
    } else {
      const max = track.scrollWidth - track.clientWidth;
      const p = max > 0 ? clamp(track.scrollLeft / max, 0, 1) : 0;
      paint(p, track.scrollLeft + track.clientWidth / 2);
    }
  };
  const req = () => { if (!raf) raf = requestAnimationFrame(update); };

  const measure = () => {
    pinned = isDesktop() && !still;
    vw = pin.clientWidth;
    if (pinned) {
      rail.style.transform = 'none';
      const rr = rail.getBoundingClientRect();
      centers = frames.map((f) => { const r = f.getBoundingClientRect(); return r.left - rr.left + r.width / 2; });
      dist = Math.max(0, rail.scrollWidth - vw);
      es.style.height = `${Math.round(pin.offsetHeight + dist)}px`;
      top = es.getBoundingClientRect().top + scrollY;
    } else {
      rail.style.transform = '';
      es.style.height = '';
      const tr = track.getBoundingClientRect();
      centers = frames.map((f) => { const r = f.getBoundingClientRect(); return r.left - tr.left + track.scrollLeft + r.width / 2; });
    }
    lastI = -1;
    update();
  };

  addEventListener('scroll', () => { if (pinned && visible) req(); }, { passive: true });
  track.addEventListener('scroll', () => { if (!pinned) req(); }, { passive: true });
  let rq = 0;
  const remeasure = () => { if (!rq) rq = requestAnimationFrame(() => { rq = 0; measure(); }); };
  addEventListener('resize', remeasure, { passive: true });
  new ResizeObserver(remeasure).observe(document.body);
  onScreen(es, (v) => { visible = v; es.classList.toggle('is-live', v); if (v) req(); });
  measure();

  es.addEventListener('click', (e) => {
    const b = e.target.closest('.es__shot');
    if (b) openFrom(imgs, +b.dataset.i, caps);
  });
}
