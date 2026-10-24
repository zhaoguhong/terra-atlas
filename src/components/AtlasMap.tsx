import { useEffect, useRef } from 'react'
import * as maplibre from 'maplibre-gl'
import { type Map as GLMap, type GeoJSONSource, type ExpressionSpecification } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import bindings from '../data/feature-bindings.json'
import { categoryInfo, dataCard, knowledge, matchCard } from '../lib/catalog'
import { geometryBounds, mapPadding, wrapLongitude, type Bounds } from '../lib/geo'
import { greatCircleRoute, routeDistance, type Coordinate } from '../lib/measure'
import {landscapeLayoutQuery} from '../lib/mobile-layout'
import {applyMapAppearance} from '../lib/map-appearance'
import { createOnlineMap } from '../lib/online-map'
import {climateGroups,languageFamilies,languageOverview,areaLanguageColors,languageMembers,languageColor,otherLanguageColor,thematicModes} from '../lib/map-presentation'
import {presentationForMember,TOPIC_MEMBER_COLOR,TOPIC_SELECTED_COLOR} from '../lib/topic-presentation'
import {memberLegendSymbol} from '../lib/map-legend'
import type { Camera, GeoProperties, LayerState, MapDisplay, MapProbe, OnlineMapStatus, Selection, ThematicState, Topic, View } from '../types'

