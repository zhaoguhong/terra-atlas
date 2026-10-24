#!/usr/bin/env python3
"""Build country language overview and exact language-display joins; no new geometry."""
import colorsys
import hashlib
import json
from pathlib import Path
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data/raw/language-areas'
PUBLIC = ROOT / 'public/data'
INPUTS = {
 'cldr48-supplementalData.xml': ('common/supplemental/supplementalData.xml', 'fb054c9f9a95f0c4da9dd1e5e0ef6dd208b6f9a73f45303011be247277d81bef'),
 'cldr48-supplementalMetadata.xml': ('common/supplemental/supplementalMetadata.xml', '36e807ce72b15304dd993f132216f408351be1c4376edaa2fe9e9547e2efcac1'),
 'cldr48-zh.xml': ('common/main/zh.xml', 'b1ef8bcadcf19fa8914d9ba812a7bcec124c72fecbf4acea02e4c8bd2fe51866'),
 'cldr48-LICENSE': ('LICENSE', 'b4c0ae8ef04f7059f96ce5bbe0467f9fe6f6d81bbe13517701dfeb961fb4d0b6'),
 'language-subtag-registry.txt': ('https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry', '755fad43283be7b41ebe3c89ad054b6eaf928f404f9c0edb74799e0eab74beb1'),
}
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p, data): p.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
def read(name): return json.loads((PUBLIC/name).read_text())

