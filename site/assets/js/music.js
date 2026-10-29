// 骑士的唱片柜：书架 → 抽出一本 → 翻开封面 → 点歌。底下一条播放条，锁屏也能控制。
// 数据：assets/data/music.json（tools/music_build.py 生成）；音频：music/<f>.m4a（要先在首页输过四位数）。
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mmss = (s) => { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const CN = ['', '第一', '第二', '第三', '第四', '第五', '第六', '第七', '第八', '第九', '第十', '第十一', '第十二', '第十三', '第十四', '第十五', '第十六'];
const KEY = 'shuying.music';

const data = await fetch('assets/data/music.json', { cache: 'no-cache' }).then((r) => r.json());
const albums = data.albums;
const tracks = [];                       // 所有能放的歌，按书架顺序
const byF = new Map();
for (const a of albums) a.tracks.forEach((t, i) => {
  t.album = a; t.i = i;
  if (t.f) { tracks.push(t); byF.set(t.f, t); }
});

const audio = $('[data-audio]');
const player = $('[data-player]');
const book = $('[data-book]');
const obj = $('[data-obj]');
let current = null;          // 正在放的那首
let shuffle = false;
let openAlbum = null;
let history = [];

/* ---------------- 书架 ---------------- */
const shelf = $('[data-shelf]');
const heights = [15.5, 14.5, 16, 15, 16.5, 15.5, 14.8, 16.2, 15.2, 16.4, 15.8, 14.6, 16, 15.4, 16.6, 15.6, 14.4, 15];
shelf.innerHTML = albums.map((a, i) => {
  const w = a.kind === 'studio' ? 2.7 + Math.min(1.1, a.tracks.length * 0.07) : 3.9;
  const gap = a.kind !== 'studio' && albums[i - 1]?.kind === 'studio' ? '<span class="shelf__gap" aria-hidden="true"></span>' : '';
  return `${gap}<button class="spine" type="button" data-a="${a.id}" style="--bg:${a.bg};--ink:${a.ink};--h:${heights[i % heights.length]}rem;--w:${w.toFixed(2)}rem" aria-label="${esc(a.title)}${a.sub ? '　' + esc(a.sub) : ''}　${esc(a.date)}">
    <span class="spine__no num">${a.no || '·'}</span>
    <span class="spine__title${a.title.length > (/[一-鿿]/.test(a.title) ? 6 : 10) ? ' is-long' : ''}">${esc(a.title)}</span>
    <span class="spine__year num">${a.kind === 'studio' ? a.year : ''}</span>
  </button>`;
}).join('');
shelf.addEventListener('click', (e) => {
  const b = e.target.closest('.spine');
  if (b) openBook(albums.find((a) => a.id === b.dataset.a), b);
});

/* ---------------- 你说过的那几首 ---------------- */
const picks = albums.flatMap((a) => a.tracks.filter((t) => t.note));
$('[data-picks]').innerHTML = picks.map((t) => `<li><button class="pick" type="button" ${t.f ? `data-f="${t.f}"` : 'disabled'} style="--c:${t.album.bg}">
  <span class="pick__dot" aria-hidden="true"></span>
  <span class="pick__main"><span class="pick__t">${esc(t.t)}</span><span class="pick__note">${esc(t.note)}${t.f ? '' : '　·　这首还没收到'}</span></span>
  <span class="pick__alb">${esc(t.album.kind === 'studio' ? t.album.title : (t.src || t.album.title))}</span>
</button></li>`).join('');
$('[data-picks]').addEventListener('click', (e) => {
  const b = e.target.closest('[data-f]');
  if (b) { shuffle = false; syncMode(); play(byF.get(b.dataset.f)); }
});
const studioN = albums.filter((a) => a.kind === 'studio').length;
const uniq = new Set(tracks.map((t) => t.t.replace('（另一版）', ''))).size;
$('[data-stat]').textContent = `${studioN === 16 ? '十六' : studioN}张专辑　${uniq} 首`;
$('[data-missing-line]').textContent = data.missing ? `还有 ${data.missing} 首没收到，翻开书能看到，是灰的　以后补上` : '';

/* ---------------- 书：抽出、翻开、合上 ---------------- */
function coverHTML(a) {
  const cn = /[一-鿿]/.test(a.title);
  const long = a.title.length > (cn ? 5 : 10);
  return `<div class="sleeve" style="--bg:${a.bg};--ink:${a.ink}">
    <div class="sleeve__top"><span class="sleeve__no num">${a.no ? 'No.' + a.no : ''}</span><span class="sleeve__year num">${a.kind === 'studio' ? a.year : ''}</span></div>
    <div class="sleeve__mid"><h3 class="sleeve__title${cn ? ' is-cn' : ''}${long ? ' is-long' : ''}">${esc(a.title)}</h3>${a.sub ? `<p class="sleeve__sub">${esc(a.sub)}</p>` : ''}</div>
    <div class="sleeve__foot"><b>蔡依林</b><span>JOLIN TSAI</span></div>
  </div>`;
}
function leafHTML(a) {
  const have = a.tracks.filter((t) => t.f).length;
  const total = a.tracks.length;
  const notes = a.tracks.filter((t) => t.note);
  const mins = Math.round(a.tracks.reduce((s, t) => s + (t.d || 0), 0) / 60);
  const facts = a.kind === 'studio'
    ? `<dt>发行</dt><dd class="num">${a.date.replaceAll('-', '.')}</dd><dt>曲目</dt><dd><span class="num">${total}</span> 首</dd><dt>收到</dt><dd><span class="num">${have}</span> 首${have < total ? '　还差 <span class="num">' + (total - have) + '</span>' : '　齐了'}</dd><dt>时长</dt><dd><span class="num">${mins}</span> 分钟</dd>`
    : `<dt>年份</dt><dd class="num">${a.date}</dd><dt>收录</dt><dd><span class="num">${total}</span> 首</dd><dt>收到</dt><dd><span class="num">${have}</span> 首</dd>`;
  return `<div class="leaf" style="--bg:${a.bg}">
    <p class="leaf__kicker">${a.kind === 'studio' ? CN[+a.no] + '张专辑' : esc(a.sub)}</p>
    <h3 class="leaf__title">${esc(a.title)}</h3>
    <dl class="leaf__facts">${facts}</dl>
    ${notes.length ? `<p class="leaf__notes">${notes.map((t) => `<b>${esc(t.t)}</b>　${esc(t.note)}`).join('<br>')}</p>` : '<span class="leaf__swatch"></span>'}
  </div>`;
}
function pageHTML(a) {
  const rows = a.tracks.map((t, i) => {
    const sub = [t.feat?.length ? `和 ${t.feat.join('、')}` : '', a.id === 'singles' || a.id === 'comps' ? `${t.y || ''}${t.src && t.src !== '单曲' ? '　' + t.src : (t.src ? '　单曲' : '')}` : '', t.note ? `<b>${esc(t.note)}</b>` : '']
      .filter(Boolean).map((s) => (s.startsWith('<b>') ? s : esc(s))).join('　');
    return `<li><button class="row" type="button" ${t.f ? `data-f="${t.f}"` : 'disabled'}>
      <span class="row__no num">${String(i + 1).padStart(2, '0')}</span>
      <span class="row__main"><span class="row__t">${esc(t.t)}</span>${sub ? `<span class="row__sub">${sub}</span>` : ''}</span>
      <span class="row__d${t.f ? ' num' : ''}">${t.f ? mmss(t.d) : '还没有'}</span>
    </button></li>`;
  }).join('');
  return `<header class="page__head"><h3>曲目</h3><p>点一首就放</p></header><ol class="page__list">${rows}</ol>`;
}

let lastSpine = null;
function flipFrom(el) {
  // 书从书脊的位置飞到屏幕中间：先算好位移和缩放，再用 Web Animations 播
  const s = el.getBoundingClientRect();
  const b = obj.getBoundingClientRect();
  const dx = s.left + s.width / 2 - (b.left + b.width / 2);
  const dy = s.top + s.height / 2 - (b.top + b.height / 2);
  return [`translate(${dx}px, ${dy}px) scale(${s.width / b.width}, ${s.height / b.height})`, 'translate(0, 0) scale(1, 1)'];
}
async function openBook(a, spine) {
  if (!a) return;
  openAlbum = a;
  lastSpine = spine || $(`.spine[data-a="${a.id}"]`);
  $$('.spine').forEach((s) => s.classList.toggle('is-out', s === lastSpine));
  $('[data-front]').innerHTML = coverHTML(a);
  $('[data-back]').innerHTML = leafHTML(a);
  $('[data-page]').innerHTML = pageHTML(a);
  obj.style.setProperty('--bg', a.bg);
  book.style.setProperty('--bg', a.bg);
  markPlaying();
  book.hidden = false;
  book.classList.remove('is-open');
  obj.style.transform = '';
  await new Promise(requestAnimationFrame);
  book.classList.add('is-shown');
  if (!reduced && lastSpine) {
    const [from, to] = flipFrom(lastSpine);
    await obj.animate([{ transform: from, opacity: .6 }, { transform: to, opacity: 1 }], { duration: 560, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }).finished.catch(() => {});
  }
  obj.style.transform = '';
  book.classList.add('is-open');
  $('[data-close].book__close').focus({ preventScroll: true });
  const playingRow = $('.row.is-playing', book);
  if (playingRow) playingRow.scrollIntoView({ block: 'center' });
}
async function closeBook() {
  if (book.hidden) return;
  book.classList.remove('is-open');
  if (!reduced) await new Promise((r) => setTimeout(r, 650));
  book.classList.remove('is-shown');
  if (!reduced && lastSpine) {
    const [from, to] = flipFrom(lastSpine);
    await obj.animate([{ transform: to, opacity: 1 }, { transform: from, opacity: 0 }], { duration: 420, easing: 'cubic-bezier(0.7, 0, 0.84, 0)' }).finished.catch(() => {});
  }
  book.hidden = true;
  $$('.spine').forEach((s) => s.classList.remove('is-out'));
  lastSpine?.focus({ preventScroll: true });
  openAlbum = null;
}
book.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) return closeBook();
  const r = e.target.closest('.row[data-f]');
  if (r) { shuffle = false; syncMode(); play(byF.get(r.dataset.f)); }
});
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBook(); });

