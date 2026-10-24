import type {ErrorEvent, ExpressionSpecification, LayerSpecification, Map as GLMap, MapSourceDataEvent} from 'maplibre-gl'
import {applyMapAppearance} from './map-appearance'
import type {ResolvedAppearance, MapDisplay, OnlineMapStatus} from '../types'

const DETAIL_SOURCE = 'online-detail'
const TERRAIN_SOURCE = 'online-terrain'
const DETAIL_METADATA = 'https://tiles.openfreemap.org/planet'
const TERRAIN_METADATA = 'https://tiles.mapterhorn.com/tilejson.json'
const DETAIL_ATTRIBUTION = '<a href="https://openfreemap.org">OpenFreeMap</a> · © <a href="https://openmaptiles.org">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
const TERRAIN_ATTRIBUTION = '© <a href="https://mapterhorn.com/attribution">Mapterhorn</a>'
const TERRAIN_LAYER = 'online-terrain-hillshade'
const DETAIL_LAYERS = ['online-detail-landcover', 'online-detail-urban', 'online-detail-water', 'online-detail-waterway', 'online-detail-roads', 'online-place-labels']
type OnlineKind = keyof OnlineMapStatus
type RequestJob = {controller: AbortController; timer: ReturnType<typeof setTimeout>}
type TileMetadata = {tiles: string[]; minzoom?: number; maxzoom?: number; bounds?: [number, number, number, number]}

// Empty localized fields should fall through just like missing fields.
const placeName: ExpressionSpecification = ['case',
  ['!=', ['coalesce', ['get', 'name:zh-Hans'], ''], ''], ['get', 'name:zh-Hans'],
  ['!=', ['coalesce', ['get', 'name:zh'], ''], ''], ['get', 'name:zh'],
  ['!=', ['coalesce', ['get', 'name:en'], ''], ''], ['get', 'name:en'],
  ['coalesce', ['get', 'name'], ''],
]

function detailLayers(): LayerSpecification[] {
  return [
    {id: DETAIL_LAYERS[0], type: 'fill', source: DETAIL_SOURCE, 'source-layer': 'landcover',
      paint: {'fill-color': ['match', ['get', 'class'], 'wood', '#8fab78', 'grass', '#bdc99b', 'sand', '#ded0a5', 'ice', '#eef4f3', '#c6c7a8'], 'fill-opacity': .22}},
    {id: DETAIL_LAYERS[1], type: 'fill', source: DETAIL_SOURCE, 'source-layer': 'landuse', minzoom: 6,
      filter: ['==', ['get', 'class'], 'residential'], paint: {'fill-color': '#e2d8bf', 'fill-opacity': .45}},
    {id: DETAIL_LAYERS[2], type: 'fill', source: DETAIL_SOURCE, 'source-layer': 'water',
      filter: ['!=', ['get', 'brunnel'], 'tunnel'], paint: {'fill-color': '#a9cbd0', 'fill-opacity': .85}},
    {id: DETAIL_LAYERS[3], type: 'line', source: DETAIL_SOURCE, 'source-layer': 'waterway', minzoom: 5,
      filter: ['!=', ['get', 'brunnel'], 'tunnel'], layout: {'line-cap': 'round', 'line-join': 'round'},
      paint: {'line-color': '#71a4b4', 'line-width': ['interpolate', ['linear'], ['zoom'], 5, .5, 9, 1.2, 12, 2.5], 'line-opacity': .85}},
    {id: DETAIL_LAYERS[4], type: 'line', source: DETAIL_SOURCE, 'source-layer': 'transportation', minzoom: 6,
      filter: ['all', ['==', ['geometry-type'], 'LineString'], ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'street', 'street_limited'], true, false]],
      layout: {'line-cap': 'round', 'line-join': 'round'}, paint: {
        'line-color': ['match', ['get', 'class'], ['motorway', 'trunk'], '#c88b55', ['primary', 'secondary'], '#d4b17e', '#f4efde'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, ['match', ['get', 'class'], ['motorway', 'trunk'], .7, .2], 10, ['match', ['get', 'class'], ['motorway', 'trunk'], 2, ['primary', 'secondary'], 1.3, .65], 14, 4],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 6, .35, 9, .8],
      }},
    {id: DETAIL_LAYERS[5], type: 'symbol', source: DETAIL_SOURCE, 'source-layer': 'place', minzoom: 4,
      filter: ['match', ['get', 'class'], ['city', 'town', 'village'], true, false], layout: {
        'text-field': placeName, 'text-font': ['sans-serif'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 8, 12, 12, 15],
        'text-max-width': 8, 'text-padding': 12,
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 10],
      }, paint: {'text-color': '#4e6658', 'text-halo-color': '#faf8ed', 'text-halo-width': 1.6}},
  ]
}

