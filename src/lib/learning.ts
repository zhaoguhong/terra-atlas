import { useEffect, useState } from 'react'
import type { ClimatePlace, ClimateSeries, Knowledge } from '../types'

const cache = new Map<string, Promise<unknown>>()
export function readLocalJson<T>(path: string): Promise<T> {
  if(!cache.has(path))cache.set(path,fetch(`${import.meta.env.BASE_URL}${path}`).then(async r=>{
    if(!r.ok)throw new Error('这份资料暂时未能加载，请重试。')
    return r.json()
  }).catch(e=>{cache.delete(path);throw e}))
  return cache.get(path) as Promise<T>
}
export function useLocalJson<T>(path: string|null){
  const [data,setData]=useState<T|null>(null)
  const [error,setError]=useState('')
  const [attempt,setAttempt]=useState(0)
  useEffect(()=>{
    let active=true
    setData(null);setError('')
    if(path)readLocalJson<T>(path).then(v=>{if(active)setData(v)}).catch(e=>{if(active)setError(e.message)})
    return()=>{active=false}
  },[path,attempt])
  return {data,error,retry:()=>{if(path)cache.delete(path);setAttempt(v=>v+1)}}
}
export interface Grid { width:number; height:number; west:number; north:number; resolutionDegrees:number; nodata?:number; data:number[] }
export function gridIndex(grid:Pick<Grid,'width'|'height'|'west'|'north'|'resolutionDegrees'>,coordinates:[number,number]):number|null {
  const [lng,lat]=coordinates
  if(!Number.isFinite(lng)||!Number.isFinite(lat)||lng<grid.west||lng>grid.west+grid.width*grid.resolutionDegrees||lat>grid.north||lat<=grid.north-grid.height*grid.resolutionDegrees)return null
  const col=Math.min(grid.width-1,Math.floor((lng-grid.west)/grid.resolutionDegrees))
  const row=Math.floor((grid.north-lat)/grid.resolutionDegrees)
  return row*grid.width+col
}
export function distanceKm(a:[number,number],b:[number,number]):number {
  const rad=Math.PI/180
  const v=Math.sin((b[1]-a[1])*rad/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin((b[0]-a[0])*rad/2)**2
  return 6371.0088*2*Math.asin(Math.sqrt(Math.min(1,v)))
}
export function nearestClimate(series:ClimateSeries|null,coordinates:[number,number],maxKm=150):ClimatePlace|null {
  if(!series)return null
  const points=[...series.places].sort((a,b)=>distanceKm(a.coordinates,coordinates)-distanceKm(b.coordinates,coordinates))
  return points[0]&&distanceKm(points[0].coordinates,coordinates)<=maxKm?points[0]:null
}
export function numberText(value:number|null|undefined,unit=''):string {
  if(value==null||!Number.isFinite(value))return '暂无资料'
  return new Intl.NumberFormat('zh-CN',{maximumFractionDigits:value<100?1:0}).format(value)+unit
}
export function climateReference(place:ClimatePlace):Knowledge {
  return {id:place.id,name:place.name,englishName:place.name,aliases:[],category:'regions',coordinates:place.coordinates,
    summary:'月气候参考点。结合十二个月的气温和降水，观察季节变化与海陆位置、地形的联系。',
    location:`参考坐标 ${place.coordinates[1].toFixed(2)}°纬度，${place.coordinates[0].toFixed(2)}°经度。`,
    formation:'纬度影响太阳辐射，海陆位置与大气环流影响水汽和季节变化，海拔与坡向也参与塑造当地气候。分类图与月资料都采用长期格网资料，具体成因还需结合区域证据。',
    connections:['打开经纬网，对比相近纬度的其他地点。','结合地形和月降水，观察温度与雨季是否同步变化。'],
    facts:[{label:'气候时期',value:'1991–2020'},{label:'取样尺度',value:'0.5°格网'}],
    sources:[{title:'Beck V3 · 原始月气候数据',url:'https://figshare.com/articles/dataset/High-resolution_1_km_K_ppen-Geiger_maps_for_1901_2099_based_on_constrained_CMIP6_projections/21789074'}],
    geometryNote:'此点供区域学习定位。气候值取自附近网格中心，不是城市气象站观测。'}
}

export interface CountryIndicators {year:number;note:string;countries:{countryId:string;iso3:string;name:string;population:number|null;urbanPercent:number|null;year:number}[]}
export interface CountryLanguages {note:string;categories:{id:string;name:string}[];countries:{countryId:string;iso3:string;name:string;languages:{id:string;name:string;status:string;sourceLabel?:string}[];untranslatedEntries?:string[];sourceEntries?:string[];sourceText:string;year:number|null;period:string;sourceUrl:string}[]}
export interface ReligionCategory {id:string;name:string;color:string}
export interface ReligionCountry {countryId:string;iso3:string;name:string;year:number|null;period:string|null;shares:Record<string,number|null>;reportedGroups?:unknown[];largestReportedCategory:string|null;scope:string;sourceText:string;notes?:string[]|string;sourceId:string;sourceUrl?:string;sourceFile?:string}
export interface HumanData {religion:{period:string;year:number|null;categories:ReligionCategory[];countries:ReligionCountry[]};[key:string]:unknown}
