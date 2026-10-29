// 八 时间：对准北京时间的表 + 一起过了多少天。
// 指针靠 CSS 动画转，这里只在开始和切回页面时对一次表；数字每秒更新一次，离开视口就停。
import { reduced, onScreen } from './util.js';

const DAY = 864e5;
const OFF = 8 * 36e5;                                   // UTC+8
const bjDay = (ms) => Math.floor((ms + OFF) / DAY);    // 北京的第几个自然日
const dayOf = (s) => bjDay(Date.parse(s.length <= 10 ? `${s}T00:00:00+08:00` : s));
const pad = (n) => String(n).padStart(2, '0');

export function init(el) {
  const root = el.querySelector('.clock');
  const dial = el.querySelector('.dial');
  const since = Date.parse(root.dataset.since);
  const hands = { h: dial.querySelector('.hand--h'), m: dial.querySelector('.hand--m'), s: dial.querySelector('.hand--s') };
  const past = dial.querySelector('.dial__year--past');
  const today = dial.querySelector('.dial__today');
  const ringLen = 2 * Math.PI * 190, step = ringLen / 365;
  const out = {
    day: el.querySelector('[data-day]'),
    h: el.querySelector('[data-h]'), m: el.querySelector('[data-m]'), s: el.querySelector('[data-s]'),
  };
  const rows = [...el.querySelectorAll('dd[data-date]')];
  const still = reduced();
  let lastDay = -1, timer = 0;

  // 当天北京时间过了多少秒
  const secs = (now) => ((now + OFF) % DAY) / 1000;

  function sync() {
    const s = secs(Date.now());
    if (still) { place(s); dial.classList.add('is-set'); return; }
    const delay = { h: s % 43200, m: s % 3600, s: s % 60 };
    for (const k in hands) hands[k].style.animation = 'none';
    void dial.offsetWidth;
    for (const k in hands) {
      hands[k].style.animation = '';
      hands[k].style.animationDelay = `-${delay[k].toFixed(3)}s`;
    }
    dial.classList.add('is-set');
  }

  // 减少动态时：指针不转，每秒跳一下
  function place(s) {
    s = Math.floor(s);
    hands.h.style.transform = `rotate(${((s % 43200) / 120).toFixed(2)}deg)`;
    hands.m.style.transform = `rotate(${((s % 3600) / 10).toFixed(2)}deg)`;
    hands.s.style.transform = `rotate(${(s % 60) * 6}deg)`;
  }

  function update() {
    const now = Date.now();
    const d = bjDay(now);
    if (still) place(secs(now));

    const e = Math.max(0, Math.floor((now - since) / 1000));
    out.h.textContent = Math.floor(e / 3600);
    out.m.textContent = pad(Math.floor((e % 3600) / 60));
    out.s.textContent = pad(e % 60);

    if (d === lastDay) return;
    lastDay = d;
    const n = d - bjDay(since) + 1;                      // 08.28 当天算第 1 天
    out.day.textContent = n;

    const lit = Math.max(0, Math.min(n, 365));
    past.setAttribute('stroke-dasharray', `${`0.7 ${(step - 0.7).toFixed(4)} `.repeat(lit)}0 ${ringLen.toFixed(2)}`);
    today.setAttribute('transform', `rotate(${(((lit - 1) * 360) / 365 + 0.1).toFixed(3)} 200 200)`);

    const year = new Date(now + OFF).getUTCFullYear();
    for (const dd of rows) {
      const date = dd.dataset.date;
      let html, cls = '';
      if (dd.dataset.mode === 'since') {
        const k = d - dayOf(date);
        html = k > 0 ? `<span class="num">${k}</span>天前` : k === 0 ? '就是今天' : `还有<span class="num">${-k}</span>天`;
        if (k === 0) cls = 'is-today';
      } else {
        let t = dayOf(date);
        if (dd.hasAttribute('data-yearly')) {
          const md = date.slice(5);
          t = dayOf(`${year}-${md}`);
          if (t < d) t = dayOf(`${year + 1}-${md}`);
        }
        const k = t - d;
        if (k > 0) html = `还有<span class="num">${k}</span>天`;
        else if (k === 0) { html = '就是今天'; cls = 'is-today'; }
        else { html = `已经过去<span class="num">${-k}</span>天`; cls = 'is-past'; }
      }
      if (dd.innerHTML !== html) dd.innerHTML = html;
      dd.className = cls;
    }
  }

  const start = () => {
    sync(); update();
    dial.classList.add('is-running');
    if (!timer) timer = setInterval(update, 1000);
  };
  const stop = () => {
    dial.classList.remove('is-running');
    clearInterval(timer); timer = 0;
  };

  update();
  scrub(el, { since, bjDay, still });
  onScreen(el, (v) => (v ? start() : stop()));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && timer) { sync(); update(); }
  });
}


// ---- 拨表盘回到那一天 ----
// 按住表盘转：外圈 365 格，一格一天。拨到哪天，右边就换成那天的日期、发生的事、那天聊了多少。
// 拨的时候时针分针跟着倒转；点「回到今天」再转回来。
const WEEK = '日一二三四五六';
const fmt = (n) => n.toLocaleString('en-US');

