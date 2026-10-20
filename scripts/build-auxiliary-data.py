"""Build versioned local city, level-3 catchment and plate-boundary layers.
Run with Python + shapely, pyshp, remotezip. Raw inputs stay in data/raw/auxiliary and data/raw/basin-atlas.
A repeat run checks cached inputs against the recorded manifest hashes.
"""
import hashlib,json,subprocess,sys,urllib.request
from pathlib import Path
import shapefile
from shapely.geometry import shape,mapping
RAW=Path('data/raw/auxiliary');RAW.mkdir(parents=True,exist_ok=True)
OUT=Path('public/data')
MANIFEST=Path('data/research/auxiliary-sources.json')
previous=json.loads(MANIFEST.read_text()) if MANIFEST.exists() else None
expected={i['path']:i['sha256'] for s in (previous or {}).get('sources',[]) for i in s['inputs']}
inputs=[]
def digest(b):return hashlib.sha256(b).hexdigest()
def cached(path,url):
 p=RAW/path
 if not p.exists():
  p.write_bytes(urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'TerraAtlas/1.0'}),timeout=60).read())
 b=p.read_bytes()
 if str(p) in expected and digest(b)!=expected[str(p)]:raise ValueError('Cached input changed: '+str(p))
 return b,{'path':str(p),'url':url,'sha256':digest(b),'bytes':len(b)}
def output(name,features):
 collection={'type':'FeatureCollection','features':features}
 p=OUT/name;p.write_text(json.dumps(collection,ensure_ascii=False,separators=(',',':'))+'\n')
 return {'path':'/data/'+name,'sha256':digest(p.read_bytes()),'bytes':p.stat().st_size,'features':len(features)}
def rounded(v):
 if isinstance(v,(list,tuple)):return [rounded(x) for x in v]
 return round(v,5) if isinstance(v,float) else v
commit='ca96624a56bd078437bca8184e78163e5039ad19'
city_url=f'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{commit}/geojson/ne_10m_populated_places.geojson'
b,city_input=cached('ne_10m_populated_places.geojson',city_url)
cities=[]
for f in json.loads(b)['features']:
 p=f['properties'];capital=bool(p.get('ADM0CAP'))
 # Representative cities, not a list of every settlement or a population ranking.
 rank=p.get('SCALERANK',10)
 if rank>7 and not capital:continue
 name=p.get('NAME_ZH') or p.get('NAME_EN') or p['NAME']
 props={'id':'city-ne-'+str(p['NE_ID']),'name':name,'nameEn':p.get('NAME_EN') or p['NAME'],'kind':'city','capital':capital,'country':p.get('ADM0NAME',''),'rank':rank,'minZoom':1.8 if capital else 2.5 if rank<=2 else 3.5 if rank<=4 else 5,'center':rounded(f['geometry']['coordinates']),'sourceId':'natural-earth-cities'}
 cities.append({'type':'Feature','geometry':{'type':'Point','coordinates':props['center']},'properties':props})
print('Cities',len(cities),flush=True)
plate_endpoint='https://earthquake.usgs.gov/arcgis/rest/services/eq/map_plateboundaries/MapServer/1/query'
b,ids_input=cached('usgs-plate-ids.json',plate_endpoint+'?where=1%3D1&returnIdsOnly=true&f=json')
plate_ids=sorted(json.loads(b)['objectIds']);plate_inputs=[ids_input];plate_features=[]
for start in range(0,len(plate_ids),500):
 plate_url=plate_endpoint+'?objectIds='+','.join(map(str,plate_ids[start:start+500]))+'&outFields=*&f=geojson&outSR=4326'
 b,plate_input=cached(f'usgs-plates-{start}.geojson',plate_url)
 page=json.loads(b);assert not page.get('exceededTransferLimit'),'Truncated plate page'
 plate_inputs.append(plate_input);plate_features.extend(page['features'])
assert len(plate_features)==len(plate_ids),'Incomplete plate response'
assert sorted(f['id'] for f in plate_features)==plate_ids,'Service IDs differ from catalog'
plate_data={'features':plate_features}
print('Plate fields',plate_data['features'][0]['properties'],flush=True)
plates=[]
names={'Convergent Boundary':('convergent','汇聚边界'),'Divergent Boundary':('divergent','分离边界'),'Transform Boundary':('transform','转换边界'),'Other':('other','其他边界')}
for index,f in enumerate(plate_data['features']):
 p=f['properties'];value=p.get('Type') or p.get('TYPE') or p.get('type')
 if value is None:
  value=next((v for v in p.values() if v in names),None)
 assert value in names,(p,value)
 kind,name=names[value]
 geom=shape(f['geometry']);assert geom.is_valid
 props={'id':'plate-usgs-'+str(f.get('id',index+1)),'name':name,'nameEn':value,'kind':'plate','boundaryType':kind,'sourceId':'usgs-plates'}
 if geom.geom_type not in ['LineString','MultiLineString']:raise ValueError(geom.geom_type)
 plates.append({'type':'Feature','geometry':{'type':geom.geom_type,'coordinates':rounded(mapping(geom)['coordinates'])},'properties':props})
# Basin geometry is regenerated exclusively from the pinned, separately reviewed
# official BasinATLAS archive; old HydroBASINS caches are never inputs.
subprocess.run([sys.executable,str(Path(__file__).with_name('build-basin-atlas.py'))],check=True)
basin_source=next(source for source in json.loads(MANIFEST.read_text())['sources'] if source['id']=='basinatlas-l3')
manifest={'reviewedAt':'2026-10-20','versionPolicy':'固定原始输入快照及SHA-256；复用缓存时严格核对，不把当前网页或服务数据当作持续更新。','sources':[
 {'id':'natural-earth-cities','version':'Natural Earth 5.1.2; repository '+commit,'license':'Public domain','documentationUrl':'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/','processing':'保留SCALERANK≤7的代表聚落及ADM0CAP标记；中文优先，缺失用英文；NE_ID用于稳定ID，按缩放逐步显示。无人口着色或排名。首都标记来自此固定版本，不表示2026年迁都状态。','inputs':[city_input],'outputs':[output('auxiliary-cities.geojson',cities)]},
 {'id':'usgs-plates','version':'USGS公开板块边界服务快照 2026-10-11；来源Bird (2003) PB2002','license':'USGS公开地理资料，保留原服务归属：Bird, P. (2003), An updated digital model of plate boundaries, DOI 10.1029/2001GC000252；USGS reuse policy https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits','documentationUrl':'https://earthquake.usgs.gov/arcgis/rest/services/eq/map_plateboundaries/MapServer','processing':'以WGS84按完整ID目录分批读取，核对全部ID，保留输入边界类别；只舍入坐标，不连接案例点或生成虚构边界。汇聚类别不进一步擅自划分俯冲/碰撞。','inputs':plate_inputs,'outputs':[output('auxiliary-plates.geojson',plates)]},
 basin_source
 ],'validation':{'method':'核对缓存SHA-256、源ID唯一、城市真实点位与筛选规则、板块源类别和完整响应、分区数量及面积属性、输出几何有效性；处理后的公开产物逐项记录SHA-256。','limitations':'全球及区域学习尺度；城市并非全部聚落；源版本首都标记非实时；流域边界与板块边界均经过概化，不用于工程、风险预测或精确测量。'}}
for p in [MANIFEST,OUT/'auxiliary-sources.json']:p.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('Outputs',[(s['id'],s['outputs'][0]['features'],s['outputs'][0]['bytes']) for s in manifest['sources']],flush=True)
