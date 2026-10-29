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
  onScreen(el, (v) => (v ? start() : stop()));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && timer) { sync(); update(); }
  });
}
