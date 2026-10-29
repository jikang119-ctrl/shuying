// 八 时间：一只表 + 一起过了多少天。表盘是静态 SVG，指针是三个 HTML 块，靠 CSS 动画走（不跑每帧 JS）。
const C = 200; // 表盘中心（viewBox 400×400）

const polar = (r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [(C + r * Math.cos(a)).toFixed(2), (C + r * Math.sin(a)).toFixed(2)];
};

function dialSvg() {
  // 60 道发丝分钟刻度
  let minutes = '';
  for (let i = 0; i < 60; i++) {
    if (i % 5 === 0) continue;
    const [x1, y1] = polar(170, i * 6), [x2, y2] = polar(176, i * 6);
    minutes += `M${x1} ${y1}L${x2} ${y2}`;
  }
  // 12 根细长条时标，12 点是两根
  let bars = '';
  for (let i = 0; i < 12; i++) {
    const offs = i === 0 ? [-4.2, 4.2] : [0];
    for (const o of offs) bars += `<rect x="${C - 1.3 + o}" y="${C - 164}" width="2.6" height="${i % 3 === 0 ? 34 : 26}" rx=".8" transform="rotate(${i * 30} ${C} ${C})"/>`;
  }
  const ring = 2 * Math.PI * 190;
  const step = ring / 365;
  return `<svg class="dial__face" viewBox="0 0 400 400" aria-hidden="true">
  <defs>
    <radialGradient id="enamel" cx="42%" cy="36%" r="70%">
      <stop offset="0" class="dial__stop-a"/><stop offset="1" class="dial__stop-b"/>
    </radialGradient>
  </defs>
  <circle class="dial__case" cx="200" cy="200" r="199"/>
  <circle class="dial__year" cx="200" cy="200" r="190" stroke-dasharray="0.7 ${(step - 0.7).toFixed(4)}" transform="rotate(-90 200 200)"/>
  <circle class="dial__year dial__year--past" cx="200" cy="200" r="190" stroke-dasharray="0 ${ring.toFixed(2)}" transform="rotate(-90 200 200)"/>
  <g class="dial__today"><line x1="200" y1="2" x2="200" y2="17"/></g>
  <circle class="dial__enamel" cx="200" cy="200" r="180"/>
  <circle class="dial__chapter" cx="200" cy="200" r="168"/>
  <path class="dial__minutes" d="${minutes}"/>
  <g class="dial__bars">${bars}</g>
  <text class="dial__brand" x="200" y="146" text-anchor="middle">疏影</text>
  <text class="dial__date" x="200" y="272" text-anchor="middle">2026 · 08 · 28</text>
</svg>`;
}

export default function clock(ch, { esc, section }) {
  const row = (it, mode) => `<div class="tally__row">
      <dt>${esc(it.label)}</dt>
      <dd data-date="${esc(it.date)}" data-mode="${mode}"${it.yearly ? ' data-yearly' : ''}>—</dd>
    </div>`;

  return section(ch, `<div class="clock" data-since="${esc(ch.since)}">
  <div class="dial" role="img" aria-label="一只表，指针走的是北京时间；外圈 365 道刻度是第一年，走过的天数是暮色的">
    ${dialSvg()}
    <span class="hand hand--h"></span>
    <span class="hand hand--m"></span>
    <span class="hand hand--s"><span class="hand__needle"></span><span class="hand__weight"></span></span>
    <span class="dial__cap"></span>
  </div>
  <div class="tally">
    <p class="tally__since">${esc(ch.sinceLabel)}　那天算第一天</p>
    <p class="tally__day"><span class="tally__unit">第</span><span class="tally__n num" data-day>—</span><span class="tally__unit">天</span></p>
    <p class="tally__run"><span class="tally__label">一起走过</span><span class="tally__hms"><span class="num" data-h>—</span> 小时 <span class="num" data-m>—</span> 分 <span class="num" data-s>—</span> 秒</span></p>
    <div class="tally__lists">
      <div><p class="tally__head">走过的</p><dl class="tally__list">${ch.marks.map((m) => row(m, 'since')).join('')}</dl></div>
      <div><p class="tally__head">接下来</p><dl class="tally__list">${ch.next.map((n) => row(n, 'until')).join('')}</dl></div>
    </div>
  </div>
</div>`);
}