function validatedMetadata(value: unknown, hostname: string): TileMetadata {
  if (!value || typeof value !== 'object') throw new Error('Invalid online map metadata')
  const raw = value as Record<string, unknown>
  if (raw.scheme !== undefined && raw.scheme !== 'xyz') throw new Error('Unsupported online tile scheme')
  if (!Array.isArray(raw.tiles) || !raw.tiles.length || raw.tiles.length > 8) throw new Error('Missing online map tiles')
  const tiles = raw.tiles.map(tile => {
    if (typeof tile !== 'string' || !['{z}', '{x}', '{y}'].every(token => tile.includes(token))) throw new Error('Invalid online tile URL')
    const url = new URL(tile.replace(/\{[zxy]\}/g, '0'))
    if (url.protocol !== 'https:' || url.hostname !== hostname || url.username || url.password) throw new Error('Unsupported online tile host')
    return tile
  })
  const metadata: TileMetadata = {tiles}
  for (const key of ['minzoom', 'maxzoom'] as const) {
    const number = raw[key]
    if (number !== undefined) {
      if (typeof number !== 'number' || !Number.isInteger(number) || number < 0 || number > 24) throw new Error('Invalid online tile zoom')
      metadata[key] = number
    }
  }
  if (metadata.minzoom !== undefined && metadata.maxzoom !== undefined && metadata.minzoom > metadata.maxzoom) throw new Error('Invalid online tile zoom range')
  if (raw.bounds !== undefined) {
    if (!Array.isArray(raw.bounds) || raw.bounds.length !== 4 || !raw.bounds.every(n => typeof n === 'number' && Number.isFinite(n))) throw new Error('Invalid online tile bounds')
    const [west, south, east, north] = raw.bounds as number[]
    if (west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) throw new Error('Invalid online tile bounds')
    metadata.bounds = [west, south, east, north]
  }
  return metadata
}

