"""content/nanjing.geo.json（DataV 南京区县边界） -> content/map.json（投影好的 SVG path）

投影：等距圆柱，经度乘 cos(纬度中值)，画布宽 1000。
map.json 里带 proj 参数，build.mjs 用同一套公式把经纬度换成画布坐标。
"""
import json, math, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
geo = json.load(open(os.path.join(ROOT, 'content', 'nanjing.geo.json'), encoding='utf-8'))

rings = []
for f in geo['features']:
    g = f['geometry']
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    for poly in polys:
        for ring in poly:
            rings.append((f['properties']['name'], ring))

lngs = [p[0] for _, r in rings for p in r]; lats = [p[1] for _, r in rings for p in r]
k = math.cos(math.radians((min(lats) + max(lats)) / 2))
x0, x1, y1 = min(lngs) * k, max(lngs) * k, max(lats)
W = 1000; s = W / (x1 - x0)
H = round((y1 - min(lats)) * s)


def proj(lng, lat):
    return (lng * k - x0) * s, (y1 - lat) * s


def simplify(pts, tol=1.2):
    out = [pts[0]]
    for p in pts[1:]:
        if math.dist(p, out[-1]) >= tol:
            out.append(p)
    return out


districts = {}
for name, ring in rings:
    pts = simplify([proj(*p) for p in ring])
    if len(pts) < 4:
        continue
    d = 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + 'Z'
    districts.setdefault(name, []).append(d)

out = {'viewBox': f'0 0 {W} {H}', 'proj': {'k': k, 'x0': x0, 'y1': y1, 's': s},
       'districts': [{'name': n, 'd': ''.join(ds)} for n, ds in districts.items()]}
json.dump(out, open(os.path.join(ROOT, 'content', 'map.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print(W, H, sum(len(d['d']) for d in out['districts']), 'chars', [d['name'] for d in out['districts']])
