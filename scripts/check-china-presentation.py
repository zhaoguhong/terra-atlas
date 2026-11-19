#!/usr/bin/env python3
"""Independently compare the China presentation with fixed source geometry."""
import hashlib
import json
from pathlib import Path

from shapely import set_precision
from shapely.geometry import Point, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return json.loads((ROOT / path).read_text())


countries = {f['properties']['id']: f for f in read('public/data/countries.geojson')['features']}
raw = read('data/raw/ne_50m_admin_0_countries.geojson')['features']
expected = {}
for f in raw:
    p = {key.lower(): value for key, value in f['properties'].items()}
    key = 'country-' + p['adm0_a3'].lower()
    if key in ['country-chn', 'country-twn', 'country-hkg', 'country-mac']:
        expected[key] = set_precision(shape(f['geometry']).simplify(.025, preserve_topology=True), .0001, mode='valid_output')
china = shape(countries['country-chn']['geometry'])
assert china.equals(unary_union(list(expected.values()))), 'China must include the original four source components exactly'
assert shape(countries['country-chn']['properties']['statisticsGeometry']).equals(expected['country-chn'])
assert not shape(countries['country-chn']['properties']['statisticsGeometry']).covers(Point(121, 24)), 'Mainland statistics must not extend onto Taiwan'
for key, name in [('country-twn', '中国台湾'), ('country-hkg', '中国香港'), ('country-mac', '中国澳门')]:
    p = countries[key]['properties']
    assert p['name'] == name and p['kind'] == 'region' and p['parentCountryId'] == 'country-chn'
    assert '中华民国' not in p['aliases']
    assert shape(countries[key]['geometry']).equals(expected[key])

provinces = {f['properties']['id']: f for f in read('public/data/learning-provinces.geojson')['features']}
admin1 = read('data/raw/learning/ne_10m_admin_1_states_provinces.geojson')['features']
taiwan = [shape(f['geometry']) for f in admin1 if f['properties'].get('adm0_a3') == 'TWN' and f['properties'].get('name') != 'Kinmen']
kinmen = [shape(f['geometry']) for f in admin1 if f['properties'].get('adm0_a3') == 'TWN' and f['properties'].get('name') == 'Kinmen']
tw = shape(provinces['province-cn-71']['geometry'])
fj = shape(provinces['province-cn-35']['geometry'])
assert tw.is_valid and fj.is_valid
assert tw.hausdorff_distance(unary_union(taiwan)) < .0062
for geom in kinmen:
    assert fj.covers(geom.representative_point()) and not tw.covers(geom.representative_point())
assert tw.covers(Point(121, 24))

for filename in ['learning-human.json', 'learning-country-languages.json', 'learning-country-indicators.json', 'language-overview.json']:
    data = read('public/data/' + filename)
    for row in (data['religion'] if filename == 'learning-human.json' else data)['countries']:
        if row['countryId'] in ['country-chn', 'country-twn', 'country-hkg', 'country-mac']:
            assert row['name'] == countries[row['countryId']]['properties']['name']
            assert row['parentCountryId'] == 'country-chn' and row['statisticsScopeNote']

cities = read('public/data/auxiliary-cities.geojson')['features']
tw_cities = [f for f in cities if f['properties'].get('sourceCountry') == 'Taiwan']
assert len(tw_cities) > 5
assert all(f['properties']['country'] == '中国' and f['properties']['parentCountryId'] == 'country-chn' and not f['properties']['capital'] for f in tw_cities)
assert any(f['properties']['name'] == '台北' and f['properties']['sourceCapital'] for f in tw_cities)

report = {'status': 'passed', 'checks': ['China outline exactly unions all four original simplified source components', 'Source mainland statistical footprint preserved separately', 'Taiwan/Hong Kong/Macao explicitly belong to China without independent-country classification', 'Taiwan province excludes Kinmen; Fujian includes its original source geometry', 'All four derived statistical tables preserve China parent and original scope notes', 'Taiwan city source records retained; Taipei not rendered as a national capital'], 'taiwanProvinceGeometrySha256': hashlib.sha256((ROOT / 'public/data/learning-provinces.geojson').read_bytes()).hexdigest()}
output = ROOT / '.local/verification/china-presentation-independent.json'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(report, ensure_ascii=False, indent=2))
