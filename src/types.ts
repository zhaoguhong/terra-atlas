export type Category = 'mountains' | 'terrain' | 'rivers' | 'lakes' | 'climate' | 'population' | 'religion' | 'language' | 'regions' | 'human'
export type View = 'china' | 'world'
export type TopicScope = View | 'all'
export interface Knowledge {
  id: string; name: string; englishName: string; aliases: string[]; category: Category;
  coordinates: [number, number]; summary: string; location: string; formation: string;
  connections: string[]; facts: { label: string; value: string }[];
  sources: { title: string; url: string }[]; region?: View; relatedIds?: string[]; geometryNote?: string;
  sections?: { title: string; body: string }[]; questions?: string[]; tags?: string[];
  mapZoom?: number; mapRole?: 'place' | 'concept';
}
export interface LayerState { terrain: boolean; mountains: boolean; rivers: boolean; lakes: boolean; climate: boolean; borders: boolean; population: boolean; religion: boolean; language: boolean; provinces: boolean; grid: boolean; cities: boolean; basins: boolean; plates: boolean }
export interface MapDisplay { basemap: 'natural' | 'detail'; terrain3d: boolean }
export interface OnlineMapStatus { detail: 'off' | 'loading' | 'ready' | 'error'; terrain: 'off' | 'loading' | 'ready' | 'error' }
export interface Camera { center: [number, number]; zoom: number; bearing?: number; pitch?: number }
export interface SavedView { id: string; name: string; camera: Camera; layers: LayerState; view: View; opacity?: number; thematic?: ThematicState; place?: string; display?: MapDisplay; topicId?: string | null }
export interface Selection { card: Knowledge; featureId?: string; source?: string; subtype?: string; geographic?: boolean }
export interface ThematicState { religion: string; language: string; opacity: number; climateMode?: 'groups'|'types'; languageMode?: 'areas'|'families'|'points'; languageId?: string }
export type TopicGroup = 'regions' | 'landforms' | 'water' | 'climate' | 'people' | 'resources' | 'earth'
export type TopicKind = 'collection' | 'distribution' | 'connections'
export type TopicOverlay = 'climate' | 'population' | 'religion' | 'language'
export type TopicVisual = {kind:'bars';title:string;unit:string;rows:{label:string;value:number;place?:string}[];note:string;sources:{title:string;url:string}[]} | {kind:'comparison';title:string;columns:string[];rows:string[][];note?:string} | {kind:'plates';title:string;note:string}
export interface Topic {
  id: string; title: string; description: string; question: string; stops: string[]; layers: string[]; region: View; takeaway: string;
  group: TopicGroup; kind: TopicKind; shared?: boolean; overlay: TopicOverlay | null;
  sections: {title: string; body: string}[]; sources: {title: string; url: string}[]; geometryNote?: string;
  visuals?: TopicVisual[];
  modules?: {id: string; title: string; description: string; detail?:string; stops: string[]}[];
}
export interface ClimateNote { code: string; title: string; description: string; seasons: string; landscape: string; examples: string[]; questions: string[]; sources: {title:string;url:string}[] }
export interface ClimatePlace { id: string; name: string; coordinates: [number,number]; sampleCoordinates: [number,number]; temperature: number[]; precipitation: number[]; [key:string]: unknown }
export interface ClimateSeries { period: string; resolution?: number; resolutionDegrees?: number; sourceId: string; places: ClimatePlace[]; [key:string]:unknown }
export interface MapProbe { coordinates: [number,number] }
export interface GeoProperties {
  id: string; name: string; nameEn: string; aliases?: string[]; kind?: string; subkind?: string;
  center?: [number, number]; rank?: number; minZoom?: number; code?: string; family?: string; color?: string;
  [key: string]: unknown;
}