maplibre.setWorkerUrl(workerUrl)
type Collection = FeatureCollection<Geometry, GeoProperties>
type Data = Record<string, Collection>
export interface Measurement { distanceKm: number; points: Coordinate[] }
export interface AtlasHandle {
  map: GLMap; data: Data;
  locate: (selection: Selection) => void;
  retry: () => Promise<void>;
  resize: () => void;
  reframe: (selection?: Selection | null, camera?: Camera, display?: MapDisplay) => void;
  focusView: (view: View) => void;
  showRelations: (ids: string[], options?: {fit?: boolean}) => Promise<void>;
  resolveFeature: (id: string) => Promise<{properties: GeoProperties; source: string} | null>;
  clearMeasurement: () => void;
  ensureElevation: (coordinates: Coordinate) => Promise<void>;
  sampleElevation: (coordinates: Coordinate) => number | null;
  elevation?: ElevationManifest;
}
export interface ElevationRegion {
  id: string; name: string; bounds: Bounds; minzoom: number; maxzoom: number; tileSize: number; tileUrl: string;
  pixelSpacingMetersAtCenter: number; nominalSourceQualityMeters?: number;
  grid: {path: string; sha256: string; decodedSha256: string; width: number; height: number; zoom: number; tileX: number; tileY: number};
}
export interface ElevationManifest { id: string; note: string; attribution: string; regions: ElevationRegion[] }
declare global { interface Window { __terraAtlas?: AtlasHandle } }
interface Props {
  appearance: 'light' | 'dark';
  layers: LayerState; opacity: number; selection: Selection | null; camera: Camera;
  display: MapDisplay; onOnlineStatus: (status: OnlineMapStatus) => void;
  mode?: 'explore' | 'probe' | 'measure'; thematic?: ThematicState;
  topic?:Topic|null;
  onSelect: (s: Selection) => void; onCamera: (c: Camera) => void;
  onReady: (h: AtlasHandle) => void; onStatus: (s: string) => void; onCatalog: (p: GeoProperties[]) => void;
  onVisible?: (bounds: Bounds) => void; onProbe?: (probe: MapProbe) => void;
  onMeasurement?: (measurement: Measurement) => void;
}
interface ReligionCountry { countryId: string; scope: string; shares: Record<string, number | null>; largestReportedCategory: string | null }
interface HumanData { religion?: { categories: {id: string; color: string}[]; countries: ReligionCountry[] } }
const empty: Collection = { type: 'FeatureCollection', features: [] }
const files: Record<string, string> = {
  land: 'land.geojson', countries: 'countries.geojson', regions: 'regions.geojson', rivers: 'rivers.geojson',
  lakes: 'lakes.geojson', peaks: 'peaks.geojson', summits: 'theme-peaks.geojson', climate: 'climate.geojson',
  provinces: 'learning-provinces.geojson', languages: 'learning-languages.geojson', 'language-areas':'language-areas.geojson',
  human: 'learning-human.json', gazetteer: 'gazetteer.json',
  cities:'auxiliary-cities.geojson',basins:'auxiliary-basins.geojson',plates:'auxiliary-plates.geojson',
  'study-regions':'china-reference-regions.geojson',
}
const point = (coordinates: Coordinate, properties: GeoProperties): Feature<Geometry, GeoProperties> => ({type: 'Feature', geometry: {type: 'Point', coordinates}, properties})
const featureBindings = bindings as Record<string, string[]>
const elevationCoverage: Bounds[] = [[86.65, 27.75, 87.2, 28.35], [138.45, 35.1, 139.05, 35.65]]
const inside = (coordinates: Coordinate, bounds: Bounds) => coordinates[0] >= bounds[0] && coordinates[0] <= bounds[2] && coordinates[1] >= bounds[1] && coordinates[1] <= bounds[3]
const categoryColor=(property:string,categories:readonly {id:string;color:string}[],fallback:string):ExpressionSpecification=>categories.length?['match',['get',property],categories[0].id,categories[0].color,...categories.slice(1).flatMap(category=>[category.id,category.color]),fallback]:['literal',fallback]
export function sourceForId(id: string): string | undefined {
  if(id.startsWith('region-cn-jiang2023-'))return 'study-regions'
  if(id.startsWith('city-ne-'))return 'cities'
  if(id.startsWith('basin-hybas-'))return 'basins'
  if(id.startsWith('plate-usgs-'))return 'plates'
  if (id.startsWith('country-')) return 'countries'
  if (id.startsWith('province-')) return 'provinces'
  if (id.startsWith('language-area-')) return 'language-areas'
  if (id.startsWith('language-')) return 'languages'
  if (id.startsWith('river-')) return 'rivers'
  if (id.startsWith('lake-')) return 'lakes'
  if (id.startsWith('peak-wikidata-')) return 'summits'
  if (id.startsWith('peak-')) return 'peaks'
  if (id.startsWith('region-')) return 'regions'
  if (id.startsWith('climate-')) return 'climate'
  return undefined
}
function sourcesForSelection(selection: Selection) {
  if (selection.source && files[selection.source]) return [selection.source]
  return [...new Set((featureBindings[selection.card.id] || []).map(sourceForId).filter((v): v is string => !!v))]
}
function featuresForSelection(data: Data, selection: Selection): Feature<Geometry, GeoProperties>[] {
  const ids = selection.featureId ? [selection.featureId] : featureBindings[selection.card.id] || []
  return Object.entries(data).filter(([name]) => name !== 'religion').flatMap(([name, collection]) => collection.features
    .filter(feature => ids.includes(feature.properties.id) && (!selection.source || selection.source === name))
    .map(feature => ({...feature, properties: {...feature.properties, referenceExtent: name === 'regions' || name === 'study-regions'}})))
}
function labels(data: Data, members: string[] = []): Collection {
  const curated = knowledge.filter(k => !members.includes(k.id) && !['climate', 'religion', 'population', 'language', 'human'].includes(k.category)).map(k => point(k.coordinates, {
    id: k.id, name: k.name.split('：')[0], nameEn: k.englishName, category: k.category, curated: true,
    color: categoryInfo[k.category]?.color || '#63816b', rank: k.region === 'china' ? 1 : 2,
    minZoom: k.category === 'mountains' ? 1.7 : 2.3,
  }))
  const regionLabels = (data.regions?.features || []).filter(f => ['range', 'mountain', 'plateau', 'basin', 'desert', 'plain'].includes(f.properties.kind || '') && /[\u3400-\u9fff]/.test(f.properties.name) && !matchCard(f.properties) && f.properties.center)
    .map(f => point(f.properties.center!, {...f.properties, geoSource: 'regions', category: f.properties.kind === 'range' || f.properties.kind === 'mountain' ? 'mountains' : 'terrain', curated: false, color: '#726c54'}))
  const peakLabels = (data.peaks?.features || []).filter(f => /[\u3400-\u9fff]/.test(f.properties.name) && !matchCard(f.properties) && f.properties.center)
    .map(f => point(f.properties.center!, {...f.properties, geoSource: 'peaks', category: 'mountains', curated: false, color: categoryInfo.mountains.color}))
  return {type: 'FeatureCollection', features: [...regionLabels, ...peakLabels, ...curated]}
}
function applyLayers(map: GLMap, layers: LayerState, opacity: number, thematic?: ThematicState) {
  const modes=thematicModes(thematic),languagePoints=layers.language&&modes.languageMode==='points'
  const visibility: Record<string, boolean> = {
    relief: layers.terrain, 'country-borders': layers.borders, 'country-hit': layers.religion || layers.language || layers.provinces,
    'river-lines': layers.rivers, 'river-hit': layers.rivers, 'lake-fill': layers.lakes, 'lake-lines': layers.lakes,
    'climate-fill': layers.climate, 'population-raster': layers.population, 'religion-fill': layers.religion,
    'province-fill': layers.provinces, 'province-lines': layers.provinces, 'province-labels': layers.provinces,
    'language-dots': languagePoints, 'language-labels': languagePoints, 'language-overview-fill':layers.language&&modes.languageMode==='overview', 'language-area-fill':layers.language&&!languagePoints&&modes.languageMode!=='overview', 'language-area-lines':layers.language&&!languagePoints&&modes.languageMode!=='overview', 'grid-lines': layers.grid, 'grid-labels': layers.grid,
    'city-dots':layers.cities,'city-labels':layers.cities,'city-hit':layers.cities,
    'basin-fill':layers.basins,'basin-lines':layers.basins,'plate-lines':layers.plates,'plate-hit':layers.plates,
  }
  Object.entries(visibility).forEach(([id, show]) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', show ? 'visible' : 'none') })
  for(const id of ['city-dots','city-labels','city-hit'])if(map.getLayer(id))map.setFilter(id,['<=',['get','minZoom'],map.getZoom()])
  for (const id of ['elevation-everest', 'elevation-fuji']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', layers.terrain ? 'visible' : 'none')
  if (map.getLayer('climate-fill')) {
    map.setPaintProperty('climate-fill', 'fill-opacity', opacity)
    map.setPaintProperty('climate-fill','fill-color',modes.climateMode==='types'?['get','color']:categoryColor('family',climateGroups,'#8c9692'))
  }
  const humanOpacity = thematic?.opacity ?? .65
  if (map.getLayer('population-raster')) map.setPaintProperty('population-raster', 'raster-opacity', humanOpacity)
  if (map.getLayer('religion-fill')) map.setPaintProperty('religion-fill', 'fill-opacity', ['case', ['==', ['get', 'eligible'], true], humanOpacity, 0])
  const selectedFamily=thematic?.language&&thematic.language!=='all'?thematic.language:null
  const selectedLanguage=modes.languageId!=='all'?modes.languageId:null
  const familyColor:ExpressionSpecification=selectedFamily?['literal',languageFamilies.find(family=>family.id===selectedFamily)?.color||'#5878b5']:categoryColor('familyId',languageFamilies,otherLanguageColor)
  const areaColor:ExpressionSpecification=selectedLanguage?['literal',languageColor(selectedLanguage)===otherLanguageColor?'#5878b5':languageColor(selectedLanguage)]:modes.languageMode==='families'?familyColor:categoryColor('glottocode',areaLanguageColors,otherLanguageColor)
  for (const id of ['language-dots','language-labels','language-area-fill','language-area-lines']) if(map.getLayer(id)) {
    const filters:ExpressionSpecification[]=[]
    if(selectedFamily)filters.push(['==',['get','familyId'],selectedFamily])
    if(selectedLanguage)filters.push(['in',['get','glottocode'],['literal',languageMembers(selectedLanguage)]])
    map.setFilter(id,filters.length?['all',...filters]:null)
  }
  if(map.getLayer('language-dots'))map.setPaintProperty('language-dots','circle-color',selectedLanguage?['literal',languageColor(selectedLanguage)===otherLanguageColor?'#5878b5':languageColor(selectedLanguage)]:familyColor)
  if(map.getLayer('language-area-fill')){map.setPaintProperty('language-area-fill','fill-color',areaColor);map.setPaintProperty('language-area-fill','fill-opacity',humanOpacity)}
  if(map.getLayer('language-overview-fill')) {
    const countries=languageOverview.countries.filter(country=>country.displayId&&(selectedLanguage===null||country.displayId===selectedLanguage))
    map.setFilter('language-overview-fill',['in',['get','id'],['literal',countries.map(country=>country.countryId)]])
    map.setPaintProperty('language-overview-fill','fill-color',categoryColor('id',countries.map(country=>({id:country.countryId,color:languageColor(country.displayId!)})),otherLanguageColor))
    map.setPaintProperty('language-overview-fill','fill-opacity',humanOpacity)
  }
  const enabled = layers.language?[]:Object.keys(categoryInfo).filter(k => k === 'regions' ? layers.provinces || layers.borders : layers[k as keyof LayerState])
  const shownAtZoom: ExpressionSpecification = ['<=', ['coalesce', ['get', 'minZoom'], 4], map.getZoom()]
  for (const id of ['place-dots', 'place-labels', 'place-hit']) if (map.getLayer(id)) {
    const filters: ExpressionSpecification[] = [['in', ['get', 'category'], ['literal', enabled]], shownAtZoom]
    if (id === 'place-dots') filters.push(['any', ['==', ['get', 'curated'], true], ['==', ['get', 'geoSource'], 'peaks']])
    map.setFilter(id, ['all', ...filters])
  }
}
function selectGeometry(map: GLMap, data: Data, selection: Selection | null) {
  let features: Feature<Geometry, GeoProperties>[] = []
  if (selection) {
    features = featuresForSelection(data, selection)
    if (!features.length) features = [point(selection.card.coordinates, {id: selection.card.id, name: selection.card.name, nameEn: selection.card.englishName})]
  }
  ;(map.getSource('selection') as GeoJSONSource | undefined)?.setData({type: 'FeatureCollection', features})
}
function grid(): Collection {
  const features: Feature<Geometry, GeoProperties>[] = []
  for (let longitude = -180; longitude <= 180; longitude += 30) features.push({type: 'Feature', geometry: {type: 'LineString', coordinates: [[longitude, -85], [longitude, 85]]}, properties: {id: `longitude-${longitude}`, name: `${Math.abs(longitude)}°${longitude < 0 ? 'W' : longitude > 0 ? 'E' : ''}`, nameEn: '', special: false}})
  for (const latitude of [...Array.from({length: 11}, (_, i) => i * 15 - 75), -23.436, 23.436]) {
    const name = latitude === 0 ? '赤道 0°' : latitude === 23.436 ? '北回归线 ≈23.44°N' : latitude === -23.436 ? '南回归线 ≈23.44°S' : `${Math.abs(latitude)}°${latitude < 0 ? 'S' : 'N'}`
    const properties = {id: `latitude-${latitude}`, name, nameEn: '', special: latitude === 0 || Math.abs(latitude) === 23.436}
    features.push({type: 'Feature', geometry: {type: 'LineString', coordinates: [[-180, latitude], [180, latitude]]}, properties})
    features.push(point([0, latitude], properties))
  }
  return {type: 'FeatureCollection', features}
}
export default function AtlasMap(props: Props) {
  const container = useRef<HTMLDivElement>(null)
  const current = useRef(props); current.current = props
  const mapRef = useRef<GLMap | null>(null)
  const dataRef = useRef<Data>({})
  const ensureRef = useRef<((names: string[]) => Promise<void>) | null>(null)
  const religionRef = useRef<(() => void) | null>(null)
  const relationRef = useRef<(() => void) | null>(null)
  const onlineRef = useRef<ReturnType<typeof createOnlineMap> | null>(null)
  useEffect(() => {
    let disposed = false, initialized = false, readyReported = false
    let human: HumanData | undefined, gazetteer: GeoProperties[] = [], relationIds: string[] = [], measurementPoints: Coordinate[] = []
    let frameRequest = 0, cameraRequestEpoch = 0, catalogDirty = true
    let pendingLocateEpoch: number | undefined
    let pendingReframeCamera: Camera | undefined
    let preserveCameraOnResize=false
    let elevationManifestPromise: Promise<ElevationManifest | null> | null = null
    const elevationGrids = new Map<string, DataView>(), elevationPending = new Map<string, Promise<void>>()
    const abort = new AbortController(), pending = new Map<string, Promise<void>>(), failed = new Set<string>(), loaded = new Set<string>()
    const data: Data = {}; dataRef.current = data
    let map: GLMap
    try {
      map = new maplibre.Map({
        container: container.current!, center: props.camera.center, zoom: props.camera.zoom,
        // Dateline-crossing bounds require the neighbouring real world copy;
        // otherwise valid Aleutian / Russian geometry ends at a blank 180° edge.
        bearing: props.camera.bearing || 0, minZoom: -1.2, maxZoom: 11.5, renderWorldCopies: true,
        pitch: props.display.terrain3d ? props.camera.pitch || 0 : 0,
        maxPitch: 60, maxTileCacheSize: 64, maxTileCacheZoomLevels: 3,
        transformConstrain: (center, zoom) => ({center: new maplibre.LngLat(wrapLongitude(center.lng), Math.max(-85, Math.min(85, center.lat))), zoom: Math.max(-1.2, Math.min(11.5, zoom))}),
        dragRotate: false, touchPitch: false, attributionControl: false,
        localIdeographFontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
        style: {version: 8, sources: {}, layers: [{id: 'ocean', type: 'background', paint: {'background-color': props.appearance==='dark'?'#111f2a':'#eff4f4'}}]},
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      current.current.onStatus(/WebGL|GPU|context/i.test(message) ? '当前浏览器的图形加速不可用，请开启硬件加速或换用现代浏览器。精选知识和资料来源仍可浏览。' : '地图初始化失败，请重试。精选知识和资料来源仍可浏览。')
      abort.abort(); return
    }
    mapRef.current = map
    map.addControl(new maplibre.ScaleControl({maxWidth: 100, unit: 'metric'}), 'bottom-right')
    const status = () => {
      if (disposed || !readyReported) return
      const names: Record<string, string> = {'study-regions':'四大地理区参考范围',cities:'城市与首都',basins:'流域分区',plates:'板块边界',land: '陆地', countries: '国家轮廓', regions: '自然区域', rivers: '河流', lakes: '湖泊', peaks: '山峰', summits: '主题山峰', climate: '气候', provinces: '中国省区', languages: '语言参考点', 'language-areas':'语言区域', human: '宗教', gazetteer: '地名搜索', elevation: '局部高程', 'elevation-everest-samples': '珠峰高程', 'elevation-fuji-samples': '富士山高程'}
      current.current.onStatus(failed.size ? `部分图层加载失败（${[...failed].map(name => names[name] || name).join('、')}）。其他图层仍可探索，可点击重试。` : 'ready')
    }
    map.on('error', event => {
      if (disposed) return
      if (onlineRef.current?.handleError(event)) return
      if (/WebGL|GPU|context/i.test(event.error.message)) current.current.onStatus('当前浏览器的图形加速不可用，请开启硬件加速或换用现代浏览器。')
      else if (initialized) current.current.onStatus('部分地图资源加载失败。已保留可用图层，可点击重试。')
    })
    const emitVisible = () => {
      const bounds = map.getBounds()
      current.current.onVisible?.([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()])
      if (initialized && current.current.layers.terrain && map.getZoom() >= 5 && elevationCoverage.some(region => region[0] <= bounds.getEast() && region[2] >= bounds.getWest() && region[1] <= bounds.getNorth() && region[3] >= bounds.getSouth())) void loadElevationManifest()
    }
    map.on('moveend', () => {
      if (disposed) return
      const c = map.getCenter(); current.current.onCamera({center: [c.lng, c.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch()}); emitVisible()
    })
    map.on('zoomend', () => { if (initialized && !disposed) applyLayers(map, current.current.layers, current.current.opacity, current.current.thematic) })
    const catalog = () => {
      if (!catalogDirty) return
      const entries = new Map<string, GeoProperties>()
      gazetteer.forEach(properties => entries.set(properties.id, properties))
      Object.entries(data).filter(([name]) => !['land', 'climate', 'religion', 'population'].includes(name)).forEach(([name, collection]) => collection.features.forEach(feature => entries.set(feature.properties.id, {...feature.properties, geoSource: name, geometryType: feature.geometry.type})))
      current.current.onCatalog([...entries.values()])
      catalogDirty = false
    }
    const updateReligion = () => {
      if (!initialized || !human?.religion || !data.countries) return
      const religion = human.religion, index = new Map(religion.countries.map(country => [country.countryId, country]))
      const colors = new Map(religion.categories.map(category => [category.id, category.color])), choice = current.current.thematic?.religion || 'largest'
      const features = data.countries.features.map(feature => {
        const country = index.get(feature.properties.id)
        const category = choice === 'largest' ? country?.largestReportedCategory : choice
        const share = category ? country?.shares[category] : null
        const eligible = country?.scope === 'population' && typeof share === 'number' && Number.isFinite(share) && share >= 0 && share <= 100 && !!category && colors.has(category)
        return {...feature, properties: {...feature.properties, eligible, share: eligible ? share : 0, religionColor: eligible ? colors.get(category!)! : '#dce3dc'}}
      })
      data.religion = {type: 'FeatureCollection', features}
      ;(map.getSource('religion') as GeoJSONSource).setData(data.religion)
      map.setPaintProperty('religion-fill', 'fill-color', choice === 'largest' ? ['get', 'religionColor'] : ['interpolate', ['linear'], ['get', 'share'], 0, '#f4f1e8', 100, colors.get(choice) || '#786590'])
    }
    const updateRelations = () => {
      const features: Feature<Geometry, GeoProperties>[] = []
      const memberLabels: Feature<Geometry, GeoProperties>[] = []
      for (const id of relationIds) {
        const card = knowledge.find(card => card.id === id)
        if (card) {
          const presentation=presentationForMember(current.current.topic||null,card)
          const presentationKind=memberLegendSymbol(presentation)
          const symbolId=`topic-${presentationKind}-${presentation.color.slice(1)}`
          if(['peak','port','city'].includes(presentationKind)&&!map.hasImage(symbolId)){
            const canvas=document.createElement('canvas');canvas.width=24;canvas.height=24
            const context=canvas.getContext('2d')!;context.fillStyle=presentation.color;context.strokeStyle='#fffaf0';context.lineWidth=2
            context.beginPath()
            if(presentationKind==='peak'){context.moveTo(12,3);context.lineTo(22,21);context.lineTo(2,21);context.lineTo(2,21);context.closePath()}
            else if(presentationKind==='port'){context.moveTo(12,2);context.lineTo(22,12);context.lineTo(12,22);context.lineTo(2,12);context.closePath()}
            else context.rect(4,4,16,16)
            context.fill();context.stroke();map.addImage(symbolId,context.getImageData(0,0,24,24),{pixelRatio:2})
          }
          const appearance={topicMemberId:card.id,topicColor:presentation.color,presentationKind,symbolId}
          const found = featuresForSelection(data, {card})
          features.push(...(found.length ? found : [point(card.coordinates, {id: card.id, name: card.name, nameEn: card.englishName})]).map(feature => ({...feature, properties: {...feature.properties, ...appearance}})))
          memberLabels.push(point(card.coordinates, {id: card.id, name: card.name, nameEn: card.englishName, ...appearance}))
        } else Object.entries(data).filter(([name]) => name !== 'religion').forEach(([name, collection]) => features.push(...collection.features.filter(feature => feature.properties.id === id).map(feature => ({...feature, properties: {...feature.properties, referenceExtent: name === 'regions' || name === 'study-regions'}}))))
      }
      const unique = [...new Map(features.map(feature => [feature.properties.id, feature])).values()]
      ;(map.getSource('relations') as GeoJSONSource | undefined)?.setData({type: 'FeatureCollection', features: unique})
      ;(map.getSource('relation-labels') as GeoJSONSource | undefined)?.setData({type: 'FeatureCollection', features: memberLabels})
      return unique
    }
    const refresh = () => {
      if (!initialized || disposed) return
      ;(map.getSource('places') as GeoJSONSource).setData(labels(data, relationIds))
      selectGeometry(map, data, current.current.selection); updateRelations(); updateReligion()
      applyLayers(map, current.current.layers, current.current.opacity, current.current.thematic)
      onlineRef.current?.update(current.current.display)
      catalog()
    }
    let refreshFrame=0
    const scheduleRefresh=()=>{if(!refreshFrame)refreshFrame=requestAnimationFrame(()=>{refreshFrame=0;refresh()})}
    relationRef.current=refresh
    religionRef.current = updateReligion
    const load = (name: string): Promise<void> => {
      if (loaded.has(name)) return Promise.resolve()
      if (pending.has(name)) return pending.get(name)!
      if (!files[name]) return Promise.resolve()
      const request = (async () => {
        try {
          const response = await fetch(`${import.meta.env.BASE_URL}data/${files[name]}`, {signal: abort.signal})
          if (!response.ok) throw new Error(`${name}: ${response.status}`)
          const value = await response.json()
          if (disposed) return
          if (name === 'human') {
            if (!value.religion || !Array.isArray(value.religion.countries) || !Array.isArray(value.religion.categories)) throw new Error('Invalid human data')
            human = value as HumanData
          } else if (name === 'gazetteer') {
            if (!Array.isArray(value)) throw new Error('Invalid gazetteer')
            gazetteer = value.filter(entry => entry && typeof entry.id === 'string')
            catalogDirty = true
          } else {
            if (value.type !== 'FeatureCollection' || !Array.isArray(value.features)) throw new Error(`Invalid ${name}`)
            const collection = value as Collection
            // Glottolog provides an authoritative point, not a separate label centre.
            // Carry that point into the searchable catalog and the data-only card.
            data[name] = { ...collection, features: collection.features.map(feature => feature.geometry.type === 'Point' && !feature.properties.center
              ? {...feature, properties: {...feature.properties, center: [feature.geometry.coordinates[0], feature.geometry.coordinates[1]] as Coordinate}}
              : feature) }
            if (!['land', 'climate', 'religion', 'population'].includes(name)) catalogDirty = true
            ;(map.getSource(name) as GeoJSONSource | undefined)?.setData(data[name])
          }
          loaded.add(name); failed.delete(name); scheduleRefresh(); status()
        } catch (error) {
          if (!disposed && (error as Error).name !== 'AbortError') { failed.add(name); status() }
        } finally { pending.delete(name) }
      })()
      pending.set(name, request); return request
    }
    const ensure = async (names: string[]) => { await Promise.allSettled([...new Set(names)].map(load)) }
    ensureRef.current = ensure
    const wanted = () => {
      const layers = current.current.layers, names: string[] = []
      if (layers.terrain || layers.mountains) names.push('regions')
      if (layers.mountains) names.push('peaks', 'summits')
      if (layers.rivers) names.push('rivers')
      if (layers.lakes) names.push('lakes')
      if (layers.climate) names.push('climate')
      if (layers.provinces) names.push('provinces')
      if(layers.cities)names.push('cities')
      if(layers.basins)names.push('basins')
      if(layers.plates)names.push('plates')
      if (layers.language) names.push(thematicModes(current.current.thematic).languageMode==='overview'?'countries':thematicModes(current.current.thematic).languageMode==='points'?'languages':'language-areas')
      if (layers.religion) names.push('human')
      if (current.current.selection) names.push(...sourcesForSelection(current.current.selection))
      return names
    }
    const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
    const scheduleFrame = (callback: () => void) => {
      cancelAnimationFrame(frameRequest)
      frameRequest = requestAnimationFrame(() => { frameRequest = requestAnimationFrame(() => { if (!disposed) callback() }) })
    }
    const fit = (features: Feature[], duration = 850) => {
      const bounds = geometryBounds(features)
      if (!bounds) return
      const padding = mapPadding(map.getContainer())
      if (bounds[2] - bounds[0] < .005 && bounds[3] - bounds[1] < .005) map.flyTo({center: [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2], zoom: 5.5, padding, duration: reducedMotion() ? 0 : duration, essential: true})
      else map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], {padding, absolutePadding: true, maxZoom: 6.7, duration: reducedMotion() ? 0 : duration, essential: true})
    }
    const updateMeasurement = () => {
      const features: Feature[] = measurementPoints.map((coordinates, index) => ({type: 'Feature', geometry: {type: 'Point', coordinates}, properties: {label: String(index + 1)}}))
      const lines = greatCircleRoute(measurementPoints)
      if (lines.length) features.unshift({type: 'Feature', geometry: {type: 'MultiLineString', coordinates: lines}, properties: {}})
      ;(map.getSource('measurement') as GeoJSONSource | undefined)?.setData({type: 'FeatureCollection', features})
      current.current.onMeasurement?.({distanceKm: routeDistance(measurementPoints), points: measurementPoints.map(point => [...point] as Coordinate)})
    }
    const sha256 = async (buffer: ArrayBuffer) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(value => value.toString(16).padStart(2, '0')).join('')
    function loadElevationManifest(): Promise<ElevationManifest | null> {
      if (elevationManifestPromise) return elevationManifestPromise
      elevationManifestPromise = (async () => {
        try {
          const response = await fetch(`${import.meta.env.BASE_URL}elevation/source.json`, {signal: abort.signal})
          if (!response.ok) throw new Error('Elevation manifest unavailable')
          const manifest = await response.json() as ElevationManifest
          if (manifest.id !== 'mapzen-local-srtm-elevation' || !Array.isArray(manifest.regions)) throw new Error('Invalid elevation manifest')
          if (disposed) return null
          handle.elevation = manifest
          for (const region of manifest.regions) {
            const id = `elevation-${region.id}`
            if (!map.getSource(id)) map.addSource(id, {type: 'raster-dem', tiles: [`${location.origin}${import.meta.env.BASE_URL}elevation/${region.tileUrl}`], tileSize: region.tileSize, encoding: 'terrarium', minzoom: region.minzoom, maxzoom: region.maxzoom, bounds: region.bounds, attribution: manifest.attribution})
            if (!map.getLayer(id)) map.addLayer({id, type: 'hillshade', source: id, minzoom: 5, paint: {'hillshade-exaggeration': .55, 'hillshade-shadow-color': '#384435', 'hillshade-highlight-color': '#fffbe6', 'hillshade-accent-color': '#78836c', 'hillshade-illumination-direction': 315}}, 'population-raster')
          }
          failed.delete('elevation'); applyLayers(map, current.current.layers, current.current.opacity, current.current.thematic); status()
          return manifest
        } catch (error) {
          if (!disposed && (error as Error).name !== 'AbortError') { elevationManifestPromise = null; failed.add('elevation'); status() }
          return null
        }
      })()
      return elevationManifestPromise
    }
    async function ensureElevation(coordinates: Coordinate) {
      if (!elevationCoverage.some(bounds => inside(coordinates, bounds))) return
      const manifest = await loadElevationManifest()
      const region = manifest?.regions.find(region => inside(coordinates, region.bounds))
      if (!region || elevationGrids.has(region.id)) return
      if (elevationPending.has(region.id)) return elevationPending.get(region.id)
      const request = (async () => {
        try {
          const response = await fetch(`${import.meta.env.BASE_URL}elevation/${region.grid.path}`, {signal: abort.signal})
          if (!response.ok) throw new Error('Elevation sample grid unavailable')
          const received = await response.arrayBuffer(), receivedHash = await sha256(received)
          // Vite and some static hosts send Content-Encoding:gzip, which fetch decodes.
          // Verify the exact decoded hash in that case; never decompress it twice.
          let buffer: ArrayBuffer
          if (receivedHash === region.grid.decodedSha256) buffer = received
          else if (receivedHash === region.grid.sha256) buffer = await new Response(new Blob([received]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
          else throw new Error('Elevation sample hash mismatch')
          if (buffer.byteLength !== region.grid.width * region.grid.height * 2 || await sha256(buffer) !== region.grid.decodedSha256) throw new Error('Elevation decoded hash mismatch')
          if (disposed) return
          elevationGrids.set(region.id, new DataView(buffer)); failed.delete(`elevation-${region.id}-samples`); status()
        } catch (error) {
          if (!disposed && (error as Error).name !== 'AbortError') { failed.add(`elevation-${region.id}-samples`); status() }
        } finally { elevationPending.delete(region.id) }
      })()
      elevationPending.set(region.id, request)
      return request
    }
    const handle: AtlasHandle = {
      map, data, resize:resizeMap,
      resolveFeature: async id => {
        const source = sourceForId(id)
        if (!source) return null
        await load(source)
        if (disposed) return null
        if (failed.has(source)) throw new Error('地点资料暂未能加载')
        const feature = data[source]?.features.find(feature => feature.properties.id === id)
        return feature ? {properties: feature.properties, source} : null
      },
      locate: selection => {
        preserveCameraOnResize=false
        const epoch = ++cameraRequestEpoch
        cancelAnimationFrame(frameRequest)
        pendingLocateEpoch = epoch
        pendingReframeCamera = undefined
        const allowEmptySelection = !current.current.selection
        const isCurrent = () => {
          const active = current.current.selection
          return !disposed && epoch === cameraRequestEpoch && (active
            ? active.card.id === selection.card.id && active.source === selection.source && active.featureId === selection.featureId
              && active.card.coordinates[0] === selection.card.coordinates[0] && active.card.coordinates[1] === selection.card.coordinates[1]
            : allowEmptySelection)
        }
        void ensure(sourcesForSelection(selection)).then(() => {
          if (disposed || epoch !== cameraRequestEpoch) { if (pendingLocateEpoch === epoch) pendingLocateEpoch = undefined; return }
          scheduleFrame(() => {
            if (pendingLocateEpoch === epoch) pendingLocateEpoch = undefined
            if (!isCurrent()) return
            const features = featuresForSelection(data, selection), hasArea = features.some(feature => feature.geometry.type !== 'Point' && feature.geometry.type !== 'MultiPoint')
            if (hasArea) fit(features)
            else {
              const peak = selection.card.category === 'mountains' && (selection.source === 'peaks' || sourcesForSelection(selection).some(source => ['peaks', 'summits'].includes(source)))
              const covered = elevationCoverage.some(bounds => inside(selection.card.coordinates, bounds))
              map.flyTo({center: selection.card.coordinates, zoom: selection.card.mapZoom ?? (peak ? covered ? 9 : 6.5 : selection.card.category === 'climate' ? 3 : 4.5), padding: mapPadding(map.getContainer()), duration: reducedMotion() ? 0 : 850, essential: true})
            }
          })
        })
      },
      reframe: (selection, camera, display) => {
        if (camera) {
          preserveCameraOnResize=true
          ++cameraRequestEpoch; pendingLocateEpoch = undefined
          pendingReframeCamera = camera
          if ((display ?? current.current.display).terrain3d) onlineRef.current?.setRequestedPitch(camera.pitch ?? 0)
        } else if (pendingLocateEpoch === cameraRequestEpoch) {
          // A pending locate will read the latest panel padding when its data
          // arrives. A sheet resize must not replace that requested location.
          return
        }
        const epoch = cameraRequestEpoch
        // A React sheet/layout effect can follow URL restoration in the same frame.
        // Keep its explicit camera until the panel layout has actually been applied.
        const requested = camera || pendingReframeCamera
        scheduleFrame(() => {
          if (epoch !== cameraRequestEpoch) return
          const target = requested?.center || (!preserveCameraOnResize?selection?.card.coordinates:undefined) || [map.getCenter().lng, map.getCenter().lat] as Coordinate
          map.jumpTo({center: target, zoom: requested?.zoom ?? map.getZoom(), bearing: requested?.bearing ?? map.getBearing(), pitch: (display ?? current.current.display).terrain3d ? requested?.pitch ?? map.getPitch() : 0, padding: mapPadding(map.getContainer())})
          if (pendingReframeCamera === requested) pendingReframeCamera = undefined
        })
      },
      focusView: view => {
        preserveCameraOnResize=false
        ++cameraRequestEpoch
        cancelAnimationFrame(frameRequest);pendingLocateEpoch=undefined;pendingReframeCamera=undefined
        map.stop()
        map.fitBounds(view==='china'?[[73,17],[136,54]]:[[-179,-58],[179,82]],{padding:mapPadding(map.getContainer()),absolutePadding:true,maxZoom:view==='china'?3.4:1.5,duration:reducedMotion()?0:800,essential:true})
      },
      retry: async () => {
        onlineRef.current?.retry()
        const retries = [...failed]
        await ensure(retries.filter(name => files[name]))
        if (retries.includes('elevation')) await loadElevationManifest()
        for (const region of handle.elevation?.regions || []) if (retries.includes(`elevation-${region.id}-samples`)) await ensureElevation([(region.bounds[0] + region.bounds[2]) / 2, (region.bounds[1] + region.bounds[3]) / 2])
        // Raster requests are owned by MapLibre; resetting their public URL list
        // retries failed tiles without destroying the map or downloaded GeoJSON.
        const rasters: [string, string][] = [['relief', `${location.origin}${import.meta.env.BASE_URL}terrain/{z}/{x}/{y}.jpg`], ['population-raster', `${location.origin}${import.meta.env.BASE_URL}population/{z}/{x}/{y}.png`], ...(handle.elevation?.regions || []).map(region => [`elevation-${region.id}`, `${location.origin}${import.meta.env.BASE_URL}elevation/${region.tileUrl}`] as [string, string])]
        for (const [id, url] of rasters) if (map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none') (map.getSource(id) as maplibre.RasterTileSource | undefined)?.setTiles([url])
        refresh(); status()
      },
      showRelations: async (ids, options) => {
        const epoch = ++cameraRequestEpoch
        map.stop()
        cancelAnimationFrame(frameRequest); pendingLocateEpoch = undefined
        pendingReframeCamera = undefined
        relationIds = [...new Set(ids)]
        // Replace the previous theme immediately, even while its new data loads.
        updateRelations()
        ;(map.getSource('places') as GeoJSONSource | undefined)?.setData(labels(data, relationIds))
        const names = relationIds.flatMap(id => {
          const card = knowledge.find(card => card.id === id)
          return card ? sourcesForSelection({card}) : [sourceForId(id)].filter((name): name is string => !!name)
        })
        await ensure(names)
        if (disposed || epoch !== cameraRequestEpoch) return
        const features = updateRelations()
        if (features.length && options?.fit !== false) scheduleFrame(() => { if (epoch === cameraRequestEpoch) fit(features, 700) })
      },
      clearMeasurement: () => { measurementPoints = []; updateMeasurement() },
      ensureElevation,
      sampleElevation: coordinates => {
        const region = handle.elevation?.regions.find(region => inside(coordinates, region.bounds))
        if (!region) return null
        const grid = elevationGrids.get(region.id)
        if (!grid) return null
        const size = 256 * 2 ** region.grid.zoom
        const x = Math.floor((coordinates[0] + 180) / 360 * size - region.grid.tileX * 256)
        const y = Math.floor((1 - Math.asinh(Math.tan(coordinates[1] * Math.PI / 180)) / Math.PI) / 2 * size - region.grid.tileY * 256)
        if (x < 0 || x >= region.grid.width || y < 0 || y >= region.grid.height) return null
        const value = grid.getInt16((y * region.grid.width + x) * 2, true)
        return value === -32768 ? null : value
      },
    }
    async function setup() {
      if (!map.isStyleLoaded()) await new Promise<void>(resolve => map.once('load', () => resolve()))
      if (disposed) return
      for (const name of Object.keys(files).filter(name => !['human', 'gazetteer'].includes(name))) map.addSource(name, {type: 'geojson', data: empty})
      for (const name of ['places', 'selection', 'relations', 'relation-labels', 'religion', 'measurement']) map.addSource(name, {type: 'geojson', data: empty})
      map.addSource('grid', {type: 'geojson', data: grid()})
      map.addSource('relief', {type: 'raster', tiles: [`${location.origin}${import.meta.env.BASE_URL}terrain/{z}/{x}/{y}.jpg`], tileSize: 512, minzoom: 0, maxzoom: 4})
      map.addSource('population-raster', {type: 'raster', tiles: [`${location.origin}${import.meta.env.BASE_URL}population/{z}/{x}/{y}.png`], tileSize: 256, minzoom: 0, maxzoom: 3})
      map.addLayer({id: 'land-fill', type: 'fill', source: 'land', paint: {'fill-color': '#e6e6d4'}})
      map.addLayer({id: 'relief', type: 'raster', source: 'relief', paint: {'raster-opacity': .92, 'raster-fade-duration': 120, 'raster-saturation': -.25}})
      map.addLayer({id: 'population-raster', type: 'raster', source: 'population-raster', paint: {'raster-opacity': .65, 'raster-resampling': 'nearest', 'raster-fade-duration': 0}})
      map.addLayer({id: 'religion-fill', type: 'fill', source: 'religion', paint: {'fill-color': ['get', 'religionColor'], 'fill-opacity': .65}})
      map.addLayer({id: 'climate-fill', type: 'fill', source: 'climate', paint: {'fill-color': ['get', 'color'], 'fill-opacity': current.current.opacity}})
      map.addLayer({id: 'country-hit', type: 'fill', source: 'countries', paint: {'fill-color': '#000000', 'fill-opacity': 0}})
      map.addLayer({id: 'country-borders', type: 'line', source: 'countries', paint: {'line-color': '#617664', 'line-width': .7, 'line-opacity': .55}})
      map.addLayer({id: 'province-fill', type: 'fill', source: 'provinces', paint: {'fill-color': '#79a687', 'fill-opacity': .12}})
      map.addLayer({id: 'province-lines', type: 'line', source: 'provinces', paint: {'line-color': '#4f7864', 'line-width': ['interpolate', ['linear'], ['zoom'], 2, .6, 5, 1.3], 'line-opacity': .75}})
      map.addLayer({id: 'lake-fill', type: 'fill', source: 'lakes', paint: {'fill-color': '#669daa', 'fill-opacity': .8}})
      map.addLayer({id: 'lake-lines', type: 'line', source: 'lakes', paint: {'line-color': '#4e879b', 'line-width': .8}})
      map.addLayer({id: 'river-lines', type: 'line', source: 'rivers', layout: {'line-cap': 'round', 'line-join': 'round'}, paint: {'line-color': '#40849e', 'line-opacity': .85, 'line-width': ['interpolate', ['linear'], ['zoom'], 1, ['case', ['<', ['get', 'rank'], 4], .8, .3], 5, ['case', ['<', ['get', 'rank'], 4], 2.2, 1.1], 7, 3]}})
      map.addLayer({id: 'river-hit', type: 'line', source: 'rivers', paint: {'line-color': '#40849e', 'line-opacity': 0, 'line-width': 12}})
      map.addLayer({id:'basin-fill',type:'fill',source:'basins',paint:{'fill-color':['coalesce',['get','color'],'#9ab6a4'],'fill-opacity':.09}},'country-borders')
      map.addLayer({id:'basin-lines',type:'line',source:'basins',paint:{'line-color':'#6b9290','line-width':['interpolate',['linear'],['zoom'],1,.7,5,1.4],'line-dasharray':[3,2],'line-opacity':.8}})
      const plateColor:ExpressionSpecification=['match',['get','boundaryType'],'convergent','#ba664d','divergent','#48859f','transform','#956eaa','#7c817b']
      map.addLayer({id:'plate-lines',type:'line',source:'plates',paint:{'line-color':plateColor,'line-width':['interpolate',['linear'],['zoom'],1,1.6,5,2.5],'line-opacity':.9}})
      map.addLayer({id:'plate-hit',type:'line',source:'plates',paint:{'line-opacity':0,'line-width':12}})
      map.addLayer({id:'city-dots',type:'circle',source:'cities',paint:{'circle-radius':['case',['get','capital'],4.5,2.7],'circle-color':['case',['get','capital'],'#455c6e','#ad8955'],'circle-stroke-color':'#fffaf0','circle-stroke-width':1.4}})
      map.addLayer({id:'city-labels',type:'symbol',source:'cities',layout:{'text-field':['get','name'],'text-font':['sans-serif'],'text-size':11,'text-anchor':'top','text-offset':[0,.6],'text-padding':8},paint:{'text-color':'#4f635b','text-halo-color':'#fffaf0','text-halo-width':1.8}})
      map.addLayer({id:'city-hit',type:'circle',source:'cities',paint:{'circle-radius':9,'circle-opacity':0}})
      map.addLayer({id: 'grid-lines', type: 'line', source: 'grid', filter: ['==', ['geometry-type'], 'LineString'], paint: {'line-color': ['case', ['==', ['get', 'special'], true], '#98633f', '#83968e'], 'line-width': ['case', ['==', ['get', 'special'], true], 1.3, .65], 'line-opacity': .65, 'line-dasharray': [4, 3]}})
      map.addLayer({id: 'grid-labels', type: 'symbol', source: 'grid', filter: ['==', ['geometry-type'], 'Point'], layout: {'text-field': ['get', 'name'], 'text-font': ['sans-serif'], 'text-size': 11, 'text-anchor': 'bottom', 'text-offset': [0, -.4]}, paint: {'text-color': '#7d6046', 'text-halo-color': '#fffaf0', 'text-halo-width': 2}})
      map.addLayer({id: 'province-labels', type: 'symbol', source: 'provinces', minzoom: 3, layout: {'text-field': ['get', 'name'], 'text-font': ['sans-serif'], 'text-size': 11, 'text-padding': 8}, paint: {'text-color': '#526d5a', 'text-halo-color': '#faf8ed', 'text-halo-width': 1.5}})
      map.addLayer({id: 'language-dots', type: 'circle', source: 'languages', minzoom: 2, paint: {'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 2.5, 5, 4, 7, 6], 'circle-color': ['coalesce', ['get', 'color'], '#688ca7'], 'circle-stroke-color': '#fcfaf2', 'circle-stroke-width': .8, 'circle-opacity': .85}})
      map.addLayer({id: 'language-labels', type: 'symbol', source: 'languages', minzoom: 5.5, layout: {'text-field': ['get', 'name'], 'text-font': ['sans-serif'], 'text-size': 11, 'text-anchor': 'top', 'text-offset': [0, .6], 'text-padding': 8}, paint: {'text-color': '#435f73', 'text-halo-color': '#faf8ed', 'text-halo-width': 1.5}})
      map.addLayer({id:'language-overview-fill',type:'fill',source:'countries',paint:{'fill-color':otherLanguageColor,'fill-opacity':.72}},'country-borders')
      map.addLayer({id:'language-area-fill',type:'fill',source:'language-areas',paint:{'fill-color':otherLanguageColor,'fill-opacity':.72}},'country-borders')
      map.addLayer({id:'language-area-lines',type:'line',source:'language-areas',paint:{'line-color':'#f8f7f0','line-width':['interpolate',['linear'],['zoom'],1,.15,5,.65],'line-opacity':.55}},'country-borders')
      map.addLayer({id: 'place-dots', type: 'circle', source: 'places', paint: {'circle-radius': ['case', ['==', ['get', 'curated'], true], ['interpolate', ['linear'], ['zoom'], 1, 2.6, 4, 3.8, 7, 5], 2.4], 'circle-color': ['get', 'color'], 'circle-stroke-color': '#fcfaf2', 'circle-stroke-width': 1.3}})
      map.addLayer({id: 'place-labels', type: 'symbol', source: 'places', layout: {
        'text-field': ['get', 'name'], 'text-font': ['sans-serif'], 'text-size': ['interpolate', ['linear'], ['zoom'], 1, 11, 4, 13, 7, 15],
        'text-anchor': 'top', 'text-offset': [0, .65], 'text-padding': 10, 'symbol-sort-key': ['case', ['==', ['get', 'curated'], true], 0, ['+', ['coalesce', ['get', 'rank'], 5], 1]],
        'text-max-width': 8, 'text-letter-spacing': .06,
      }, paint: {'text-color': ['get', 'color'], 'text-halo-color': '#faf8ed', 'text-halo-width': 1.8, 'text-halo-blur': .5}})
      map.addLayer({id: 'place-hit', type: 'circle', source: 'places', paint: {'circle-radius': 12, 'circle-opacity': 0}})
      for (const [source, color] of [['relations', TOPIC_MEMBER_COLOR], ['selection', TOPIC_SELECTED_COLOR]]) {
        const memberColor=source==='relations'?['coalesce',['get','topicColor'],color] as ExpressionSpecification:color
        map.addLayer({id: `${source}-area`, type: 'fill', source, filter: ['==', ['geometry-type'], 'Polygon'], paint: {'fill-color': memberColor, 'fill-opacity': source==='relations'?.24:.15}})
        map.addLayer({id: `${source}-line`, type: 'line', source, filter: ['all', ['!=', ['geometry-type'], 'Point'], ['!=', ['get', 'referenceExtent'], true]], paint: {'line-color': memberColor, 'line-width': source === 'selection' ? 3 : 2.2, 'line-opacity': .95}})
        map.addLayer({id: `${source}-reference`, type: 'line', source, filter: ['==', ['get', 'referenceExtent'], true], paint: {'line-color': memberColor, 'line-width': 2, 'line-dasharray': [3, 2], 'line-opacity': .8}})
        map.addLayer({id: `${source}-dot`, type: 'circle', source, filter:source==='relations'?['all',['==',['geometry-type'],'Point'],['!', ['in',['get','presentationKind'],['literal',['peak','port','city']]]]]:['==', ['geometry-type',], 'Point'], paint: {'circle-radius': source === 'selection' ? 8 : 6, 'circle-color': memberColor, 'circle-stroke-color': '#fffaf0', 'circle-stroke-width': 2.5}})
      }
      map.addLayer({id:'relations-symbols',type:'symbol',source:'relations',filter:['all',['==',['geometry-type'],'Point'],['in',['get','presentationKind'],['literal',['peak','port','city']]]],layout:{'icon-image':['get','symbolId'],'icon-size':1.15,'icon-allow-overlap':true}})
      map.addLayer({id: 'relation-member-hit', type: 'circle', source: 'relation-labels', paint: {'circle-radius': 12, 'circle-opacity': 0}})
      map.addLayer({id: 'relation-member-labels', type: 'symbol', source: 'relation-labels', layout: {'text-field': ['get', 'name'], 'text-font': ['sans-serif'], 'text-size': 13, 'text-anchor': 'top', 'text-offset': [0, .8], 'text-padding': 7, 'text-max-width': 8}, paint: {'text-color': ['coalesce',['get','topicColor'],'#745b32'], 'text-halo-color': '#fffaf0', 'text-halo-width': 2}})
      map.addLayer({id: 'measurement-line', type: 'line', source: 'measurement', filter: ['!=', ['geometry-type'], 'Point'], paint: {'line-color': '#704d7d', 'line-width': 2.5, 'line-dasharray': [2, 1]}})
      map.addLayer({id: 'measurement-point', type: 'circle', source: 'measurement', filter: ['==', ['geometry-type'], 'Point'], paint: {'circle-color': '#704d7d', 'circle-radius': 6, 'circle-stroke-width': 2, 'circle-stroke-color': '#fffaf0'}})
      map.addLayer({id: 'measurement-label', type: 'symbol', source: 'measurement', filter: ['==', ['geometry-type'], 'Point'], layout: {'text-field': ['get', 'label'], 'text-font': ['sans-serif'], 'text-size': 10, 'text-offset': [0, -1.3]}, paint: {'text-color': '#704d7d', 'text-halo-color': '#fffaf0', 'text-halo-width': 2}})
      onlineRef.current = createOnlineMap(map, state => current.current.onOnlineStatus(state), current.current.appearance)
      if (props.display.terrain3d) onlineRef.current.setRequestedPitch(props.camera.pitch ?? 0)
      applyMapAppearance(map,current.current.appearance)
      initialized = true; window.__terraAtlas = handle; refresh()
      const pickLayers = ['relation-member-labels', 'relation-member-hit', 'relations-area', 'relations-line', 'relations-reference', 'relations-dot', 'relations-symbols','city-hit','city-labels','plate-hit','basin-fill','place-labels', 'place-hit', 'river-hit', 'lake-fill', 'province-fill', 'language-dots', 'language-labels', 'language-area-fill','country-hit', 'climate-fill']
      map.on('click', event => {
        // Clicks on an adjacent world copy refer to the same canonical place.
        const coordinates: Coordinate = [wrapLongitude(event.lngLat.lng), event.lngLat.lat]
        if (current.current.mode === 'measure') { measurementPoints.push(coordinates); updateMeasurement(); return }
        if (current.current.mode === 'probe') { current.current.onProbe?.({coordinates}); return }
        const found = map.queryRenderedFeatures(event.point, {layers: pickLayers}).filter(feature => map.getLayoutProperty(feature.layer.id, 'visibility') !== 'none')
        const feature = found.find(feature => feature.source === 'relation-labels') || found.find(feature => feature.source === 'relations')
          || found.find(feature => feature.source === 'places' && feature.properties?.curated === true)
          || found.find(feature=>feature.source==='cities')
          || found.find(feature => feature.source === 'languages'||feature.source==='language-areas') || found.find(feature => feature.layer.id === 'place-labels')
          || found.find(feature => feature.source === 'places') || found.find(feature => !['climate', 'countries', 'population','basins'].includes(feature.source))
          || found.find(feature => feature.source === 'climate') || found.find(feature => feature.source === 'population')
          || (current.current.layers.religion || current.current.layers.language || current.current.layers.provinces ? found.find(feature => feature.source === 'countries') : undefined)
          || found.find(feature=>feature.source==='basins')
        if (!feature || feature.source === 'population') { current.current.onProbe?.({coordinates}); return }
        const raw = feature.properties as GeoProperties
        if (typeof raw.topicMemberId === 'string') {
          const card = knowledge.find(card => card.id === raw.topicMemberId)
          if (card) { current.current.onSelect({card}); return }
        }
        const source = feature.source === 'places' ? typeof raw.geoSource === 'string' ? raw.geoSource : sourceForId(raw.id) || 'regions' : feature.source
        const properties = data[source]?.features.find(value => value.properties.id === raw.id)?.properties || raw
        if (feature.source === 'climate') {
          const card = knowledge.find(card => card.id === `climate-${String(properties.family).toLowerCase()}`)
          if (card) current.current.onSelect({card: {...card, coordinates}, source: 'climate', featureId: properties.id, subtype: `${properties.code} · ${properties.name}`})
        } else {
          const card = knowledge.find(card => card.id === properties.id) || matchCard(properties)
          current.current.onSelect(card ? {card, ...(feature.source !== 'places' ? {source, featureId: properties.id, geographic: true} : {})}
            : {card: dataCard(properties, properties.center || coordinates, source), source, featureId: properties.id, geographic: true})
        }
      })
      map.on('mousemove', event => {
        if (current.current.mode && current.current.mode !== 'explore') map.getCanvas().style.cursor = 'crosshair'
        else map.getCanvas().style.cursor = map.queryRenderedFeatures(event.point, {layers: pickLayers}).length ? 'pointer' : ''
      })
      // The searchable gazetteer and optional thematic datasets never delay the base map.
      void ensure(['gazetteer'])
      await ensure(['land', 'countries'])
      if (disposed) return
      readyReported = true; current.current.onReady(handle); status(); emitVisible()
      void ensure(wanted())
    }
    void setup().catch(error => { if (!disposed && (error as Error).name !== 'AbortError') current.current.onStatus('地图初始化失败。已保留知识内容，请重试。') })
    let resizeDeferred=false
    function resizeMap(){
      const element=map.getContainer(),style=getComputedStyle(element)
      // Full reading hides the left map; keep its camera and last usable size.
      if(disposed||!element.clientWidth||!element.clientHeight||style.visibility==='hidden'||style.display==='none')return
      map.resize()
      if(!initialized)return
      const selection=current.current.selection
      if(preserveCameraOnResize){handle.reframe(null);return}
      if(!matchMedia(landscapeLayoutQuery).matches){if(selection)handle.reframe(selection);return}
      // Updating padding with jumpTo interrupts the current camera animation.
      // Let terrain tilt / navigation finish before reframing a resized sidebar.
      if(map.isMoving()){
        if(!resizeDeferred){resizeDeferred=true;map.once('moveend',()=>{resizeDeferred=false;resizeMap()})}
        return
      }
      const padding=mapPadding(element)
      map.jumpTo({padding})
      if(selection){
        const point=map.project(selection.card.coordinates)
        if(point.x<padding.left||point.x>element.clientWidth-padding.right||point.y<padding.top||point.y>element.clientHeight-padding.bottom)handle.reframe(selection)
      }
    }
    const resize = new ResizeObserver(resizeMap)
    resize.observe(container.current!)
    return () => {
      disposed = true; cancelAnimationFrame(refreshFrame); abort.abort(); cancelAnimationFrame(frameRequest); resize.disconnect(); onlineRef.current?.destroy(); onlineRef.current = null; map.remove(); mapRef.current = null; ensureRef.current = null; religionRef.current = null
      if (window.__terraAtlas === handle) delete window.__terraAtlas
    }
  }, [])
  useEffect(() => {
    const map = mapRef.current
    if (!map?.getLayer('relief')) return
    applyLayers(map, props.layers, props.opacity, props.thematic)
  }, [props.layers, props.opacity, props.thematic])
  useEffect(() => {
    if (!mapRef.current?.getLayer('relief')) return
    const names: string[] = []
    if (props.layers.terrain || props.layers.mountains) names.push('regions')
    if (props.layers.mountains) names.push('peaks', 'summits')
    if (props.layers.rivers) names.push('rivers')
    if (props.layers.lakes) names.push('lakes')
    if (props.layers.climate) names.push('climate')
    if (props.layers.provinces) names.push('provinces')
    if(props.layers.cities)names.push('cities')
    if(props.layers.basins)names.push('basins')
    if(props.layers.plates)names.push('plates')
    if (props.layers.language) names.push(thematicModes(props.thematic).languageMode==='overview'?'countries':thematicModes(props.thematic).languageMode==='points'?'languages':'language-areas')
    if (props.layers.religion) names.push('human')
    void ensureRef.current?.(names)
  }, [props.layers,props.thematic?.languageMode])
  useEffect(()=>{relationRef.current?.()},[props.topic])
  useEffect(() => { religionRef.current?.() }, [props.thematic?.religion])
  useEffect(() => { onlineRef.current?.update(props.display) }, [props.display])
  useEffect(()=>{const map=mapRef.current;if(map?.getLayer('relief'))applyMapAppearance(map,props.appearance);onlineRef.current?.setAppearance(props.appearance)},[props.appearance])
  useEffect(() => {
    const map = mapRef.current
    if (!map?.getSource('selection')) return
    selectGeometry(map, dataRef.current, props.selection)
    if (props.selection) void ensureRef.current?.(sourcesForSelection(props.selection))
  }, [props.selection])
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (props.mode === 'measure') map.doubleClickZoom.disable(); else map.doubleClickZoom.enable()
    map.getCanvas().style.cursor = props.mode && props.mode !== 'explore' ? 'crosshair' : ''
  }, [props.mode])
  return <div ref={container} className="atlas-map" aria-label="交互式地理地图" data-testid="atlas-map" />
}
