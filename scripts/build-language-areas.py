#!/usr/bin/env python3
"""Build a small, attributable language-area layer from real published polygons.

Requires shapely; uses the existing Glottolog 5.3 point/family layers for exact
identifier joins. Raw inputs remain in the ignored data/raw/language-areas.
Run from the repository root with the documented data environment active:
python scripts/build-language-areas.py
"""
from __future__ import annotations

import collections
import csv
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import urllib.request

import shapely
from shapely.geometry import MultiPolygon, mapping, shape

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data/raw/language-areas'
PUBLIC = ROOT / 'public/data'
RESEARCH = ROOT / 'data/research'
COMMIT = '20102238acf12a2b82bd4d752356687ee2acfd6d'
VERSION = 'v2.0'
SOURCE_ID = 'glottography-asher2007-v2'
BASE = f'https://raw.githubusercontent.com/Glottography/asher2007world/{COMMIT}/'
SHA256 = {
    'languages.geojson': '889365bc8c8ede1e4c291e54c036090b995e50b8cacac1e64eea7c9f552896f0',
    'languages.csv': 'da3132a01453621576dc4c17e2f7345e71d9f363f0ac5ae4f56b52e8001893d8',
    'contributions.csv': '4d8e1383115fc662bb576f163fff7f9033aed768fe5588c06096f969ff5b9a77',
    'contemporary-metadata.json': '37e04289c030af9fabbb69eb2f71afa6d36ad57c5f60ff9d0b4369bfa0f53948',
    'LICENSE': '945fbcb37deca05bccd7c3ca0e261679f1f5373515504fdbad68f6f3cf6f49b9',
    'VALIDATION.md': '6a86765961995d85e2b2b5dc32436165eaa2ec53df58c44ff2787f2adbbe0335',
}
TOLERANCE = .04
MAX_AREA_CHANGE = .2

NOTES = [
    '色面来自2007年《世界语言地图集》的使用区图，经Glottography数字化；不是2026年实时语言分布。',
    '使用contemporary资料集，未混入欧洲殖民接触时的traditional范围；原图资料年份并不统一，未注明的图按出版年2007登记。',
    '范围为地图集概括的语言使用区，不能据此判断人口、使用者比例或官方地位，也不表示区域内人人只使用这一种语言。',
    '多语言交错与重叠在原图中表示不充分；无法精确分配给某一语言的语组区域未作为单一语言面展示。空白不表示没有语言使用者。',
    '语言与方言的划分沿用源数据在Glottolog语言层级的聚合；名称与语系按本站Glottolog 5.3的真实Glottocode连接，排除bookkeeping条目。',
    '边界为便于全球探索而简化的参考范围；不同语言可重叠，不能作为人口普查边界或精确行政界线。',
]


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n')


def acquire(filename: str, relative: str) -> Path:
    path = RAW / filename
    if not path.exists():
        temporary = path.with_suffix(path.suffix + '.part')
        with urllib.request.urlopen(BASE + relative, timeout=180) as response, temporary.open('wb') as stream:
            while chunk := response.read(1024 * 1024):
                stream.write(chunk)
        temporary.replace(path)
    if filename in SHA256 and sha(path) != SHA256[filename]:
        raise ValueError(f'Pinned source checksum mismatch: {filename}')
    return path


def quantize(value, digits):
    if isinstance(value, dict):
        return {k: quantize(v, digits) for k, v in value.items()}
    if isinstance(value, (tuple, list)):
        return [quantize(v, digits) for v in value]
    if isinstance(value, float):
        return round(value, digits)
    return value


def polygon_counts(geometry):
    parts = list(geometry.geoms) if geometry.geom_type == 'MultiPolygon' else [geometry]
    return len(parts), sum(len(part.interiors) for part in parts)


