import { ArrowRight,MapPin,X } from 'lucide-react'
import {useEffect,useState} from 'react'
import type {AtlasHandle} from './AtlasMap'
import climateLegend from '../../public/data/climate-legend.json'
import climateNotes from '../data/climate-notes.json'
import {distanceKm,gridIndex,nearestClimate,numberText,useLocalJson,type Grid} from '../lib/learning'
import type { ClimateNote,ClimateSeries,MapProbe } from '../types'
import ClimateChart from './ClimateChart'

interface PopulationGrid {width:number;height:number;west:number;north:number;resolutionDegrees:number;values:(number|null)[][];year:number}
export default function ProbePanel({probe,atlas,onClose,onClimate,onPlace}:{probe:MapProbe;atlas:AtlasHandle|null;onClose:()=>void;onClimate:(code:string,coordinates:[number,number])=>void;onPlace:(id:string)=>void}){
  const climate=useLocalJson<Grid>('data/climate-grid.json')
  const population=useLocalJson<PopulationGrid>('data/learning-population.json')
  const monthly=useLocalJson<ClimateSeries>('data/learning-climate.json')
  const ci=climate.data?gridIndex(climate.data,probe.coordinates):null
  const value=ci!=null?climate.data!.data[ci]:null
  const code=climateLegend.find(c=>c.value===value)
  const note=(climateNotes as ClimateNote[]).find(c=>c.code===code?.code)
  const pi=population.data?gridIndex(population.data,probe.coordinates):null
  const density=pi!=null?population.data!.values[Math.floor(pi/population.data!.width)]?.[pi%population.data!.width]:null
  const place=nearestClimate(monthly.data,probe.coordinates)
  const [elevation,setElevation]=useState<{meters:number;spacing:number}|null>(null)
  useEffect(()=>{let active=true;setElevation(null);if(atlas)void atlas.ensureElevation(probe.coordinates).then(()=>{const meters=atlas.sampleElevation(probe.coordinates),region=atlas.elevation?.regions.find(r=>probe.coordinates[0]>=r.bounds[0]&&probe.coordinates[0]<=r.bounds[2]&&probe.coordinates[1]>=r.bounds[1]&&probe.coordinates[1]<=r.bounds[3]);if(active&&meters!=null&&region)setElevation({meters,spacing:region.pixelSpacingMetersAtCenter})});return()=>{active=false}},[atlas,probe.coordinates])
  return <aside className="probe-panel panel" aria-label="位置点查">
    <div className="knowledge-top"><span><MapPin size={13}/>位置点查</span><button className="icon-button" aria-label="关闭点查" onClick={onClose}><X size={17}/></button></div>
    <div className="probe-scroll"><h2>{Math.abs(probe.coordinates[1]).toFixed(2)}°{probe.coordinates[1]<0?'S':'N'} · {Math.abs(probe.coordinates[0]).toFixed(2)}°{probe.coordinates[0]<0?'W':'E'}</h2>
      <section className="reading-section"><h3>长期气候</h3>{code?<><button className="probe-climate" onClick={()=>onClimate(code.code,probe.coordinates)}><i style={{background:code.color}}/><span><strong>{code.code} · {code.name}</strong><small>查看分类解释与观察问题</small></span><ArrowRight size={15}/></button><p>{note?.seasons}</p></>:<p>{climate.error||(!climate.data?'正在读取分类格网…':'此网格没有气候分类资料；海洋或缺失位置不作推断。')}</p>}<p className="data-caption">Beck V3 · 1991–2020 · 0.5°格网，不能反映山顶与山谷等局地差异。</p></section>
      <section className="reading-section"><h3>人口密度 · 2020</h3>{density!=null?<><strong className="probe-number">{numberText(density)}<small>人 / km²</small></strong><p className="data-caption">GHS-POP人口估计聚合到0.5°；密度按完整格网面积计算，不能表示一条街道或村落的人口。</p></>:<p>{population.error||(!population.data?'正在读取人口格网…':'此格网暂无有效人口资料。缺失不表示无人居住。')}</p>}</section>
      {elevation&&<section className="reading-section"><h3>局部高程参考</h3><strong className="probe-number">{numberText(elevation.meters)}<small>米</small></strong><p className="data-caption">Mapzen/Tilezen · SRTM约2000年资料；显示像元约{Math.round(elevation.spacing)}米，原始主要高程资料约90米。此数值是像元高程，不代表山峰正式海拔或当前位置实测。</p><a className="text-button" href={import.meta.env.BASE_URL+'elevation/source.json'} target="_blank" rel="noopener noreferrer">高程来源与覆盖范围 ↗</a></section>}
      {place&&<section className="reading-section"><h3>附近月气候参考点</h3><p className="data-caption">{place.name}，距所点位置约 {numberText(distanceKm(place.coordinates,probe.coordinates),' km')}；图表属于该参考点的取样网格。</p><ClimateChart place={place} compact/><button className="text-button" onClick={()=>onPlace(place.id)}>查看这个参考点 <ArrowRight size={14}/></button></section>}
      {(climate.error||population.error||monthly.error)&&<button className="secondary-button" onClick={()=>{climate.retry();population.retry();monthly.retry()}}>重新读取点查资料</button>}
    </div>
  </aside>
}
