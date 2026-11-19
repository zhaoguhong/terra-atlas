#!/usr/bin/env python3
"""Digitize explicitly named landform units from licensed published maps.

The input contains the printed divider traces and independent graticule controls.
It does not estimate a landform from an administrative polygon or a label point.
The source image is an optional, hash-locked private cache; numpy and shapely are
the only runtime dependencies. The resulting outlines are national-scale visual
references, not an official vector dataset or boundaries for area statistics.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon, mapping, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return json.loads((ROOT / path).read_text())


def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def write(path, value):
    (ROOT / path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


trace_path = 'scripts/landform-reference-digitization.json'
trace = read(trace_path)
cached_image = ROOT / 'data/raw/area-review/zhang-2025-fig2.png'
if cached_image.exists():
    assert hashlib.sha256(cached_image.read_bytes()).hexdigest() == trace['source']['sha256'], 'Source figure changed'

calibration = trace['georeferencing']
p = calibration['parameters']
n, A, cx, cy, lon0, C = (p[k] for k in ['n', 'A', 'cx', 'cy', 'centralMeridianDegrees', 'C'])


def project(lon, lat, z=None):
    angle = n * np.radians(np.asarray(lon) - lon0)
    radius = A * np.sqrt(C - 2 * n * np.sin(np.radians(lat)))
    return cx + radius * np.sin(angle), cy + radius * np.cos(angle)


def unproject(x, y, z=None):
    dx, dy = np.asarray(x) - cx, np.asarray(y) - cy
    radius = np.hypot(dx, dy)
    lon = lon0 + np.degrees(np.arctan2(dx, dy) / n)
    lat = np.degrees(np.arcsin((C - (radius / A) ** 2) / (2 * n)))
    return lon, lat


# Check the figure's original ticks rather than fitting against the output map.
errors = []
for lon, x in calibration['longitudeTicks']:
    predicted_x = cx + (calibration['topEdgeY'] - cy) * np.tan(n * np.radians(lon - lon0))
    errors.append(predicted_x - x)
for lat, y in calibration['latitudeTicks']:
    radius = A * np.sqrt(C - 2 * n * np.sin(np.radians(lat)))
    predicted_y = cy + np.sqrt(radius ** 2 - (calibration['leftEdgeX'] - cx) ** 2)
    errors.append(predicted_y - y)
rms = float(np.sqrt(np.mean(np.asarray(errors) ** 2)))
max_error = float(max(abs(e) for e in errors))
assert rms < 0.25 and max_error < 0.5, 'Figure graticule calibration failed'

country_path = 'public/data/countries.geojson'
country_ids = ['country-chn', 'country-twn', 'country-hkg', 'country-mac']
land = unary_union([shape(f['geometry']) for f in read(country_path)['features'] if f['properties']['id'] in country_ids])
land_px = transform(project, land)
note = '依据Zhang等（2025）图2中III-C内蒙古高原区数字化的全国尺度地貌参考范围；分界为过渡带的概化表达，不是精确地貌边界、行政界线或面积统计范围。'
features, checks = [], []
for region in trace['regions']:
    masks = [Polygon(ring) for ring in region['masks']]
    assert all(mask.is_valid and not mask.is_empty for mask in masks), region['id']
    pieces = [land_px.intersection(mask) for mask in masks]
    assert all(piece.is_valid and not piece.is_empty for piece in pieces)
    assert all(pieces[i].intersection(pieces[j]).area < 1e-6 for i in range(len(pieces)) for j in range(i)), 'Published components must not overlap'
    # The source print and Natural Earth generalize the international border
    # independently. Keep the one connected inland part belonging to each of the
    # two printed units; discard tiny clipping slivers at the boundary endpoint.
    geographic_pieces, discarded_area = [], 0.0
    for piece in pieces:
        clipped = transform(unproject, piece).intersection(land)
        polygon_parts = [clipped] if clipped.geom_type == 'Polygon' else [g for g in clipped.geoms if g.geom_type == 'Polygon']
        largest = max(polygon_parts, key=lambda g: g.area)
        slivers = sum(part.area for part in polygon_parts if part is not largest)
        assert slivers < largest.area * 0.002, 'Unexpected disconnected clipping component'
        discarded_area += slivers
        geographic_pieces.append(largest)
    geom = unary_union(geographic_pieces)
    assert geom.is_valid and not geom.is_empty and geom.geom_type in ['Polygon', 'MultiPolygon']
    assert geom.difference(land).area < 1e-7, 'Reference extent must stay inside the source national land mask'
    for point in region['insideChecks']:
        assert geom.covers(Point(point)), ('Missing independent location', region['id'], point)
    for point in region['outsideChecks']:
        assert not geom.covers(Point(point)), ('Included unrelated region', region['id'], point)
    # Keep a readable, deterministic coordinate precision at this source scale.
    geom = transform(lambda x, y, z=None: (np.round(x, 5), np.round(y, 5)), geom)
    assert geom.is_valid and not geom.is_empty
    props = {k: region[k] for k in ['id', 'cardId', 'name', 'nameEn', 'kind', 'sourceUnit', 'center']}
    props.update({'aliases': [region['name'], region['nameEn']], 'sourceId': 'zhang-2025-landform-figure2', 'bbox': list(geom.bounds), 'geometryNote': note, 'referenceExtent': True})
    features.append({'type': 'Feature', 'id': region['id'], 'properties': props, 'geometry': mapping(geom)})
    checks.append({'id': region['id'], 'inside': region['insideChecks'], 'outside': region['outsideChecks'], 'publishedComponents': len(pieces), 'discardedBorderSliverSquareDegrees': discarded_area, 'valid': True})

output = 'public/data/landform-reference-regions.geojson'
(ROOT / output).write_text(json.dumps({'type': 'FeatureCollection', 'features': features}, ensure_ascii=False, separators=(',', ':')) + '\n')
manifest = {
    'id': 'zhang-2025-landform-figure2', 'version': '2026-11-13-digitization-v1',
    'title': '内蒙古高原 · 已发表地貌分区图数字化参考范围',
    'source': trace['source'], 'license': 'CC-BY-4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
    'attribution': 'Adapted from Zhang, G. et al. (2025), Production and Analysis of a Landslide Susceptibility Map Covering Entire China, Remote Sensing 17(9), 1615, Figure 2, https://doi.org/10.3390/rs17091615, CC BY 4.0. Exterior land geometry: Natural Earth, public domain.',
    'processing': [
        '采用论文图2及表1明确命名的III-C内蒙古高原区，论文区划依据李炳元等（2013）；未将蒙古高原、内蒙古自治区或湖区研究范围替代为本对象。',
        '以原图8个经度刻度与4个纬度刻度拟合Albers圆锥等面积投影，逐线数字化原图内部分界；图示两个分离部分分别处理，不补画连接区域。',
        '仅原图与国界重合的外缘沿本站既有Natural Earth中国陆地掩膜裁剪；闭合线全部在掩膜之外，不构成新增的可见地貌分界。',
        '原图与底图国界概化不同，在分界端点产生的微小离散裁剪碎片按源图两处独立内陆区域的连通性剔除；不连接原图中分离的两部分。',
        '图形保留全国尺度的源图线宽、概化与数字化误差；配准误差只反映刻度拟合，不代表地貌分界的实际精度，不用于测量或面积统计。',
    ],
    'inputs': [{'path': trace_path, 'sha256': sha(trace_path)}, {'path': country_path, 'sha256': sha(country_path), 'featureIds': country_ids, 'sourceManifest': 'scripts/data-sources.lock.json'}],
    'output': {'path': output, 'sha256': sha(output), 'features': len(features)},
    'georeferencing': {**calibration, 'pixelRmsError': rms, 'maxPixelError': max_error},
    'validation': {'validPolygons': len(features), 'insideNationalLandMask': True, 'independentLocations': checks},
    'note': note,
}
write('data/research/landform-reference-region-sources.json', manifest)
write('public/data/landform-reference-region-sources.json', manifest)
print(f'Built {len(features)} landform reference region; graticule RMS {rms:.3f}px, max {max_error:.3f}px; geometry and independent-location checks passed.')
