// 六 你：手机上两列平衡排布；电脑上 gallery.js 把同一批格子改排成一面可拖拽的照片墙
export default function gallery(ch, { img, section, photo }) {
  const tiles = ch.photos.map((id, i) => {
    const p = photo(id);
    return `<button class="gal__tile" type="button" data-i="${i}" style="--ar:${(p.h / p.w).toFixed(4)}" aria-label="看大图 ${i + 1}">${img(id, { sizes: '(min-width: 60rem) 380px, 50vw', cls: 'gal__img', alt: '你', attrs: 'draggable="false"' })}</button>`;
  }).join('');
  return section(ch, `<div class="gal">${tiles}</div>
<p class="gal__hint"><span class="hint-fine">按住拖动　点开看大图</span><span class="hint-coarse">点开看大图</span></p>`);
}
