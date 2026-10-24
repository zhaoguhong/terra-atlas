import {ArrowLeft,ArrowRight,Bookmark,BookOpen,Check,ChevronDown,Globe2,Layers,LocateFixed,MapPin,Search,Share2,X} from 'lucide-react'
import {useLayoutEffect,useRef,type ReactNode} from 'react'
import {knowledge} from '../lib/catalog'
import {topicGroups,topicKindNames,topicsForScope} from '../lib/topics'
import {mobileLayoutQuery,useLandscapeLayout} from '../lib/mobile-layout'
import type {Selection,Topic,TopicGroup,TopicScope} from '../types'
import TopicVisuals from './TopicVisuals'

const cardsById=new Map(knowledge.map(card=>[card.id,card]))
const scopeOptions=[{id:'all',name:'全部主题'},{id:'china',name:'中国地理'},{id:'world',name:'世界地理'}] as const

export default function TopicPanel({scope,query,topic,library,group,selection,controls,learningTools,detail,onScope,onQuery,onGroup,onStart,onLibrary,onExit,onPick,onOverview,onSave,onShare,sheet,onSheet,onBack,canGoBack=false,onShowMap}:{
  scope:TopicScope;query:string;topic:Topic|null;library:boolean;group:TopicGroup|'all';selection:Selection|null;controls:ReactNode;learningTools?:ReactNode;detail:ReactNode;
  onScope:(scope:TopicScope)=>void;onQuery:(query:string)=>void;onGroup:(group:TopicGroup|'all')=>void;onStart:(topic:Topic)=>void;onLibrary:()=>void;onExit:()=>void;
  onPick:(id:string)=>void;onOverview:()=>void;onSave:()=>void;onShare:()=>void;sheet:'peek'|'half'|'full';onSheet:(sheet:'peek'|'half'|'full')=>void;
  onBack?:()=>void;canGoBack?:boolean;onShowMap?:()=>void;
}){
  const landscape=useLandscapeLayout()
  const panelRef=useRef<HTMLDivElement>(null)
  const membersRef=useRef<HTMLElement>(null)
  const allTopics=topicsForScope(scope)
  const search=query.trim().toLocaleLowerCase()
  const matches=(entry:Topic)=>!search||[entry.title,entry.description,entry.question,...(entry.modules||[]).flatMap(module=>[module.title,module.description]),...entry.stops.flatMap(id=>{const card=cardsById.get(id);return card?[card.name,card.englishName,...card.aliases]:[]})].join(' ').toLocaleLowerCase().includes(search)
  const matchingTopics=allTopics.filter(matches)
  const available=matchingTopics.filter(entry=>group==='all'||entry.group===group)
  useLayoutEffect(()=>{
    const scroll=panelRef.current?.closest('.explorer-scroll')
    if(scroll)scroll.scrollTop=0
  },[topic?.id,selection?.card.id,selection?.subtype,library,group,scope])
  function showModules(){
    if(matchMedia(mobileLayoutQuery).matches&&sheet!=='full')onSheet('full')
    requestAnimationFrame(()=>membersRef.current?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}))
  }
  if(library||!topic)return <div className="topic-library" ref={panelRef}>
    <div className="explorer-intro theme-catalogue-heading"><h1>按主题看地图</h1><p>从地域、地貌或人文线索出发，自由跳着看。</p></div>
    {topic&&<button className="topic-resume" onClick={onOverview}><Layers size={15}/><span>继续看 · {topic.title}</span><ArrowRight size={14}/></button>}
    <div className="topic-scope"><span className="topic-filter-label" id="topic-scope-label"><Globe2 size={13}/>主题范围</span><div className="topic-scope-options" role="group" aria-labelledby="topic-scope-label">{scopeOptions.map(item=><button key={item.id} aria-label={item.name} aria-pressed={scope===item.id} onClick={()=>onScope(item.id)}><span>{item.name}</span><small aria-hidden="true">{topicsForScope(item.id).length}</small></button>)}</div></div>
    <label className="topic-search"><Search size={15}/><input type="search" aria-label="搜索主题和主题成员" placeholder="搜索主题或地点，如高原、黄河" value={query} onChange={event=>onQuery(event.target.value)}/>{query&&<button type="button" onClick={()=>onQuery('')} aria-label="清空主题搜索"><X size={14}/></button>}</label>
    <details className="topic-category-filters" open={group!=='all'||undefined}><summary>内容分类 · {group==='all'?'全部':topicGroups.find(item=>item.id===group)?.name}</summary>
    <div className="topic-categories" aria-label="主题分类"><button aria-label="全部分类" aria-pressed={group==='all'} onClick={()=>onGroup('all')}>全部分类 <span aria-hidden="true">{matchingTopics.length}</span></button>{topicGroups.map(item=><button key={item.id} aria-label={item.name} aria-pressed={group===item.id} onClick={()=>onGroup(item.id)}>{item.name} <span aria-hidden="true">{matchingTopics.filter(entry=>entry.group===item.id).length}</span></button>)}</div>
    </details>
    {(scope!=='all'||group!=='all'||query)&&<button className="text-button" onClick={()=>{onScope('all');onQuery('');onGroup('all')}}>重置主题筛选</button>}
    <p className="topic-result-count" role="status">{scopeOptions.find(item=>item.id===scope)?.name}{group!=='all'&&` · ${topicGroups.find(item=>item.id===group)?.name}`} · {search?'找到 ':''}{available.length} 个主题{search&&` · “${query.trim()}”`}</p>
    {topicGroups.filter(item=>group==='all'||group===item.id).map(item=>{
      const entries=available.filter(entry=>entry.group===item.id)
      return entries.length?<section className="topic-group" key={item.id} aria-label={item.name+'主题'}><div className="section-label"><BookOpen size={14}/><span>{item.name}</span><small>{entries.length} 个主题</small></div><p className="topic-group-description">{item.description}</p><div className="topic-list">{entries.map(entry=><button key={entry.id} aria-pressed={topic?.id===entry.id} onClick={()=>onStart(entry)}><span>{entry.shared?'中国与世界':entry.region==='china'?'中国':'世界'} · {topicKindNames[entry.kind]} · {entry.stops.length} 个阅读入口</span><strong>{entry.title}</strong><p>{entry.description}</p>{topic?.id===entry.id?<Check size={15}/>:<ArrowRight size={15}/>}</button>)}</div></section>:null
    })}
    {!available.length&&<div className="topic-empty"><BookOpen size={22}/><p>没有找到匹配的主题。</p><span>可以换一个地名，或调整主题范围和分类。</span><button onClick={()=>{onQuery('');onScope('all');onGroup('all')}}>查看全部主题</button></div>}
    <p className="topic-library-note"><Globe2 size={13}/>气候、人口等共用主题在中国与世界范围均可阅读。</p>
  </div>
  const memberIndex=selection?topic.stops.indexOf(selection.card.id):-1
  const member=memberIndex!==-1
  const selectedModule=selection?topic.modules?.find(module=>module.stops.includes(selection.card.id)):undefined
  const modules=topic.modules?.length?topic.modules:[{id:'members',title:topic.kind==='distribution'?'分布中的阅读入口':'认识主题中的地方',description:topic.kind==='distribution'?'结合地图分布，打开具体解读继续观察。':'选择任一地点，阅读介绍并在地图上定位；不必按顺序阅读。',stops:topic.stops}]
  const showDetail=!!(selection&&detail)
  const cardSheetControls=<div className="topic-reader-sizes mobile-only" aria-label="知识卡片布局"><button aria-label={sheet==='full'?'返回地图与卡片':'卡片全屏'} onClick={()=>onSheet(sheet==='full'?'half':'full')}>{sheet==='full'?(landscape?'并排':'半屏'):'展开阅读'}</button><button className="topic-close-card" aria-label="关闭知识卡片" title="关闭地点，返回主题全览" onClick={onOverview}><X size={13}/></button></div>
  return <div className="topic-reader" data-topic-id={topic.id} ref={panelRef}>
    <div className="topic-sticky-nav">
      <div className="topic-reader-nav"><button onClick={onLibrary}><ArrowLeft size={14}/>主题库</button><div className="topic-actions">{onShowMap&&<button className="topic-show-map" onClick={onShowMap} aria-label="查看主题地图" title="查看地图"><LocateFixed size={14}/><span>看地图</span></button>}<button onClick={onSave} aria-label="保存主题视图" title="保存主题视图"><Bookmark size={14}/></button><button onClick={onShare} aria-label="分享主题" title="分享主题"><Share2 size={14}/></button><button onClick={onExit} aria-label="退出主题" title="退出主题，回到自由探索"><X size={15}/><span>自由探索</span></button></div></div>
      {showDetail&&<>
        <div className="topic-breadcrumb" aria-label="当前阅读位置"><span>{topic.title}</span><span aria-hidden="true">›</span><strong title={selection!.card.name}>{selection!.card.name}</strong></div>
        <div className="topic-detail-navigation"><button onClick={onOverview}><ArrowLeft size={13}/>主题全览</button>{member&&<label><span className="sr-only">切换主题成员</span><select aria-label="切换主题成员" value={selection!.card.id} onChange={event=>onPick(event.target.value)}>{topic.stops.map((id,index)=><option key={id} value={id}>{index+1}. {cardsById.get(id)?.name||id}</option>)}</select></label>}{!member&&canGoBack&&onBack&&<button onClick={onBack}>返回上一地点<ArrowLeft size={13}/></button>}</div>
        {member&&<nav className="topic-member-pagination" aria-label="主题成员翻页"><button aria-label="上一个主题成员" disabled={memberIndex===0} onClick={()=>onPick(topic.stops[memberIndex-1])}><ArrowLeft size={13}/><span>上一个</span></button><span aria-live="polite">{memberIndex+1} / {topic.stops.length}</span><button aria-label="下一个主题成员" disabled={memberIndex===topic.stops.length-1} onClick={()=>onPick(topic.stops[memberIndex+1])}><span>下一个</span><ArrowRight size={13}/></button>{cardSheetControls}</nav>}{!member&&cardSheetControls}
      </>}
    </div>
    <div className="topic-heading"><span className="eyebrow">{topicGroups.find(item=>item.id===topic.group)?.name} · {topicKindNames[topic.kind]}</span><h1>{topic.title}</h1></div>
    {!showDetail&&<div className="topic-sheet-controls mobile-only" aria-label="主题介绍布局"><button aria-label={sheet==='full'?'返回主题与地图':'主题阅读'} onClick={()=>onSheet(sheet==='full'?'half':'full')}>{sheet==='full'?'返回地图':'展开阅读'}</button></div>}
    {showDetail?<>
      {selectedModule&&<p className="topic-member-context"><Layers size={13}/><span>所属模块 · {selectedModule.title}</span></p>}
      {!member&&<div className="topic-related-notice"><BookOpen size={15}/><p>这是从当前主题延伸探索的地点。主题仍保留，可返回主题全览继续选择成员。</p></div>}
      <div className="topic-detail">{detail}</div>
      <div className="topic-reading-footer"><button onClick={onOverview}><ArrowLeft size={14}/>返回主题全览</button>{member&&memberIndex<topic.stops.length-1&&<button onClick={()=>onPick(topic.stops[memberIndex+1])}>继续看 · {cardsById.get(topic.stops[memberIndex+1])?.name}<ArrowRight size={14}/></button>}</div>
    </>:<>
      {controls}
      <p className="topic-summary">{topic.description}</p>
      <TopicVisuals visuals={topic.visuals} onPick={onPick}/>
      <button className="topic-module-jump" onClick={showModules}><span><Layers size={14}/>{modules.length} 个学习模块 · {topic.stops.length} 个阅读入口</span><span>选择模块<ChevronDown size={13}/></span></button>
      <div className="topic-observation"><BookOpen size={15}/><div><strong>看地图时想一想</strong><p>{topic.question}</p></div></div>
      <details className="topic-expanded-intro topic-explanation" key={'intro-'+topic.id} aria-label="主题介绍"><summary>展开主题介绍<ChevronDown size={13}/></summary>{topic.sections.map((section,index)=><section className="reading-section" key={index}><h3>{section.title}</h3><p>{section.body}</p></section>)}<p className="topic-takeaway">{topic.takeaway}</p></details>
      {learningTools}
      <section className="topic-members-section" ref={membersRef} aria-label="学习模块"><div className="section-label"><Layers size={14}/><span>学习模块</span><small>{modules.length} 个模块 · {topic.stops.length} 个入口</small></div><p className="topic-module-hint">打开一个地点，地图会移到对应位置，并显示它的介绍。</p>{modules.map((module,moduleIndex)=><section className="topic-module" key={module.id} aria-label={module.title}>
        <div className="topic-module-heading"><span>{String(moduleIndex+1).padStart(2,'0')}</span><h2>{module.title}</h2><small>{module.stops.length} 个入口</small></div><p className="topic-module-description">{module.description}</p>
        {'detail' in module&&module.detail&&<details className="module-detail" key={topic.id+module.id}><summary>展开说明<ChevronDown size={12}/></summary><p>{module.detail}</p></details>}
        <div className="topic-members">{module.stops.map(id=>{
          const card=cardsById.get(id)
          return card?<button key={id} onClick={()=>onPick(id)}><span>{String(topic.stops.indexOf(id)+1).padStart(2,'0')}</span><span><strong>{card.name}</strong><small>{card.summary}</small><em><MapPin size={11}/>查看介绍与地图</em></span><ArrowRight size={13}/></button>:null
        })}</div>
      </section>)}</section>
      {topic.geometryNote&&<p className="geometry-note"><MapPin size={13}/>{topic.geometryNote}</p>}
      <details className="sources topic-sources" key={'sources-'+topic.id}><summary>核对资料 <span>{topic.sources.length} 项来源</span><ChevronDown size={13}/></summary>{topic.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ArrowRight size={12}/></a>)}</details>
    </>}
  </div>
}
