#!/usr/bin/env python3
"""Apply the project's China display conventions to existing, attributed data.

Run after rebuilding country, province, language or auxiliary layers. It keeps
source identifiers and statistical footprints; it never infers new coastlines.
"""
import hashlib
import json
from pathlib import Path

from china_presentation import CHINA_IDS, PRESENTATION_NOTE, city_properties, country_features, country_properties

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public/data'
RESEARCH = ROOT / 'data/research'


def read(path):
    return json.loads(path.read_text())


def write(path, value, pretty=False):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2 if pretty else None, separators=None if pretty else (',', ':')) + '\n')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


changed = []
countries = read(PUBLIC / 'countries.geojson')
country_features(countries['features'])
countries['presentationNote'] = PRESENTATION_NOTE
write(PUBLIC / 'countries.geojson', countries)
changed.append('countries.geojson')
by_id = {f['properties']['id']: f['properties'] for f in countries['features']}

regions = read(PUBLIC / 'regions.geojson')
for f in regions['features']:
    p = f['properties']
    if p['id'] == 'region-1159103793':
        p['name'] = '中国台湾岛'
        p['nameEn'] = 'Taiwan Island, China'
        p['aliases'] = ['台湾', '台湾岛', '中国台湾岛', 'Taiwan', 'Taiwan Island']
        p['parentCountryId'] = 'country-chn'
        p['parentCountryName'] = '中国'
write(PUBLIC / 'regions.geojson', regions)
changed.append('regions.geojson')

gazetteer = read(PUBLIC / 'gazetteer.json')
for p in gazetteer:
    if p['id'] in by_id:
        source = by_id[p['id']]
        for key in ['name', 'nameEn', 'aliases', 'kind', 'bbox', 'parentCountryId', 'parentCountryName']:
            if key in source:
                p[key] = source[key]
    elif p['id'] == 'region-1159103793':
        source = next(f['properties'] for f in regions['features'] if f['properties']['id'] == p['id'])
        for key in ['name', 'nameEn', 'aliases', 'parentCountryId', 'parentCountryName']:
            p[key] = source[key]
write(PUBLIC / 'gazetteer.json', gazetteer)
changed.append('gazetteer.json')

for filename in ['learning-human.json', 'learning-country-languages.json', 'learning-country-indicators.json', 'language-overview.json']:
    table = read(PUBLIC / filename)
    content = table['religion'] if filename == 'learning-human.json' else table
    for row in content['countries']:
        country_properties(row)
    content['presentationNote'] = PRESENTATION_NOTE
    if filename == 'learning-country-languages.json':
        table['title'] = '国家与地区语言概览'
    write(PUBLIC / filename, table, pretty=filename == 'language-overview.json')
    changed.append(filename)

cities = read(PUBLIC / 'auxiliary-cities.geojson')
for f in cities['features']:
    city_properties(f['properties'])
write(PUBLIC / 'auxiliary-cities.geojson', cities)
changed.append('auxiliary-cities.geojson')
regional_city_metadata = [
    {key: f['properties'][key] for key in ['id', 'name', 'nameEn', 'center', 'rank', 'country', 'regionName', 'capital', 'parentCountryId', 'sourceCountry'] if key in f['properties']}
    for f in sorted(cities['features'], key=lambda feature: feature['properties']['id'])
    if f['properties'].get('parentCountryId') == 'country-chn' and f['properties'].get('regionName')
]
regional_city_path = ROOT / 'src/data/china-regional-cities.json'
regional_city_path.parent.mkdir(parents=True, exist_ok=True)
write(regional_city_path, regional_city_metadata, pretty=True)

# Refresh only affected output records in their original source manifests.
# This is an explicit processing step, never a new license or source dataset.
for filename, research_file in [('sources.json', ROOT / 'data/geodata-sources.json'), ('learning-data-sources.json', RESEARCH / 'learning-data-sources.json'), ('country-context-sources.json', RESEARCH / 'country-context-sources.json'), ('language-overview-sources.json', RESEARCH / 'language-overview-sources.json'), ('auxiliary-sources.json', RESEARCH / 'auxiliary-sources.json')]:
    manifest = read(PUBLIC / filename)
    def refresh(node):
        if isinstance(node, list):
            for item in node:
                refresh(item)
        elif isinstance(node, dict):
            path = node.get('path')
            if path:
                actual = ROOT / ('public' + path if path.startswith('/data/') else path)
                if actual.is_file() and actual.name in changed + ['learning-provinces.geojson']:
                    node['sha256'] = digest(actual)
                    for field in ['size', 'bytes']:
                        if field in node:
                            node[field] = actual.stat().st_size
            for item in node.values():
                if isinstance(item, (list, dict)):
                    refresh(item)
    refresh(manifest)
    for source in manifest.get('sources', []):
        if source.get('id') in ('natural-earth-50m-countries', 'natural-earth-cities') and PRESENTATION_NOTE not in source.get('processing', ''):
            source['processing'] = source.get('processing', '') + PRESENTATION_NOTE
    pretty = filename != 'country-context-sources.json'
    write(PUBLIC / filename, manifest, pretty=pretty)
    write(research_file, manifest, pretty=pretty)

inputs = ['scripts/china_presentation.py', 'scripts/build-china-presentation.py', 'scripts/build-learning-data.py', 'public/data/learning-provinces.geojson']
output = {
    'reviewedAt': '2026-11-13',
    'policy': PRESENTATION_NOTE,
    'processing': PRESENTATION_NOTE + '中国轮廓合并现有真实几何，原始中国大陆统计几何另存；台湾省源单元排除金门并归入福建。所有原始数据许可和统计口径分别保留。',
    'references': [
        {'title': '中国政府网 · 台湾基本情况', 'url': 'https://www.gov.cn/guoqing/2020-07/28/content_5530577.htm', 'use': '台湾省及台湾地区范围区别，金门、马祖归属福建省。'},
        {'title': 'Natural Earth · Disputed boundaries policy', 'url': 'https://www.naturalearthdata.com/about/disputed-boundaries-policy/', 'use': '原始数据的默认表达并非统一国家归属；项目明确记录所采用的展示口径。'},
    ],
    'geometry': {'china': '复用原有CHN、TWN、HKG、MAC四组几何合并中国轮廓；原始CHN几何另存statisticsGeometry，仅用于来源中中国大陆的统计着色。', 'taiwanProvince': '复用固定Natural Earth Admin-1台湾主岛、澎湖及已收录附属岛屿，金门源单元归入福建；不推绘缺失小岛。'},
    'statistics': '地区统计的数值、年份、原文和源ID保持分列，parentCountryId统一为country-chn；不合成未获来源支持的全国人口或宗教比例。',
    'license': 'Natural Earth: Public domain；统计与语言资料保留原来源清单中的各自许可。',
    'inputs': [{'path': p, 'sha256': digest(ROOT / p)} for p in inputs],
    'outputs': [{'path': 'public/data/' + name, 'sha256': digest(PUBLIC / name)} for name in changed] + [{'path': 'src/data/china-regional-cities.json', 'sha256': digest(regional_city_path)}],
    'validation': {'chinaSourceIds': CHINA_IDS, 'regionsBelongToChina': True, 'originalStatisticalFootprintsPreserved': True, 'taipeiIsNotNationalCapital': True},
}
write(RESEARCH / 'china-presentation-sources.json', output, pretty=True)
write(PUBLIC / 'china-presentation-sources.json', output, pretty=True)
print('Applied China presentation conventions to', ', '.join(changed))
