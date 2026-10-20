import { fromGeojsonVt } from '@maplibre/vt-pbf'
import type { GeoJSONVTFeature, GeoJSONVTTile } from '@maplibre/geojson-vt'
import { deflateSync } from 'node:zlib'

// Deliberately synthetic, test-only geometry. Every requested tile receives
// this tiny valid MVT; it is never included in the public map or its build.
const tile = (features: GeoJSONVTFeature[]): GeoJSONVTTile => ({
  features, transformed: true, source: null, x: 0, y: 0, z: 0,
})
export const chineseFixtureName = '测试中文城'
export const vectorTile = Buffer.from(fromGeojsonVt({
  place: tile([{ id: 90001, type: 1, geometry: [[2048, 2048]], tags: {
    name: chineseFixtureName, 'name:zh': chineseFixtureName,
    'name:zh-Hans': chineseFixtureName, 'name:en': 'Test-only town',
    class: 'city', rank: 1, capital: 2,
  } }]),
  transportation: tile([{ id: 90002, type: 2,
    geometry: [[[0, 2300], [4096, 2300]]],
    tags: { class: 'primary', subclass: 'primary', brunnel: '' },
  }]),
  waterway: tile([{ id: 90003, type: 2,
    geometry: [[[0, 2600], [4096, 2600]]], tags: { class: 'river' },
  }]),
  water: tile([]), landcover: tile([]), landuse: tile([]),
}, { version: 2, extent: 4096 }))

function crc32(data: Buffer) {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}
function pngChunk(kind: string, data: Buffer) {
  const type = Buffer.from(kind), length = Buffer.alloc(4), crc = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  crc.writeUInt32BE(crc32(Buffer.concat([type, data])))
  return Buffer.concat([length, type, data, crc])
}

// A valid 512px Terrarium PNG with a synthetic elevation gradient. Tests serve
// these bytes even for .webp URLs; browser image decoding uses the PNG signature.
const size = 512, pixels = Buffer.alloc(size * (1 + size * 4))
for (let row = 0; row < size; row++) {
  const start = row * (1 + size * 4)
  for (let col = 0; col < size; col++) {
    const elevation = 800 + Math.round(1200 * col / (size - 1)), encoded = elevation + 32768
    const offset = start + 1 + col * 4
    pixels[offset] = Math.floor(encoded / 256)
    pixels[offset + 1] = encoded % 256
    pixels[offset + 2] = 0
    pixels[offset + 3] = 255
  }
}
const header = Buffer.alloc(13)
header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4)
header[8] = 8; header[9] = 6
export const terrainTile = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(pixels)), pngChunk('IEND', Buffer.alloc(0)),
])

export const detailMetadata = {
  tilejson: '3.0.0', name: 'Test-only OpenMapTiles fixture',
  tiles: ['https://tiles.openfreemap.org/planet/test-only/{z}/{x}/{y}.pbf'],
  minzoom: 0, maxzoom: 14, bounds: [-180, -85, 180, 85],
  attribution: 'Test fixture — not production geography',
  vector_layers: ['place', 'transportation', 'waterway', 'water', 'landcover', 'landuse']
    .map(id => ({ id, fields: {} })),
}
export const terrainMetadata = {
  tilejson: '3.0.0', name: 'Test-only Terrarium fixture',
  tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
  minzoom: 0, maxzoom: 12, tileSize: 512, encoding: 'terrarium',
  bounds: [-180, -85, 180, 85], attribution: 'Synthetic test-only elevation',
}
