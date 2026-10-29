// 尾声最后的回信：写好点「寄出」，信存到服务器（/api/letters），只有康康能在收信页看到。
// 没寄出去的草稿和她自己寄出过的信只存在这台手机里（localStorage），换手机就看不到，这是故意的。
const DRAFT = 'shuying:draft';
const SENT = 'shuying:sent';

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 隐私模式存不了就算了 */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* 同上 */ } },
};

const when = (iso) => {
  const [, m, d, hh, mm] = iso.match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/) || [];
  return m ? `${+m}月${+d}日　${hh}:${mm}` : '';
};

const REASON = {
  403: '要先在首页输入那四个数字',
  413: '太长了　分两封寄吧',
  429: '寄得太快了　过一分钟再寄',
  0: '网不太好',
};

export function init(el) {
  const form = el.querySelector('.reply__form');
  const ta = form.querySelector('textarea');
  const btn = form.querySelector('.reply__send');
  const count = form.querySelector('.reply__count');
  const status = form.querySelector('.reply__status');
  const sentBox = el.querySelector('.reply__sent');
  const list = el.querySelector('.reply__list');
  const max = +ta.getAttribute('maxlength') || 2000;
  let busy = false, saveT = 0;

  const paint = () => {
    const n = ta.value.trim().length;
    count.textContent = `${ta.value.length} / ${max}`;
    btn.disabled = busy || n === 0;
  };

  const renderSent = () => {
    const sent = store.get(SENT, []);
    sentBox.hidden = sent.length === 0;
    list.replaceChildren(...sent.slice().reverse().map((l) => {
      const li = document.createElement('li');
      const t = document.createElement('p'); t.className = 'reply__when'; t.textContent = when(l.time);
      const b = document.createElement('p'); b.className = 'reply__body'; b.textContent = l.text;
      li.append(t, b);
      return li;
    }));
  };

  ta.value = store.get(DRAFT, '');
  paint();
  renderSent();

  ta.addEventListener('input', () => {
    status.textContent = '';
    el.classList.remove('is-error', 'is-done');
    paint();
    clearTimeout(saveT);
    saveT = setTimeout(() => (ta.value ? store.set(DRAFT, ta.value) : store.del(DRAFT)), 400);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = ta.value.trim();
    if (!text || busy) return;
    busy = true;
    btn.setAttribute('aria-busy', 'true');
    btn.textContent = '寄出中';
    paint();
    let res = null, code = 0;
    try {
      const r = await fetch('api/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        cache: 'no-store',
      });
      code = r.status;
      if (r.ok) res = await r.json();
    } catch { code = 0; }
    busy = false;
    btn.removeAttribute('aria-busy');
    btn.textContent = '寄出';

    if (res?.ok) {
      const sent = store.get(SENT, []);
      sent.push({ time: res.time, text });
      store.set(SENT, sent);
      store.del(DRAFT);
      ta.value = '';
      status.textContent = `寄出去了　${when(res.time)}`;
      el.classList.add('is-done');
      renderSent();
    } else {
      status.textContent = `没寄出去　${REASON[code] || '服务器没回话'}　信还在　等会儿再点一次`;
      el.classList.add('is-error');
    }
    paint();
  });
}