def main():
 RAW.mkdir(parents=True, exist_ok=True)
 inputs=[]
 for name,(relative,checksum) in INPUTS.items():
  url=relative if relative.startswith('https:') else 'https://raw.githubusercontent.com/unicode-org/cldr/release-48/'+relative
  path=RAW/name
  if not path.exists(): path.write_bytes(urllib.request.urlopen(url, timeout=90).read())
  assert digest(path)==checksum, f'Pinned input changed: {name}'
  inputs.append({'path':str(path.relative_to(ROOT)), 'url':url, 'sha256':checksum})
 xml=ET.parse(RAW/'cldr48-supplementalData.xml')
 aliases={e.get('type'):e.get('replacement').split()[0] for e in ET.parse(RAW/'cldr48-supplementalMetadata.xml').findall('.//languageAlias')}
 names={e.get('type'):e.text for e in ET.parse(RAW/'cldr48-zh.xml').findall('.//localeDisplayNames/languages/language') if not e.get('alt')}
 names['zh']='汉语'; names['ko']='朝鲜语／韩语'
 records=[dict(line.split(': ',1) for line in block.strip().splitlines() if ': ' in line) for block in (RAW/'language-subtag-registry.txt').read_text().split('%%')]
 macros={r['Subtag']:r['Macrolanguage'] for r in records if r.get('Type')=='language' and r.get('Macrolanguage') in ('zh','ar','fa','mn','uz','ps','ku')}
 def normalize(code):
  code=aliases.get(code,code).split('_')[0]
  return macros.get(code,code)
 points=read('learning-languages.geojson')['features']
 areas=read('language-areas-meta.json')['languages']
 area_ids={a['id'] for a in areas}
 members={}
 for feature in points:
  p=feature['properties']
  if p.get('iso6393'):
   code=normalize(p['iso6393']);members.setdefault(code,[]).append(p['glottocode'])
 alpha3={e.get('alpha3').lower():e.get('type') for e in xml.findall('.//territoryCodes') if e.get('alpha3')}
 # Natural Earth uses these stable Admin-0 IDs instead of the ISO alpha-3 code.
 alpha3.update({'kos':'XK','sds':'SS','ald':'AX','psx':'PS','sah':'EH'})
 territories={e.get('type'):e for e in xml.findall('.//territoryInfo/territory')}
 countries=[]
 for f in read('countries.geojson')['features']:
  p=f['properties'];territory=alpha3.get(p['id'].removeprefix('country-'));entry=territories.get(territory)
  languages=[]
  if entry is not None:
   for lang in entry.findall('languagePopulation'):
    original=lang.get('type');code=normalize(original)
    languages.append({'code':original,'displayId':'group:'+code,'name':names.get(code,code),'populationPercent':float(lang.get('populationPercent')),'status':lang.get('officialStatus','reported')})
  known=[l for l in languages if l['displayId'] not in ('group:und','group:mul','group:zxx')]
  national=[l for l in known if l['status'] in ('official','de_facto_official')]
  candidates=national or known
  ranked=sorted(candidates,key=lambda l:(-l['populationPercent'],l['code']))
  chosen=ranked[0] if ranked else None
  countries.append({'countryId':p['id'],'name':p['name'],'territory':territory,'displayId':chosen['displayId'] if chosen else None,'selectionBasis':'national-official' if national else 'largest-reported' if chosen else 'missing','languages':languages})
 codes={c['displayId'][6:] for c in countries if c['displayId']}
 codes.update(['zh','en','es','fr','pt','ru','de','hi','bn','ja','ar','ko','vi','th','tr','fa','id','ms','ta','te','ur','mr','kk','mn','bo','ug'])
 preferred=['zh','en','es','ar','fr','pt','ru','de','hi','bn','ja','ko','vi','th','tr','fa','id','ms']
 ordered=[c for c in preferred if c in codes]+sorted(codes-set(preferred))
 fixed={'zh':'#5878b5','en':'#c18a31','es':'#cb7042','fr':'#258b80','pt':'#8c69af','ru':'#aa5354','de':'#79923e','hi':'#ca8590','bn':'#479fb4','ja':'#a35e99','ar':'#ad7945'}
 categories=[]
 for i,code in enumerate(ordered):
  rgb=colorsys.hls_to_rgb((i*.61803398875)%1,.43+(i%3)*.055,.45+(i%2)*.15)
  color=fixed.get(code,'#'+''.join(f'{round(v*255):02x}' for v in rgb))
  ids=sorted(members.get(code,[]))
  categories.append({'id':'group:'+code,'name':names.get(code,code),'color':color,'members':ids,'areaMembers':[c for c in ids if c in area_ids]})
 assert len({c['color'] for c in categories})==len(categories)
 note='按国家／地区显示主要通用语言：优先选CLDR记录的全国官方或事实官方语言中使用比例最高的一种；没有此类记录时选已报告比例最高的语言。多语国家的其他语言可点开查看。国家色面不表示每个地区或居民只使用该语言，也不是母语或方言边界。资料为CLDR 48汇编估计，调查年份不一，不代表2026年人口普查。'
 output={'sourceId':'unicode-cldr-48','version':'48','registryDate':'2026-09-17','note':note,'categories':categories,'countries':countries}
 write(PUBLIC/'language-overview.json',output)
 (ROOT/'public/licenses/Unicode-3.0.txt').write_bytes((RAW/'cldr48-LICENSE').read_bytes())
 source={'reviewedAt':'2026-10-24','sources':[{'id':'unicode-cldr-48','title':'Unicode CLDR 48 · 国家语言资料与中文名称','url':'https://github.com/unicode-org/cldr/tree/release-48','version':'48','license':'Unicode-3.0','licensePath':'/licenses/Unicode-3.0.txt','processing':note},{'id':'iana-language-subtags-2026-09-17','title':'IANA Language Subtag Registry · 宏语言归属','url':INPUTS['language-subtag-registry.txt'][0],'version':'File-Date: 2026-09-17','license':'IANA注册标识符与归属事实；登记规范RFC 5646，IETF Trust Legal Provisions','processing':'按ISO标识符与Macrolanguage字段精确连接Glottolog；汉语、阿拉伯语等在总览合并着色，保留原始语种ID与几何。未按名称或国家猜测细分语言范围。'},{'id':'hainan-chinese-survey-2024','title':'中国语言资源集·海南（汉语方言）调查成果','url':'https://www.hntou.edu.cn/xwzx/xshd/202403/t20240311_85004.html','version':'2024-03-11','license':'原文版权归发布方；仅核对事实，不复制文章或图像','processing':'核对海南闽语属于汉语方言；不将调查点扩成分布面。'}], 'inputs':inputs,'localInputs':[{'path':'public/data/'+name,'sha256':digest(PUBLIC/name)} for name in ['countries.geojson','learning-languages.geojson','language-areas-meta.json']], 'artifacts':[{'path':'/data/language-overview.json','sha256':digest(PUBLIC/'language-overview.json')}], 'validation':{'countryCount':len(countries),'mappedCountryCount':sum(c['displayId'] is not None for c in countries),'missingCountries':[c['countryId'] for c in countries if c['displayId'] is None],'categoryCount':len(categories),'countryCodeExceptions':{'source':'Natural Earth 50m ADM0_A3 and ISO_A2 / ISO_A2_EH fields','mapping':{'kos':'XK','sds':'SS','ald':'AX','psx':'PS','sah':'EH'}},'geometry':'Reuses unchanged Natural Earth country geometry only in country overview; language-area geometry unchanged.'}}
 for path in [ROOT/'data/research/language-overview-sources.json',PUBLIC/'language-overview-sources.json']:write(path,source)
 content=json.loads((ROOT/'data/research/content-sources.json').read_text());content['languageOverviewSourceManifest']='/data/language-overview-sources.json'
 for path in [ROOT/'data/research/content-sources.json',PUBLIC/'content-sources.json']:write(path,content)
 print(json.dumps(source['validation'],ensure_ascii=False))
if __name__=='__main__':main()
