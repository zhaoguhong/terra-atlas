import {useEffect,useId,useRef,useState} from 'react'
import {ChevronDown,ChevronUp,Search} from 'lucide-react'

export type LegendSymbol='area'|'point'|'line'|'dashed'|'peak'|'port'|'city'|'empty'
export interface LegendEntry {id:string;label:string;color?:string;symbol?:LegendSymbol;active?:boolean;description?:string}
export interface LegendSection {id:string;title?:string;entries?:LegendEntry[];scale?:{color:string;stops:{label:string;position:number}[]};note?:string}
interface Props {title:string;subtitle?:string;sections:LegendSection[];onEntryClick?:(id:string)=>void}

function Symbol({entry}:{entry:LegendEntry}) {
  return <i aria-hidden="true" className={'map-legend-symbol symbol-'+(entry.symbol||'area')} style={{color:entry.color||'#7b8970',backgroundColor:entry.symbol==='empty'?'transparent':entry.color||'#7b8970'}}/>
}
function Scale({scale}:{scale:NonNullable<LegendSection['scale']>}) {
  return <div className="map-legend-scale"><div style={{background:scale.color}}/>{scale.stops.map(stop=><span key={stop.label} style={{left:`${stop.position*100}%`}}>{stop.label}</span>)}</div>
}
export default function MapLegend({title,subtitle,sections,onEntryClick}:Props) {
  const [expanded,setExpanded]=useState(false),[query,setQuery]=useState('')
  const id=useId(),toggle=useRef<HTMLButtonElement>(null)
  const element=useRef<HTMLElement>(null)
  useEffect(()=>{
    if(expanded||!element.current)return
    const legend=element.current,stage=legend.parentElement
    const resize=()=>stage?.style.setProperty('--map-legend-height',`${legend.getBoundingClientRect().height}px`)
    resize()
    const observer=new ResizeObserver(resize);observer.observe(legend)
    return()=>observer.disconnect()
  },[expanded])
  useEffect(()=>{setExpanded(false);setQuery('')},[title])
  useEffect(()=>{
    if(!expanded)return
    const close=(event:KeyboardEvent)=>{if(event.key==='Escape'){setExpanded(false);toggle.current?.focus()}}
    window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)
  },[expanded])
  const entryCount=sections.reduce((sum,section)=>sum+(section.entries?.length||0),0)
  const primary=sections[0]
  const preview=primary?.entries?.slice(0,6)||[]
  const renderEntry=(entry:LegendEntry)=>onEntryClick&&entry.id.startsWith('action:')
    ?<button key={entry.id} className="map-legend-entry" aria-pressed={entry.active} onClick={()=>onEntryClick(entry.id)} title={entry.description}><Symbol entry={entry}/><span>{entry.label}</span></button>
    :<span key={entry.id} className="map-legend-entry" title={entry.description}><Symbol entry={entry}/><span>{entry.label}</span></span>
  return <aside ref={element} className={'legend panel map-legend '+(expanded?'is-expanded':'')} aria-label="地图图例">
    <div className="map-legend-header"><div><strong>{title}</strong>{subtitle&&<small>{subtitle}</small>}</div><button ref={toggle} aria-label={expanded?'收起图例':'展开图例'} aria-expanded={expanded} aria-controls={id} onClick={()=>setExpanded(value=>!value)}>{expanded?<ChevronDown size={14}/>:<ChevronUp size={14}/>}<span>{expanded?'收起':'展开'}</span></button></div>
    {!expanded&&<div className="map-legend-preview">{primary?.scale?<Scale scale={primary.scale}/>:preview.map(renderEntry)}{(primary?.entries?.length||0)>preview.length&&<button className="map-legend-more" onClick={()=>setExpanded(true)}>还有 {(primary?.entries?.length||0)-preview.length} 项</button>}</div>}
    {expanded&&<div id={id} className="map-legend-body">
      {entryCount>15&&<label className="map-legend-search"><Search size={13}/><input aria-label="搜索图例" placeholder="查找颜色或符号…" value={query} onChange={event=>setQuery(event.target.value)}/></label>}
      {sections.map(section=>{
        const entries=(section.entries||[]).filter(entry=>!query||`${entry.label} ${entry.description||''}`.toLowerCase().includes(query.trim().toLowerCase()))
        if(query&&!entries.length&&!section.scale)return null
        return <section key={section.id} aria-label={section.title||title}>{section.title&&<h3>{section.title}</h3>}{section.scale&&<Scale scale={section.scale}/>}<div className="map-legend-entries">{entries.map(renderEntry)}</div>{section.note&&<p>{section.note}</p>}</section>
      })}
      {query&&!sections.some(section=>section.entries?.some(entry=>`${entry.label} ${entry.description||''}`.toLowerCase().includes(query.trim().toLowerCase())))&&<p className="map-legend-empty">没有找到对应的图例。</p>}
    </div>}
  </aside>
}
