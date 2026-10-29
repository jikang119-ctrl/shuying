// 二 在遇见我之前：她的原话 → 一条 35mm 胶片 → 我回的那句
export default function filmstrip(ch, { esc, img, lines, section }) {
  const frames = ch.frames.map((f, i) => `<li class="film__frame">
      <span class="film__no num" aria-hidden="true">${12 + i}${i % 2 ? 'A' : ''}</span>
      <button class="film__shot" type="button" data-i="${i}" aria-label="看大图：${esc(f.cap)}">${img(f.photo, { cls: 'film__img', sizes: '(min-width: 60rem) 340px, 60vw', alt: f.cap })}</button>
      <p class="film__cap">${esc(f.cap)}</p>
    </li>`).join('');

  return section(ch, `<div class="fs-quote">
  <p class="fs-quote__text">${lines(ch.quote, 'ln rv')}</p>
  <p class="fs-quote__by rv" style="--i:4">— ${esc(ch.quoteBy)}</p>
</div>
<div class="film" data-film>
  <ol class="film__track">${frames}</ol>
</div>
<div class="fs-reply">
  <p class="fs-reply__text rv">${esc(ch.reply)}</p>
  <p class="fs-reply__by rv" style="--i:1">— ${esc(ch.replyBy)}</p>
</div>`);
}
