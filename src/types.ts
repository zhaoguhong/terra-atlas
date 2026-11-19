export type Appearance = 'system' | 'light' | 'dark'
export type ResolvedAppearance = Exclude<Appearance, 'system'>
export type Category = 'mountains' | 'terrain' | 'rivers' | 'lakes' | 'climate' | 'population' | 'religion' | 'language' | 'regions' | 'human'
export type View = 'china' | 'world'
export type TopicScope = View | 'all'
export interface Knowledge {
  id: string; name: string; englishName: string; aliases: string[]; category: Category;
  coordinates: [number, number]; summary: string; location: string; formation: string;
  connections: string[]; facts: { label: string; value: string }[];
  sources: { title: string; url: string }[]; region?: View; relatedIds?: string[]; geometryNote?: string;
  sections?: { title: string; body: string }[]; questions?: string[]; tags?: string[];
  mapZoom?: number; mapRole?: 'place' | 'concept'; mediaIds?: string[]; readingTopicIds?:string[];
  geometryType?: string;
}
export interface LayerState { terrain: boolean; mountains: boolean; rivers: boolean; lakes: boolean; climate: boolean; borders: boolean; population: boolean; religion: boolean; language: boolean; provinces: boolean; grid: boolean; cities: boolean; basins: boolean; plates: boolean }
export interface MapDisplay { basemap: 'natural' | 'detail'; terrain3d: boolean }
export interface OnlineMapStatus { detail: 'off' | 'loading' | 'ready' | 'error'; terrain: 'off' | 'loading' | 'ready' | 'error' }
export interface Camera { center: [number, number]; zoom: number; bearing?: number; pitch?: number }
export interface SavedView { id: string; name: string; camera: Camera; layers: LayerState; view: View; opacity?: number; thematic?: ThematicState; place?: string; featureId?: string; subtype?: string; placeCoordinates?: [number,number]; display?: MapDisplay; topicId?: string | null }
export interface Selection { card: Knowledge; featureId?: string; source?: string; subtype?: string; geographic?: boolean }
export interface ThematicState { religion: string; language: string; opacity: number; climateMode?: 'groups'|'types'; languageMode?: 'overview'|'areas'|'families'|'points'; languageId?: string }
export type TopicGroup = 'regions' | 'landforms' | 'water' | 'climate' | 'people' | 'resources' | 'earth'
export type TopicKind = 'collection' | 'distribution' | 'connections'
export type TopicOverlay = 'climate' | 'population' | 'religion' | 'language'
export type TopicVisual = {kind:'bars';title:string;unit:string;rows:{label:string;value:number;place?:string}[];note:string;sources:{title:string;url:string}[]} | {kind:'comparison';title:string;columns:string[];rows:string[][];note?:string} | {kind:'plates';title:string;note:string}
export interface Topic {
  id: string; title: string; description: string; question: string; stops: string[]; layers: string[]; region: View; takeaway: string;
  group: TopicGroup; kind: TopicKind; shared?: boolean; overlay: TopicOverlay | null;
  sections: {title: string; body: string}[]; sources: {title: string; url: string}[]; geometryNote?: string;
  visuals?: TopicVisual[];
  mapGuide?: {summary?:string;sections:{sectionId:string;title:string;body:string}[];cases:{id:string;prompt:string}[]};
  modules?: {id: string; partTitle?:string; title: string; description: string; detail?:string; stops: string[]}[];
  reading?: {parts?:ReadingPart[];chapters?:{id:string;title:string}[];coverId:string; keywords:string[]; highlights:string[]; minutes:number; relatedTopicIds:string[]};
}
export interface ReadingProgress {sectionId:string; offset:number; updatedAt:number}
export interface ReadingPart {id:string;title:string;sectionId:string;description:string;keywords:string[]}
export interface TopicArticle {
  id:string; title:string; introduction:string; updatedAt:string; parts?:ReadingPart[]; presentation?:'essay';
  sections:{id:string; title:string; paragraphs:string[]; continuation?:boolean; partId?:string; mediaIds?:string[]; mediaAfterParagraph?:Record<string,number>; mediaPlacement?:'before-text'; visuals?:TopicVisual[]; caseIds?:string[]; mapLabels?:Record<string,string>; terms?:{term:string;definition:string}[]}[];
  questions:{question:string;answer:string}[];
  sources:{title:string;url:string}[];
}
export interface ReadingMedia {
  id:string; path:string; kind:'photo'|'diagram'|'map'|'illustration'; title:string; alt:string; caption:string;
  author:string; license:string; sourceUrl:string; width:number; height:number;
  sourceUrls?:string[]; placeIds?:string[]; licenseUrl?:string;
}
export interface ClimateNote { code: string; title: string; description: string; seasons: string; landscape: string; examples: string[]; questions: string[]; sources: {title:string;url:string}[]; sections?:{title:string;body:string}[]; mediaIds?:string[]; readingTopicIds?:string[] }
export interface ClimatePlace { id: string; name: string; coordinates: [number,number]; sampleCoordinates: [number,number]; temperature: number[]; precipitation: number[]; [key:string]: unknown }
export interface ClimateSeries { period: string; resolution?: number; resolutionDegrees?: number; sourceId: string; places: ClimatePlace[]; [key:string]:unknown }
export interface MapProbe { coordinates: [number,number] }
export interface GeoProperties {
  id: string; name: string; nameEn: string; aliases?: string[]; kind?: string; subkind?: string;
  center?: [number, number]; rank?: number; minZoom?: number; code?: string; family?: string; color?: string;
  [key: string]: unknown;
}