def simplified_geometry(original):
    """Retain every polygon/hole; reduce tolerance for very small areas.

    The cap checks symmetric-difference area in lon/lat coordinate space. It is
    a simplification guard, not a physical square-kilometre estimate. Shared
    boundaries across separate features are not claimed to remain identical.
    """
    tolerance = TOLERANCE
    for _ in range(10):
        simplified = original.simplify(tolerance, preserve_topology=True)
        difference = original.symmetric_difference(simplified).area / original.area
        if difference <= MAX_AREA_CHANGE:
            break
        tolerance /= 2
    else:
        simplified = original
        tolerance = 0
    # Refine small islands/enclaves within the already valid full-language
    # topology, accepting a replacement only when it keeps that topology valid.
    if original.geom_type == 'MultiPolygon' and tolerance:
        parts = list(original.geoms)
        refined = list(simplified.geoms) if simplified.geom_type == 'MultiPolygon' else [simplified]
        if len(parts) == len(refined):
            for i, part in enumerate(parts):
                local_tolerance = tolerance
                if part.symmetric_difference(refined[i]).area / part.area <= MAX_AREA_CHANGE:
                    continue
                for _ in range(10):
                    candidate = part.simplify(local_tolerance, preserve_topology=True)
                    if part.symmetric_difference(candidate).area / part.area <= MAX_AREA_CHANGE:
                        break
                    local_tolerance /= 2
                else:
                    candidate = part
                trial = MultiPolygon([candidate if k == i else value for k, value in enumerate(refined)])
                if trial.is_valid:
                    refined[i] = candidate
            simplified = MultiPolygon(refined)
    for digits in (4, 5, 6, 8):
        encoded = quantize(mapping(simplified), digits)
        result = shape(encoded)
        if result.is_valid and not result.is_empty and polygon_counts(result) == polygon_counts(original):
            difference = original.symmetric_difference(result).area / original.area
            if difference <= MAX_AREA_CHANGE:
                return encoded, result, tolerance, digits, difference
    # Some very narrow valid rings cannot be safely rounded even at 8 decimals.
    # Keep their simplified full-precision coordinates instead of dropping parts.
    difference = original.symmetric_difference(simplified).area / original.area
    return mapping(simplified), simplified, tolerance, None, difference


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    input_files = {
        'languages.geojson': 'cldf/contemporary/languages.geojson',
        'languages.csv': 'cldf/contemporary/languages.csv',
        'contributions.csv': 'cldf/contemporary/contributions.csv',
        'contemporary-metadata.json': 'cldf/contemporary/contemporary-metadata.json',
        'LICENSE': 'LICENSE',
        'VALIDATION.md': 'VALIDATION.md',
    }
    inputs = {name: acquire(name, path) for name, path in input_files.items()}
    rows = {r['ID']: r for r in csv.DictReader(inputs['languages.csv'].open())}
    contributions = {r['ID']: r for r in csv.DictReader(inputs['contributions.csv'].open())}
    local_points = json.loads((PUBLIC / 'learning-languages.geojson').read_text())
    local = {f['properties']['glottocode']: f for f in local_points['features']}
    families = {f['id']: f for f in json.loads((PUBLIC / 'learning-language-families.json').read_text())['families']}
    source = json.loads(inputs['languages.geojson'].read_text())
    features = []
    languages = []
    excluded = []
    tolerance_counts = collections.Counter()
    precision_counts = collections.Counter()
    max_difference = 0
    raw_vertices = 0
    output_vertices = 0
    input_polygons = input_holes = output_polygons = output_holes = 0
    for feature in source['features']:
        code = feature['properties']['cldf:languageReference']
        row = rows[code]
        assert row['Glottolog_Languoid_Level'] == 'language', code
        if code not in local:
            # All such records in the pinned input are Bookkeeping, not active
            # language records; do not invent a join or move their geometry.
            assert row['Family'] == 'Bookkeeping', code
            excluded.append({'glottocode': code, 'name': row['Name'], 'reason': 'Glottolog bookkeeping; excluded from the existing 5.3 language layer'})
            continue
        original = shape(feature['geometry'])
        assert original.is_valid and not original.is_empty and original.geom_type in ('Polygon', 'MultiPolygon'), code
        encoded, geometry, tolerance, digits, difference = simplified_geometry(original)
        assert geometry.is_valid and not geometry.is_empty
        bounds = geometry.bounds
        assert -180 <= bounds[0] <= bounds[2] <= 180 and -90 <= bounds[1] <= bounds[3] <= 90
        raw_vertices += int(shapely.get_num_coordinates(original))
        output_vertices += int(shapely.get_num_coordinates(geometry))
        polygons, holes = polygon_counts(original)
        input_polygons += polygons
        input_holes += holes
        polygons, holes = polygon_counts(geometry)
        output_polygons += polygons
        output_holes += holes
        tolerance_counts[str(tolerance)] += 1
        precision_counts[str(digits)] += 1
        max_difference = max(max_difference, difference)
        point = local[code]
        p = point['properties']
        years = sorted({contributions[fid]['Year'] for fid in row['Feature_IDs'].split() if contributions[fid]['Year']})
        assert years == ['2007'], (code, years)
        properties = {
            'id': 'language-area-' + code,
            'glottocode': code,
            'languageId': 'language-' + code,
            'name': p['name'],
            'nameEn': p['nameEn'],
            'familyId': p['familyId'],
            'family': p['family'],
            'familyEn': p['familyEn'],
            'color': families[p['familyId']]['color'],
            'period': '2007',
            'sourceId': SOURCE_ID,
            'kind': 'language',
            'level': 'language',
            'center': point['geometry']['coordinates'],
            'centerSourceId': 'glottolog-5.3',
            'sourceFeatureCount': len(row['Feature_IDs'].split()),
        }
        features.append({'type': 'Feature', 'id': properties['id'], 'properties': properties, 'geometry': encoded})
        languages.append({
            'id': code, 'name': p['name'], 'nameEn': p['nameEn'],
            'familyId': p['familyId'], 'count': 1, 'partCount': polygons,
            'sourceFeatureCount': properties['sourceFeatureCount'],
            'bounds': [round(n, 5) for n in bounds],
            'center': properties['center'], 'centerSourceId': 'glottolog-5.3',
        })
    assert len({f['properties']['glottocode'] for f in features}) == len(features)
    assert input_polygons == output_polygons and input_holes == output_holes
    output = PUBLIC / 'language-areas.geojson'
    staging = RAW / 'language-areas-staging.geojson'
    write(staging, {'type': 'FeatureCollection', 'features': features})
    assert staging.stat().st_size < 6_000_000, staging.stat().st_size
    staging.replace(output)
    family_counts = collections.Counter(f['properties']['familyId'] for f in features)
    area_families = [dict(families[fid], count=count, areaLanguageCount=count) for fid, count in family_counts.most_common()]
    meta = {
        'sourceId': SOURCE_ID, 'version': VERSION, 'commit': COMMIT,
        'period': '2007', 'periodLabel': '2007年图集使用区参考',
        'filename': '/data/language-areas.geojson', 'sha256': sha(output), 'bytes': output.stat().st_size,
        'languageCount': len(features), 'referencePointCount': len(local),
        'familyCount': len(area_families),
        'languageLevelOnly': True, 'fromReferencePoints': False,
        'bounds': [min(x['bounds'][0] for x in languages), min(x['bounds'][1] for x in languages), max(x['bounds'][2] for x in languages), max(x['bounds'][3] for x in languages)],
        'note': ' '.join(NOTES), 'notes': NOTES,
        'overlapNote': NOTES[3],
        'languages': languages, 'families': area_families,
        'excludedBookkeepingCount': len(excluded),
        'referencePointsWithoutArea': len(local) - len(features),
        'sourcePublicationYear': 2007,
        'sourceClassificationVersion': 'Glottolog 5.2',
        'displayClassificationVersion': 'Glottolog 5.3',
    }
    meta_path = PUBLIC / 'language-areas-meta.json'
    write(meta_path, meta)
    now = datetime.now(timezone.utc).isoformat()
    artifacts = [{'path': '/data/' + p.name, 'sha256': sha(p), 'size': p.stat().st_size} for p in (output, meta_path)]
    sources = {
        'reviewedAt': now,
        'sources': [{
            'id': SOURCE_ID,
            'title': 'Glottography · 2007世界语言图集使用区（v2.0）',
            'url': 'https://doi.org/10.5281/zenodo.18613195',
            'repository': f'https://github.com/Glottography/asher2007world/tree/{COMMIT}',
            'scientificDescriptor': 'https://www.nature.com/articles/s41597-025-05828-6',
            'citation': 'The Glottography Consortium (2026). Glottography dataset derived from Asher and Moseley 2007 "Atlas of the World\'s Languages" (v2.0). Zenodo. Asher, R. E. & Christopher J. Moseley (eds.) (2007). Atlas of the World\'s Languages. 2nd edn. Routledge.',
            'version': VERSION, 'commit': COMMIT,
            'period': '2007年图集的contemporary使用区；并非2026实时分布',
            'license': 'CC BY 4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
            'inputPath': 'data/raw/language-areas/languages.geojson',
            'inputSha256': sha(inputs['languages.geojson']),
            'inputs': [{'path': str(path.relative_to(ROOT)), 'url': BASE + input_files[name], 'sha256': sha(path), 'size': path.stat().st_size} for name, path in inputs.items()],
            'processing': f'只使用contemporary/languages.geojson已聚合的真实语言级面。按真实Glottocode连接本站Glottolog 5.3语言与语系名称；排除29条Bookkeeping记录。拓扑保留简化最大容差{TOLERANCE}°，小面积对象自适应减小容差；坐标舍入通过有效性及部件/洞数量检验后采用。各语言独立简化，不声称共边完全一致，不以点扩散、国家边界、人口或官方地位补面。',
            'notes': NOTES,
        }],
        'artifacts': artifacts,
        'coverage': {'languages': len(features), 'families': len(area_families), 'referencePointsWithoutArea': len(local) - len(features)},
    }
    write(RESEARCH / 'language-area-sources.json', sources)
    validation = {
        'generatedAt': now, 'valid': True, 'sourceId': SOURCE_ID,
        'sourceVersion': VERSION, 'sourceCommit': COMMIT,
        'shapelyVersion': shapely.__version__,
        'inputSha256': {name: sha(path) for name, path in inputs.items()},
        'localJoinInputs': {name: sha(PUBLIC / name) for name in ('learning-languages.geojson', 'learning-language-families.json')},
        'inputLanguageCount': len(source['features']), 'outputLanguageCount': len(features),
        'uniqueIds': len(features), 'exactGlottocodeJoins': len(features),
        'languageOnly': True, 'noPointBuffers': True, 'noCountryInferredAreas': True,
        'validPolygonGeometries': len(features), 'allCoordinatesInBounds': True,
        'inputVertices': raw_vertices, 'outputVertices': output_vertices,
        'inputPolygonParts': input_polygons, 'outputPolygonParts': output_polygons,
        'inputHoles': input_holes, 'outputHoles': output_holes,
        'toleranceDegrees': dict(tolerance_counts), 'precisionDigits': dict(precision_counts),
        'smallPartRefinement': 'Small islands/enclaves are refined separately only when the replacement keeps the entire language geometry valid.',
        'maxSymmetricDifferenceAreaRatio': max_difference,
        'differenceMeasurement': 'Planar longitude/latitude area, only used to guard simplification; not physical area or language/population coverage.',
        'excludedBookkeeping': excluded, 'artifacts': artifacts,
        'limitations': NOTES,
    }
    write(RESEARCH / 'language-area-validation.json', validation)
    print(json.dumps({'languages': len(features), 'families': len(area_families), 'bytes': output.stat().st_size, 'vertices': output_vertices, 'maxDifferenceRatio': max_difference, 'excludedBookkeeping': len(excluded)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
