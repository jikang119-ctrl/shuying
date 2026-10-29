"""把思源宋体（Noto Serif SC）和 Cormorant Garamond 裁成只含本站用到的字，输出 woff2。

用法: python tools/fonts.py
- 扫 site/index.html、site/lock.html、site/assets/js/*.js 里出现的所有字符
- 原始字体放在 tools/.fonts/（不进 git），没有就自动从 GitHub 下载
- 文案改了以后要重跑这一步，否则新字会退回系统宋体
"""
import glob, os, re, urllib.request
from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', '.fonts')
OUT = os.path.join(ROOT, 'site', 'assets', 'fonts')
URLS = {
    'NotoSerifSC-Regular.otf': 'https://github.com/notofonts/noto-cjk/raw/main/Serif/SubsetOTF/SC/NotoSerifSC-Regular.otf',
    'NotoSerifSC-SemiBold.otf': 'https://github.com/notofonts/noto-cjk/raw/main/Serif/SubsetOTF/SC/NotoSerifSC-SemiBold.otf',
    'CormorantGaramond[wght].ttf': 'https://github.com/google/fonts/raw/main/ofl/cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf',
    'CormorantGaramond-Italic[wght].ttf': 'https://github.com/google/fonts/raw/main/ofl/cormorantgaramond/CormorantGaramond-Italic%5Bwght%5D.ttf',
}


def ensure():
    os.makedirs(SRC, exist_ok=True)
    for name, url in URLS.items():
        p = os.path.join(SRC, name)
        if not os.path.exists(p):
            print('下载', name)
            urllib.request.urlretrieve(url, p)


def chars():
    text = ''
    files = [os.path.join(ROOT, 'site', 'index.html'), os.path.join(ROOT, 'site', 'lock.html')]
    files += glob.glob(os.path.join(ROOT, 'site', 'assets', 'js', '*.js'))
    for f in files:
        if os.path.exists(f):
            text += open(f, encoding='utf-8').read()
    text = re.sub(r'data:[^")\s]+', '', text)   # 去掉内联的 base64 底图
    # 常用标点和数字始终带上
    text += '０１２３４５６７８９　，。、：；！？「」『』《》（）——……·・〇一二三四五六七八九十百千年月日天时分秒'
    return ''.join(sorted(set(c for c in text if ord(c) >= 32)))


def cut(src, dst, text, extra=()):
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    opts.desubroutinize = True
    for k, v in extra:
        setattr(opts, k, v)
    font = subset.load_font(src, opts)
    s = subset.Subsetter(opts)
    s.populate(text=text)
    s.subset(font)
    subset.save_font(font, dst, opts)
    return os.path.getsize(dst)


if __name__ == '__main__':
    ensure()
    os.makedirs(OUT, exist_ok=True)
    t = chars()
    latin = ''.join(chr(c) for c in range(32, 127)) + '·–—‘’“”…'
    sizes = {
        'serif-400.woff2': cut(os.path.join(SRC, 'NotoSerifSC-Regular.otf'), os.path.join(OUT, 'serif-400.woff2'), t),
        'serif-600.woff2': cut(os.path.join(SRC, 'NotoSerifSC-SemiBold.otf'), os.path.join(OUT, 'serif-600.woff2'), t),
        'num.woff2': cut(os.path.join(SRC, 'CormorantGaramond[wght].ttf'), os.path.join(OUT, 'num.woff2'), latin),
        'num-italic.woff2': cut(os.path.join(SRC, 'CormorantGaramond-Italic[wght].ttf'), os.path.join(OUT, 'num-italic.woff2'), latin),
    }
    print(len(t), '个字符;', ', '.join(f'{k} {v // 1024} KB' for k, v in sizes.items()))
