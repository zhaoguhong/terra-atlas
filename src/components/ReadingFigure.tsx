import {lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react'
import {Expand,Map,X,ZoomIn,ZoomOut} from 'lucide-react'
import {mediaById} from '../lib/reading'
import {knowledge} from '../lib/catalog'
const ReadingInlineMap=lazy(()=>import('./ReadingInlineMap'))
import ReadingMapLinks from './ReadingMapLinks'
import './ReadingInlineMap.css'

// Each expanded figure owns a WebGL context. Opening another figure releases
// the previous one rather than accumulating live maps throughout a long essay.
const closeFigureMaps=new Set<()=>void>()

export default function ReadingFigure({id,compact=false,onExplore}:{id:string;compact?:boolean;onExplore?:(id:string)=>void}){
  const item=mediaById.get(id)
  const dialog=useRef<HTMLDialogElement>(null)
  const [failed,setFailed]=useState(false)
  const [enlarged,setEnlarged]=useState(false)
  const [zoomed,setZoomed]=useState(false)
  const [mapOpen,setMapOpen]=useState(false)
  const mapButton=useRef<HTMLButtonElement>(null)
  const places=useMemo(()=>(item?.placeIds||[]).flatMap(id=>{const card=knowledge.find(card=>card.id===id);return card&&card.mapRole!=='concept'?[card]:[]}),[item])
  useEffect(()=>{setFailed(false);setMapOpen(false)},[id])
  useEffect(()=>{
    const close=()=>setMapOpen(false)
    closeFigureMaps.add(close)
    return()=>{closeFigureMaps.delete(close)}
  },[])
  if(!item)return null
  const src=import.meta.env.BASE_URL+item.path
  const illustrated=item.kind==='illustration'
  function toggleMap(){if(!mapOpen)for(const close of closeFigureMaps)close();setMapOpen(!mapOpen)}
  function closeMap(){setMapOpen(false);mapButton.current?.focus({preventScroll:true})}
  function enlarge(){setEnlarged(true);dialog.current?.showModal()}
  return <figure className={`reading-figure${compact?' compact':''}${illustrated?' reading-illustration':''}`} data-media-id={id}>
    <div className="reading-image-frame">{failed?<div className="reading-image-error"><p>{item.alt}</p><button onClick={()=>setFailed(false)}>重新加载图片</button></div>:<button className="reading-image-button" aria-label={`放大图片：${item.title}`} onClick={enlarge}><img src={src} width={item.width} height={item.height} alt={item.alt} loading="lazy" decoding="async" onError={()=>setFailed(true)}/><span><Expand size={14}/>查看大图</span></button>}
    <div className="reading-image-actions">{!failed&&<button aria-label={`查看大图：${item.title}`} onClick={enlarge}><Expand size={14}/>查看大图</button>}{!!places.length&&<button ref={mapButton} aria-label={'看地图：'+item.title} aria-expanded={mapOpen} aria-controls={'reading-map-'+id} onClick={toggleMap}><Map size={15}/>{mapOpen?'收起地图':'看地图'}</button>}</div></div>
    {mapOpen&&!!places.length&&<Suspense fallback={<p role="status">正在打开配图地图…</p>}><ReadingInlineMap id={id} title={item.title} places={places} onClose={closeMap} onExplore={onExplore}/></Suspense>}
    <figcaption><span>{item.caption}</span><small>{item.author} · <a href={item.licenseUrl} target="_blank" rel="noopener noreferrer">{item.license}</a> · <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.kind==='photo'?'图片来源':'参考资料'}</a></small></figcaption>
    {illustrated&&onExplore&&!!places.length&&!mapOpen&&<ReadingMapLinks ids={places.map(place=>place.id)} title="图中地点" prefix="在山河图中探索：" onPick={onExplore}/>}
    <dialog ref={dialog} className="reading-image-dialog" aria-label={item.title} onClose={()=>{setEnlarged(false);setZoomed(false)}} onClick={event=>{if(event.target===dialog.current)dialog.current.close()}}><button className="icon-button" aria-label="关闭大图" onClick={()=>dialog.current?.close()}><X size={20}/></button>{enlarged&&<><div className="reading-image-controls"><button aria-pressed={zoomed} onClick={()=>setZoomed(value=>!value)}>{zoomed?<ZoomOut size={16}/>:<ZoomIn size={16}/>} {zoomed?'适应窗口':'放大细节'}</button><span>{zoomed?'滑动或滚动查看图片各处':'可放大阅读图中标注'}</span></div><div className={'reading-image-canvas'+(zoomed?' is-zoomed':'')} role="region" aria-label="图片细节" tabIndex={zoomed?0:undefined}><img src={src} alt={item.alt} style={zoomed?{width:Math.max(1600,item.width)}:undefined}/></div></>}<p>{item.caption}</p><small>{item.author} · <a href={item.licenseUrl} target="_blank" rel="noopener noreferrer">{item.license}</a> · <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">来源</a></small></dialog>
  </figure>
}
