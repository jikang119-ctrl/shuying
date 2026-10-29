// 显影：照片像在暗房药水里一样，从纸上慢慢显出来。
// 鼠标/手指走过的地方先显出一层旧照片的褐色，过一会儿才变成彩色；不碰它也会自己慢慢显完。
// 显完以后把画布淡掉，露出底下真正的 <img>（清晰、原生缩放），循环停掉，不再占 CPU。
import { onScreen, loop, reduced, dpr, isFine } from './util.js';

const PRESET = {
  cover:  { auto: 7000, brush: 0.2, ambient: 3, wake: 0 },
  finale: { auto: 11000, brush: 0.16, ambient: 2, wake: 0 },
};

export function init(el) {
  const kind = el.dataset.develop;
  const opt = PRESET[kind] || PRESET.cover;
  const img = el.querySelector('img');
  const canvas = el.querySelector('canvas');
  const host = kind === 'finale' ? el.closest('.finale') : el;
  const cover = kind === 'cover' ? el.querySelector('.cover__paper') : el.querySelector('.finale__dark');

  const done = () => {
    host.classList.add('is-developed');
    canvas.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1200, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' });
    cover.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1200, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' });
  };
  if (reduced()) { done(); return; }

  const ready = img.complete && img.naturalWidth ? Promise.resolve() : new Promise((r) => img.addEventListener('load', r, { once: true }));
  ready.then(() => start(el, { img, canvas, host, opt, done }));
}

