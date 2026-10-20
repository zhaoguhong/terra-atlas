"""Build an entirely local Web Mercator tile pyramid from Natural Earth I.

Source TIFF/world file: https://naciscdn.org/naturalearth/50m/raster/NE1_50M_SR.zip
Public domain. Colours encode land cover; relief shading is not an elevation scale.
Run with Python + rasterio, numpy, Pillow.
"""
from pathlib import Path
import hashlib, json, math
from datetime import datetime, timezone
import numpy as np
import rasterio
from rasterio.warp import reproject, Resampling
from rasterio.transform import from_bounds
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
source_path = ROOT / 'data/raw/NE1_50M_SR/NE1_50M_SR.tif'
tile_root = ROOT / 'public/terrain'
tile_root.mkdir(parents=True, exist_ok=True)
extent = math.pi * 6378137
size = 512 * 2**4
with rasterio.open(source_path) as src:
    result = np.zeros((3, size, size), dtype=np.uint8)
    for band in range(3):
        reproject(source=rasterio.band(src, band + 1), destination=result[band],
                  src_transform=src.transform, src_crs=src.crs or 'EPSG:4326',
                  dst_transform=from_bounds(-extent, -extent, extent, extent, size, size),
                  dst_crs='EPSG:3857', resampling=Resampling.bilinear)
image = Image.fromarray(result.transpose(1, 2, 0))
for zoom in range(5):
    n = 2**zoom
    scaled = image.resize((512*n, 512*n), Image.Resampling.LANCZOS) if zoom < 4 else image
    for x in range(n):
        (tile_root / str(zoom) / str(x)).mkdir(parents=True, exist_ok=True)
        for y in range(n):
            scaled.crop((x*512,y*512,(x+1)*512,(y+1)*512)).save(tile_root / str(zoom) / str(x) / f'{y}.jpg', quality=83, optimize=True)
manifest = {'id':'natural-earth-relief','title':'Natural Earth I · 50m shaded relief',
 'url':'https://www.naturalearthdata.com/downloads/50m-raster-data/50m-natural-earth-1/',
 'downloadUrl':'https://naciscdn.org/naturalearth/50m/raster/NE1_50M_SR.zip',
 'license':'Public domain','sourceSha256':hashlib.sha256(source_path.read_bytes()).hexdigest(),
 'processedAt':datetime.now(timezone.utc).isoformat(),'minzoom':0,'maxzoom':4,'tileSize':512,
 'note':'土地覆盖配色和地形阴影，不是精确高程色标。EPSG:3857静态瓦片，最高原生缩放级别4；更高缩放为放大显示。'}
(ROOT / 'public/terrain/source.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print(f'Generated 341 terrain tiles, {sum(p.stat().st_size for p in tile_root.rglob("*.jpg"))/1024/1024:.1f} MiB')
