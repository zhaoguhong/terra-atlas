import {useEffect,useMemo,useRef,useState} from 'react'
import {ArrowUpRight,LocateFixed,Minus,Plus,RotateCcw,X} from 'lucide-react'
import AtlasMap,{type AtlasHandle} from './AtlasMap'
import {mapRepresentation,representationLabels} from '../lib/geometry-presentation'
import type {Camera,Knowledge,LayerState,ResolvedAppearance,Selection,Topic} from '../types'
import './ReadingInlineMap.css'

const layers:LayerState={terrain:true,borders:true,mountains:false,rivers:true,lakes:true,climate:false,population:false,religion:false,language:false,provinces:false,grid:false,cities:false,basins:false,plates:false}
const display={basemap:'natural',terrain3d:false} as const
const noop=()=>{}

export default function ReadingInlineMap({id,title,places,onClose,onExplore}:{
  id:string;title:string;places:Knowledge[];onClose:()=>void;onExplore?:(id:string)=>void;
}){
  const root=useRef<HTMLDivElement>(null)
  const atlas=useRef<AtlasHandle|null>(null)
  const [selection,setSelection]=useState<Selection|null>(null)
  const [status,setStatus]=useState('loading')
  const [ready,setReady]=useState(false)
  const [attempt,setAttempt]=useState(0)
  const [appearance,setAppearance]=useState<ResolvedAppearance>(()=>document.documentElement.dataset.theme==='dark'?'dark':'light')
  const ids=useMemo(()=>places.map(place=>place.id),[places])
  // The same renderer and explicit feature bindings as the full atlas determine
  // whether a place is a range, a line or only a reference point.
  const topic=useMemo<Topic>(()=>({id:'figure-'+id,title,description:'',question:'',stops:ids,layers:['terrain','borders','rivers','lakes'],region:places.every(place=>place.region==='china')?'china':'world',takeaway:'',group:'regions',kind:'collection',overlay:null,sections:[],sources:[]}),[id,title,ids,places])
  const camera=useMemo<Camera>(()=>({center:places[0]?.coordinates||[105,35],zoom:places.every(place=>place.region==='china')?2.3:0}),[places])
  const interactive=ready&&status==='ready'
  useEffect(()=>{
    const observer=new MutationObserver(()=>setAppearance(document.documentElement.dataset.theme==='dark'?'dark':'light'))
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']})
    return()=>observer.disconnect()
  },[])
  useEffect(()=>()=>{atlas.current=null},[])
  function onReady(handle:AtlasHandle){
    atlas.current=handle
    const describe=()=>{
      if(atlas.current!==handle||!root.current)return
      for(const source of ['relations','selection']){
        const data=(handle.map.getSource(source)?.serialize() as {data?:{features?:{properties:{id:string};geometry:{type:string}}[]}}|undefined)?.data
        root.current.setAttribute('data-'+source+'-geometry',JSON.stringify(data?.features?.map(feature=>({id:feature.properties.id,type:feature.geometry.type}))||[]))
      }
    }
    handle.map.on('sourcedata',describe)
    handle.map.on('movestart',()=>root.current?.setAttribute('data-map-settled','false'))
    handle.map.on('idle',()=>root.current?.setAttribute('data-map-settled','true'))
    void handle.showRelations(ids).then(()=>{if(atlas.current===handle){setReady(true);describe()}})
  }
  function choose(next:Selection){
    // Keep the inset focused on the objects shown in this figure. Other atlas
    // labels can be explored after opening the full map.
    if(!interactive||!ids.includes(next.card.id))return
    root.current?.setAttribute('data-map-settled','false')
    setSelection(next)
    atlas.current?.locate(next)
  }
  function overview(){if(!interactive)return;root.current?.setAttribute('data-map-settled','false');setSelection(null);void atlas.current?.showRelations(ids)}
  function retry(){
    if(atlas.current)void atlas.current.retry().then(()=>atlas.current?.showRelations(ids))
    else{setStatus('loading');setReady(false);setAttempt(value=>value+1)}
  }
  const selected=selection?.card
  const failed=status!=='loading'&&status!=='ready'
  return <div ref={root} id={'reading-map-'+id} className="reading-inline-map" role="region" aria-label={title+'的交互地图'} data-map-ready={interactive} data-selected-place={selected?.id||''}>
    <div className="reading-inline-map-heading"><span><LocateFixed size={16}/>山河图 · {title}</span><button aria-label="收起配图地图" onClick={onClose}><X size={17}/><span>收起地图</span></button></div>
    <div className="reading-inline-map-stage">
      <AtlasMap key={attempt} embedded appearance={appearance} topic={topic} layers={layers} opacity={.48} camera={camera} selection={selection} display={display} onOnlineStatus={noop} onSelect={choose} onCamera={noop} onReady={onReady} onStatus={setStatus} onCatalog={noop}/>
      {!ready&&!failed&&<p className="reading-inline-map-status" role="status">正在打开地图…</p>}
      <div className="reading-inline-map-controls" role="group" aria-label="配图地图控制"><button aria-label="放大配图地图" disabled={!interactive} onClick={()=>atlas.current?.map.zoomIn()}><Plus size={18}/></button><button aria-label="缩小配图地图" disabled={!interactive} onClick={()=>atlas.current?.map.zoomOut()}><Minus size={18}/></button><button aria-label="查看配图全部地点" disabled={!interactive} onClick={overview}><RotateCcw size={17}/></button></div>
      <a className="reading-inline-map-attribution" href={import.meta.env.BASE_URL+'data/sources.json'} target="_blank" rel="noopener noreferrer">Natural Earth 等 · 地图来源</a>
    </div>
    {failed&&<div className="reading-inline-map-error" role="alert"><p>{status}</p><button onClick={retry}>重试配图地图</button></div>}
    <div className="reading-inline-map-places" role="group" aria-label="选择配图中的地点"><button aria-pressed={!selected} disabled={!interactive} onClick={overview}>全部地点</button>{places.map(place=><button key={place.id} aria-pressed={selected?.id===place.id} disabled={!interactive} onClick={()=>choose({card:place})}><span>{place.name}</span><small>{representationLabels[mapRepresentation(place)]}</small></button>)}</div>
    <p className="reading-inline-map-note">虚线范围沿用已核对的概化参考数据，圆点仅表示位置。可用＋－缩放；触屏双指操作，滚轮缩放需按住 Ctrl 或 ⌘。</p>
    {selected&&<div className="reading-inline-map-place"><div><strong>{selected.name}</strong><p>{selected.summary}</p></div>{onExplore&&<button onClick={()=>onExplore(selected.id)}>在完整地图中查看<ArrowUpRight size={16}/></button>}</div>}
    {!selected&&onExplore&&<button className="reading-inline-map-open" onClick={()=>onExplore(places[0].id)}>在完整地图中继续探索<ArrowUpRight size={16}/></button>}
  </div>
}
