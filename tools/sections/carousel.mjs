// 四 平常的日子：南京发丝线地图（两个 pin + 一条虚线弧）→ 卡片横滑轮播
const STRONG = new Set(['江宁区', '高淳区']);

function mapSvg(m, { esc, map, mapProject }) {
  const [, , W, H] = map.viewBox.split(' ').map(Number);
  const pts = m.pins.map((p) => mapProject(p.lng, p.lat));
  const districts = map.districts.map((d, i) =>
    `<path class="mp__d${STRONG.has(d.name) ? ' is-strong' : ''}" d="${d.d}" pathLength="1" style="--i:${i}"><title>${esc(d.name)}</title></path>`).join('');

  // 两点之间向右鼓出去的一条弧
  const [[ax, ay], [bx, by]] = pts;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const len = Math.hypot(bx - ax, by - ay);
  const nx = (by - ay) / len, ny = -(bx - ax) / len; // 法线：A 在上 B 在下时指向东边
  const bulge = len * 0.32;
  const cx = mx + nx * bulge, cy = my + ny * bulge;
  const arc = `M${ax.toFixed(1)} ${ay.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`;
  const lx = 0.25 * ax + 0.5 * cx + 0.25 * bx, ly = 0.25 * ay + 0.5 * cy + 0.25 * by;

  const pins = m.pins.map((p, i) => {
    const [x, y] = pts[i];
    return `<g class="mp__pin" style="--i:${i}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
      <circle class="mp__halo" r="30"/><circle class="mp__dot" r="11"/>
      <text class="mp__name" x="-34" y="-4" text-anchor="end">${esc(p.name)}</text>
      <text class="mp__note" x="-34" y="40" text-anchor="end">${esc(p.note)}</text>
    </g>`;
  }).join('');

  return `<svg class="mp__svg" viewBox="${map.viewBox}" width="${W}" height="${H}" role="img" aria-label="${esc(m.caption)}：${m.pins.map((p) => esc(p.name + '，' + p.note)).join('；')}">
    <defs><mask id="mp-arc-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><path class="mp__arc-draw" d="${arc}" pathLength="1"/></mask></defs>
    <g class="mp__districts">${districts}</g>
    <path class="mp__arc" d="${arc}" mask="url(#mp-arc-mask)"/>
    <text class="mp__between" x="${(lx + 26).toFixed(1)}" y="${(ly + 14).toFixed(1)}">${esc(m.between)}</text>
    ${pins}
  </svg>`;
}

export default function carousel(ch, ctx) {
  const { esc, img, section } = ctx;
  const m = ch.map;
  const legend = m.pins.map((p) => `<li><span class="mp__lg-name">${esc(p.name)}</span><span class="mp__lg-note">${esc(p.note)}</span></li>`).join('');

  const cards = ch.cards.map((c, i) => `<li class="cr__card" data-i="${i}">
      <div class="cr__in">
        <button class="cr__shot" type="button" data-i="${i}" aria-label="看大图：${esc(c.place + '，' + c.cap)}">${img(c.photo, { cls: 'cr__img', sizes: '(min-width: 60rem) 420px, 72vw', alt: c.cap, attrs: 'draggable="false"' })}</button>
        <p class="cr__place">${esc(c.place)}</p>
        <p class="cr__cap">${esc(c.cap)}</p>
      </div>
    </li>`).join('');
  const n = ch.cards.length;
  const pad = (x) => String(x).padStart(2, '0');

  return section(ch, `<figure class="mp">
  <div class="mp__map">${mapSvg(m, ctx)}</div>
  <figcaption class="mp__legend">
    <p class="mp__caption">${esc(m.caption)}</p>
    <ol class="mp__lg">${legend}</ol>
    <p class="mp__lg-between">${esc(m.between)}</p>
  </figcaption>
</figure>
<div class="cr" role="region" aria-roledescription="carousel" aria-label="${esc(ch.title)}">
  <div class="cr__viewport" tabindex="0" aria-label="左右滑动，或用方向键切换">
    <ul class="cr__track">${cards}</ul>
  </div>
  <div class="cr__bar">
    <button class="cr__btn cr__prev" type="button" aria-label="上一张">← 上一张</button>
    <p class="cr__count num" aria-live="polite"><span class="cr__now">01</span> / ${pad(n)}</p>
    <button class="cr__btn cr__next" type="button" aria-label="下一张">下一张 →</button>
  </div>
</div>`);
}