function start(el, { img, canvas, host, opt, done }) {
  const ctx = canvas.getContext('2d');
  const wet = document.createElement('canvas');   // 刚碰过的地方：褐色
  const fix = document.createElement('canvas');   // 慢一拍跟上：彩色
  const tmp = document.createElement('canvas');
  const wctx = wet.getContext('2d');
  const fctx = fix.getContext('2d');
  const tctx = tmp.getContext('2d');
  let W = 0, H = 0, MW = 0, MH = 0, sepia = null, rect = null, frame = 0;
  // 手机上：画布 0.75 倍像素、隔一帧才合成一次（遮罩还是每帧更新），显完之后反正换回原生 <img>
  const coarse = !isFine();

  // 一支软刷子，预先画好，之后只贴图
  const brush = document.createElement('canvas');
  brush.width = brush.height = 64;
  const bctx = brush.getContext('2d');
  const g = bctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  bctx.fillStyle = g;
  bctx.fillRect(0, 0, 64, 64);

  // 按 object-fit: cover 的方式算出照片在画布上的位置，和底下的 <img> 对齐
  const fit = (w, h) => {
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    return [(w - dw) / 2, (h - dh) / 2, dw, dh];
  };

  function makeSepia() {
    // 只做一次：缩小一份照片，逐像素调成旧照片的褐色、偏淡
    const c = document.createElement('canvas');
    const sw = Math.min(640, img.naturalWidth);
    c.width = sw; c.height = Math.round(img.naturalHeight * sw / img.naturalWidth);
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0, c.width, c.height);
    try {
      const d = cx.getImageData(0, 0, c.width, c.height);
      const p = d.data;
      for (let i = 0; i < p.length; i += 4) {
        const y = 0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2];
        const l = 70 + y * 0.78;
        p[i] = Math.min(255, l * 1.07); p[i + 1] = Math.min(255, l * 0.93); p[i + 2] = Math.min(255, l * 0.76);
      }
      cx.putImageData(d, 0, 0);
    } catch { /* 读不了像素就直接用原图 */ }
    return c;
  }

  function resize() {
    rect = canvas.getBoundingClientRect();
    const r = coarse ? 0.75 : dpr(1.25);
    W = canvas.width = Math.max(1, Math.round(rect.width * r));
    H = canvas.height = Math.max(1, Math.round(rect.height * r));
    tmp.width = W; tmp.height = H;
    // 遮罩用 1/4 分辨率，放大时自然变软
    const nMW = Math.max(8, Math.round(rect.width / 4)), nMH = Math.max(8, Math.round(rect.height / 4));
    if (MW === nMW && MH === nMH) return;
    if (MW) {
      const ow = document.createElement('canvas'); ow.width = nMW; ow.height = nMH; ow.getContext('2d').drawImage(wet, 0, 0, nMW, nMH);
      const of = document.createElement('canvas'); of.width = nMW; of.height = nMH; of.getContext('2d').drawImage(fix, 0, 0, nMW, nMH);
      wet.width = fix.width = nMW; wet.height = fix.height = nMH;
      wctx.drawImage(ow, 0, 0); fctx.drawImage(of, 0, 0);
    } else {
      wet.width = fix.width = nMW; wet.height = fix.height = nMH;
    }
    MW = nMW; MH = nMH;
  }

  const stamp = (x, y, size, a = 1) => {
    wctx.globalAlpha = a;
    wctx.drawImage(brush, x - size / 2, y - size / 2, size, size);
    wctx.globalAlpha = 1;
  };

  // 把 CSS 坐标的一段笔画按间距铺满
  let lx = null, ly = null;
  function stroke(cx, cy, a = 0.9) {
    const x = (cx - rect.left) / rect.width * MW;
    const y = (cy - rect.top) / rect.height * MH;
    const size = Math.min(MW, MH) * opt.brush * 2;
    if (lx === null) { stamp(x, y, size, a); }
    else {
      const d = Math.hypot(x - lx, y - ly);
      const n = Math.max(1, Math.ceil(d / (size / 5)));
      for (let i = 1; i <= n; i++) stamp(lx + (x - lx) * i / n, ly + (y - ly) * i / n, size, a * 0.6);
    }
    lx = x; ly = y;
    wake();
  }
  const lift = () => { lx = ly = null; };

  // 没人碰时，几道慢慢游走的光，像药水在纸上晃
  const walkers = Array.from({ length: opt.ambient }, (_, i) => ({ p: Math.random() * 6.28, q: Math.random() * 6.28, s: 0.00022 + i * 0.00007 }));

  let t0 = 0, elapsed = 0, finished = false, idleFrames = 0;
  const L = loop((now, dt) => {
    if (!t0) t0 = now;
    elapsed += dt;
    const k = Math.min(1, elapsed / opt.auto);

    for (const w of walkers) {
      const x = (0.5 + 0.42 * Math.sin(w.p + now * w.s)) * MW;
      const y = (0.5 + 0.42 * Math.sin(w.q + now * w.s * 1.37)) * MH;
      stamp(x, y, Math.min(MW, MH) * 0.5, 0.018 + 0.03 * k);
    }
    // 整张纸一起慢慢显，越到后面越快
    wctx.globalAlpha = 0.0015 + 0.022 * k * k;
    wctx.fillStyle = '#fff';
    wctx.fillRect(0, 0, MW, MH);
    wctx.globalAlpha = 1;
    // 彩色比褐色慢一拍
    fctx.globalAlpha = 0.045 + 0.08 * k;
    fctx.drawImage(wet, 0, 0);
    fctx.globalAlpha = 1;

    if (coarse && (++frame & 1) && k < 1) return true;
    const [dx, dy, dw, dh] = fit(W, H);
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(wet, 0, 0, W, H);
    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(sepia, dx, dy, dw, dh);
    tctx.globalCompositeOperation = 'copy';
    tctx.drawImage(fix, 0, 0, W, H);
    tctx.globalCompositeOperation = 'source-in';
    tctx.drawImage(img, dx, dy, dw, dh);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(tmp, 0, 0);

    if (k >= 1 && !finished) {
      idleFrames++;
      if (idleFrames > 50) { finished = true; done(); return false; }
    }
    return true;
  });

  function wake() { if (!finished && visible) L.start(); }

  let visible = false;
  sepia = makeSepia();
  resize();
  addEventListener('resize', () => { if (!finished) resize(); }, { passive: true });

  onScreen(el, (v) => { visible = v; if (v) wake(); else L.stop(); });

  if (isFine()) {
    el.addEventListener('pointermove', (e) => stroke(e.clientX, e.clientY), { passive: true });
    el.addEventListener('pointerleave', lift, { passive: true });
  } else {
    // 手机上：手指划过时（哪怕页面在滚）也记下来；轻点一下就在那儿显一块
    el.addEventListener('touchstart', (e) => { lift(); const t = e.touches[0]; stroke(t.clientX, t.clientY, 1); }, { passive: true });
    el.addEventListener('touchmove', (e) => { const t = e.touches[0]; stroke(t.clientX, t.clientY); }, { passive: true });
    el.addEventListener('touchend', lift, { passive: true });
  }
  // 滚动时 rect 会变
  addEventListener('scroll', () => { if (!finished && visible) rect = canvas.getBoundingClientRect(); }, { passive: true });
}