/* ---------------- 播放 ---------------- */
function markPlaying() {
  const f = current?.f;
  $$('.row, .pick').forEach((r) => r.classList.toggle('is-playing', !!f && r.dataset.f === f));
  $$('.spine').forEach((s) => s.classList.toggle('is-playing', !!current && s.dataset.a === current.album.id));
  book.classList.toggle('is-playing', !!current && !audio.paused && openAlbum === current.album);
}
function load(t, at = 0) {
  current = t;
  audio.src = `music/${t.f}`;
  if (at) audio.addEventListener('loadedmetadata', () => { audio.currentTime = at; }, { once: true });
  player.hidden = false;
  player.style.setProperty('--bg', t.album.bg);
  $('[data-title]').textContent = t.t;
  $('[data-sub]').textContent = `${t.album.kind === 'studio' ? t.album.title + '　' + t.album.year : (t.src || t.album.title) + (t.y ? '　' + t.y : '')}${t.feat?.length ? '　和 ' + t.feat.join('、') : ''}`;
  document.title = `${t.t} · 骑士的唱片柜`;
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: t.t, artist: '蔡依林', album: t.album.kind === 'studio' ? t.album.title : (t.src || t.album.title) });
  }
  save();
  markPlaying();
}
async function play(t, at = 0) {
  if (!t) return;
  if (current !== t) { if (current) history.push(current); load(t, at); }
  try { await audio.play(); } catch (err) { console.warn('[唱片柜] 放不出来', err); }
}
function nextOf(t, dir = 1) {
  if (shuffle) {
    if (dir < 0 && history.length) return history.pop();
    const pool = data.favs.map((f) => byF.get(f)).filter((x) => x && x !== t);
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const i = tracks.indexOf(t);
  return tracks[(i + dir + tracks.length) % tracks.length];
}
const step = (dir) => { if (!current) return; const n = nextOf(current, dir); if (dir < 0 && shuffle) { current = null; } play(n); };

audio.addEventListener('play', () => { player.classList.add('is-playing'); markPlaying(); });
audio.addEventListener('pause', () => { player.classList.remove('is-playing'); markPlaying(); save(); });
audio.addEventListener('ended', () => step(1));
audio.addEventListener('error', () => {
  $('[data-sub]').textContent = '这首加载不出来　可能还没传到服务器上';
  player.classList.remove('is-playing');
});

const seek = $('[data-seek]');
const time = $('[data-time]');
let seeking = false;
audio.addEventListener('timeupdate', () => {
  if (seeking || !audio.duration) return;
  const p = audio.currentTime / audio.duration;
  seek.value = String(Math.round(p * 1000));
  seek.style.setProperty('--p', `${(p * 100).toFixed(2)}%`);
  time.textContent = `${mmss(audio.currentTime)} / ${mmss(audio.duration)}`;
});
seek.addEventListener('input', () => { seeking = true; seek.style.setProperty('--p', `${seek.value / 10}%`); });
seek.addEventListener('change', () => { if (audio.duration) audio.currentTime = (seek.value / 1000) * audio.duration; seeking = false; });

$('[data-toggle]').addEventListener('click', () => (audio.paused ? play(current) : audio.pause()));
$('[data-prev]').addEventListener('click', () => (audio.currentTime > 4 ? (audio.currentTime = 0) : step(-1)));
$('[data-next]').addEventListener('click', () => step(1));
const modeBtn = $('[data-mode]');
function syncMode() { modeBtn.setAttribute('aria-pressed', String(shuffle)); modeBtn.textContent = shuffle ? '随' : '序'; modeBtn.setAttribute('aria-label', shuffle ? '现在是随机　点一下改成按顺序' : '现在按顺序　点一下改成随机'); }
modeBtn.addEventListener('click', () => { shuffle = !shuffle; syncMode(); save(); });
$$('[data-open-current]').forEach((b) => b.addEventListener('click', () => current && openBook(current.album)));

const lucky = $('[data-lucky]');
lucky.addEventListener('click', () => {
  shuffle = true; syncMode();
  lucky.classList.remove('is-spin'); void lucky.offsetWidth; lucky.classList.add('is-spin');
  play(nextOf(current));
});

if ('mediaSession' in navigator) {
  const ms = navigator.mediaSession;
  ms.setActionHandler('play', () => play(current));
  ms.setActionHandler('pause', () => audio.pause());
  ms.setActionHandler('previoustrack', () => step(-1));
  ms.setActionHandler('nexttrack', () => step(1));
  try { ms.setActionHandler('seekto', (d) => { audio.currentTime = d.seekTime; }); } catch {}
}

/* ---------------- 记住上次放到哪 ---------------- */
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ f: current?.f, t: Math.floor(audio.currentTime || 0), shuffle })); } catch {}
}
addEventListener('pagehide', save);
const hash = new URLSearchParams(location.hash.slice(1));
const want = hash.get('t') && tracks.find((t) => t.t === hash.get('t'));
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
shuffle = !!saved.shuffle; syncMode();
if (want) { load(want); openBook(want.album); }
else if (saved.f && byF.get(saved.f)) load(byF.get(saved.f), saved.t || 0);
