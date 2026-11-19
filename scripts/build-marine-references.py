#!/usr/bin/env python3
"""Select explicit public-domain marine reference polygons; never infer extents from points."""
import hashlib
import json
from pathlib import Path
from shapely.geometry import shape, mapping
from shapely import set_precision

ROOT = Path(__file__).resolve().parents[1]
def read(path): return json.loads((ROOT / path).read_text())
def sha(path): return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
def write(path, data): (ROOT / path).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
def rounded(value):
    if isinstance(value, (tuple,list)): return [rounded(item) for item in value]
    return round(value,4) if isinstance(value,float) else value

lock_path = 'scripts/marine-reference-inputs.lock.json'
lock = read(lock_path)
assert sha(lock['path']) == lock['sha256'], 'Marine input hash changed'
raw = read(lock['path'])
features = {f['properties']['ne_id']: f for f in raw['features']}
note = 'Natural Earth 1:1000万海洋地理标注参考范围，用于辨认海域位置和展布；不是海域完整水面、法定界线、领海界线或航线。各海域相互连通，参考面之间的空隙不表示海洋中断。'
output = []
for member in lock['members']:
    for ne_id, original_name in member['features']:
        source = features[ne_id]
        assert source['properties']['name'] == original_name, (ne_id, original_name)
        geometry = set_precision(shape(source['geometry']), 0.0001, mode='valid_output')
        assert geometry.is_valid and not geometry.is_empty and geometry.geom_type in ['Polygon', 'MultiPolygon']
        center = geometry.representative_point()
        fid = 'region-marine-ne-' + str(ne_id)
        output.append({'type':'Feature', 'id':fid, 'properties':{
            'id':fid, 'name':member['name'], 'nameEn':source['properties']['name_en'],
            'aliases':[member['name'], source['properties']['name_en']],
            'kind':source['properties']['featurecla'], 'sourceId':'natural-earth-10m-marine-v5.1.2',
            'sourceName':original_name, 'neId':ne_id, 'cardId':member['cardId'],
            'center':[round(center.x, 4), round(center.y, 4)],
            'geometryNote':note, 'referenceExtent':True,
        }, 'geometry':{'type':geometry.geom_type,'coordinates':rounded(mapping(geometry)['coordinates'])}})

output_path = 'public/data/marine-reference-regions.geojson'
(ROOT / output_path).write_text(json.dumps({'type':'FeatureCollection','features':output},ensure_ascii=False,separators=(',',':'))+'\n')
manifest = {
    'id':'natural-earth-10m-marine-v5.1.2', 'reviewedAt':'2026-11-13',
    'title':'Natural Earth · 海洋与海峡概化标注参考范围',
    'homepage':'https://www.naturalearthdata.com/downloads/10m-physical-vectors/',
    'version':lock['version'], 'license':lock['license'], 'licenseUrl':lock['licenseUrl'],
    'inputs':[{'path':lock_path,'sha256':sha(lock_path)}, {k:lock[k] for k in ['path','url','sha256']}],
    'processing':'按锁定的NE_ID和原始英文名称双重核对，选取五大洋、地中海、马六甲与直布罗陀海峡的原始参考面；保留南北分片，不从定位点、海岸外接框或行政范围推测海域；GEOS安全量化至0.0001°。中文统一采用本站规范名称。',
    'limitations':note,
    'validation':{'features':len(output),'cards':len(lock['members']),'allGeometriesValid':True,'namesAndIdsMatch':True},
    'output':{'path':output_path,'sha256':sha(output_path)},
}
for folder in ['data/research','public/data']:
    write(folder+'/marine-reference-sources.json',manifest)
print(f"Built {len(output)} verified marine reference polygons for {len(lock['members'])} objects.")
