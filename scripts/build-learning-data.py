#!/usr/bin/env python3
"""Build auditable static learning layers from pinned real geographic data.

Runtime: Python with numpy, rasterio, shapely, pyproj (netCDF4 optional).
Only writes new learning data and its source/validation manifests.
Run from the repository root with the documented data environment active:
python scripts/build-learning-data.py
"""
from __future__ import annotations

import argparse
import collections
import csv
import hashlib
import html
import io
import json
import math
from pathlib import Path
import re
import urllib.request
import zipfile
from datetime import datetime, timezone

import numpy as np
import rasterio
from PIL import Image
from rasterio.windows import Window
from rasterio.features import rasterize
from rasterio.transform import from_origin
from pyproj import Geod
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data/raw/learning'
PUBLIC = ROOT / 'public/data'
RESEARCH = ROOT / 'data/research'
COMMIT = '144d6977b2b01ac1cbd220de754c0a005616760b'
NE_COMMIT = 'ca96624a56bd078437bca8184e78163e5039ad19'
SOURCE_SHA256 = {
    'languages_and_dialects_geo.csv':'e1b68f09acadda3610ecb6704ffe573fcf5b73411ad1ad1f6396a3ff9754e702',
    'glottolog_languoid.csv.zip':'47fcc04c18f3f6bff43198b5be14f1f6954600c90573373df9ecf6fc12622bfb',
    'ne_10m_admin_1_states_provinces.geojson':'22d0e3ad85eb3e27f17cabf8ba2d50e554fbc27a87796ff891d958185da62fb5',
    'climate_data_0p5.zip':'40e957d5085bb21ffdb3cbcda1f0fca4c75e2981a6a98ae48ea9fefc72e31c71',
    'GHS_POP_E2020_GLOBE_R2023A_4326_30ss_V1_0.tif':'b6eec24c613d0787c14166214865a3e0578b419ceebbaff00e46904e6a61e708',
    'factbook-json.zip':'939e98689cb8afec5cf7dfcfdc75bcdfe5434335143d42ea3ca7bd5c3f03cd34',
}
NOW = lambda: datetime.now(timezone.utc).isoformat()
for directory in (RAW, PUBLIC, RESEARCH):
    directory.mkdir(parents=True, exist_ok=True)


