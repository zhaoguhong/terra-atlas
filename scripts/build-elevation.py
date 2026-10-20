"""Cache two genuine local elevation examples from Mapzen/Terrain Tiles.

Terrarium PNGs encode heights, not shaded-relief colours. Input attribution and
per-tile source-image headers are retained. Uses numpy and Pillow; no credentials.
Raw downloads stay in ignored data/raw/elevation. Public files are derived static
assets with SHA-256 checks. Run with the project's data Python environment.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import gzip
import hashlib
import io
import json
import math
import shutil
import urllib.request
import time
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'data/raw/elevation'
OUTPUT = ROOT / 'public/elevation'
BASE = 'https://elevation-tiles-prod.s3.amazonaws.com/terrarium'
REGIONS = [
    {'id': 'everest', 'name': '珠峰附近', 'bounds': [86.65, 27.75, 87.2, 28.35]},
    {'id': 'fuji', 'name': '富士山附近', 'bounds': [138.45, 35.1, 139.05, 35.65]},
]
MIN_ZOOM, MAX_ZOOM = 7, 11

def digest(value):
    return hashlib.sha256(value).hexdigest()

def tile_coordinates(longitude, latitude, zoom):
    n = 2 ** zoom
    return (longitude + 180) / 360 * n, (1 - math.asinh(math.tan(math.radians(latitude))) / math.pi) / 2 * n

def tile_range(bounds, zoom):
    x0, y0 = tile_coordinates(bounds[0], bounds[3], zoom)
    x1, y1 = tile_coordinates(bounds[2], bounds[1], zoom)
    return range(math.floor(x0), math.floor(x1) + 1), range(math.floor(y0), math.floor(y1) + 1)

def fetch_tile(task):
    region, zoom, x, y = task
    relative = Path(region['id']) / str(zoom) / str(x) / f'{y}.png'
    cached = CACHE / relative
    metadata_file = cached.with_suffix('.headers.json')
    url = f'{BASE}/{zoom}/{x}/{y}.png'
    if not cached.exists() or not metadata_file.exists():
        for attempt in range(3):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'TerraAtlas-data-build/1.0'}), timeout=35) as response:
                    value = response.read()
                    metadata = {'url': url, 'etag': response.headers.get('ETag'), 'versionId': response.headers.get('x-amz-version-id'), 'sourceImages': response.headers.get('x-amz-meta-x-imagery-sources'), 'lastModified': response.headers.get('Last-Modified')}
                image = Image.open(io.BytesIO(value))
                if image.size != (256, 256) or image.format != 'PNG':
                    raise ValueError(f'Unexpected tile dimensions or format: {url}')
                cached.parent.mkdir(parents=True, exist_ok=True)
                cached.write_bytes(value)
                metadata_file.write_text(json.dumps(metadata, indent=2))
                break
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(attempt + 1)
    value = cached.read_bytes()
    metadata = json.loads(metadata_file.read_text())
    # Rebuilding accepts only the exact input hashes already recorded for these tiles.
    previous_file = OUTPUT / 'source.json'
    if previous_file.exists():
        previous = json.loads(previous_file.read_text())
        locked = {item['path']: item['sha256'] for entry in previous['regions'] for item in entry['tiles']}
        if str(relative) in locked and locked[str(relative)] != digest(value):
            raise ValueError(f'Cached input changed: {relative}')
    destination = OUTPUT / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(cached, destination)
    if digest(destination.read_bytes()) != digest(value):
        raise ValueError(f'Output copy changed: {relative}')
    return region['id'], {'path': str(relative), 'sha256': digest(value), 'bytes': len(value), **metadata}

OUTPUT.mkdir(parents=True, exist_ok=True)
tasks = [(region, zoom, x, y) for region in REGIONS for zoom in range(MIN_ZOOM, MAX_ZOOM + 1) for x in tile_range(region['bounds'], zoom)[0] for y in tile_range(region['bounds'], zoom)[1]]
with ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(fetch_tile, tasks))
regions = []
for region in REGIONS:
    xs, ys = tile_range(region['bounds'], MAX_ZOOM)
    heights = np.empty((len(ys) * 256, len(xs) * 256), dtype='<i2')
    for x in xs:
        for y in ys:
            image = np.asarray(Image.open(CACHE / region['id'] / str(MAX_ZOOM) / str(x) / f'{y}.png').convert('RGB'), dtype=np.float32)
            decoded = image[:, :, 0] * 256 + image[:, :, 1] + image[:, :, 2] / 256 - 32768
            if not np.all(np.isfinite(decoded)) or np.min(decoded) < -12000 or np.max(decoded) > 10000:
                raise ValueError(f'Implausible decoded elevation {region["id"]}/{x}/{y}')
            heights[(y - ys.start) * 256:(y - ys.start + 1) * 256, (x - xs.start) * 256:(x - xs.start + 1) * 256] = np.rint(decoded).astype('<i2')
    raw = heights.tobytes()
    compressed = gzip.compress(raw, compresslevel=9, mtime=0)
    grid_path = f'{region["id"]}/heights.i16.gz'
    (OUTPUT / grid_path).write_bytes(compressed)
    tile_items = [item for identifier, item in results if identifier == region['id']]
    regions.append({**region, 'minzoom': MIN_ZOOM, 'maxzoom': MAX_ZOOM, 'tileSize': 256, 'encoding': 'terrarium', 'tileUrl': f'{region["id"]}/{{z}}/{{x}}/{{y}}.png', 'tiles': tile_items,
        'grid': {'path': grid_path, 'encoding': 'int16-little-endian-gzip', 'sha256': digest(compressed), 'decodedSha256': digest(raw), 'bytes': len(compressed), 'width': heights.shape[1], 'height': heights.shape[0], 'zoom': MAX_ZOOM, 'tileX': xs.start, 'tileY': ys.start, 'heightRangeMeters': [int(heights.min()), int(heights.max())]},
        'nominalSourceQualityMeters': 90, 'pixelSpacingMetersAtCenter': 40075016.686 * math.cos(math.radians((region['bounds'][1] + region['bounds'][3]) / 2)) / (256 * 2 ** MAX_ZOOM)})
manifest = {'id': 'mapzen-local-srtm-elevation', 'version': 1, 'generatedAt': datetime.now(timezone.utc).isoformat(),
    'title': '局部真实高程 · 珠峰与富士山', 'provider': 'Mapzen / Tilezen Terrain Tiles on AWS',
    'url': 'https://registry.opendata.aws/terrain-tiles/', 'license': 'Underlying SRTM/GMTED2010/ETOPO1 public-domain data; provider attribution required',
    'licenseUrl': 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
    'sourceDocumentation': 'https://github.com/tilezen/joerd/blob/master/docs/data-sources.md',
    'formatDocumentation': 'https://github.com/tilezen/joerd/blob/master/docs/formats.md',
    'attribution': 'Elevation processing by Mapzen / Tilezen; SRTM and GMTED2010 data courtesy of the U.S. Geological Survey; ETOPO1 courtesy of NOAA.',
    'sourceEpoch': 'SRTM observations February 2000; terrain tile build metadata preserved per input',
    'note': '仅两处局部覆盖；来源为真实DEM，不是现有JPG推算。SRTM原始数据约30m取样/90m名义质量；显示网格为Web Mercator重采样，zoom11像元约62–67m，并不提高源精度。格网抽样取最近像元并四舍五入至米，不是实地测量或最新官方峰顶高程；冰雪、植被及源数据填补会影响结果。',
    'processing': 'Terrarium RGB decode: R*256+G+B/256-32768 meters; nearest-cell Int16 rounded meter sample grid; gzip mtime=0; input and copied output SHA256 verified.',
    'regions': regions}
(OUTPUT / 'source.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
print(json.dumps({'regions': len(regions), 'tiles': len(tasks), 'bytes': sum(path.stat().st_size for path in OUTPUT.rglob('*') if path.is_file()), 'heightRanges': {region['id']: region['grid']['heightRangeMeters'] for region in regions}}, ensure_ascii=False))
