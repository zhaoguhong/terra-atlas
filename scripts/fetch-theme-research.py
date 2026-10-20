#!/usr/bin/env python3
"""Cache explicit named summit entities for a reproducible, offline theme build."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/raw/themes'
OUT.mkdir(parents=True, exist_ok=True)
NAMES = ['Mount Everest', 'K2', 'Kangchenjunga', 'Lhotse', 'Makalu', 'Cho Oyu',
         'Dhaulagiri', 'Manaslu', 'Nanga Parbat', 'Annapurna I', 'Gasherbrum I',
         'Broad Peak', 'Gasherbrum II', 'Shishapangma']

def request(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={
        'User-Agent': 'TerraAtlas/1.0 (personal geography research; cached public data)'
    }), timeout=35).read()

def fetch(name):
    cache = OUT / (name.lower().replace(' ', '-') + '.json')
    if cache.exists():
        return json.loads(cache.read_text())
    url = 'https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode({
        'action': 'wbsearchentities', 'search': name, 'language': 'en', 'format': 'json', 'limit': 3
    })
    results = json.loads(request(url))['search']
    candidates = [item for item in results if any(word in item.get('description', '').casefold() for word in ['mountain', 'peak'])]
    exact = [item for item in candidates if item.get('label', '').casefold() == name.casefold()]
    candidate = (exact or candidates or results)[0]
    entity_url = 'https://www.wikidata.org/wiki/Special:EntityData/' + candidate['id'] + '.json'
    raw = request(entity_url)
    entity = json.loads(raw)['entities'][candidate['id']]
    coordinate_claims = [claim for claim in entity['claims'].get('P625', []) if claim['rank'] != 'deprecated']
    coordinate_claims.sort(key=lambda claim: claim['rank'] != 'preferred')
    assert coordinate_claims, (name, candidate['id'], candidate.get('label'), 'no coordinate claim')
    coordinate = coordinate_claims[0]['mainsnak']['datavalue']['value']
    assert coordinate['globe'] == 'http://www.wikidata.org/entity/Q2'
    record = {'searchName': name, 'id': entity['id'], 'label': entity['labels']['en']['value'],
              'revision': entity['lastrevid'], 'inputUrl': entity_url,
              'sha256': hashlib.sha256(raw).hexdigest(),
              'coordinates': [coordinate['longitude'], coordinate['latitude']],
              'precisionDegrees': coordinate['precision'],
              'heightClaims': [claim['mainsnak'].get('datavalue', {}).get('value') for claim in entity['claims'].get('P2044', []) if claim['rank'] != 'deprecated']}
    (OUT / (entity['id'] + '.json')).write_bytes(raw)
    cache.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
    return record

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    records = list(pool.map(fetch, NAMES))
(OUT / 'summits.json').write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(records, ensure_ascii=False, indent=2))