def sha(path: Path, algorithm='sha256'):
    digest = hashlib.new(algorithm)
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def write(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n')


def acquire(filename, url):
    path = RAW / filename
    if not path.exists():
        temp = path.with_suffix(path.suffix + '.part')
        with urllib.request.urlopen(url, timeout=90) as source, temp.open('wb') as target:
            while chunk := source.read(2 * 1024 * 1024):
                target.write(chunk)
        temp.replace(path)
    if filename in SOURCE_SHA256:
        assert sha(path)==SOURCE_SHA256[filename], f'Pinned source SHA-256 changed: {filename}'
    return path


def record(source, inputs, outputs, validation):
    manifest_path = RESEARCH / 'learning-data-sources.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {'sources': []}
    source['inputs'] = [{'path': str(p.relative_to(ROOT)), 'bytes': p.stat().st_size, 'sha256': sha(p)} for p in inputs]
    previous = next((s for s in manifest['sources'] if s['id'] == source['id']), None)
    source['retrievedAt'] = previous['retrievedAt'] if previous and previous.get('inputs') == source['inputs'] and previous.get('version') == source.get('version') else NOW()
    source['outputs'] = [{'path': str(p.relative_to(ROOT)), 'bytes': p.stat().st_size, 'sha256': sha(p), **({'published': False} if p == RESEARCH / 'learning-population.geojson' else {})} for p in outputs]
    manifest['sources'] = [s for s in manifest['sources'] if s['id'] != source['id']] + [source]
    manifest['generatedAt'] = NOW()
    write(manifest_path, manifest)
    write(PUBLIC / 'learning-data-sources.json', manifest)
    vp = RESEARCH / 'learning-validation.json'
    result = json.loads(vp.read_text()) if vp.exists() else {'checks': {}}
    result['checks'][source['id']] = validation
    result['generatedAt'] = NOW()
    write(vp, result)
    print(source['id'], validation, flush=True)


FAMILY_ZH = {
    'Sino-Tibetan': '汉藏语系', 'Indo-European': '印欧语系', 'Afro-Asiatic': '亚非语系',
    'Austronesian': '南岛语系', 'Austroasiatic': '南亚语系', 'Atlantic-Congo': '大西洋—刚果语系',
    'Dravidian': '达罗毗荼语系', 'Turkic': '突厥语系', 'Uralic': '乌拉尔语系',
    'Tai-Kadai': '壮侗语系', 'Hmong-Mien': '苗瑶语系', 'Japonic': '日本语系',
    'Koreanic': '朝鲜语系', 'Mongolic-Khitan': '蒙古—契丹语系', 'Tungusic': '通古斯语系',
    'Eskimo-Aleut': '爱斯基摩—阿留申语系', 'Trans-New Guinea': '跨新几内亚语系',
    'Nuclear Trans New Guinea': '核心跨新几内亚语系', 'Pama-Nyungan': '帕马—恩永甘语系',
    'Uto-Aztecan': '犹他—阿兹特克语系', 'Arawakan': '阿拉瓦克语系', 'Cariban': '加勒比语系',
    'Tupian': '图皮语系', 'Quechuan': '克丘亚语系', 'May an': '玛雅语系', 'Mayan': '玛雅语系',
    'Kartvelian': '南高加索语系', 'Nakh-Daghestanian': '东北高加索语系',
    'Abkhaz-Adyge': '西北高加索语系', 'Nubian': '努比亚语系', 'Nilotic': '尼罗语系',
}
LANG_ZH = {
    'Mandarin Chinese': '官话', 'Yue Chinese': '粤语', 'Wu Chinese': '吴语', 'Hakka Chinese': '客家话',
    'Southern Min': '闽南语', 'Gan Chinese': '赣语', 'Xiang Chinese': '湘语',
    'English': '英语', 'French': '法语', 'German': '德语', 'Spanish': '西班牙语', 'Portuguese': '葡萄牙语',
    'Russian': '俄语', 'Japanese': '日语', 'Korean': '朝鲜语', 'Hindi': '印地语', 'Bengali': '孟加拉语',
    'Urdu': '乌尔都语', 'Tamil': '泰米尔语', 'Telugu': '泰卢固语', 'Vietnamese': '越南语',
    'Thai': '泰语', 'Indonesian': '印度尼西亚语', 'Turkish': '土耳其语', 'Modern Hebrew': '现代希伯来语',
    'Standard Arabic': '标准阿拉伯语', 'Egyptian Arabic': '埃及阿拉伯语', 'Uyghur': '维吾尔语',
    'Central Tibetan': '中部藏语', 'Halh Mongolian': '喀尔喀蒙古语', 'Northern Zhuang': '北部壮语',
    'Kazakh': '哈萨克语', 'Italian': '意大利语', 'Modern Greek': '现代希腊语', 'Dutch': '荷兰语',
    'Polish': '波兰语', 'Finnish': '芬兰语', 'Hungarian': '匈牙利语', 'Swedish': '瑞典语',
    'Swahili': '斯瓦希里语', 'Hausa': '豪萨语', 'Yoruba': '约鲁巴语', 'Amharic': '阿姆哈拉语',
}
PALETTE = ['#cf7641', '#2b8e82', '#d6a94f', '#627cb8', '#ac6aa1', '#6a9859', '#be615d', '#80909c', '#48a9b5', '#a28a54', '#936eba', '#ce8d91']


def build_languages():
    base = 'https://cdstar.eva.mpg.de//bitstreams/EAEA0-608B-9919-A962-0/'
    geo = acquire('languages_and_dialects_geo.csv', base + 'languages_and_dialects_geo.csv')
    archive = acquire('glottolog_languoid.csv.zip', base + 'glottolog_languoid.csv.zip')
    with zipfile.ZipFile(archive) as z:
        rows = list(csv.DictReader(io.StringIO(z.read('languoid.csv').decode())))
    all_rows = {r['id']: r for r in rows}
    macroareas = {r['glottocode']: r['macroarea'] for r in csv.DictReader(geo.open())}
    accepted = [r for r in rows if r['level'] == 'language' and r['bookkeeping'] != 'True' and r['latitude'] and r['longitude']]
    counts = collections.Counter(r['family_id'] or 'isolate' for r in accepted)
    families = []
    family_index = {}
    for i, (fid, count) in enumerate(counts.most_common()):
        english = all_rows[fid]['name'] if fid != 'isolate' else 'Language isolates'
        item = {'id': fid, 'name': FAMILY_ZH.get(english, '孤立语言' if fid == 'isolate' else english), 'nameEn': english, 'color': PALETTE[i % len(PALETTE)], 'count': count}
        family_index[fid] = item
        families.append(item)
    features = []
    for r in accepted:
        fid = r['family_id'] or 'isolate'
        f = family_index[fid]
        coords = [round(float(r['longitude']), 5), round(float(r['latitude']), 5)]
        assert -180 <= coords[0] <= 180 and -90 <= coords[1] <= 90
        p = {'id': 'language-' + r['id'], 'glottocode': r['id'], 'name': LANG_ZH.get(r['name'], r['name']), 'nameEn': r['name'], 'iso6393': r['iso639P3code'] or None, 'familyId': fid, 'family': f['name'], 'familyEn': f['nameEn'], 'color': f['color'], 'macroarea': macroareas.get(r['id'], ''), 'countryCodes': r['country_ids'].split() if r['country_ids'] else [], 'sourceId': 'glottolog-5.3', 'kind': 'language', 'level': 'language'}
        features.append({'type': 'Feature', 'id': p['id'], 'geometry': {'type': 'Point', 'coordinates': coords}, 'properties': p})
    note = '语言点是Glottolog所记录的地理参考位置，包含濒危或已消亡语言；不表示使用人口、官方地位、连续使用区或精确边界。仅language层级，未混入dialect或family。'
    out = PUBLIC / 'learning-languages.geojson'
    legend = PUBLIC / 'learning-language-families.json'
    write(out, {'type': 'FeatureCollection', 'sourceId': 'glottolog-5.3', 'version': '5.3', 'note': note, 'features': features})
    write(legend, {'sourceId': 'glottolog-5.3', 'version': '5.3', 'note': note, 'families': families})
    record({'id': 'glottolog-5.3', 'title': 'Glottolog 5.3语言地理参考点', 'url': 'https://glottolog.org/meta/downloads', 'downloadUrls': [base + 'glottolog_languoid.csv.zip', base + 'languages_and_dialects_geo.csv'], 'version': '5.3', 'period': 'Glottolog 5.3版本快照，语种并非同年人口调查', 'license': 'CC BY 4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/', 'attribution': 'Hammarström, Harald & Forkel, Robert & Haspelmath, Martin & Bank, Sebastian. Glottolog 5.3.', 'processing': note, 'coverage': {'features': len(features), 'families': len(families)}}, [geo, archive], [out, legend], {'valid': True, 'languageOnly': True, 'featureCount': len(features), 'uniqueIds': len(set(f['id'] for f in features)), 'noCoordinatesExcluded': sum(1 for r in rows if r['level'] == 'language' and not (r['latitude'] and r['longitude']))})


PROVINCE_CODES = {'Beijing':'11','Tianjin':'12','Hebei':'13','Shanxi':'14','Inner Mongol':'15','Liaoning':'21','Jilin':'22','Heilongjiang':'23','Shanghai':'31','Jiangsu':'32','Zhejiang':'33','Anhui':'34','Fujian':'35','Jiangxi':'36','Shandong':'37','Henan':'41','Hubei':'42','Hunan':'43','Guangdong':'44','Guangxi':'45','Hainan':'46','Chongqing':'50','Sichuan':'51','Guizhou':'52','Yunnan':'53','Xizang':'54','Shaanxi':'61','Gansu':'62','Qinghai':'63','Ningxia':'64','Xinjiang':'65'}


def rounded_geometry(geometry, digits=4):
    def rounded(x):
        return [rounded(y) for y in x] if isinstance(x, (tuple, list)) else round(float(x), digits)
    return {'type': geometry['type'], 'coordinates': rounded(geometry['coordinates'])}


def build_provinces():
    url = f'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{NE_COMMIT}/geojson/ne_10m_admin_1_states_provinces.geojson'
    raw = acquire('ne_10m_admin_1_states_provinces.geojson', url)
    fs = json.loads(raw.read_text())['features']
    groups = collections.defaultdict(list)
    props = {}
    for f in fs:
        p = f['properties']; adm = p.get('adm0_a3'); name = p.get('name')
        if adm == 'CHN':
            code = '46' if name == 'Paracel Islands' else PROVINCE_CODES.get(name)
            assert code, name
            if name != 'Paracel Islands': props[code] = (p.get('name_zh') or name, name, p.get('iso_3166_2'))
        elif adm in ('TWN','HKG','MAC'):
            code = {'TWN':'71','HKG':'81','MAC':'82'}[adm]
            props[code] = {'TWN':('台湾','Taiwan','CN-71'), 'HKG':('香港特别行政区','Hong Kong','CN-81'), 'MAC':('澳门特别行政区','Macau','CN-82')}[adm]
        else: continue
        groups[code].append(shape(f['geometry']))
    features = []
    for code, geoms in sorted(groups.items()):
        geom = unary_union(geoms).simplify(0.006, preserve_topology=True)
        assert geom.is_valid
        zh, en, source_iso = props[code]
        center = geom.representative_point()
        p = {'id': 'province-cn-' + code, 'name': zh, 'nameEn': en, 'code': code, 'isoCode': 'CN-' + code, 'sourceISO': source_iso, 'aliases': [zh, en], 'kind': 'province', 'sourceId': 'natural-earth-10m-admin1-learning', 'center': [round(center.x, 4), round(center.y, 4)], 'bbox': [round(v, 4) for v in geom.bounds]}
        g = rounded_geometry(mapping(geom))
        assert shape(g).is_valid
        features.append({'type': 'Feature', 'id': p['id'], 'properties': p, 'geometry': g})
    out = PUBLIC / 'learning-provinces.geojson'
    note = 'Natural Earth 1:1000万概化行政范围；香港、澳门、台湾由原始真实Admin-1单元合并，西沙标签单元并入海南。中文省级名称及GB/T省级代码用于学习导航；沿用Natural Earth原始地理表达，不能作为法定边界或测绘依据。'
    write(out, {'type':'FeatureCollection', 'sourceId': 'natural-earth-10m-admin1-learning', 'note': note, 'features': features})
    record({'id': 'natural-earth-10m-admin1-learning', 'title': 'Natural Earth中国省级学习范围', 'url': 'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/', 'downloadUrls':[url], 'version': NE_COMMIT, 'period':'Natural Earth数据版本快照', 'license':'Public domain', 'licenseUrl':'https://www.naturalearthdata.com/about/terms-of-use/', 'processing':note + ' 简化0.006度，保拓扑，坐标保留4位小数。', 'coverage': {'features':len(features)}}, [raw], [out], {'valid': True, 'features':len(features), 'ids':[f['id'] for f in features]})


# City coordinates are explicit named sample sites, not fabricated climate values.
CLIMATE_PLACES = [
 ('chengdu','成都',104.0665,30.5728),('lhasa','拉萨',91.1322,29.6604),('guangzhou','广州',113.2644,23.1291),('hohhot','呼和浩特',111.7492,40.8426),
 ('beijing','北京',116.4074,39.9042),('shanghai','上海',121.4737,31.2304),('harbin','哈尔滨',126.6424,45.7569),('urumqi','乌鲁木齐',87.6168,43.8256),
 ('kunming','昆明',102.8329,24.8801),('wuhan','武汉',114.3055,30.5928),('xian','西安',108.9398,34.3416),('lanzhou','兰州',103.8343,36.0611),
 ('xining','西宁',101.7782,36.6171),('haikou','海口',110.3312,20.0310),('nanjing','南京',118.7969,32.0603),('chongqing','重庆',106.5516,29.5630),
 ('fuzhou','福州',119.2965,26.0745),('jinan','济南',117.1201,36.6512),('shenyang','沈阳',123.4315,41.8057),('yinchuan','银川',106.2309,38.4872),
 ('taipei','台北',121.5654,25.0330),('hong-kong','香港',114.1694,22.3193),('tokyo','东京',139.6917,35.6895),('seoul','首尔',126.9780,37.5665),
 ('new-delhi','新德里',77.2090,28.6139),('mumbai','孟买',72.8777,19.0760),('bangkok','曼谷',100.5018,13.7563),('singapore','新加坡',103.8198,1.3521),
 ('jakarta','雅加达',106.8456,-6.2088),('dubai','迪拜',55.2708,25.2048),('cairo','开罗',31.2357,30.0444),('nairobi','内罗毕',36.8219,-1.2921),
 ('cape-town','开普敦',18.4241,-33.9249),('lagos','拉各斯',3.3792,6.5244),('paris','巴黎',2.3522,48.8566),('london','伦敦',-0.1276,51.5074),
 ('berlin','柏林',13.4050,52.5200),('moscow','莫斯科',37.6173,55.7558),('rome','罗马',12.4964,41.9028),('madrid','马德里',-3.7038,40.4168),
 ('oslo','奥斯陆',10.7522,59.9139),('helsinki','赫尔辛基',24.9384,60.1699),('reykjavik','雷克雅未克',-21.9426,64.1466),('new-york','纽约',-74.0060,40.7128),
 ('los-angeles','洛杉矶',-118.2437,34.0522),('chicago','芝加哥',-87.6298,41.8781),('mexico-city','墨西哥城',-99.1332,19.4326),('vancouver','温哥华',-123.1207,49.2827),
 ('sao-paulo','圣保罗',-46.6333,-23.5505),('buenos-aires','布宜诺斯艾利斯',-58.3816,-34.6037),('lima','利马',-77.0428,-12.0464),('santiago','圣地亚哥',-70.6693,-33.4489),
 ('sydney','悉尼',151.2093,-33.8688),('melbourne','墨尔本',144.9631,-37.8136),('perth','珀斯',115.8605,-31.9505),('auckland','奥克兰',174.7633,-36.8485),
 ('kathmandu','加德满都',85.3240,27.7172),('addis-ababa','亚的斯亚贝巴',38.7578,8.9806),('tehran','德黑兰',51.3890,35.6892),('tashkent','塔什干',69.2401,41.2995),
]


def build_climate():
    url = 'https://ndownloader.figshare.com/files/61012816'
    archive = acquire('climate_data_0p5.zip', url)
    expected_md5 = '55db93d0a71c9d22879f5efe3aaf8ff8'
    assert sha(archive, 'md5') == expected_md5, 'Beck V3 archive MD5 differs from fixed Figshare record'
    with zipfile.ZipFile(archive) as z:
        for n in ['1991_2020/ensemble_mean_0p5.nc','1991_2020/ensemble_std_0p5.nc']:
            z.extract(n, RAW / 'climate')
    mean = RAW / 'climate/1991_2020/ensemble_mean_0p5.nc'
    std = RAW / 'climate/1991_2020/ensemble_std_0p5.nc'
    places = []
    sources = [rasterio.open(f'netcdf:"{p}":{v}') for p in (mean,std) for v in ('air_temperature','precipitation')]
    kg = rasterio.open(ROOT / 'data/raw/climate/1991_2020/koppen_geiger_0p5.tif')
    try:
        for s in sources:
            assert s.count == 12 and s.width == 720 and s.height == 360
            assert s.tags()['NETCDF_DIM_time_VALUES'] == '{1,2,3,4,5,6,7,8,9,10,11,12}'
        for pid, name, lon, lat in CLIMATE_PLACES:
            row, col = sources[0].index(lon,lat)
            sample = list(sources[0].xy(row,col))
            # Coastal cities may fall into an ocean/no-data climate pixel. Choose
            # closest complete land pixel within 1 degree and disclose movement.
            choices = []
            for rr in range(max(0,row-2),min(360,row+3)):
                for cc in range(max(0,col-2),min(720,col+3)):
                    vals = [s.read(window=Window(cc,rr,1,1)).reshape(12) for s in sources]
                    if all(np.all(np.isfinite(v)) and np.all(v != s.nodata) for v,s in zip(vals,sources)):
                        xy = list(sources[0].xy(rr,cc)); d = ((xy[0]-lon)*math.cos(math.radians(lat)))**2 + (xy[1]-lat)**2
                        choices.append((d,rr,cc,xy,vals))
            assert choices, (pid, 'no nearby complete land climate cell')
            _,rr,cc,sample,vals = min(choices,key=lambda c:c[0])
            t,p,ts,ps = [[round(float(x),3) for x in v] for v in vals]
            assert all(-100 < x < 70 for x in t) and all(x >= 0 for x in p)
            moved = rr != row or cc != col
            distance = Geod(ellps='WGS84').inv(lon,lat,*sample)[2]/1000
            kgvalue = int(kg.read(1,window=Window(cc,rr,1,1))[0,0])
            places.append({'id':'climate-place-'+pid,'name':name,'coordinates':[lon,lat], 'sampleCoordinates':sample,'sampleDistanceKm':round(distance,2),'sampling':'nearest complete land pixel within 1 degree' if moved else 'containing grid cell', 'temperature':t,'precipitation':p,'temperatureStd':ts,'precipitationStd':ps,'annualTemperature':round(sum(t)/12,2),'annualPrecipitation':round(sum(p),1),'climateValue':kgvalue,'sourceId':'beck-v3-monthly-1991-2020'})
    finally:
        for s in sources: s.close()
        kg.close()
    out = PUBLIC / 'learning-climate.json'
    note = '1991–2020长期月平均气温与月降水；集合均值及集合标准差，非实时天气或站点观测。0.5°网格约56km（赤道），山地和海岸局地差异可能明显。取城市所在有效格网；海岸缺测时透明记录最近完整陆地格网位置及距离。未重新推导或更改Köppen–Geiger分类。'
    write(out, {'period':'1991–2020','resolution':0.5,'resolutionDegrees':0.5,'sourceId':'beck-v3-monthly-1991-2020','version':'V3, January 2026 correction','months':list(range(1,13)),'units':{'temperature':'°C','precipitation':'mm/month'},'note':note,'places':places})
    record({'id':'beck-v3-monthly-1991-2020','title':'Beck V3 1991–2020月气温与降水气候平均', 'url':'https://figshare.com/articles/dataset/High-resolution_1_km_K_ppen-Geiger_maps_for_1901_2099_based_on_constrained_CMIP6_projections/21789074','downloadUrls':[url],'version':'V3, January 2026 correction; file 61012816','archiveMd5':expected_md5,'period':'1991–2020','license':'CC BY 4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','attribution':'Beck et al. (2023), Scientific Data 10, 724; January 2026 correction. doi:10.1038/s41597-023-02549-6','processing':note,'coverage':{'places':len(places),'months':12}},[archive,mean,std],[out],{'valid':True,'archiveMd5Verified':True,'places':len(places),'months':12,'monthlyVariablesVerified':True,'coastalSamplesMoved':[p['id'] for p in places if p['sampling']!='containing grid cell'],'allFinite':True})


RELIGIONS = [('christian','基督宗教','#628db6'),('muslim','伊斯兰教','#3c9a82'),('hindu','印度教','#d48b42'),('buddhist','佛教','#d4b650'),('jewish','犹太教','#a17ab4'),('folk','民间与传统宗教','#aa7857'),('other','其他宗教','#87939e'),('unaffiliated','无宗教归属','#788f72')]


def clean(text):
    return re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',html.unescape(text))).strip()


def category(label):
    x = label.lower()
    if re.search(r'unspecified|no response|no answer|undeclared|don.t know|refus|not stat|not describ|unreported',x): return None
    if re.search(r'other (?:or|and) (?:none|unaffiliated)|none or (?:unspecified|refused)|none/unspecified|agnostics? and other|other religions and traditional spirituality',x): return None
    major_groups=[r'christ|catholic|protestant|orthodox',r'muslim|islam|sunni|shia',r'hindu',r'buddh',r'jew|juda']
    if sum(bool(re.search(pattern,x)) for pattern in major_groups)>1:return None
    if re.search(r'buddhist or taoist|buddhist and',x): return None
    if re.search(r'muslim|islam|sunni|shia|shiite|ibadi',x): return 'muslim'
    if re.search(r'christ|catholic|protestant|orthodox|evangelical|anglican|lutheran|baptist|methodist|presbyterian|pentecost|adventist|jehovah|mormon|kimbangu|salutiste|apostolic|assembly of god|brethren|moravian|uniting church|new apostolic|salvation army|latter day saints|calvinist|reformed|church of norway|church of sweden|ekalesia niue',x): return 'christian'
    if re.search(r'hindu',x): return 'hindu'
    if re.search(r'buddh',x): return 'buddhist'
    if re.search(r'jew|juda',x): return 'jewish'
    if re.search(r'folk|traditional|indigenous|animis|ethnic religion|badimo|vodou|taois|shinto|confucian|umbanda|candombl',x): return 'folk'
    if re.search(r'none|unaffiliat|atheis|agnostic|no religion|non.?religious|not religious|non.?believ|nothing in particular',x): return 'unaffiliated'
    if re.search(r'other|sikh|baha|bahá|jain|spirit|spirt|rastafar|zoroas|druze|santeria|tenrikyo|cao dai|hoa hao',x): return 'other'
    return None


def outside_parentheses(text):
    depth = 0; result = []
    for ch in text:
        if ch in '([': depth += 1; result.append(' ')
        elif ch in ')]': depth = max(0,depth-1); result.append(' ')
        elif depth == 0: result.append(ch)
    return ''.join(result)


def build_religion():
    url = f'https://codeload.github.com/factbook/factbook.json/zip/{COMMIT}'
    archive = acquire('factbook-json.zip',url)
    rawcountries = json.loads((ROOT/'data/raw/ne_50m_admin_0_countries.geojson').read_text())['features']
    current = {f['properties']['id']:f['properties'] for f in json.loads((PUBLIC/'countries.geojson').read_text())['features']}
    fips = {}; names = {}
    for f in rawcountries:
        p=f['properties']; iso=p.get('ISO_A3_EH')
        if not iso or iso=='-99':iso=p['ADM0_A3']
        cid='country-'+p['ADM0_A3'].lower()
        if cid not in current:continue
        obj=(iso,cid,current[cid])
        fips[p['FIPS_10'].lower()]=obj
        for key in ['ADMIN','NAME','NAME_LONG','NAME_EN','NAME_CIAWF','FORMAL_EN']:
            if p.get(key):names[clean(p[key]).lower()]=obj
    manual = {'Cabo Verde':'CPV','Czechia':'CZE','Congo, Democratic Republic of the':'COD','Congo, Republic of the':'COG','Korea, North':'PRK','Korea, South':'KOR','Burma':'MMR','Eswatini':'SWZ','The Bahamas':'BHS','The Gambia':'GMB','Timor-Leste':'TLS','West Bank':'PSE','Gaza Strip':'PSE'}
    byiso={v[0]:v for v in names.values()}
    results={}; missing=[]; unmapped_groups=[]
    with zipfile.ZipFile(archive) as z:
        assert all(COMMIT in n.split('/')[0] for n in z.namelist()), 'Factbook archive must be fixed commit'
        for n in z.namelist():
            if not n.endswith('.json') or '/meta/' in n:continue
            o=json.loads(z.read(n)); rel=o.get('People and Society',{}).get('Religions',{})
            if not rel:continue
            cname=o.get('Government',{}).get('Country name',{}).get('conventional short form',{}).get('text','')
            target=names.get(clean(cname).lower()) or byiso.get(manual.get(clean(cname))) or fips.get(Path(n).stem)
            if not target:missing.append({'file':n,'name':cname});continue
            iso,cid,cp=target
            if iso == 'PSE':
                missing.append({'countryId':cid,'file':n,'reason':'West Bank/Gaza have separate denominators; no full-territory value inferred'})
                continue
            text=clean(rel.get('text') or rel.get('religious affiliation',{}).get('text',''))
            if not text:continue
            notes=clean(rel.get('note','') + ' ' + rel.get('notes',''))
            years=re.findall(r'\b(?:19|20)\d{2}(?:[–-]\d{2,4})?\b',text)
            period=years[-1] if years else None
            year=int(period[:4]) if period and '-' not in period and '–' not in period else None
            groups=[]; shares={k:None for k,_,_ in RELIGIONS}; uncertain=set()
            core=outside_parentheses(text)
            threshold_tail=re.search(r';\s*less than\s+(\d*\.?\d+)%\s*:\s*(.*)',core,re.I)
            if threshold_tail: core=core[:threshold_tail.start()]
            # Do not silently repair malformed source percentages or take range midpoints.
            malformed=bool(re.search(r'\d+/\d+%',core))
            for m in re.finditer(r'([^%,;:]+?)\s+([<>≤≥]?\s*\d*\.?\d+(?:\s*[-–]\s*\d*\.?\d+)?)\s*%',core if not malformed else ''):
                label=m[1].strip();value=m[2].strip();cat=category(label)
                numbers=[float(x) for x in re.findall(r'\d*\.?\d+',value)]
                exact=len(numbers)==1 and not re.search(r'[<>≤≥]',value)
                g={'nameEn':label,'valueText':value+'%','category':cat,'share':numbers[0] if exact else None}
                if len(numbers)>1:g['bounds']=numbers
                elif not exact:g['upperBound' if '<' in value or '≤' in value else 'lowerBound']=numbers[0]
                groups.append(g)
                if cat and exact:shares[cat]=round((shares[cat] or 0)+numbers[0],3)
                elif cat:uncertain.add(cat)
                elif exact:unmapped_groups.append({'countryId':cid,'label':label,'share':numbers[0]})
            if threshold_tail:
                upper=float(threshold_tail[1])
                for label in re.split(r',|;',threshold_tail[2]):
                    label=label.strip().rstrip('.')
                    if not label:continue
                    cat=category(label)
                    groups.append({'nameEn':label,'valueText':f'<{upper:g}%','category':cat,'share':None,'upperBound':upper})
                    if cat:uncertain.add(cat)
            for cat in uncertain:shares[cat]=None
            if malformed:shares={k:None for k,_,_ in RELIGIONS}
            scope='population'
            if re.search(r'claiming a religious affiliation|among.*affiliat',notes,re.I):scope='affiliated'
            if re.search(r'practicing worship',notes,re.I):scope='practicing'
            if re.search(r'citizen population|do not include.*refugee',notes,re.I):scope='citizens'
            if re.search(r'years of age|aged?\s+\d+|population \d+ years|ages? \d+|adults',notes,re.I):scope='age-limited'
            total=sum(g['share'] or 0 for g in groups)
            if total>103:
                scope='mixed'
                shares={k:None for k,_,_ in RELIGIONS}
            known={k:v for k,v in shares.items() if v is not None}
            largest=max(known,key=known.get) if known and scope=='population' and not malformed else None
            # An unclassified combined group or an uncertain category may be
            # larger than every exact value. Never color that country as a
            # smaller, merely easier-to-parse religion (e.g. Iraq, Greece, HK).
            if largest:
                candidate=known[largest]
                for cat in uncertain:
                    possible=sum(g['share'] if g['share'] is not None else (g.get('upperBound') or (g.get('bounds') or [0,100])[-1]) for g in groups if g['category']==cat)
                    if possible>=candidate:largest=None;break
                if largest and any(g['category'] is None and (g['share'] or g.get('upperBound') or (g.get('bounds') or [0])[-1])>=candidate for g in groups):largest=None
            r={'iso3':iso,'countryId':cid,'name':cp['name'],'nameEn':cp['nameEn'],'year':year,'period':period,'shares':shares,'reportedGroups':groups,'largestReportedCategory':largest,'scope':scope,'sourceText':text,'notes':notes,'sourceId':'cia-factbook-religion-snapshot','sourceFile':n.split('/',1)[-1],'reportedExactTotal':round(total,3),'quality':'source-malformed' if malformed else ('partial' if total<97 else 'reported-composition')}
            if cid in results:
                # West Bank and Gaza are separate Factbook entries, so cannot be
                # merged into a Palestine-wide proportion without population weights.
                results.pop(cid,None);missing.append({'countryId':cid,'reason':'multiple territory denominators; excluded rather than merge'});continue
            results[cid]=r
    out=PUBLIC/'learning-human.json'
    note='CIA World Factbook历史国家资料，快照固定2026年前，资料年份及统计口径逐国不同；不是统一2020宗教调查。八类是学习展示归并，不改变来源估计。国家着色不能代表内部每位居民或局地分布；未报告类别为null，阈值与范围不取中点，不归一化到100%。民间/传统宗教含源列的神道、道教等；其他宗教含锡克教等；混合或未明确类别保留原项、不强行分配。'
    write(out,{'religion':{'year':None,'period':'各国条目资料年份不同','sourceId':'cia-factbook-religion-snapshot','snapshotCommit':COMMIT,'categories':[{'id':k,'name':n,'color':c} for k,n,c in RELIGIONS],'note':note,'countries':sorted(results.values(),key=lambda r:r['iso3'])}})
    record({'id':'cia-factbook-religion-snapshot','title':'CIA World Factbook国家宗教构成历史资料','url':'https://github.com/factbook/factbook.json','downloadUrls':[url],'version':COMMIT,'period':'逐国保留原始条目资料年份','license':'US government public domain; mirror CC0-1.0','licenseUrl':f'https://github.com/factbook/factbook.json/blob/{COMMIT}/LICENSE.md','processing':note,'coverage':{'countries':len(results),'countriesWithPercentages':sum(bool(r['reportedGroups']) for r in results.values())},'alternativeToPew':'Pew 2020全表需账户且条款限制full/substantially full再发布，故未复制该全表。','alternativeSourceUrl':'https://www.pewresearch.org/about/terms-and-conditions/'},[archive],[out],{'valid':True,'countries':len(results),'missingOrExcluded':missing,'unmappedReportedGroups':unmapped_groups,'nonPopulationScopes':[r['countryId'] for r in results.values() if r['scope']!='population'],'noImplicitZeros':True,'noMidpoints':True})


def build_population():
    url='https://jrc-ghsl.s3.eu-central-1.amazonaws.com/ghs-pop/r2023a/4326/30asec/2020/GHS_POP_E2020_GLOBE_R2023A_4326_30ss_V1_0.tif'
    raw=acquire('GHS_POP_E2020_GLOBE_R2023A_4326_30ss_V1_0.tif',url)
    assert raw.stat().st_size == 424616290, 'GHS-POP source file is incomplete or differs from pinned AWS object'
    totals=np.zeros((360,720),dtype=np.float64);valid=np.zeros((360,720),dtype=bool)
    original_total=0.
    with rasterio.open(raw) as s:
        print('population input',s.width,s.height,s.transform,s.dtypes,s.nodata,flush=True)
        assert s.width==43202 and s.height==21384 and abs(s.transform.a-1/120)<1e-8
        latitudes=s.transform.f+(np.arange(s.height)+.5)*s.transform.e
        lat_bins=np.floor((90-latitudes)/.5).astype(int)
        longitudes=s.transform.c+(np.arange(s.width)+.5)*s.transform.a
        lon_bins=np.floor((((longitudes+180)%360)-180+180)/.5).astype(int)
        assert np.array_equal(lon_bins[1:-1],np.repeat(np.arange(720),60))
        assert lon_bins[0]==719 and lon_bins[-1]==0
        for r in range(360):
            rows=np.flatnonzero(lat_bins==r)
            if not len(rows):continue
            values=s.read(1,window=Window(0,int(rows[0]),s.width,len(rows)))
            mask=np.isfinite(values)&(values!=s.nodata)&(values>=0)
            safe=np.where(mask,values,0.)
            original_total+=float(safe.sum(dtype=np.float64))
            totals[r]=safe[:,1:-1].reshape(len(rows),720,60).sum(axis=(0,2),dtype=np.float64)
            # The source has a one-pixel guard column on either side of the
            # antimeridian. Assign its real counts by wrapped pixel center.
            totals[r,719]+=float(safe[:,0].sum(dtype=np.float64))
            totals[r,0]+=float(safe[:,-1].sum(dtype=np.float64))
            valid[r]=mask[:,1:-1].reshape(len(rows),720,60).any(axis=(0,2))
            if r%60==0:print('population latitude rows',r,flush=True)
    # Source oceans are encoded as zero, not tagged no-data. Mask ocean-only
    # cells for an honest residential land map, while preserving every actual
    # positive population cell (including islands omitted at NE50m scale).
    land=json.loads((PUBLIC/'land.geojson').read_text())['features']
    land_mask=rasterize([(f['geometry'],1) for f in land],out_shape=(360,720),transform=from_origin(-180,90,.5,.5),all_touched=True).astype(bool)
    valid &= land_mask | (totals>0)
    # Ellipsoidal area of a lat/lon rectangle uses parallels, not a planar
    # degree-square approximation. Integrate WGS84 area element analytically.
    a=6378137.;e2=0.0066943799901413165;e=math.sqrt(e2)
    def integral(latitude):
        u=math.sin(math.radians(latitude))
        return a*a*(1-e2)*(u/(2*(1-e2*u*u))+math.atanh(e*u)/(2*e))
    areas=np.array([math.radians(.5)*(integral(90-r*.5)-integral(89.5-r*.5))/1e6 for r in range(360)])
    density=totals/areas[:,None]
    assert np.all(np.isfinite(density)) and np.all(density>=0)
    assert math.isclose(float(totals.sum()),original_total,rel_tol=1e-12)
    features=[]
    for r,c in zip(*np.where(valid)):
        north=90-int(r)*.5;west=-180+int(c)*.5;pid=f'pop-r{r}-c{c}'
        p={'id':pid,'population':round(float(totals[r,c]),2),'density':round(float(density[r,c]),3),'areaKm2':round(float(areas[r]),3),'year':2020,'sourceId':'ghs-pop-2020','row':int(r),'col':int(c)}
        features.append({'type':'Feature','id':pid,'properties':p,'geometry':{'type':'Polygon','coordinates':[[[west,north],[west+.5,north],[west+.5,north-.5],[west,north-.5],[west,north]]]}})
    note='JRC GHS-POP R2023A 2020居住人口估计，原始30角秒格网人口数按像元中心归入0.5°并逐格求和；源边缘像元经度按日期变更线回绕。密度=格网总人口/WGS84椭球完整0.5°格网面积（包含格网内水域），单位人/km²。原始人口分配模型不是逐户实测，海岸及城市有概化。无有效源数据及纯海洋格网为null；Natural Earth50m陆地掩膜内有效格网0人口保留为0，真实正人口格网无论掩膜均保留。不是国家平均密度。'
    # Keep the vector grid for independent validation; the site uses raster tiles.
    out=RESEARCH/'learning-population.geojson';grid=PUBLIC/'learning-population.json'
    write(out,{'type':'FeatureCollection','sourceId':'ghs-pop-2020','year':2020,'resolutionDegrees':.5,'note':note,'features':features})
    data=[]
    for r in range(360):data.append([round(float(v),3) if valid[r,c] else None for c,v in enumerate(density[r])])
    write(grid,{'year':2020,'sourceId':'ghs-pop-2020','width':720,'height':360,'west':-180,'north':90,'resolutionDegrees':.5,'units':'people/km²','noData':None,'note':note,'values':data})
    record({'id':'ghs-pop-2020','title':'JRC GHS-POP 2020局地人口密度','url':'https://human-settlement.emergency.copernicus.eu/ghs_pop2023.php','downloadUrls':[url],'version':'GHS_POP_E2020_GLOBE_R2023A_4326_30ss_V1_0','period':2020,'license':'CC BY 4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','attribution':'European Commission, Joint Research Centre (JRC), GHS-POP R2023A, 2020; Schiavina, Freire & MacManus.','processing':note,'maskSource':{'id':'natural-earth-50m-land','url':'https://www.naturalearthdata.com/downloads/50m-physical-vectors/50m-land/','version':NE_COMMIT,'license':'Public domain'},'coverage':{'validGridCells':len(features),'sourceResolutionArcSeconds':30,'outputResolutionDegrees':.5}},[raw,PUBLIC/'land.geojson'],[out,grid],{'valid':True,'validCells':len(features),'sourcePopulationTotal':original_total,'aggregatePopulationTotal':float(totals.sum()),'massConservationRelativeError':abs(float(totals.sum())-original_total)/original_total,'minDensity':float(density[valid].min()),'maxDensity':float(density[valid].max()),'wholeEarthAreaKm2':float(areas.sum()*720),'noDataCells':int((~valid).sum()),'zeroPopulationValidCells':int(((totals==0)&valid).sum())})


def build_population_tiles():
    grid_path=PUBLIC/'learning-population.json'
    grid=json.loads(grid_path.read_text())
    values=np.asarray(grid['values'],dtype=float)
    thresholds=np.array([10,50,200,500,1000,5000])
    colors=['#f7eee1','#f5d4aa','#e9aa70','#d57745','#af452d','#79271f','#4f1b21']
    rgba=np.array([[int(c[i:i+2],16) for i in (1,3,5)]+[255] for c in colors],dtype=np.uint8)
    population_dir=ROOT/'public/population';population_dir.mkdir(parents=True,exist_ok=True)
    outputs=[];visible_pixel_counts={}
    for z in range(4):
        dim=256*2**z
        # Source-grid nearest lookup at Web Mercator pixel centers. No invented
        # extra spatial detail is introduced at the display tile levels.
        x=(np.arange(dim)+.5)/dim
        longitude=360*x-180
        latitude=np.degrees(np.arctan(np.sinh(math.pi*(1-2*x))))
        columns=np.floor((longitude+180)/.5).astype(int)
        rows=np.floor((90-latitude)/.5).astype(int)
        sampled=values[rows[:,None],columns[None,:]]
        valid=np.isfinite(sampled)&(sampled>0)
        idx=np.searchsorted(thresholds,np.where(valid,sampled,0),side='right')
        image=rgba[idx];image[~valid]=[0,0,0,0]
        visible_pixel_counts[z]=int(valid.sum())
        for tile_x in range(2**z):
            directory=population_dir/str(z)/str(tile_x);directory.mkdir(parents=True,exist_ok=True)
            for tile_y in range(2**z):
                path=directory/f'{tile_y}.png'
                Image.fromarray(image[tile_y*256:(tile_y+1)*256,tile_x*256:(tile_x+1)*256]).save(path,optimize=True)
                outputs.append(path)
    meta=population_dir/'source.json'
    note='从真实0.5°局地人口密度格网以nearest映射至Web Mercator显示瓦片；z0–3仅为显示重采样，不代表更高数据精度。0人口与缺测不着色，点查仍区分0与null。'
    write(meta,{'sourceId':'ghs-pop-2020','year':2020,'dataResolutionDegrees':.5,'tileSize':256,'minzoom':0,'maxzoom':3,'bounds':[-180,-85.05112878,180,85.05112878],'tiles':['./{z}/{x}/{y}.png'],'resampling':'nearest','unit':'people/km²','note':note,'legend':[{'min':0 if i==0 else int(thresholds[i-1]),'max':int(thresholds[i]) if i<len(thresholds) else None,'color':c} for i,c in enumerate(colors)],'gridSha256':sha(grid_path),'tileCount':len(outputs),'tileBytes':sum(p.stat().st_size for p in outputs)})
    outputs.append(meta)
    manifest=json.loads((RESEARCH/'learning-data-sources.json').read_text())
    source=next(s for s in manifest['sources'] if s['id']=='ghs-pop-2020')
    source['maskSource']={'id':'natural-earth-50m-land','url':'https://www.naturalearthdata.com/downloads/50m-physical-vectors/50m-land/','version':NE_COMMIT,'license':'Public domain'}
    source['processing'] += ' '+note if note not in source['processing'] else ''
    existing=json.loads((RESEARCH/'learning-validation.json').read_text())['checks']['ghs-pop-2020']
    existing['tiles']={'count':len(outputs)-1,'bytes':sum(p.stat().st_size for p in outputs if p.suffix=='.png'),'nativeDataResolutionDegrees':.5,'nearest':True,'visiblePixelsByZoom':visible_pixel_counts}
    record(source,[RAW/'GHS_POP_E2020_GLOBE_R2023A_4326_30ss_V1_0.tif',PUBLIC/'land.geojson'],[RESEARCH/'learning-population.geojson',grid_path,*outputs],existing)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--only',choices=['languages','provinces','climate','religion','population','population-tiles']);args=parser.parse_args()
    for name,fn in [('languages',build_languages),('provinces',build_provinces),('climate',build_climate),('religion',build_religion),('population',build_population),('population-tiles',build_population_tiles)]:
        if args.only and name!=args.only:continue
        fn()
