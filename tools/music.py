"""蔡依林的歌：把下载下来的音频整理成站点用的曲库。

用法:
  python -X utf8 tools/music.py --src D:/projects/jolin/raw --out D:/projects/shuying-music

- 扫 --src 下所有 mp3/m4a/flac，按文件名认歌，对照 content/jolin-songs.tsv（中文维基「蔡依林歌曲列表」222 首）
- 同一首歌有多个文件：时长差不到 15 秒算重复只留一个，差得多算另一个版本都留
- 不重新编码（这台电脑转码太慢，原文件已经是 320k MP3 / 256k AAC），只换容器标签：
  去掉下载站塞进标签里的水印，写回干净的歌名/歌手/专辑；m4a 加 faststart 方便边下边播
  文件名是歌名的哈希加原扩展名，和曲序无关；已经有的跳过；--prune 删掉 --out 里不在曲库的旧文件
- 写 content/music-catalog.json：每首歌对应哪个文件、多长、属于哪张专辑（不含音频，进仓库）

音频不进这个仓库，在私有仓库 jikang119-ctrl/shuying-music（--out 指的那个目录就是它的工作区）。部署照 DEPLOY.md「唱片柜」一节，传之前用 tools/check_music.py 核对。
"""
import argparse, concurrent.futures as cf, hashlib, json, os, re, shutil, subprocess, sys

from mutagen import File
from opencc import OpenCC

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cc = OpenCC('t2s')
FFMPEG = shutil.which('ffmpeg') or r'D:\tools\ffmpeg\ffmpeg.exe'

# 下载站的写法 → 维基的写法（都先转简体、去空格标点再比）
ALIAS = {'thanku': 'thankyou', 'getthispartystarted': 'getthepartystarted', 'whenusaynothingatall': 'whenyousaynothingatall',
         '爱情36计': '爱情三十六计', '爱上一条街': '爱上了一条街', '台湾心跳声': '台湾的心跳声', '实时生效': '即时生效',
         '追杀丘比特': '追杀邱比特', '漂浮': '飘浮', '说爱妳': '说爱你', '今天你要嫁给我': '今天妳要嫁给我',
         'sugarsuqar': 'sugarsugar', 'goodgirl': '我超会'}
# 维基表里没有、但确实是她的歌的（专辑插曲 / 加长版）
EXTRA = {'thedivinecomedypurgatorio': ('The Divine Comedy: Purgatorio', 'Pleasure', '2025'),
         'hushlittlebaby': ('Hush Little Baby', 'Pleasure', '2025'),
         'myself': ('Myself', 'Myself', '2010')}


def norm(s):
    s = cc.convert(s).lower()
    s = re.sub(r"[\s\u2060\u200b\-·'’.,，!！（）()_:：&]", '', s)
    return ALIAS.get(s, s)


def load_wiki():
    songs = {}
    for line in open(os.path.join(ROOT, 'content', 'jolin-songs.tsv'), encoding='utf-8'):
        t, a, y = line.rstrip('\n').split('|')
        songs[norm(t)] = dict(title=cc.convert(t), album=a, year=y)
    for k, (t, a, y) in EXTRA.items():
        songs.setdefault(k, dict(title=t, album=a, year=y, extra=True))
    return songs


