// content/story.json + site/photos/manifest.json -> site/index.html
// 用法：node tools/build.mjs
// 每一章的 HTML 由 tools/sections/<kind>.mjs 生成，接口见 README「章节模块」。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const story = read('content/story.json');
const manifest = read('site/photos/manifest.json');
const map = read('content/map.json');
const chatDays = fs.existsSync(path.join(ROOT, 'content', 'chat-days.json')) ? read('content/chat-days.json') : { until: '', days: {} };
for (const ch of story.chapters) if (ch.kind === 'clock') ch._chat = chatDays;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function photo(id) {
  const p = manifest[id];
  if (!p) throw new Error(`story.json 引用了不存在的照片 ${id}`);
  return p;
}

const src = (id, w) => {
  const p = photo(id);
  const pick = p.sizes.find((s) => s >= w) ?? p.sizes[p.sizes.length - 1];
  return `photos/${id}-${pick}.webp`;
};
const srcset = (id) => photo(id).sizes.map((w) => `photos/${id}-${w}.webp ${w}w`).join(', ');

// <img>：带 srcset、宽高（防跳动）、16px 模糊底图（加载前先看到颜色和轮廓）
function img(id, { sizes = '100vw', cls = '', eager = false, alt = '', attrs = '', pos = '' } = {}) {
  const p = photo(id);
  return `<img${cls ? ` class="${cls}"` : ''} src="${src(id, 960)}" srcset="${srcset(id)}" sizes="${sizes}" width="${p.w}" height="${p.h}" alt="${esc(alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async"${eager ? ' fetchpriority="high"' : ''} style="background-color:${p.color};background-image:url(${p.lqip})${pos ? `;object-position:${pos}` : ''}" data-photo="${id}"${pos ? ` data-focus="${pos}"` : ''}${attrs ? ' ' + attrs : ''}>`;
}

// 全角空格是白描里的停顿：停顿之间的词组不折行，只在停顿处换行
const seg = (text) => String(text).split('　').map((t) => `<span class="seg">${esc(t)}</span>`).join('　');
const lines = (arr, cls = 'ln') => arr.map((l, i) => `<span class="${cls}" style="--i:${i}">${seg(l)}</span>`).join('');

const head = (ch) => `<header class="ch-head"><p class="ch-no">${esc(ch.no)}</p><h2 class="ch-title">${esc(ch.title)}</h2>${ch.lede && typeof ch.lede === 'string' ? `<p class="ch-lede">${esc(ch.lede)}</p>` : ''}</header>`;

function section(ch, inner, { theme = 'paper', cls = '', withHead = true, module = ch.kind } = {}) {
  return `<section class="ch ch--${ch.kind}${theme === 'night' ? ' ch--night night' : ''}${cls ? ' ' + cls : ''}" id="${ch.id}" data-chapter="${esc(ch.no + '　' + ch.title)}"${theme === 'night' ? ' data-night' : ''}${module ? ` data-module="${module}"` : ''}>
${withHead ? head(ch) : ''}${inner}
</section>`;
}

// 南京地图：把经纬度换成 map.json 画布坐标
const mapProject = (lng, lat) => {
  const { k, x0, y1, s } = map.proj;
  return [(lng * k - x0) * s, (y1 - lat) * s];
};

const ctx = { story, manifest, map, esc, seg, photo, src, srcset, img, lines, head, section, mapProject };

async function render(ch) {
  const file = path.join(ROOT, 'tools', 'sections', `${ch.kind}.mjs`);
  if (!fs.existsSync(file)) return section(ch, `<p class="todo">这一章还在写：${esc(ch.kind)}</p>`, { module: '' });
  const mod = await import(pathToFileURL(file).href + `?t=${Date.now()}`);
  return mod.default(ch, ctx);
}

const core = await import(pathToFileURL(path.join(ROOT, 'tools', 'sections', 'core.mjs')).href);
const chapters = [];
for (const ch of story.chapters) chapters.push(await render(ch));

// 每章自己的 css 有就链上
const cssFiles = ['base', ...new Set(story.chapters.map((c) => c.kind)), 'lightbox', 'reply']
  .filter((n) => fs.existsSync(path.join(ROOT, 'site', 'assets', 'css', `${n}.css`)));
const ver = Date.now().toString(36);

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#f3eee6">
<meta name="format-detection" content="telephone=no">
<title>${esc(story.meta.title)}</title>
<link rel="icon" href="assets/img/icon.svg" type="image/svg+xml">
<link rel="preload" href="assets/fonts/serif-600.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/serif-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" as="image" href="${src(story.cover.photo, 960)}" imagesrcset="${srcset(story.cover.photo)}" imagesizes="100vw">
${cssFiles.map((n) => `<link rel="stylesheet" href="assets/css/${n}.css?v=${ver}">`).join('\n')}
<script type="module" src="assets/js/main.js?v=${ver}"></script>
</head>
<body>
${core.bookmark(story, ctx)}
<main>
${core.cover(story, ctx)}
${core.prologue(story, ctx)}
${chapters.join('\n')}
${core.finale(story, ctx)}
</main>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'site', 'index.html'), html);
console.log(`site/index.html ${(html.length / 1024).toFixed(1)} KB · ${story.chapters.length} 章 · css: ${cssFiles.join(', ')}`);