/** Adds optional online sources without replacing the local map or its knowledge layers. */
export function createOnlineMap(map: GLMap, onStatus: (status: OnlineMapStatus) => void, initialAppearance:ResolvedAppearance='light') {
  let appearance=initialAppearance
  let destroyed = false
  let display: MapDisplay = {basemap: 'natural', terrain3d: false}
  const state: OnlineMapStatus = {detail: 'off', terrain: 'off'}
  const requests: Partial<Record<OnlineKind, RequestJob>> = {}
  const loadTimers: Partial<Record<OnlineKind, ReturnType<typeof setTimeout>>> = {}
  const epochs: Record<OnlineKind, number> = {detail: 0, terrain: 0}
  const receivedTile: Record<OnlineKind, boolean> = {detail: false, terrain: false}
  let terrainPitch = 45
  let requestedPitch: number | undefined

  const wanted = (kind: OnlineKind) => kind === 'detail' ? display.basemap === 'detail' : display.terrain3d
  const sourceId = (kind: OnlineKind) => kind === 'detail' ? DETAIL_SOURCE : TERRAIN_SOURCE
  function status(kind: OnlineKind, next: OnlineMapStatus[OnlineKind]) {
    if (destroyed || state[kind] === next) return
    state[kind] = next
    onStatus({...state})
  }
  function clearLoading(kind: OnlineKind) {
    const request = requests[kind]
    if (request) {
      clearTimeout(request.timer)
      request.controller.abort()
      delete requests[kind]
    }
    clearTimeout(loadTimers[kind])
    delete loadTimers[kind]
  }
  function remove(kind: OnlineKind) {
    epochs[kind]++
    clearLoading(kind)
    receivedTile[kind] = false
    if (kind === 'terrain') {
      if (map.getTerrain()?.source === TERRAIN_SOURCE) map.setTerrain(null)
      map.touchPitch.disable()
      map.dragRotate.disable()
      map.touchZoomRotate.disableRotation()
      map.setPitch(0)
    }
    for (const id of kind === 'detail' ? [...DETAIL_LAYERS].reverse() : [TERRAIN_LAYER]) if (map.getLayer(id)) map.removeLayer(id)
    if (map.getSource(sourceId(kind))) map.removeSource(sourceId(kind))
  }
  function fail(kind: OnlineKind) {
    if (destroyed || !wanted(kind) || state[kind] === 'error') return
    // Mark the source failed before removing it so aborted requests cannot re-enter cleanup.
    status(kind, 'error')
    remove(kind)
  }
  function ready(kind: OnlineKind) {
    clearTimeout(loadTimers[kind])
    delete loadTimers[kind]
    if (kind === 'terrain') {
      map.setMaxPitch(60)
      map.touchPitch.enable()
      map.dragRotate.enable()
      map.touchZoomRotate.enableRotation()
      map.easeTo({pitch: terrainPitch, duration: 500})
    }
    status(kind, 'ready')
  }

  async function start(kind: OnlineKind) {
    if (destroyed || !wanted(kind) || state[kind] === 'loading' || state[kind] === 'ready') return
    remove(kind)
    const epoch = epochs[kind]
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    requests[kind] = {controller, timer}
    status(kind, 'loading')
    try {
      const url = kind === 'detail' ? DETAIL_METADATA : TERRAIN_METADATA
      const response = await fetch(url, {signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer'})
      if (!response.ok) throw new Error(`Online map metadata ${response.status}`)
      const raw = await response.json() as Record<string, unknown>
      const metadata = validatedMetadata(raw, new URL(url).hostname)
      if (kind === 'terrain' && ((raw.encoding !== undefined && raw.encoding !== 'terrarium') || (raw.tileSize !== undefined && raw.tileSize !== 512))) throw new Error('Unsupported online terrain encoding')
      if ((metadata.minzoom ?? 0) > (kind === 'detail' ? 14 : 12)) throw new Error('Unsupported online tile zoom range')
      if (destroyed || epoch !== epochs[kind] || !wanted(kind)) return
      clearTimeout(timer)
      delete requests[kind]
      const before = map.getLayer('population-raster') ? 'population-raster' : undefined
      if (kind === 'detail') {
        map.addSource(DETAIL_SOURCE, {type: 'vector', ...metadata, minzoom: metadata.minzoom ?? 0, maxzoom: Math.min(metadata.maxzoom ?? 14, 14), attribution: DETAIL_ATTRIBUTION})
        for (const layer of detailLayers()) map.addLayer(layer, before)
      } else {
        map.addSource(TERRAIN_SOURCE, {type: 'raster-dem', ...metadata, minzoom: metadata.minzoom ?? 0, maxzoom: Math.min(metadata.maxzoom ?? 12, 12), tileSize: 512, encoding: 'terrarium', attribution: TERRAIN_ATTRIBUTION})
        map.addLayer({id: TERRAIN_LAYER, type: 'hillshade', source: TERRAIN_SOURCE, paint: {
          'hillshade-exaggeration': .35, 'hillshade-shadow-color': '#455b45', 'hillshade-highlight-color': '#fffbe8', 'hillshade-accent-color': '#78906b',
        }}, before)
        map.setTerrain({source: TERRAIN_SOURCE, exaggeration: 1})
      }
      applyMapAppearance(map,appearance)
      // A metadata response alone is insufficient: wait for viewport tiles to finish loading.
      loadTimers[kind] = setTimeout(() => { if (epoch === epochs[kind] && state[kind] === 'loading') fail(kind) }, 15000)
    } catch {
      if (!destroyed && epoch === epochs[kind] && wanted(kind)) fail(kind)
    } finally {
      clearTimeout(timer)
      if (requests[kind]?.controller === controller) delete requests[kind]
    }
  }

  function sourceData(event: MapSourceDataEvent) {
    const kind = event.sourceId === DETAIL_SOURCE ? 'detail' : event.sourceId === TERRAIN_SOURCE ? 'terrain' : undefined
    if (!kind || destroyed || !wanted(kind) || state[kind] !== 'loading') return
    // Tile completion events do not set sourceDataType in MapLibre 6.13.
    if (event.tile?.state === 'loaded') receivedTile[kind] = true
    if (receivedTile[kind] && event.isSourceLoaded && map.getSource(sourceId(kind))) ready(kind)
  }
  map.on('sourcedata', sourceData)

  return {
    setAppearance(next:ResolvedAppearance){appearance=next;if(!destroyed)applyMapAppearance(map,appearance)},
    update(next: MapDisplay) {
      if (destroyed) return
      if (!display.terrain3d && next.terrain3d) {
        terrainPitch = requestedPitch ?? (Math.min(60, Math.max(0, map.getPitch())) || 45)
        requestedPitch = undefined
      }
      if (display.terrain3d && !next.terrain3d) requestedPitch = undefined
      display = {...next}
      for (const kind of ['detail', 'terrain'] as const) {
        if (!wanted(kind)) {
          if (state[kind] !== 'off' || map.getSource(sourceId(kind))) remove(kind)
          status(kind, 'off')
        } else if (state[kind] === 'off') void start(kind)
      }
    },
    setRequestedPitch(pitch: number) {
      if (destroyed || !Number.isFinite(pitch)) return
      terrainPitch = Math.min(60, Math.max(0, pitch))
      // View restoration is scheduled after React has applied its panel layout.
      // Retain its explicit pitch, including 0, before asynchronous DEM readiness.
      if (!display.terrain3d) requestedPitch = terrainPitch
    },
    retry() {
      for (const kind of ['detail', 'terrain'] as const) if (wanted(kind) && state[kind] === 'error') void start(kind)
    },
    handleError(event: ErrorEvent): boolean {
      const source = (event as ErrorEvent & {sourceId?: string}).sourceId
      const error = event.error as {message: string; url?: string}
      const text = `${error?.url ?? ''} ${error?.message ?? ''}`
      const kind = source === DETAIL_SOURCE || /https:\/\/tiles\.openfreemap\.org\//.test(text) ? 'detail'
        : source === TERRAIN_SOURCE || /https:\/\/tiles\.mapterhorn\.com\//.test(text) ? 'terrain' : undefined
      if (!kind) return false
      fail(kind)
      return true
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      map.off('sourcedata', sourceData)
      remove('detail')
      remove('terrain')
    },
  }
}
