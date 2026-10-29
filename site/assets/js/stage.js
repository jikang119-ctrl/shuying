// 七 骑士：跟随的光 + 唱片和歌单。
// 光的开销：每帧只改遮光层上的 --x/--y，只有这一层（视口大小、纯色 + 渐变遮罩）重绘，正文不重排不重绘；离开视口循环就停。
import { isFine, reduced, onScreen, loop, lerp } from './util.js';

export function init(el) {
  const light = el.querySelector('.stage__light');
  initTracks(el);

  if (reduced()) { el.classList.add('is-still'); onScreen(el, (v) => el.classList.toggle('is-on', v)); return; }

  const fine = isFine();
  let w = innerWidth, h = innerHeight;
  let x = w * 0.5, y = h * 0.42;          // 现在光在哪
  let tx = x, ty = y;                      // 要去哪
  let holdUntil = 0;                       // 手指按过之后，光在那停一会儿
  let lastWrite = '';

  const setTarget = (cx, cy, now) => {
    const r = light.getBoundingClientRect();
    tx = cx - r.left; ty = cy - r.top;
    holdUntil = now + 2600;
  };

  if (fine) {
    el.addEventListener('pointermove', (e) => setTarget(e.clientX, e.clientY, performance.now()), { passive: true });
  } else {
    const touch = (e) => { const t = e.touches[0]; if (t) setTarget(t.clientX, t.clientY, performance.now()); };
    el.addEventListener('touchstart', touch, { passive: true });
    el.addEventListener('touchmove', touch, { passive: true });
  }
  addEventListener('resize', () => { w = innerWidth; h = innerHeight; }, { passive: true });

  const run = loop((now) => {
    if (!fine && now > holdUntil) {
      // 手机上没人碰的时候：慢慢走一条利萨如曲线
      tx = w * (0.5 + 0.34 * Math.sin(now * 0.00027));
      ty = h * (0.46 + 0.3 * Math.sin(now * 0.00019 + 1.1));
    }
    const k = fine ? 0.14 : 0.045;
    x = lerp(x, tx, k); y = lerp(y, ty, k);
    const v = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    if (v !== lastWrite) {
      light.style.setProperty('--x', `${x.toFixed(1)}px`);
      light.style.setProperty('--y', `${y.toFixed(1)}px`);
      lastWrite = v;
    }
  });

  onScreen(el, (v) => {
    el.classList.toggle('is-on', v);
    v ? run.start() : run.stop();
  });
}

function initTracks(el) {
  const arm = el.querySelector('.vinyl__arm');
  const btns = [...el.querySelectorAll('.track')];
  const n = btns.length;
  // 唱臂角度：最外一圈 17°，最里一圈 31°；没选歌时停在唱片外面
  const angle = (i) => 17 + (14 * i) / Math.max(1, n - 1);
  // 唱片柜的曲库：章节一进视口就先取好，点歌时同步拿到文件名（iOS 要求 play() 在点击里直接调）
  let lib = new Map();
  fetch('assets/data/music.json').then((r) => r.json()).then((d) => {
    for (const a of d.albums) for (const t of a.tracks) if (t.f && !lib.has(t.t)) lib.set(t.t, t.f);
  }).catch(() => {});
  let audio = null;
  btns.forEach((b, i) => b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    btns.forEach((o) => { o.setAttribute('aria-pressed', o === b && on ? 'true' : 'false'); o.classList.remove('is-loud'); });
    arm.style.setProperty('--arm', on ? `${angle(i).toFixed(1)}deg` : '2deg');
    const f = lib.get(b.dataset.title);
    if (!on) { audio?.pause(); return; }
    if (!f) { audio?.pause(); return; }               // 这首还没收到：只放下唱臂
    audio ||= new Audio();
    audio.src = `music/${f}`;
    audio.play().then(() => b.classList.add('is-loud')).catch(() => {});
    audio.onended = () => { b.classList.remove('is-loud'); b.setAttribute('aria-pressed', 'false'); arm.style.setProperty('--arm', '2deg'); };
  }));
}
