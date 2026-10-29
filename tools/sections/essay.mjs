// 三 高淳的一天：从中午到黄昏的一组照片。电脑端钉住横移，手机端横滑；底色跟着「一天」变暗
export default function essay(ch, { esc, img, lines, head, photo, section }) {
  const frames = ch.frames.map((f, i) => {
    const p = photo(f.photo);
    const land = p.w > p.h;
    return `<figure class="es__frame${land ? ' is-land' : ''}" style="--ar:${(p.w / p.h).toFixed(4)}" data-time="${esc(f.time)}" data-i="${i}">
        <button class="es__shot" type="button" data-i="${i}" aria-label="看大图：${esc(f.cap)}">${img(f.photo, { cls: 'es__img', sizes: land ? '(min-width: 60rem) 90vh, 92vw' : '(min-width: 60rem) 50vh, 80vw', alt: f.cap })}</button>
        <figcaption><span class="es__time">${esc(f.time)}</span><span class="es__cap">${esc(f.cap)}</span></figcaption>
      </figure>`;
  }).join('');

  return section(ch, `<div class="es" style="--n:${ch.frames.length}">
  <div class="es__pin">
    <div class="es__sky" aria-hidden="true"><i class="es__sky-warm"></i><i class="es__sky-dusk"></i><i class="es__sky-night"></i></div>
    <div class="es__rail">
      <div class="es__intro">
        ${head(ch)}
        <p class="es__lede">${lines(ch.lede, 'ln rv')}</p>
      </div>
      <div class="es__track">${frames}<span class="es__end" aria-hidden="true"></span></div>
    </div>
    <div class="es__hud" aria-hidden="true"><span class="es__hud-time">${esc(ch.frames[0].time)}</span><span class="es__hud-bar"><i></i></span></div>
  </div>
</div>`, { withHead: false });
}
