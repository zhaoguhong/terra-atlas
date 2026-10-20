import {useLayoutEffect,useRef} from 'react'
import {ArrowLeft,ArrowLeftRight,ArrowRight,Bookmark,BookOpen,ChevronDown,CloudSun,Layers,LocateFixed,MapPin,Share2,X} from 'lucide-react'
import climateNotes from '../data/climate-notes.json'
import featureBindings from '../data/feature-bindings.json'
import climateLegend from '../../public/data/climate-legend.json'
import {categoryInfo,knowledge} from '../lib/catalog'
import {gridIndex,nearestClimate,useLocalJson,type Grid} from '../lib/learning'
import type {ClimateNote,ClimateSeries,Selection} from '../types'
import ClimateChart from './ClimateChart'
import CountryContext from './CountryContext'
import MobileSheetHandle from './MobileSheetHandle'
import {useLandscapeLayout,useMobileLayout} from '../lib/mobile-layout'
import {useReadingPosition} from '../lib/reading-position'

export default function KnowledgePanel({selection,favorite,countryId,sheet,onSheet,onClose,onFavorite,onLocate,onShare,onCompare,onPick,onRelations,onClimate,embedded=false}:{
  selection:Selection;favorite:boolean;countryId:string|null;sheet:'peek'|'half'|'full';onSheet:(s:'peek'|'half'|'full')=>void;
  onClose:()=>void;onFavorite:()=>void;onLocate:()=>void;onShare:()=>void;onCompare:()=>void;onPick:(id:string)=>void;onRelations:(ids:string[])=>void;
  onClimate:(code:string)=>void;
  embedded?:boolean;
}){
  const {card}=selection
  const monthly=useLocalJson<ClimateSeries>('data/learning-climate.json')
  const climate=nearestClimate(monthly.data,card.coordinates)
  const grid=useLocalJson<Grid>(card.category==='climate'?null:'data/climate-grid.json')
  const index=grid.data?gridIndex(grid.data,card.coordinates):null
  const classification=index!==null?climateLegend.find(c=>c.value===grid.data!.data[index]):null
  const coordinateDetail=(climateNotes as ClimateNote[]).find(c=>c.code===classification?.code)
  const code=selection.subtype?.split(' · ')[0]
  const detail=(climateNotes as ClimateNote[]).find(c=>c.code===code)
  const related=card.relatedIds?.filter(id=>knowledge.some(k=>k.id===id))||[]
  const panelRef=useRef<HTMLElement>(null)
  const scrollRef=useRef<HTMLDivElement>(null)
  const mobileLayout=useMobileLayout()
  const landscapeLayout=useLandscapeLayout()
  const collapsed=mobileLayout&&!embedded&&sheet==='peek'
  const curated=knowledge.some(item=>item.id===card.id)
  const bindings=(featureBindings as Record<string,string[]>)[card.id]
  const referenceOnly=!!bindings&&!bindings.length
  const sources=[...card.sources,...(detail?.sources||[]),...(coordinateDetail?.sources||[])].filter((source,index,all)=>all.findIndex(item=>item.url===source.url)===index)
  useLayoutEffect(()=>{
    if(scrollRef.current)scrollRef.current.scrollTop=0
  },[card.id,selection.subtype])
  useReadingPosition(scrollRef,embedded?null:`${card.id}:${selection.subtype||''}`)
  return <aside ref={panelRef} className={`knowledge-panel panel sheet-${sheet}${embedded?' embedded':' mobile-reading-sheet'}`} aria-label="地理知识卡片">
    {!embedded&&<MobileSheetHandle sheet={sheet} title={card.name} panelRef={panelRef} scrollRef={scrollRef} onSheet={onSheet} contentId="place-reading-content"/>}
    <div className="knowledge-top" inert={collapsed}><span><MapPin size={13}/>{categoryInfo[card.category].name} · {card.region==='china'?'中国地理':'地理探索'}</span><div className="sheet-controls"><button aria-label={landscapeLayout?'收起知识卡片':'卡片摘要'} aria-pressed={sheet==='peek'} onClick={()=>onSheet('peek')}>{landscapeLayout?'收起':'摘要'}</button><button aria-label={landscapeLayout?'卡片并排':'卡片半屏'} aria-pressed={sheet==='half'} onClick={()=>onSheet('half')}>{landscapeLayout?'并排':'半屏'}</button><button aria-label="卡片全屏" aria-pressed={sheet==='full'} onClick={()=>onSheet('full')}>阅读</button></div><button className="icon-button" aria-label="关闭知识卡片" title={embedded?'返回主题全览':'关闭知识卡片'} onClick={onClose}>{embedded?<ArrowLeft size={17}/>:<X size={17}/>}</button></div>
    <div className="knowledge-scroll" ref={scrollRef} id={embedded?undefined:'place-reading-content'} inert={collapsed}>
      <span className="eyebrow">{curated?'EXPLORE A PLACE':'GEOGRAPHIC DATA'}</span><h2>{card.name}</h2><span className="english-name">{card.englishName}</span>
      {selection.subtype&&<div className="climate-subtype"><CloudSun size={13}/>{selection.subtype}</div>}
      <div className="knowledge-content-label"><BookOpen size={12}/>{curated?'地点介绍':'数据概览 · 尚无精选解读'}{referenceOnly&&<span><MapPin size={11}/>地图使用定位参考点</span>}</div>
      <p className="summary">{card.summary}</p>
      <div className="card-actions"><button className="favorite-button" aria-pressed={favorite} onClick={onFavorite}><Bookmark size={14} fill={favorite?'currentColor':'none'}/>{favorite?'已收藏':'收藏地点'}</button><button onClick={onLocate}><LocateFixed size={14}/>定位</button><button aria-label="加入两地对比" onClick={onCompare}><ArrowLeftRight size={14}/>对比</button><button aria-label="分享这个地点" onClick={onShare}><Share2 size={15}/></button></div>
      <dl className="facts">{card.facts.map(f=><div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>
      {detail&&<section className="reading-section climate-specific"><h3>{detail.code} · {detail.title}</h3><p>{detail.description}</p><h4>季节变化</h4><p>{detail.seasons}</p><h4>景观与生活</h4><p>{detail.landscape}</p><div className="tag-list">{detail.examples.map((e,i)=><span key={i}>{e}</span>)}</div></section>}
      <section className="reading-section"><h3><LocateFixed size={14}/>它在哪里</h3><p>{card.location}</p></section>
      <section className="reading-section"><h3><BookOpen size={14}/>{card.tags?.includes('山峰定位')?'怎样读这座山峰':card.category==='religion'||card.category==='language'||card.category==='population'||card.category==='human'?'怎样理解':'为什么会这样'}</h3><p>{card.formation}</p></section>
      {card.sections?.map((s,i)=><section key={i} className="reading-section"><h3>{s.title}</h3><p>{s.body}</p></section>)}
      {card.category!=='climate'&&<section className="reading-section" data-testid="card-climate"><h3><CloudSun size={14}/>定位点的长期气候</h3>{classification?<><button className="probe-climate" onClick={()=>onClimate(classification.code)}><i style={{background:classification.color}}/><span><strong>{classification.code} · {classification.name}</strong><small>查看分类解释与观察问题</small></span><ArrowRight size={15}/></button><p>{coordinateDetail?.seasons}</p></>:<p>{grid.error||(!grid.data?'正在读取分类格网…':'定位点所在格网暂无气候分类；海洋或缺失位置不作推断。')}</p>}<p className="data-caption">Beck V3 · 1991–2020 · 0.5°格网。分类仅表示定位点所在格网，不能代表整片区域，也不能反映山顶与山谷等局地差异。</p>{grid.error&&<button className="text-button" onClick={grid.retry}>重试气候分类</button>}</section>}
      {climate&&<section className="reading-section"><h3>月气候参考 · {climate.name}</h3><ClimateChart place={climate}/></section>}
      {countryId&&<CountryContext countryId={countryId}/>} 
      <section className="reading-section connections"><h3><Layers size={15}/>看看它们的联系</h3>{card.connections.map((c,i)=><p key={i}><span>{String(i+1).padStart(2,'0')}</span>{c}</p>)}{!!related.length&&<button className="secondary-button" onClick={()=>onRelations([card.id,...related])}>在地图上看这些联系 <Layers size={14}/></button>}</section>
      {!!(card.questions?.length||detail?.questions.length)&&<section className="reading-section observation-questions"><h3>带着问题观察</h3>{[...(detail?.questions||[]),...(card.questions||[])].map((q,i)=><p key={i}><span>{i+1}</span>{q}</p>)}</section>}
      {!!related.length&&<section className="reading-section"><h3>相关地点 · 继续探索</h3><div className="related">{related.map(id=><button key={id} onClick={()=>onPick(id)}>{knowledge.find(k=>k.id===id)!.name}<ArrowRight size={12}/></button>)}</div></section>}
      {card.geometryNote&&<p className="geometry-note">{card.geometryNote}</p>}
      <details className="sources" key={card.id+':'+(selection.subtype||'')}><summary>核对资料 <span>{sources.length} 项来源</span><ChevronDown size={13}/></summary>{sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ArrowRight size={12}/></a>)}</details>
      {monthly.error&&<p className="resource-error">{monthly.error}<button onClick={monthly.retry}>重试月气候资料</button></p>}
    </div><div className="knowledge-foot"><BookOpen size={13}/>在地图上观察，也读懂地方之间的联系。</div>
  </aside>
}
