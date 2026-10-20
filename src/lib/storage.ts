import type { Camera, LayerState, MapDisplay, SavedView, ThematicState, View } from '../types'
import {legacyTopic,singleOverlay,topicOverlays,validTopicReference} from './theme-state.ts'
export const defaultLayers: LayerState = { terrain: true, mountains: true, rivers: true, lakes: true, climate: false, borders: true, population: false, religion: false, language: false, provinces: false, grid: false, cities:false, basins:false, plates:false }
export const defaultThematic: ThematicState = { religion: 'largest', language: 'all', opacity: 0.72, climateMode:'groups', languageMode:'areas', languageId:'all' }
export const defaultDisplay: MapDisplay = { basemap: 'natural', terrain3d: false }
export const initialCamera: Camera = {center: [104, 35], zoom: typeof window !== 'undefined' && window.matchMedia('(max-width: 759px), (max-width: 1000px) and (max-height: 540px)').matches ? 2 : 3.3}
export interface Collection { id: string; name: string; places: string[] }
export interface Preferences { favorites: string[]; savedViews: SavedView[]; layers: LayerState; camera: Camera; view: View; opacity: number; thematic: ThematicState; display: MapDisplay; notes: Record<string,string>; collections: Collection[]; topicId:string|null }
const defaults: Preferences = { favorites: [], savedViews: [], layers: defaultLayers, camera: initialCamera, view: 'china', opacity: 0.48, thematic: defaultThematic, display: defaultDisplay, notes: {}, collections: [],topicId:null }
export function validCamera(c: unknown): c is Camera {
  const v = c as Camera | undefined
  return !!v && Array.isArray(v.center) && v.center.length === 2 && v.center.every(Number.isFinite) && Math.abs(v.center[0]) <= 180 && Math.abs(v.center[1]) <= 85 && Number.isFinite(v.zoom) && v.zoom >= -1.2 && v.zoom <= 11.5 && (v.pitch === undefined || (Number.isFinite(v.pitch) && v.pitch >= 0 && v.pitch <= 60)) && (v.bearing === undefined || Number.isFinite(v.bearing))
}
export function validDisplay(value: unknown): MapDisplay {
  const v=value as Partial<MapDisplay>|undefined
  return {basemap:v?.basemap==='detail'?'detail':'natural',terrain3d:v?.terrain3d===true}
}
export function validLayers(value: unknown): LayerState {
  const v=value as Partial<LayerState>|undefined
  const layers=Object.fromEntries(Object.entries(defaultLayers).map(([k,fallback])=>[k,typeof v?.[k as keyof LayerState]==='boolean'?v[k as keyof LayerState]:fallback])) as unknown as LayerState
  return singleOverlay(layers,topicOverlays.find(key=>layers[key])||null)
}
export function validThematic(value:unknown):ThematicState {
  const v=value as Partial<ThematicState>|undefined
  return {religion:typeof v?.religion==='string'?v.religion:'largest',language:typeof v?.language==='string'?v.language:'all',opacity:typeof v?.opacity==='number'&&v.opacity>=.15&&v.opacity<=.9?v.opacity:.72,climateMode:v?.climateMode==='types'?'types':'groups',languageMode:v?.languageMode==='points'?'points':v?.languageMode==='families'?'families':'areas',languageId:typeof v?.languageId==='string'?v.languageId:'all'}
}
export function parsePreferences(value: unknown): Preferences {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('记录格式不正确')
  const p=value as Partial<Preferences>
  const display=validDisplay(p.display)
  const layers=validLayers(p.layers)
  const strings=(v:unknown)=>Array.isArray(v)?v.filter((x):x is string=>typeof x==='string').slice(0,1000):[]
  const notes=Object.fromEntries(Object.entries(p.notes||{}).filter(([k,v])=>k.length<200&&typeof v==='string').map(([k,v])=>[k,String(v).slice(0,4000)]))
  return {
    favorites:strings(p.favorites),
    savedViews:Array.isArray(p.savedViews)?p.savedViews.filter(v=>v&&typeof v.id==='string'&&typeof v.name==='string'&&validCamera(v.camera)).slice(0,40).map(v=>{const savedDisplay=validDisplay(v.display),savedLayers=validLayers(v.layers);return {...v,display:savedDisplay,thematic:validThematic(v.thematic),camera:{...v.camera,pitch:savedDisplay.terrain3d?v.camera.pitch??0:0},layers:savedLayers,topicId:validTopicReference(v.topicId,savedLayers),view:v.view==='world'?'world':'china'}}):[],
    layers,topicId:validTopicReference(p.topicId,layers)??(p.topicId===null?null:legacyTopic(layers)),camera:validCamera(p.camera)?{...p.camera,pitch:display.terrain3d?p.camera.pitch??0:0}:initialCamera,view:p.view==='world'?'world':'china',display,
    opacity:typeof p.opacity==='number'&&p.opacity>=0.15&&p.opacity<=0.85?p.opacity:0.48,
    thematic:validThematic(p.thematic),
    notes,collections:Array.isArray(p.collections)?p.collections.filter(c=>c&&typeof c.id==='string'&&typeof c.name==='string').slice(0,40).map(c=>({...c,name:c.name.slice(0,80),places:strings(c.places)})):[],
  }
}
export function loadPreferences(): Preferences {
  try {
    const p=JSON.parse(localStorage.getItem('terra-atlas-v1')||'null')
    return p?parsePreferences(p):defaults
  } catch { return defaults }
}
export function savePreferences(p: Preferences): boolean {
  try {localStorage.setItem('terra-atlas-v1', JSON.stringify(p)); return true} catch {return false}
}
