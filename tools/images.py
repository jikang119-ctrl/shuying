"""raw 照片 -> site/photos/pNN-{480,960,1600}.webp + manifest.json

用法: python tools/images.py <raw 目录>
raw 目录里的文件名以两位编号开头（01_xxx.jpg），编号就是 story.json 里的 pNN。
"""
import base64, io, json, os, sys
from concurrent.futures import ProcessPoolExecutor
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'site', 'photos')
WIDTHS = (480, 960, 1600)


def one(path):
    pid = 'p' + os.path.basename(path)[:2]
    im = ImageOps.exif_transpose(Image.open(path)).convert('RGB')
    w, h = im.size
    done = []
    for tw in WIDTHS:
        if tw > w and done:
            break
        tw = min(tw, w)
        th = round(h * tw / w)
        im.resize((tw, th), Image.LANCZOS).save(
            os.path.join(OUT, f'{pid}-{tw}.webp'), 'WEBP', quality=76 if tw < 1600 else 72, method=6)
        done.append(tw)
    tiny = im.resize((16, max(1, round(16 * h / w))), Image.LANCZOS)
    buf = io.BytesIO(); tiny.save(buf, 'WEBP', quality=40)
    r, g, b = im.resize((1, 1), Image.LANCZOS).getpixel((0, 0))
    return pid, {'w': w, 'h': h, 'sizes': done,
                 'lqip': 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode(),
                 'color': f'#{r:02x}{g:02x}{b:02x}'}


if __name__ == '__main__':
    src = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    files = sorted(os.path.join(src, f) for f in os.listdir(src) if f[:2].isdigit())
    with ProcessPoolExecutor() as ex:
        manifest = dict(ex.map(one, files))
    with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print(len(manifest), 'photos')
