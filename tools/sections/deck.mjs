// 五 一起吃饭：一叠卡片，照片卡 + 菜单卡，deck.js 负责拖动和翻页
export default function deck(ch, { esc, img, section }) {
  const pad = (n) => String(n).padStart(2, '0');
  const label = (c) => (c.type === 'menu' ? c.head : c.cap);
  const cards = ch.cards.map((c, i) => {
    const no = `<span class="deck__no num">${pad(i + 1)}</span>`;
    if (c.type === 'menu') {
      return `<div class="deck__card deck__card--menu${c.head.includes('不') ? ' is-no' : ''}" data-i="${i}">
  <div class="menu"><p class="menu__head">${esc(c.head)}</p><ul class="menu__items">${c.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>${no}
</div>`;
    }
    return `<figure class="deck__card deck__card--photo" data-i="${i}">
  <div class="deck__ph">${img(c.photo, { sizes: '(min-width: 60rem) 380px, 80vw', alt: c.cap, attrs: 'draggable="false"' })}</div>
  <figcaption class="deck__cap">${esc(c.cap)}</figcaption>${no}
</figure>`;
  }).join('');
  const index = ch.cards.map((c, i) => `<li><button type="button" data-go="${i}"><span class="num">${pad(i + 1)}</span>${esc(label(c))}</button></li>`).join('');
  return section(ch, `<div class="deck">
  <div class="deck__stage">
    <div class="deck__stack" tabindex="0" role="group" aria-roledescription="卡片" aria-label="一起吃饭的卡片，左右键翻页">${cards}</div>
  </div>
  <div class="deck__side">
    <ol class="deck__index">${index}</ol>
    <div class="deck__ctrl">
      <button class="deck__btn" type="button" data-dir="-1">上一张</button>
      <p class="deck__count num" aria-live="polite">01 / ${pad(ch.cards.length)}</p>
      <button class="deck__btn" type="button" data-dir="1">下一张</button>
    </div>
  </div>
</div>`);
}
