// 二 在遇见我之前：手机上原生横滑；电脑上胶片跟着竖向滚动横移
import { isDesktop, reduced, onScreen, clamp } from './util.js';

export async function openFrom(imgs, i, caps) {
  try {
    const lb = await import('./lightbox.js');
    lb.openLightbox(lb.itemsFrom(imgs, caps), i, imgs[i]);
  } catch (err) {
    console.warn('[shuying] lightbox 不可用', err);
  }
}

export function init(el) {
  const film = el.querySelector('.film');
  const track = film.querySelector('.film__track');
  const imgs = [...film.querySelectorAll('.film__img')];
  const caps = [...film.querySelectorAll('.film__cap')].map((c) => c.textContent);

  let active = false, visible = false, raf = 0;
  let top = 0, h = 0, dist = 0;

  const update = () => {
    raf = 0;
    if (!active) return;
    const p = clamp((scrollY + innerHeight - top) / (innerHeight + h), 0, 1);
    track.style.transform = `translate3d(${(-p * dist).toFixed(1)}px,0,0)`;
  };
  const measure = () => {
    active = isDesktop() && !reduced();
    if (!active) { track.style.transform = ''; return; }
    const r = film.getBoundingClientRect();
    top = r.top + scrollY;
    h = r.height;
    dist = Math.max(0, track.offsetWidth - film.clientWidth);
    update();
  };

  addEventListener('scroll', () => { if (active && visible && !raf) raf = requestAnimationFrame(update); }, { passive: true });
  let rq = 0;
  const remeasure = () => { if (!rq) rq = requestAnimationFrame(() => { rq = 0; measure(); }); };
  addEventListener('resize', remeasure, { passive: true });
  new ResizeObserver(remeasure).observe(document.body);
  onScreen(film, (v) => { visible = v; if (v) remeasure(); });
  measure();

  film.addEventListener('click', (e) => {
    const b = e.target.closest('.film__shot');
    if (b) openFrom(imgs, +b.dataset.i, caps);
  });
}
