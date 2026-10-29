"""content/music-catalog.json + content/jolin-tracklists.json -> site/assets/data/music.json（唱片柜页面读这个）

用法: python -X utf8 tools/music_build.py
专辑顺序、配色、她喜欢的歌和备注都在这个文件里改。
"""
import json, os, re
from opencc import OpenCC

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cc = OpenCC('t2s')
rd = lambda p: json.load(open(os.path.join(ROOT, p), encoding='utf-8'))

# 每张专辑一本书：显示名、副名、发行日、封面底色、字色
STUDIO = [
    ('1019', '1019', '第一张专辑', '1999-09-10', '#cfd8dc', '#1d2a31'),
    ("Don't Stop", "Don't Stop", '', '2000-04-26', '#e6c24a', '#2a220c'),
    ('Show Your Love', 'Show Your Love', '', '2000-12-22', '#e6a2b4', '#3a1522'),
    ('Lucky Number', 'Lucky Number', '', '2001-07-07', '#e2793a', '#2a1105'),
    ('看我72變', '看我72变', 'Magic', '2003-03-07', '#6a2d8b', '#f5e8ff'),
    ('城堡', '城堡', 'Castle', '2004-02-27', '#263f69', '#e8eef7'),
    ('J-Game', 'J-Game', '', '2005-04-25', '#1d6b59', '#e6f5f0'),
    ('舞孃', '舞娘', 'Dancing Diva', '2006-05-12', '#9a1c29', '#fbe7d2'),
    ('特務J', '特务J', 'Agent J', '2007-09-21', '#1c1b1d', '#e2c079'),
    ('愛的練習語', '爱的练习语', 'Love Exercise', '2008-10-31', '#efc8ce', '#4a1c2a'),
    ('花蝴蝶', '花蝴蝶', 'Butterfly', '2009-03-27', '#4a2969', '#f2d6ff'),
    ('Myself', 'Myself', '', '2010-08-13', '#d9d3c5', '#232220'),
    ('Muse', 'Muse', '', '2012-09-14', '#2c5d7a', '#e9f3f9'),
    ('呸', '呸', 'Play', '2014-11-15', '#c41f2e', '#fff2e6'),
    ('Ugly Beauty', 'Ugly Beauty', '怪美的', '2018-12-26', '#d8798b', '#2a0e16'),
    ('Pleasure', 'Pleasure', '', '2025-07-25', '#5a0e1b', '#f5d5c8'),
]
COMPS = ['J9 新歌+Party精選', 'J1演唱會 影音全記錄', 'J-Top 冠軍精選', '唯舞獨尊 演唱會鮮聽版&混音', 'J世紀 2006—2009大牌新曲+精選盤']
COMP_BOOK = ('comps', '精选里的新歌', 'J9 · J1 · J-Top · 唯舞独尊 · J 世纪', '2004 — 2009', '#8b7b5d', '#fbf3e4')
SINGLE_BOOK = ('singles', '单曲　合作　原声', '专辑之外', '2000 — 2026', '#3a3e39', '#ece5d6')

# 她自己说过的（聊天记录里的原话改写成短句）
NOTES = {
    '七上八下': '你入坑的那首', '亲爱的对象': '你私藏的　说不推荐给任何人', '做一天的你': '你的典藏', '诗人漫步': '你的典藏',
    '我的依赖': '你的典藏', '玫瑰少年': 'MV 你看了无数遍', '如果我没有伤口': '当了你六年的铃声', '骑士精神': '你们叫骑士',
    '怪美的': '你推给我的', '红衣女孩': '你推给我的', '恋我癖': '你推给我的', 'Pillow': '你推给我的',
}
# 「随便放一首」从这里挑：她的心头好 + 公认好听的
FAVS = list(NOTES) + ['布拉格广场', '说爱你', '倒带', '日不落', '舞娘', '大艺术家', '爱情三十六计', '天空', '你也有今天',
                      '美人计', '柠檬草的味道', '看我72变', '第三人称', '消极掰', '甜秘密', '爱的罗曼死', '野蛮游戏', '许愿池的希腊少女']


