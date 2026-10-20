"""Build the level-3 catchment layer from the pinned official BasinATLAS release.
Run from the repository root with the documented data environment active:
python scripts/build-basin-atlas.py
Raw inputs remain in ignored data/raw/basin-atlas. No HydroBASINS cache fallback.
"""
import hashlib
import json
from pathlib import Path
import sys
import zlib

import requests
from remotezip import RemoteFetcher, RemoteZip
import shapefile
from shapely import make_valid, set_precision
from shapely.affinity import translate
from shapely.geometry import MultiPolygon, box, mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
LOCK = json.loads((ROOT / 'scripts/basin-atlas-inputs.lock.json').read_text())
RAW = ROOT / 'data/raw/basin-atlas'
RAW.mkdir(parents=True, exist_ok=True)
REGIONS = {'1':'非洲','2':'欧洲','3':'西伯利亚','4':'亚洲','5':'澳大利亚及周边','6':'南美洲','7':'北美洲','8':'北极地区','9':'格陵兰'}
COLORS = ['#82a897','#a9ac7e','#8da4b9','#b7a084','#a696b2']

def digest(data):
    return hashlib.sha256(data).hexdigest()

def check(data, record):
    if len(data) != record['bytes'] or digest(data) != record['sha256']:
        raise ValueError('Pinned BasinATLAS input changed: ' + record['path'])
    if 'crc32' in record and f'{zlib.crc32(data):08x}' != record['crc32']:
        raise ValueError('Archive member CRC mismatch: ' + record['path'])

class PinnedRangeFetcher(RemoteFetcher):
    def get_file_size(self):
        return LOCK['archive']['bytes']

    def _request(self, kwargs):
        response = requests.get(self._url, stream=True, **kwargs)
        if response.status_code != 206 or 'Content-Range' not in response.headers:
            response.close()
            raise ValueError('BasinATLAS archive server must honor HTTP ranges; refusing a full archive download')
        start_end, total = response.headers['Content-Range'].split('/')
        if int(total) != LOCK['archive']['bytes']:
            response.close()
            raise ValueError('Pinned archive size changed')
        return response.raw, response.headers['Content-Range']

def prepare_inputs():
    missing = []
    for record in LOCK['members']:
        path = ROOT / record['path']
        if path.exists():
            check(path.read_bytes(), record)
        else:
            missing.append(record)
    if missing:
        with RemoteZip(LOCK['archive']['url'], headers={'User-Agent':'TerraAtlas/1.0'},
                       fetcher=PinnedRangeFetcher, support_suffix_range=False, timeout=90) as archive:
            for record in missing:
                info = archive.getinfo(record['archiveMember'])
                assert info.file_size == record['bytes'] and f'{info.CRC:08x}' == record['crc32']
                data = archive.read(record['archiveMember'])
                check(data, record)
                path = ROOT / record['path']
                temporary = path.with_suffix(path.suffix + '.download')
                temporary.write_bytes(data)
                temporary.replace(path)
    return [{key:record[key] for key in ['path','sha256','bytes','archiveMember','crc32']}
            | {'url':LOCK['archive']['url']} for record in LOCK['members']]

def polygons(geometry):
    fixed = make_valid(geometry) if not geometry.is_valid else geometry
    if fixed.geom_type == 'GeometryCollection':
        fixed = unary_union([part for part in fixed.geoms if part.geom_type in ['Polygon','MultiPolygon']])
    assert not fixed.is_empty and fixed.geom_type in ['Polygon','MultiPolygon'] and fixed.is_valid
    return fixed

def rounded(value):
    if isinstance(value, (list, tuple)):
        return [rounded(item) for item in value]
    return round(value, 5) if isinstance(value, float) else value

