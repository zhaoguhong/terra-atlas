"""Build small country context tables from attributed, cached public data."""
import hashlib
import html
import json
import re
import tarfile
from datetime import datetime, timezone
from pathlib import Path
from country_languages import LABELS, parse_languages

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data/raw'
PUBLIC = ROOT / 'public/data'
RESEARCH = ROOT / 'data/research'
COMMIT = '144d6977b2b01ac1cbd220de754c0a005616760b'
ARCHIVE_HASH = '3e70c3008d32b670e6eb7be3f93f03b4a6ce368258a21d3d09f5d47409b41ece'
def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'))+'\n')
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def normal(s):
    return re.sub(r'[^a-z0-9]', '', s.lower())
countries = json.loads((PUBLIC/'countries.geojson').read_text())['features']
names = {}
for f in countries:
    p=f['properties']
    for n in [p['nameEn'], *p.get('aliases', [])]:
        if normal(n):names[normal(n)]=p
name_aliases = {
    'United States':'country-usa','Congo, Democratic Republic of the':'country-cod',
    'Congo, Republic of the':'country-cog','Cote d\'Ivoire':'country-civ',
    'Korea, North':'country-prk','Korea, South':'country-kor','Burma':'country-mmr',
    'Czechia':'country-cze','The Bahamas':'country-bhs','The Gambia':'country-gmb',
    'Timor-Leste':'country-tls','Holy See (Vatican City)':'country-vat',
    'Cabo Verde':'country-cpv','Curacao':'country-cuw','Eswatini':'country-swx',
    'North Macedonia':'country-mkd','Sao Tome and Principe':'country-stp',
}
by_id={f['properties']['id']:f['properties'] for f in countries}
for name, id in name_aliases.items():
    if id in by_id:names[normal(name)]=by_id[id]

archive=RAW/'factbook-144d6977.tar.gz'
assert digest(archive)==ARCHIVE_HASH, 'Factbook snapshot hash mismatch'
records=[]
unmatched=[]
with tarfile.open(archive) as tar:
    for member in tar.getmembers():
        if not member.isfile() or not member.name.endswith('.json') or '/meta/' in member.name:continue
        d=json.load(tar.extractfile(member))
        short=d.get('Government',{}).get('Country name',{}).get('conventional short form',{}).get('text','')
        p=names.get(normal(short))
        language=d.get('People and Society',{}).get('Languages',{})
        text=language.get('Languages',{}).get('text',language.get('text',''))
        if not text:continue
        if not p:
            unmatched.append({'sourceName':short,'file':member.name});continue
        text=html.unescape(re.sub('<[^>]+>',' ',text)).strip()
        # Do not import disputed regional official-status descriptions into the learning UI.
        text=text.split('; note -')[0]
        text=re.sub(r'\bofficial\b', 'source-described status', text, flags=re.I)
        languages, untranslated, entries = parse_languages(text)
        years=re.findall(r'\b((?:19|20)\d{2})\b',text)
        records.append({'countryId':p['id'],'iso3':p['id'].removeprefix('country-').upper(),'name':p['name'],
            'languages':languages,'untranslatedEntries':untranslated,'sourceEntries':entries,'sourceText':text,'year':int(years[-1]) if years else None,
            'period':f'{years[-1]}年资料' if years else '条目未注明语言统计年份',
            'sourceId':'factbook-language-snapshot','sourceUrl':f'https://github.com/factbook/factbook.json/blob/{COMMIT}/'+member.name.split('/',1)[1]})
assert all(r['languages'] or r['untranslatedEntries'] for r in records), 'Empty language display'
assert len(records)>180, f'Unexpected low language coverage: {len(records)}'
duplicates={r['countryId'] for r in records if sum(x['countryId']==r['countryId'] for x in records)>1}
assert not duplicates, [(r['countryId'],r['sourceUrl']) for r in records if r['countryId'] in duplicates]
language_output={'title':'国家语言概览','snapshot':COMMIT,'categories':[{'id':id,'name':name} for id,name,_ in LABELS],
    'note':'资料列举的语言并不代表所有居民使用，也不是官方语言法律清单。地图上的语言参考点另来自Glottolog，不能据点位推算使用人口或精确边界。',
    'countries':sorted(records,key=lambda r:r['countryId'])}
