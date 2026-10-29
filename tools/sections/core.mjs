// 封面、序、书签条、尾声。时间线（timeline.mjs）也是这一路写的。

export function bookmark(story, { esc }) {
  const toc = story.chapters.map((c) => `<a href="#${c.id}" data-toc="${c.id}"><span>${esc(c.no + '　' + c.title)}</span></a>`).join('');
  return `<div class="bookmark" aria-hidden="true">
  <span class="bookmark__mark">${esc(story.meta.title)}</span>
  <span class="bookmark__ch"></span>
  <span class="bookmark__bar"></span><span class="bookmark__fill"></span>
</div>
<nav class="toc" aria-label="章节">${toc}<a href="#finale" data-toc="finale"><span>尾声</span></a></nav>`;
}

export function cover(story, { esc, img }) {
  const c = story.cover;
  return `<header class="cover" id="cover" data-module="develop" data-develop="cover">
  <div class="cover__photo">${img(c.photo, { eager: true, alt: c.alt, pos: c.focus })}</div>
  <div class="cover__paper"></div>
  <canvas class="cover__canvas" aria-hidden="true"></canvas>
  <div class="cover__veil"></div>
  <p class="cover__hint"><span class="hint-fine">${esc(c.hintFine)}</span><span class="hint-coarse">${esc(c.hintCoarse)}</span></p>
  <div class="cover__text">
    <h1 class="cover__title">${esc(c.title)}</h1>
    <p class="cover__sub">${esc(c.sub)}</p>
    <p class="cover__line">${esc(c.line)}</p>
  </div>
  <p class="cover__scroll" aria-hidden="true">往下翻</p>
</header>`;
}

export function prologue(story, { lines }) {
  return `<section class="prologue" aria-label="序"><p class="rv-group">${lines(story.prologue, 'ln rv')}</p></section>`;
}

export function finale(story, { esc, img, lines }) {
  const f = story.finale;
  return `<section class="finale night" id="finale" data-chapter="尾声" data-night>
  <div class="finale__stage" data-module="develop" data-develop="finale">
    ${img(f.photo, { alt: f.alt, pos: f.focus })}
    <div class="finale__dark"></div>
    <canvas class="finale__canvas" aria-hidden="true"></canvas>
    <p class="finale__hint"><span class="hint-fine">在黑里移动鼠标</span><span class="hint-coarse">在黑里擦一擦</span></p>
    <p class="finale__poem">${f.poem.map(esc).join('<br>')}<small>${esc(f.poemBy)}</small></p>
  </div>
  <div class="finale__words">
    <p class="finale__lines">${lines(f.lines, 'ln rv')}</p>
    <p class="finale__sign">${esc(f.sign)}</p>
  </div>
  ${reply(story, { esc })}
</section>`;
}

// 尾声最后：她可以给我回信。信寄到服务器（server/letters.py），只有我能看。
function reply(story, { esc }) {
  const r = story.reply;
  if (!r) return '';
  return `<div class="reply" data-module="reply">
    <h3 class="reply__title">${esc(r.title)}</h3>
    <p class="reply__hint">${esc(r.hint)}</p>
    <form class="reply__form" novalidate>
      <label class="sr-only" for="reply-text">${esc(r.title)}</label>
      <textarea class="reply__paper" id="reply-text" name="text" rows="7" maxlength="2000" placeholder="${esc(r.placeholder)}"></textarea>
      <div class="reply__bar">
        <span class="reply__count num" aria-hidden="true">0 / 2000</span>
        <button class="reply__send" type="submit" disabled>寄出</button>
      </div>
      <p class="reply__status" role="status"></p>
    </form>
    <div class="reply__sent" hidden>
      <p class="reply__sent-head">你寄出的</p>
      <ol class="reply__list"></ol>
    </div>
  </div>`;
}
