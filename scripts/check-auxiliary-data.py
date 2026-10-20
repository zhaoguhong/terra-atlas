"""Independent raw/output comparison; requires cached inputs and Python geo packages."""
import json,hashlib,collections
from pathlib import Path
import shapefile
from shapely.geometry import shape,Point
from shapely import make_valid
from shapely.ops import unary_union
from shapely.affinity import translate
manifest=json.loads(Path('public/data/auxiliary-sources.json').read_text())
assert Path('public/data/auxiliary-sources.json').read_bytes()==Path('data/research/auxiliary-sources.json').read_bytes()
report={'status':'passed','method':'独立读取公开GeoJSON及原始输入；逐要素检查真实ID、类别、坐标、属性与几何有效性，并量化概化误差。','sources':{}}
for source in manifest['sources']:
 for raw in source['inputs']:
  assert hashlib.sha256(Path(raw['path']).read_bytes()).hexdigest()==raw['sha256'],raw['path']
 output=source['outputs'][0];data=json.loads(Path('public'+output['path']).read_text());features=data['features']
 assert hashlib.sha256(Path('public'+output['path']).read_bytes()).hexdigest()==output['sha256']
 assert len({f['properties']['id'] for f in features})==len(features)==output['features']
 for f in features:
  g=shape(f['geometry']);assert g.is_valid and not g.is_empty,f['properties']['id']
  assert g.bounds[0]>=-180 and g.bounds[2]<=180 and g.bounds[1]>=-90 and g.bounds[3]<=90
 report['sources'][source['id']]={'features':len(features),'sha256':output['sha256'],'validGeometries':len(features)}
cities=json.loads(Path('public/data/auxiliary-cities.geojson').read_text())['features']
original=json.loads(Path('data/raw/auxiliary/ne_10m_populated_places.geojson').read_text())['features']
expected={str(f['properties']['NE_ID']):f for f in original if f['properties']['SCALERANK']<=7 or f['properties']['ADM0CAP']}
assert len(cities)==len(expected)
for f in cities:
 raw=expected[f['properties']['id'].removeprefix('city-ne-')]
 assert bool(raw['properties']['ADM0CAP'])==f['properties']['capital']
 assert shape(raw['geometry']).distance(shape(f['geometry']))<.00001
plates=json.loads(Path('public/data/auxiliary-plates.geojson').read_text())['features']
ids=json.loads(Path('data/raw/auxiliary/usgs-plate-ids.json').read_text())['objectIds']
assert {int(f['properties']['id'].removeprefix('plate-usgs-')) for f in plates}==set(ids)
rawplates={f['id']:f for i in manifest['sources'][1]['inputs'][1:] for f in json.loads(Path(i['path']).read_text())['features']}
for f in plates:
 raw=rawplates[int(f['properties']['id'].removeprefix('plate-usgs-'))]
 assert raw['properties']['LABEL']==f['properties']['nameEn']
 assert shape(raw['geometry']).hausdorff_distance(shape(f['geometry']))<.00001
basins=json.loads(Path('public/data/auxiliary-basins.geojson').read_text())['features']
basin_source=next(source for source in manifest['sources'] if source['id']=='basinatlas-l3')
assert basin_source['license']=='CC BY 4.0'
rawbasins={}
rawpath=next(item['path'] for item in basin_source['inputs'] if item['path'].endswith('.shp'))
for record in shapefile.Reader(rawpath).iterShapeRecords():rawbasins[str(int(record.record.as_dict()['HYBAS_ID']))]=record
assert len(rawbasins)==len(basins)
errors=[]
for f in basins:
 p=f['properties'];record=rawbasins[p['hybasId']];attributes=record.record.as_dict()
 assert attributes['SUB_AREA']==p['areaKm2']
 assert str(int(attributes['PFAF_ID']))==p['pfafId']
 assert str(int(attributes['NEXT_DOWN']))==p['nextDown']
 assert int(attributes['ENDO'])==p['endorheic']
 assert p['sourceId']=='basinatlas-l3' and p['id']=='basin-hybas-'+p['hybasId']
 assert p['color']==['#82a897','#a9ac7e','#8da4b9','#b7a084','#a696b2'][int(p['pfafId'])%5]
 g=shape(record.shape.__geo_interface__);clean=make_valid(g)
 if clean.geom_type=='GeometryCollection':clean=unary_union([part for part in clean.geoms if part.geom_type in ['Polygon','MultiPolygon']])
 simplified=shape(f['geometry']);assert simplified.covers(Point(p['center']))
 comparison=simplified
 if clean.bounds[0]>0 and clean.bounds[2]>180:
  comparison=unary_union([translate(part,xoff=360) if part.bounds[0]<0 else part for part in simplified.geoms])
 distance=clean.hausdorff_distance(comparison)
 assert distance<.071,p['id']+' excessive generalization'
 assert abs(clean.area-comparison.area)/clean.area<=.05,p['id']+' excessive planar area change'
 errors.append({'id':p['id'],'hausdorffDegrees':distance,'relativePlanarAreaDifference':abs(clean.area-comparison.area)/clean.area})
report['sources']['basinatlas-l3'].update({'maximumHausdorffDegrees':max(e['hausdorffDegrees'] for e in errors),'maximumRelativePlanarAreaDifference':max(e['relativePlanarAreaDifference'] for e in errors),'allOriginalIdsAndCoreFieldsPreserved':True,'rawFeatures':len(rawbasins)})
report['limitations']='平面角度和面积差是制图概化核验指标，并非地面精度或水文模型验证；各相邻面分别概化，细小接缝不作为新的分水岭。'
output=Path('.local/basin-atlas-migration/auxiliary-independent-validation.json');output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
