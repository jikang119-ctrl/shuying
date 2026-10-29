// 七 骑士：暗场的舞台。一束暖光跟着鼠标（手机上自己游走、手指按哪跳哪），光里才看得清。
// 结构：.stage__light 是贴在视口上的遮光层（sticky），下面是正常排版的内容。
// 按全角空格分段，每段不拆行（避免「年年」被折成两行）
const segs = (t, esc) => t.split('　').map((x) => `<span class="seg">${esc(x)}</span>`).join('　');

export default function stage(ch, { esc, img, section }) {
  const idol = [...ch.idol].map((c) => `<span>${esc(c)}</span>`).join('');

  const lines = ch.lines.map((l, i) => {
    const who = l.who ? `<span class="say__who">${esc(l.who)}</span>` : '';
    return `<p class="say${l.who ? '' : ' say--aside'}${l.who === '我' ? ' say--me' : ''}" style="--i:${i}"><span class="say__text">${segs(l.text, esc)}</span>${who}</p>`;
  }).join('');

  const tracks = ch.tracks.map((t, i) => `<li><button class="track" type="button" aria-pressed="false" data-i="${i}" data-title="${esc(t.title)}">
      <span class="track__no num">${String(i + 1).padStart(2, '0')}</span>
      <span class="track__title">${esc(t.title)}</span>
      <span class="track__note">${esc(t.note)}</span>
    </button></li>`).join('');

  const photos = ch.photos.map((p, i) => `<figure class="stage__photo stage__photo--${i}">
      ${img(p.photo, { sizes: '(min-width: 60rem) 22vw, 44vw', alt: p.cap })}
      <figcaption>${esc(p.cap)}</figcaption>
    </figure>`).join('');

  return section(ch, `<div class="stage__light" aria-hidden="true"><div class="stage__glow"></div><div class="stage__dark"></div></div>
<div class="stage">
  <h3 class="stage__idol" aria-label="${esc(ch.idol)}">${idol}</h3>
  <div class="stage__script">${lines}</div>
  <div class="stage__deck">
    <div class="vinyl" aria-hidden="true">
      <div class="vinyl__disc">
        <div class="vinyl__label"><span class="vinyl__name num">${esc(ch.album.name)}</span><span class="vinyl__note">${esc(ch.album.note)}</span></div>
      </div>
      <div class="vinyl__sheen"></div>
      <div class="vinyl__arm"><span class="vinyl__pivot"></span><span class="vinyl__rod"></span><span class="vinyl__head"></span></div>
    </div>
    <div class="stage__tracks">
      <p class="stage__tracks-head">她的歌单　点一首</p>
      <ol class="tracks">${tracks}</ol>
      <a class="stage__more" href="music.html"><span class="stage__more-t">打开她的唱片柜</span><span class="stage__more-s">十六张专辑　一本一本翻</span><span class="stage__more-a" aria-hidden="true">→</span></a>
    </div>
  </div>
  <div class="stage__photos">${photos}</div>
  <p class="stage__end">${segs(ch.end, esc)}</p>
</div>`, { theme: 'night' });
}