write(PUBLIC/'learning-country-languages.json',language_output)

stats={p['id']:{'countryId':p['id'],'iso3':p['id'].removeprefix('country-').upper(),'name':p['name'],'population':None,'urbanPercent':None,'year':2024} for p in by_id.values()}
indicator_sources=[]
for indicator,key in [('SP.POP.TOTL','population'),('SP.URB.TOTL.IN.ZS','urbanPercent')]:
    path=RAW/(indicator+'-2024.json');d=json.loads(path.read_text())
    assert isinstance(d,list) and len(d)==2
    for row in d[1]:
        id='country-'+row['countryiso3code'].lower()
        if id=='country-xkx':id='country-kos'
        if id in stats:stats[id][key]=row['value']
    indicator_sources.append({'id':'worldbank-'+indicator,'title':'World Bank WDI · '+indicator,
        'url':f'https://api.worldbank.org/v2/country/all/indicator/{indicator}?date=2024&format=json&per_page=20000',
        'homepage':f'https://data.worldbank.org/indicator/{indicator}','period':'2024','version':d[0].get('lastupdated'),
        'license':'CC BY 4.0','licenseUrl':'https://datacatalog.worldbank.org/public-licenses',
        'inputPath':str(path.relative_to(ROOT)),'inputSha256':digest(path),
        'processing':'仅提取2024年人口及城镇人口占比；按ISO3明确连接Natural Earth国家/地区；剔除地区汇总。缺失保留null；城镇定义因国家而异。'})
write(PUBLIC/'learning-country-indicators.json',{'year':2024,'note':'人口为年度估计。城镇人口占比按各国城镇定义统计，跨国比较须留意口径差异。与GHS-POP2020空间格网时期不同。','countries':[r for r in stats.values() if r['population'] is not None or r['urbanPercent'] is not None]})
sources=[{'id':'factbook-language-snapshot','title':'CIA World Factbook · 历史国家语言资料（固定镜像快照）',
    'url':f'https://github.com/factbook/factbook.json/tree/{COMMIT}',
    'originalProvider':'CIA World Factbook','originalHomepage':'https://www.cia.gov/the-world-factbook/',
    'retirementNotice':'https://www.cia.gov/stories/story/spotlighting-the-world-factbook-as-we-bid-a-fond-farewell/',
    'version':COMMIT,'period':'条目各自注明年份；未注明保留未知，不视为2026现状',
    'license':'Public domain / mirror CC0 1.0','licenseUrl':f'https://github.com/factbook/factbook.json/blob/{COMMIT}/LICENSE.md',
    'inputPath':'data/raw/factbook-144d6977.tar.gz','inputSha256':ARCHIVE_HASH,
    'processing':'按括号之外的逗号和分号保留原文列举；仅对完整名称明确匹配中文标签，未匹配的名称及混合陈述保留为可见原文条目。词源说明和克里奥尔名称不映射为其词源语言；保留原文顺序与逐项摘录。仅按国家名称和人工别名明确连接。标签不代表法定地位、语言比例或地区边界；去除未核实的地区官方地位备注。'}]+indicator_sources
artifacts=[{'path':'/data/'+name,'sha256':digest(PUBLIC/name),'size':(PUBLIC/name).stat().st_size} for name in ['learning-country-languages.json','learning-country-indicators.json']]
manifest={'reviewedAt':datetime.now(timezone.utc).isoformat(),'sources':sources,'artifacts':artifacts,'coverage':{'languages':len(records),'indicators':sum(r['population'] is not None for r in stats.values())}}
write(RESEARCH/'country-context-sources.json',manifest);write(PUBLIC/'country-context-sources.json',manifest)
write(RESEARCH/'country-context-validation.json',{'status':'passed','languageRecords':len(records),'unmatchedSourceNames':unmatched,'checks':['fixed snapshot SHA256','unique exact country connections','unknown years preserved','World Bank aggregates omitted','null is not zero','whole-label translations preserve source order','untranslated and mixed entries remain visible','no empty language display'],'artifacts':artifacts})
print(f'Country context: {len(records)} language records, {len(stats)} country contexts; {len(unmatched)} source entries have no matching map unit.')
