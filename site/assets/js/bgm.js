// 进门就放一首她的歌：从唱片柜的心头好（music.json 的 favs）里随机挑，放完接着随机。
// 浏览器不让没点过的页面出声：被拦就等她第一下点按再放（iOS 要求 play() 在点按里直接调，所以曲库先取好）。
// 右下角一张小唱片：点开能暂停、换一首、去唱片柜。和七 骑士章的歌单互斥：谁开始放就广播 shuying:play，别人听到就停。
const KEY = 'shuying.music';     // 和唱片柜共用：从这里去唱片柜接着放这首，从唱片柜回来也接着放
const WAIT = '点一下　放一首你爱听的';

export async function init() {
  let data;
  try { data = await fetch('assets/data/music.json').then((r) => r.json()); } catch { return; }
  const byF = new Map();
  for (const a of data.albums) for (const t of a.tracks) if (t.f) byF.set(t.f, { ...t, album: a });
  const pool = data.favs.map((f) => byF.get(f)).filter(Boolean);
  if (!pool.length) return;
  const pick = (not) => { const p = pool.filter((t) => t !== not); return p[Math.floor(Math.random() * p.length)] || pool[0]; };

  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}

  const el = document.createElement('div');
  el.className = 'bgm';
  el.innerHTML = `
  <div class="bgm__card" id="bgm-card" role="group" aria-label="正在放的歌">
    <p class="bgm__kicker">正在放</p>
    <p class="bgm__title" data-t></p>
    <p class="bgm__sub" data-s></p>
    <div class="bgm__row">
      <button type="button" data-toggle>暂停</button>
      <button type="button" data-next>换一首</button>
      <a href="music.html">唱片柜<span aria-hidden="true">→</span></a>
    </div>
  </div>
  <p class="bgm__now" aria-live="polite"></p>
  <button class="bgm__disc" type="button" aria-expanded="false" aria-controls="bgm-card" aria-label="正在放的歌"><span></span></button>`;
  document.body.append(el);
  const $ = (s) => el.querySelector(s);
  const disc = $('.bgm__disc');
  const now = $('.bgm__now');
  const toggle = $('[data-toggle]');

  const audio = new Audio();
  audio.preload = 'none';
  let cur = null;
  let started = false;     // 真的放出过声音才记进 localStorage
  let fails = 0;
  let tellTimer = 0;

  const tell = (text, ms = 4000) => {
    clearTimeout(tellTimer);
    now.textContent = text;
    el.classList.add('is-telling');
    if (ms) tellTimer = setTimeout(() => el.classList.remove('is-telling'), ms);
  };
  const open = (on) => {
    el.classList.toggle('is-open', on);
    disc.setAttribute('aria-expanded', String(on));
    if (on) el.classList.remove('is-telling');
  };

  function load(t, at = 0) {
    cur = t;
    audio.src = `music/${t.f}`;
    if (at) audio.addEventListener('loadedmetadata', () => { audio.currentTime = at; }, { once: true });
    const where = t.album.kind === 'studio' ? `${t.album.title}　${t.album.year}` : (t.src || t.album.title);
    $('[data-t]').textContent = t.t;
    $('[data-s]').textContent = `蔡依林　${where}`;
    el.style.setProperty('--bg', t.album.bg);
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: t.t, artist: '蔡依林', album: t.album.kind === 'studio' ? t.album.title : (t.src || t.album.title) });
    }
  }
  function play() {
    dispatchEvent(new CustomEvent('shuying:play', { detail: audio }));
    return audio.play().then(() => { disarm(); started = true; fails = 0; }, (err) => {
      if (err.name === 'NotAllowedError') arm();
      else disarm();            // 被别的歌打断（AbortError）之类：不再等点按
    });
  }
  const next = () => { load(pick(cur)); play(); };

  // ---- 被拦了：等第一下点按 ----
  let armed = false;
  const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'];
  // 第一下要是点了骑士章的歌：那边会广播 shuying:play 把这边停掉，play() 收到 AbortError 就撤掉等待
  const onGesture = (e) => { if (!el.contains(e.target)) play(); };
  function arm() {
    if (armed) return;
    armed = true;
    el.classList.add('is-waiting');
    tell(WAIT, 0);
    GESTURES.forEach((g) => addEventListener(g, onGesture, { capture: true, passive: true }));
  }
  function disarm() {
    if (!armed) return;
    armed = false;
    el.classList.remove('is-waiting');
    GESTURES.forEach((g) => removeEventListener(g, onGesture, { capture: true }));
  }

  audio.addEventListener('play', () => { el.classList.add('is-playing'); toggle.textContent = '暂停'; tell(cur.t); });
  audio.addEventListener('pause', () => { el.classList.remove('is-playing'); toggle.textContent = '接着放'; });
  audio.addEventListener('ended', next);
  audio.addEventListener('error', () => {
    if (++fails < 3) return next();
    el.classList.remove('is-playing');
    $('[data-s]').textContent = '这几首加载不出来　可能还没传到服务器上';
  });
  addEventListener('shuying:play', (e) => { if (e.detail !== audio) audio.pause(); });

  disc.addEventListener('click', () => (armed ? play() : open(!el.classList.contains('is-open'))));
  toggle.addEventListener('click', () => (audio.paused ? play() : audio.pause()));
  $('[data-next]').addEventListener('click', next);
  addEventListener('pointerdown', (e) => { if (!el.contains(e.target)) open(false); }, { passive: true });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') open(false); });
  // 手机上写回信时键盘弹起来，右下角别挡着输入框
  addEventListener('focusin', (e) => el.classList.toggle('is-hidden', !!e.target.closest?.('input, textarea')));
  addEventListener('focusout', () => el.classList.remove('is-hidden'));

  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => play());
    ms.setActionHandler('pause', () => audio.pause());
    ms.setActionHandler('nexttrack', next);
  }
  addEventListener('pagehide', () => {
    if (!started || !cur) return;
    try { localStorage.setItem(KEY, JSON.stringify({ ...saved, f: cur.f, t: Math.floor(audio.currentTime || 0) })); } catch {}
  });

  // 从唱片柜回来：接着放那边那首；否则随机挑一首（不挑上次那首）
  const back = /music\.html/.test(document.referrer) && byF.get(saved.f);
  if (back) load(back, saved.t || 0);
  else load(pick(byF.get(saved.f)));
  play();
}