def parse_name(path):
    base = os.path.splitext(os.path.basename(path))[0]
    m = re.match(r'^\d+\s+(.+)$', base)            # Pleasure 那包：「01 Layers」
    if m:
        return '蔡依林', m.group(1).replace('_', ':' if 'Comedy' in base else "'").strip()
    m = re.match(r'^(.*?)\s*-\s*(.+)$', base)        # 熊猫那包：「蔡依林&周杰伦-布拉格广场」
    return (m.group(1).strip(), m.group(2).strip()) if m else ('', base)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--jobs', type=int, default=4)
    ap.add_argument('--prune', action='store_true')
    args = ap.parse_args()

    wiki = load_wiki()
    found, unknown = {}, []
    for d, _, fs in os.walk(args.src):
        for f in sorted(fs):
            if not f.lower().endswith(('.mp3', '.m4a', '.flac')):
                continue
            p = os.path.join(d, f)
            artist, title = parse_name(p)
            k = norm(title)
            if k not in wiki:
                unknown.append(f)
                continue
            dur = File(p).info.length
            feat = [x for x in re.split(r'[&＆]', artist) if x and '蔡依林' not in x]
            found.setdefault(k, []).append(dict(src=p, dur=dur, feat=feat))

    catalog = []
    for k, files in found.items():
        files.sort(key=lambda x: (-len(x['feat']), -x['dur']))      # 有合唱信息、更长的优先
        kept = []
        for f in files:
            if all(abs(f['dur'] - g['dur']) >= 15 for g in kept):
                kept.append(f)
        for i, f in enumerate(kept):
            w = wiki[k]
            fid = hashlib.sha1(f'{k}#{i}'.encode()).hexdigest()[:10]
            ext = os.path.splitext(f['src'])[1].lower()
            catalog.append(dict(key=k, title=w['title'], album=w['album'], year=w['year'], extra=bool(w.get('extra')),
                                feat=f['feat'], version=i, file=f'{fid}{ext}', dur=round(f['dur']), src=os.path.basename(f['src'])))
    catalog.sort(key=lambda s: (s['year'], s['album'], s['title']))

    os.makedirs(args.out, exist_ok=True)
    srcmap = {(c['key'], c['version']): next(x['src'] for x in sorted(found[c['key']], key=lambda x: (-len(x['feat']), -x['dur']))
                                              if abs(x['dur'] - c['dur']) < 1.5) for c in catalog}

    def conv(c):
        dst = os.path.join(args.out, c['file'])
        if os.path.exists(dst) and os.path.getsize(dst) > 10000:
            return 'skip'
        ext = os.path.splitext(dst)[1]
        tmp = dst + '.part' + ext
        fmt = ['-id3v2_version', '3', '-write_id3v1', '0'] if ext == '.mp3' else ['-movflags', '+faststart']
        cmd = [FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-i', srcmap[(c['key'], c['version'])],
               '-map', '0:a:0', '-map_metadata', '-1', '-vn', '-c:a', 'copy',
               '-metadata', f"title={c['title']}", '-metadata', 'artist=蔡依林', '-metadata', f"album={cc.convert(c['album'])}",
               *fmt, tmp]
        subprocess.run(cmd, check=True)
        os.replace(tmp, dst)
        return 'ok'

    done = {'ok': 0, 'skip': 0}
    with cf.ThreadPoolExecutor(args.jobs) as ex:
        for i, r in enumerate(ex.map(conv, catalog), 1):
            done[r] += 1
            if i % 20 == 0:
                print(f'  {i}/{len(catalog)}', flush=True)

    if args.prune:
        keep = {c['file'] for c in catalog}
        gone = [n for n in os.listdir(args.out) if n not in keep and n.lower().endswith(('.mp3', '.m4a', '.flac'))]   # README、.git 留着
        for n in gone:
            os.remove(os.path.join(args.out, n))
        print(f'清掉不在曲库里的旧文件 {len(gone)} 个')
    json.dump(dict(count=len(catalog), songs=catalog), open(os.path.join(ROOT, 'content', 'music-catalog.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    have = {c['key'] for c in catalog}
    missing = [w['title'] for k, w in wiki.items() if k not in have and not w.get('extra')]
    size = sum(os.path.getsize(os.path.join(args.out, c['file'])) for c in catalog) / 1e6
    print(f'曲库 {len(catalog)} 个文件（{len(have)} 首，{done["ok"]} 新转 / {done["skip"]} 跳过），{size:.0f} MB → {args.out}')
    print(f'认不出的文件 {len(unknown)}: {unknown}')
    print(f'维基 222 首里还缺 {len(missing)} 首')


if __name__ == '__main__':
    sys.exit(main())
