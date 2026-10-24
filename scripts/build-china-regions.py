#!/usr/bin/env python3
"""Reproduce national-scale reference regions from Jiang et al. (2023), Fig. 2.

The published dividers are digitized, georeferenced with the figure's graticule,
and clipped to the site's existing Natural Earth country geometry. They are
not an official or survey boundary dataset. Requires numpy and shapely.
"""
import hashlib
import json
from pathlib import Path
import numpy as np
from shapely.geometry import Point, Polygon, shape, mapping
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
def read(path): return json.loads((ROOT / path).read_text())
def sha(path): return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
def write(path, value): (ROOT / path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
trace_path = 'scripts/china-region-digitization.json'
trace = read(trace_path)
raw_source = ROOT / 'data/raw/area-review/nhess-23-3747-2023.pdf'
if raw_source.exists():
    assert hashlib.sha256(raw_source.read_bytes()).hexdigest() == trace['source']['sha256'], 'Source PDF changed'
n, A, cx, cy, lon0 = trace['georeferencing']['parameters']
def project(x, y, z=None):
    lon, lat = np.radians(x), np.radians(y)
    angle = n * (lon - lon0)
    radius = A * np.tan(np.pi / 4 + lat / 2) ** -n
    return cx + radius * np.sin(angle), cy + radius * np.cos(angle)
def unproject(x, y, z=None):
    dx, dy = np.asarray(x) - cx, np.asarray(y) - cy
    radius = np.hypot(dx, dy)
    return np.degrees(lon0 + np.arctan2(dx, dy) / n), np.degrees(2 * np.arctan((A / radius) ** (1 / n)) - np.pi / 2)

controls = np.array(trace['georeferencing']['controlPoints'])
projected = np.column_stack(project(controls[:, 0], controls[:, 1]))
errors = projected - controls[:, 2:]
assert np.sqrt(np.mean(errors ** 2)) < 1
assert np.max(np.linalg.norm(errors, axis=1)) < 2

country_path = 'public/data/countries.geojson'
country_ids = ['country-chn', 'country-twn', 'country-hkg', 'country-mac']
features = read(country_path)['features']
land = unary_union([shape(f['geometry']) for f in features if f['properties']['id'] in country_ids])
land_px = transform(project, land)
d = trace['dividers']
tn, ne, te, ns = (d[k] for k in ['tibetNorth', 'northwestEast', 'tibetEast', 'northSouth'])
assert tn[-1] == ne[0] == te[0] and ns[0] in te
junction = te.index(ns[0])
# Closure vertices lie outside the country's land mask; only published divider
# segments appear inside the land. A shared exterior extension avoids gaps.
north_extension = [1000, -500]
west_extension = [-100, 440]
south_extension = [500, 1800]
east_extension = [2200, 755]
masks = {
 'iii': Polygon([west_extension] + tn + ne[1:] + [north_extension, [-100, -500]]),
 'iv': Polygon([west_extension] + tn + te[1:] + [south_extension, [-100, 1800]]),
 'ii': Polygon(ne + [north_extension, [2200, -500], east_extension] + list(reversed(ns)) + list(reversed(te[:junction]))),
}
assert all(m.is_valid for m in masks.values())
regions = {key: land_px.intersection(mask) for key, mask in masks.items()}
regions['i'] = land_px.difference(unary_union(list(regions.values())))
for key, geom in regions.items():
    assert geom.is_valid and not geom.is_empty
    for other, g in regions.items():
        if key != other: assert geom.intersection(g).area < 1e-6, (key, other)
assert unary_union(list(regions.values())).symmetric_difference(land_px).area < 1e-6

metadata = [
 ('ii', 'northern-china', '北方地区', 'Northern China', [116,39]),
 ('i', 'southern-china', '南方地区', 'Southern China', [112,27]),
 ('iii', 'northwestern-china', '西北地区', 'Northwestern China', [95,42]),
 ('iv', 'qinghai-tibet-region', '青藏地区', 'Qinghai–Tibet region', [90,33]),
]
note = '依据Jiang等（2023）图2数字化的四大地理区概化分区，适合全国尺度学习；分界为过渡带参考，不是行政区界、精确气候线或实测边界。外围轮廓沿用本站Natural Earth数据。'
output = []
for key, card, name, english, center in metadata:
    geom = transform(unproject, regions[key])
    assert geom.is_valid and geom.covers(Point(center)), card
    fid = 'region-cn-jiang2023-' + key
    props = {'id':fid, 'name':name, 'nameEn':english, 'aliases':[name,english], 'kind':'region',
             'sourceId':'jiang-2023-china-regions-figure2', 'sourceRegion':key.upper(), 'cardId':card,
             'center':center, 'bbox':list(geom.bounds), 'geometryNote':note, 'referenceExtent':True}
    output.append({'type':'Feature','id':fid,'properties':props,'geometry':mapping(geom)})
outpath = 'public/data/china-reference-regions.geojson'
(ROOT / outpath).write_text(json.dumps({'type':'FeatureCollection','features':output},ensure_ascii=False,separators=(',',':'))+'\n')
# Independent familiar locations well away from the schematic transition lines.
checks = {'ii':[[116.4,39.9],[126.6,45.8],[112.55,37.87]],'i':[[113.26,23.13],[110.33,20.03],[121.56,25.04],[104.07,30.67]],'iii':[[87.62,43.83],[111.67,40.82],[94.66,40.14]],'iv':[[91.13,29.65],[94.9,36.4],[89,32]]}
for key, points in checks.items():
    for p in points: assert regions[key].covers(Point(*project(*p))), (key,p)
manifest = {
 'id':'jiang-2023-china-regions-figure2','version':'2026-10-24-digitization-v1',
 'title':'中国四大地理区 · 论文分区图数字化参考范围',
 'source':trace['source'], 'sourcePage':'https://nhess.copernicus.org/articles/23/3747/2023/',
 'attribution':'Adapted from Jiang, R. et al. (2023), Natural Hazards and Earth System Sciences 23, 3747–3759, Figure 2, CC BY 4.0. Exterior land geometry: Natural Earth, public domain.',
 'license':'CC-BY-4.0', 'licenseUrl':'https://creativecommons.org/licenses/by/4.0/',
 'processing':['提取已发表图2的四区分界，按图中经纬网进行圆锥投影配准；保留图示口径，不使用闪电栅格数据。','共同分界使用同一条数字化线，构成互不重叠的四区；外围轮廓裁剪到本站既有国家图层。','源图边界附近有概化、线宽与配准误差；不用于地方归属判断、面积统计或行政划界。'],
 'inputs':[{'path':trace_path,'sha256':sha(trace_path)}, {'path':country_path,'sha256':sha(country_path),'featureIds':country_ids,'sourceManifest':'data/research/data-sources.lock.json'}],
 'output':{'path':outpath,'sha256':sha(outpath),'features':4},
 'georeferencing':trace['georeferencing'],
 'validation':{'validPolygons':4,'noInteriorOverlap':True,'coversExistingLandMask':True,'independentLocations':checks},
 'note':note,
}
# Input source lock actually lives with the reproducible scripts.
manifest['inputs'][1]['sourceManifest']='scripts/data-sources.lock.json'
write('data/research/china-reference-region-sources.json',manifest)
write('public/data/china-reference-region-sources.json',manifest)
print(f'Built four reference regions ({(ROOT/outpath).stat().st_size} bytes); geometry, coverage and {sum(map(len,checks.values()))} independent locations passed.')