function scrub(el, { since, bjDay, still }) {
  const root = el.querySelector('.clock');
  const dial = el.querySelector('.dial');
  const data = JSON.parse(el.querySelector('.clock-data').textContent);
  const pick = dial.querySelector('.dial__pick');
  const wraps = { h: dial.querySelector('[data-hands="h"]'), m: dial.querySelector('[data-hands="m"]') };
  const then = el.querySelector('.then');
  const out = {
    n: el.querySelector('[data-day]'),
    date: then.querySelector('.then__date'),
    events: then.querySelector('.then__events'),
    chat: then.querySelector('.then__chat'),
    fig: then.querySelector('.then__photo'),
    img: then.querySelector('.then__photo img'),
  };
  const back = then.querySelector('.then__back');
  const start0 = Date.parse(`${data.start}T00:00:00+08:00`);
  const firstChat = Object.keys(data.chat)[0] || '9999';
  const todayN = () => bjDay(Date.now()) - bjDay(since) + 1;

  let dayF = 0, shown = 0, lastA = null, active = false;

  const iso = (n) => new Date(start0 + (n - 1) * DAY + OFF).toISOString().slice(0, 10);
  let box = null;   // 按下时记住表盘位置，拖的过程中不再读布局
  const angleOf = (e) => {
    const r = box || dial.getBoundingClientRect();
    const a = Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180 / Math.PI;
    return a < 0 ? a + 360 : a;
  };

  function render(n) {
    const day = iso(n);
    const [y, m, d] = day.split('-').map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const md = `${m}月${d}日`;
    out.n.textContent = n;
    out.date.textContent = `${y === 2026 ? '' : y + '年'}${md}　周${WEEK[wd]}`;
    const ev = data.events[day] || [];
    out.events.replaceChildren(...ev.map((line) => Object.assign(document.createElement('li'), { textContent: line })));

    const k = n - todayN();
    const c = data.chat[day];
    let chat = '';
    if (k > 0) chat = `还有 <span class="num">${k}</span> 天`;
    else if (k === 0) chat = '就是今天';
    else if (day < firstChat) chat = '那时候还没加微信　在小红书上聊';
    else if (c) {
      const [hh, mm] = (c.last || '0:0').split(':').map(Number);
      const late = c.last ? (hh < 5 ? `聊到凌晨 ${hh}:${String(mm).padStart(2, '0')}` : `聊到 ${c.last}`) : '';
      chat = `那天${c.by === 'them' ? '你' : '我'}先开口<br>我们说了 <span class="num">${fmt(c.n)}</span> 句话${late ? '　' + late : ''}`;
    }
    out.chat.innerHTML = chat;
    out.chat.hidden = !chat;

    const src = data.photos[day];
    out.fig.hidden = !src;
    if (src && out.img.getAttribute('src') !== src) out.img.src = src;

    pick.setAttribute('transform', `rotate(${(((n - 1) * 360) / 365).toFixed(2)} 200 200)`);
    dial.setAttribute('aria-valuenow', n);
    dial.setAttribute('aria-valuetext', `第 ${n} 天，${md}${ev.length ? '，' + ev.join('，') : ''}`);
  }

  // 时针分针跟着倒转：差几天，分针就多转几圈
  function rewind(f) {
    if (still) return;
    const D = f - todayN();
    wraps.m.style.transform = `rotate(${(D * 360).toFixed(1)}deg)`;
    wraps.h.style.transform = `rotate(${(D * 30).toFixed(1)}deg)`;
  }

  function set(f) {
    dayF = Math.max(1, Math.min(365, f));
    const n = Math.round(dayF);
    if (!active) {
      active = true;
      root.classList.add('is-then');
      then.hidden = false;
      for (const w of Object.values(wraps)) w.classList.remove('is-return');
    }
    rewind(dayF);
    if (n !== shown) { shown = n; render(n); }
  }

  function reset() {
    if (!active) return;
    active = false; shown = 0; lastA = null;
    root.classList.remove('is-then');
    then.hidden = true;
    out.n.textContent = todayN();
    dial.removeAttribute('aria-valuenow');
    dial.removeAttribute('aria-valuetext');
    // 先把角度折回半圈以内，再转回 0，别一口气倒转几十圈
    for (const w of Object.values(wraps)) {
      const a = parseFloat((w.style.transform.match(/-?[\d.]+/) || [0])[0]);
      const r = ((a % 360) + 540) % 360 - 180;
      w.classList.remove('is-return');
      w.style.transform = `rotate(${r}deg)`;
      void w.offsetWidth;
      w.classList.add('is-return');
      w.style.transform = 'rotate(0deg)';
    }
  }

  // 拖动：自己记住是哪根手指在拖，在 window 上跟，不依赖 pointer capture（有的浏览器会中途丢掉）
  let dragId = null;
  dial.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dragId = e.pointerId;
    try { dial.setPointerCapture(e.pointerId); } catch { /* 拿不到也照样能拖 */ }
    dial.classList.add('is-grab');
    box = dial.getBoundingClientRect();
    const a = angleOf(e);
    lastA = a;
    // 按下的位置就是那一天：12 点方向是 08.28，顺时针一格一天
    set((a / 360) * 365 + 1);
  });
  addEventListener('pointermove', (e) => {
    if (e.pointerId !== dragId) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) { end(e); return; }
    const a = angleOf(e);
    let d = a - lastA;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    lastA = a;
    set(dayF + (d / 360) * 365);
  }, { passive: true });
  function end(e) {
    if (e.pointerId !== dragId) return;
    dragId = null; lastA = null; box = null;
    dial.classList.remove('is-grab');
  }
  addEventListener('pointerup', end, { passive: true });
  addEventListener('pointercancel', end, { passive: true });

  dial.addEventListener('keydown', (e) => {
    const cur = active ? Math.round(dayF) : todayN();
    const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -7, PageUp: 7 }[e.key];
    if (step) { e.preventDefault(); set(cur + step); }
    else if (e.key === 'Home') { e.preventDefault(); set(1); }
    else if (e.key === 'End' || e.key === 'Escape') { e.preventDefault(); reset(); }
  });
  back.addEventListener('click', () => { reset(); dial.focus({ preventScroll: true }); });
}