def build():
    inputs = prepare_inputs()
    reader = shapefile.Reader(str(RAW / 'BasinATLAS_v10_lev03'))
    assert len(reader) == LOCK['expectedFeatures']
    fields = {field[0] for field in reader.fields[1:]}
    assert set(LOCK['selectedFields']).issubset(fields)
    features, seen, refinements = [], set(), 0
    for record in reader.iterShapeRecords():
        # Deliberately select only the reviewed core identifier/topology/area
        # fields. Do not publish the 281 additional hydro-environmental columns.
        values = {name:record.record.as_dict()[name] for name in LOCK['selectedFields']}
        hybas = str(int(values['HYBAS_ID']))
        assert hybas not in seen and len(hybas) == 10 and hybas[1] == '0' and hybas[2] == '3'
        seen.add(hybas)
        original = polygons(shape(record.shape.__geo_interface__))
        tolerance = .035
        while True:
            simple = polygons(original.simplify(tolerance, preserve_topology=True))
            simple = set_precision(simple, .00001)
            if abs(simple.area-original.area)/original.area <= .05:
                break
            tolerance /= 2
            refinements += 1
            if tolerance < .000001:
                raise ValueError('Could not preserve basin area: ' + hybas)
        if simple.bounds[2] > 180:
            west = simple.intersection(box(-180,-90,180,90))
            east = translate(simple.intersection(box(180,-90,360,90)), xoff=-360)
            parts = []
            for part in [west,east]:
                if part.geom_type == 'Polygon':parts.append(part)
                elif part.geom_type == 'MultiPolygon':parts.extend(part.geoms)
            simple = MultiPolygon(parts)
        assert simple.is_valid and not simple.is_empty
        assert simple.bounds[0]>=-180 and simple.bounds[2]<=180 and simple.bounds[1]>=-90 and simple.bounds[3]<=90
        center = simple.representative_point()
        pfaf = str(int(values['PFAF_ID']))
        props = {'id':'basin-hybas-'+hybas,'name':REGIONS[hybas[0]]+'汇水分区 '+pfaf,
                 'nameEn':'BasinATLAS '+hybas,'kind':'basin','hybasId':hybas,'pfafId':pfaf,
                 'level':3,'areaKm2':values['SUB_AREA'],'endorheic':int(values['ENDO']),
                 'nextDown':str(int(values['NEXT_DOWN'])),'center':[round(center.x,5),round(center.y,5)],
                 'color':COLORS[int(pfaf)%len(COLORS)],'sourceId':'basinatlas-l3'}
        features.append({'type':'Feature','geometry':{'type':simple.geom_type,'coordinates':rounded(mapping(simple)['coordinates'])},'properties':props})
    features.sort(key=lambda feature:feature['properties']['hybasId'])
    collection = {'type':'FeatureCollection','features':features}
    data = (json.dumps(collection,ensure_ascii=False,separators=(',',':'))+'\n').encode()
    target = ROOT / 'public/data/auxiliary-basins.geojson'
    temporary = target.with_suffix('.geojson.tmp')
    temporary.write_bytes(data)
    temporary.replace(target)
    output = {'path':'/data/auxiliary-basins.geojson','sha256':digest(data),'bytes':len(data),'features':len(features)}
    source = {'id':'basinatlas-l3','version':'BasinATLAS v1.0, level 03; Figshare 9890531.v1, file 20087237',
              'license':'CC BY 4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/',
              'documentationUrl':'https://www.hydrosheds.org/hydroatlas',
              'doi':'10.6084/m9.figshare.9890531.v1',
              'citation':'Linke, S. et al. (2019). Global hydro-environmental sub-basin and river reach characteristics at high spatial resolution. Scientific Data 6, 283. doi:10.1038/s41597-019-0300-6. Underlying delineations: Lehner, B. & Grill, G. (2013), doi:10.1002/hyp.9740.',
              'processing':'从官方BasinATLAS v1.0归档以HTTP范围请求提取第3级shp/shx/dbf/prj；仅选HYBAS_ID、PFAF_ID、NEXT_DOWN、SUB_AREA、ENDO五个核心字段及真实几何，不引入281列环境属性。修复无效几何，保拓扑概化最多0.035°；对平面面积变化超过5%的单元逐次减半容差，精度网格0.00001°；斐济跨180°的面拆分回绕。展示面积沿用SUB_AREA，不用概化面重算。按真实HYBAS_ID保留旧链接ID；参考点取公开概化面内部。颜色仅区分分区，不表示水量。三级单元含沿海汇水分组，不等同全部命名大河完整流域；北纬60°以北资料较粗，南极未覆盖。',
              'selectedFields':LOCK['selectedFields'],'excludedAttributes':'不发布任何新增环境属性列，不将其各自许可统一归入本层。',
              'archive':LOCK['archive'], 'licenseReview':LOCK['licenseReview'],
              'inputs':inputs,'outputs':[output]}
    manifest_path = ROOT / 'data/research/auxiliary-sources.json'
    manifest = json.loads(manifest_path.read_text())
    manifest['reviewedAt'] = '2026-10-20'
    manifest['sources'] = [s for s in manifest['sources'] if s['id'] not in ['hydrobasins-l3','basinatlas-l3']] + [source]
    for path in [manifest_path,ROOT/'public/data/auxiliary-sources.json']:
        path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(f'BasinATLAS: {len(features)} verified level-3 features; {len(data)} output bytes; {refinements} tolerance refinements.', file=sys.stderr)

if __name__ == '__main__':
    build()
