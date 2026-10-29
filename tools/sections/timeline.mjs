// 一 遇见：手机上是一条竖的日期线；电脑上左边有一个跟着滚动换的大日期
export default function timeline(ch, { esc, seg, section }) {
  const items = ch.items.map((it, i) => `<li class="tl__item rv" style="--i:0" data-date="${esc(it.date)}" data-i="${i}">
      <span class="tl__date">${esc(it.date)}</span>
      <p class="tl__text">${it.lines.map((l) => `<span class="ln">${seg(l)}</span>`).join('')}</p>
    </li>`).join('');
  const first = ch.items[0];
  return section(ch, `<div class="tl">
  <div class="tl__big" aria-hidden="true"><p class="tl__big-date">${esc(first.date)}</p><p class="tl__big-cap">二〇二六</p></div>
  <ol class="tl__list">${items}</ol>
</div>`, { module: '' });
}