def key(t):
    return re.sub(r"[\s\-·'’.,，!！（）()_:：&]", '', cc.convert(t).lower())


def main():
    cat = rd('content/music-catalog.json')['songs']
    tl_path = os.path.join(ROOT, 'content', 'jolin-tracklists.json')
    tracklists = rd('content/jolin-tracklists.json') if os.path.exists(tl_path) else {}
    wiki = [l.rstrip('\n').split('|') for l in open(os.path.join(ROOT, 'content', 'jolin-songs.tsv'), encoding='utf-8')]

    by_title = {}
    for s in cat:
        by_title.setdefault(key(s['title']), []).append(s)

    def track(title, year=None, album=None):
        t = cc.convert(title)
        files = sorted(by_title.get(key(t), []), key=lambda s: s['version'])
        out = []
        for i, s in enumerate(files or [None]):
            name = t if i == 0 else f'{t}（另一版）'
            row = {'t': name, 'f': s['file'] if s else None, 'd': s['dur'] if s else 0}
            if s and s['feat']: row['feat'] = s['feat']
            if t in NOTES and i == 0: row['note'] = NOTES[t]
            if year: row['y'] = year
            out.append(row)
        return out

    def ordered(album_tw):
        names = tracklists.get(album_tw) or [w[0] for w in wiki if w[1] == album_tw]
        extra = [s['title'] for s in cat if s['album'] == album_tw and s['extra']]
        return names + extra

    albums = []
    for i, (tw, title, sub, date, bg, ink) in enumerate(STUDIO, 1):
        tracks = [r for n in ordered(tw) for r in track(n)]
        albums.append(dict(id=f'a{i:02d}', no=f'{i:02d}', title=title, sub=sub, date=date, year=date[:4], kind='studio',
                           bg=bg, ink=ink, tracks=tracks))
    comp_tracks = [r for a in COMPS for n in ordered(a) for r in track(n, year=next(w[2] for w in wiki if w[1] == a))]
    albums.append(dict(id='comps', no='', title=COMP_BOOK[1], sub=COMP_BOOK[2], date=COMP_BOOK[3], year='2004', kind='more',
                       bg=COMP_BOOK[4], ink=COMP_BOOK[5], tracks=comp_tracks))
    rest = sorted([w for w in wiki if w[1] not in [s[0] for s in STUDIO] + COMPS], key=lambda w: (w[2], cc.convert(w[0])))
    albums.append(dict(id='singles', no='', title=SINGLE_BOOK[1], sub=SINGLE_BOOK[2], date=SINGLE_BOOK[3], year='2000', kind='more',
                       bg=SINGLE_BOOK[4], ink=SINGLE_BOOK[5],
                       tracks=[dict(r, src=cc.convert(w[1]) if w[1] != '不適用' else '单曲') for w in rest for r in track(w[0], year=w[2])]))

    favs = []
    for a in albums:
        for t in a['tracks']:
            if t['f'] and t['t'] in FAVS and t['f'] not in favs:
                favs.append(t['f'])
    have = sum(1 for a in albums for t in a['tracks'] if t['f'])
    miss = [t['t'] for a in albums for t in a['tracks'] if not t['f']]
    data = dict(artist='蔡依林', have=have, missing=len(miss), albums=albums, favs=favs)
    os.makedirs(os.path.join(ROOT, 'site', 'assets', 'data'), exist_ok=True)
    json.dump(data, open(os.path.join(ROOT, 'site', 'assets', 'data', 'music.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'music.json：{len(albums)} 本 · 能放 {have} 首 · 还缺 {len(miss)} 首 · 随机池 {len(favs)} 首 · 曲序来自 {len(tracklists)} 张专辑')
    print('缺：', '、'.join(miss))


if __name__ == '__main__':
    main()
