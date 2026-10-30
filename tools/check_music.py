"""核对曲库：site/assets/data/music.json 里引用的每个音频文件，在 --dir 里是不是都有。

用法:
  python -X utf8 tools/check_music.py --dir D:/projects/shuying-music

全对打印「齐了」并退出 0；缺了就列出缺哪些（歌名 + 文件名）并退出 1。
多出来的文件只提示不算错（--prune 过的曲库不会有）。
"""
import argparse, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ap = argparse.ArgumentParser()
ap.add_argument('--dir', default=os.path.join(ROOT, 'site', 'music'))
args = ap.parse_args()

data = json.load(open(os.path.join(ROOT, 'site', 'assets', 'data', 'music.json'), encoding='utf-8'))
want = {t['f']: t['t'] for a in data['albums'] for t in a['tracks'] if t.get('f')}
have = set(os.listdir(args.dir)) if os.path.isdir(args.dir) else set()
missing = sorted(set(want) - have)
extra = sorted(f for f in have - set(want) if f.lower().endswith(('.mp3', '.m4a', '.flac')))   # README、.git 不算
size = sum(os.path.getsize(os.path.join(args.dir, f)) for f in want if f in have) / 1e9

print(f'music.json 要 {len(want)} 个文件，{args.dir} 里有 {len(want) - len(missing)} 个（{size:.2f} GB）')
for f in missing:
    print(f'  缺 {f}  {want[f]}')
if extra:
    print(f'  多出 {len(extra)} 个不在曲库里的文件（不影响，可以不传）')
if missing:
    sys.exit(1)
print('齐了')
