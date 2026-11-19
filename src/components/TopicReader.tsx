import {Fragment,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react'
import {ArrowLeft,ArrowRight,Bookmark,BookOpen,Share2} from 'lucide-react'
import type {ReadingProgress,Topic,TopicArticle} from '../types'
import {useLocalJson} from '../lib/learning'
import {sectionMapLinks} from '../lib/reading-map-links'
import {topics,topicGroups} from '../lib/topics'
import ReadingFigure from './ReadingFigure'
import TopicVisuals from './TopicVisuals'
import ReadingMapLinks from './ReadingMapLinks'
import './TopicReading.css'
import {topicPath,followTopicLink} from '../lib/topic-url'

export default function TopicReader({topic,initialArticle,visible,progress,saved,onProgress,onBack,onLibrary,onMap,onRead,onSave,onShare}:{
  initialArticle?:TopicArticle;topic:Topic;visible:boolean;progress?:ReadingProgress;saved:boolean;
  onProgress:(id:string,progress:ReadingProgress,flush?:boolean)=>void;onBack:()=>void;onLibrary:()=>void;
  onMap:(id?:string)=>void;onRead:(topic:Topic)=>void;onSave:()=>void;onShare:()=>void;
}){
  const article=useLocalJson<TopicArticle>(`reading/topics/${topic.id}.json`,initialArticle)
  const scroll=useRef<HTMLDivElement>(null)
  const initial=useRef(progress)
  const restored=useRef(false)
  const report=useRef(onProgress);report.current=onProgress
  const [section,setSection]=useState(progress?.sectionId||'')
  const blocks=()=>Array.from(scroll.current?.querySelectorAll<HTMLElement>('[data-reading-section]')||[])
  const topOf=(block:HTMLElement)=>block.getBoundingClientRect().top-scroll.current!.getBoundingClientRect().top+scroll.current!.scrollTop
  function capture(flush=false){
    const panel=scroll.current
    if(!visible||!panel?.getClientRects().length)return
    const edge=panel.getBoundingClientRect().top+18
    // scrollTop rounds to CSS pixels; keep the chapter selected at fractional boundaries.
    const items=blocks(),block=items.filter(item=>item.getBoundingClientRect().top<=edge+1).at(-1)||items[0]
    if(!block?.offsetHeight)return
    const id=block.dataset.readingSection!
    setSection(id)
    report.current(topic.id,{sectionId:id,offset:Math.max(0,Math.min(1,(edge-block.getBoundingClientRect().top)/block.offsetHeight)),updatedAt:Date.now()},flush)
  }
  function leave(action:()=>void){capture();action()}
  useLayoutEffect(()=>{
    if(!article.data||!visible||restored.current)return
    const element=blocks().find(block=>block.dataset.readingSection===initial.current?.sectionId)
    if(element&&scroll.current)scroll.current.scrollTop=topOf(element)+(initial.current?.offset||0)*element.offsetHeight-18
    restored.current=true
    capture()
  },[article.data,visible])
  useEffect(()=>{
    const panel=scroll.current
    if(!panel||!article.data||!visible)return
    let timeout:ReturnType<typeof setTimeout>|undefined
    const handle=()=>{clearTimeout(timeout);timeout=setTimeout(capture,250)}
    const flush=()=>{clearTimeout(timeout);capture(true)}
    const hidden=()=>{if(document.visibilityState==='hidden')flush()}
    panel.addEventListener('scroll',handle,{passive:true})
    window.addEventListener('pagehide',flush)
    document.addEventListener('visibilitychange',hidden)
    return()=>{clearTimeout(timeout);panel.removeEventListener('scroll',handle);window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',hidden)}
  },[article.data,topic.id,visible])
  function goTo(id:string){
    const block=blocks().find(item=>item.dataset.readingSection===id)
    if(block&&scroll.current){scroll.current.scrollTo({top:topOf(block)-12,behavior:'auto'});setSection(id);capture();(block.querySelector<HTMLElement>('h2:not([hidden])')||block).focus({preventScroll:true})}
  }
  const mapLinks=useMemo(()=>article.data?sectionMapLinks(article.data):new Map<string,string[]>(),[article.data])
  const parts=article.data?.parts
  const essay=article.data?.presentation==='essay'
  const activePart=article.data?.sections.find(item=>item.id===section)?.partId
  const chapters=useMemo(()=>article.data?.sections.filter(item=>!item.continuation)||[],[article.data])
  const currentIndex=article.data?.sections.findIndex(item=>item.id===section)??-1
  const currentChapter=currentIndex<0?'introduction':article.data!.sections.slice(0,currentIndex+1).filter(item=>!item.continuation).at(-1)?.id
  const category=topicGroups.find(group=>group.id===topic.group)?.name
  const related=(topic.reading?.relatedTopicIds||[]).map(id=>topics.find(t=>t.id===id)).filter((t):t is Topic=>!!t)
  return <section className={'topic-reading-page'+(essay?' reading-essay':'')} hidden={!visible} aria-label="完整专题阅读" data-reading-topic={topic.id}>
    <div className="reading-toolbar"><button onClick={()=>leave(onBack)}><ArrowLeft size={16}/>返回地图</button><span>{topic.title}</span><div><button onClick={onSave} aria-label={saved?'取消收藏专题':'收藏专题'} aria-pressed={saved}><Bookmark size={16} fill={saved?'currentColor':'none'}/><span>{saved?'已收藏':'收藏专题'}</span></button><button onClick={()=>leave(onShare)} aria-label="分享专题阅读"><Share2 size={16}/></button><button onClick={()=>leave(onLibrary)}><BookOpen size={16}/>主题目录</button></div></div>
    <div className="reading-layout">
      <nav className={'reading-toc'+(parts?' reading-toc-grouped':'')} aria-label="专题章节"><span>本篇内容 · 可自由选读</span>{parts?<>
        <label className="reading-chapter-select">跳转章节<select aria-label="跳转专题章节" value={currentChapter} onChange={event=>goTo(event.target.value)}><option value="introduction">主题概览</option>{parts.map(part=><optgroup key={part.id} label={part.title}>{chapters.filter(s=>s.partId===part.id).map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</optgroup>)}</select></label>
        <div className="reading-toc-groups">{parts.map(part=><details key={part.id} open={activePart===part.id||undefined}><summary>{part.title}</summary>{chapters.filter(s=>s.partId===part.id).map(s=><button key={s.id} aria-current={currentChapter===s.id?'location':undefined} onClick={()=>goTo(s.id)}>{s.id===part.sectionId&&part.title===s.title?'本组概览':s.title}</button>)}</details>)}</div>
      </>:<><label className="reading-chapter-select">跳转章节<select aria-label="跳转专题章节" value={currentChapter} onChange={event=>goTo(event.target.value)}><option value="introduction">主题概览</option>{chapters.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label><div className="reading-toc-flat"><button aria-current={section==='introduction'?'location':undefined} onClick={()=>goTo('introduction')}>主题概览</button>{chapters.map(s=><button key={s.id} aria-current={currentChapter===s.id?'location':undefined} onClick={()=>goTo(s.id)}>{s.title}</button>)}</div></>}</nav>
      <div className="reading-body" ref={scroll}>
        {article.error?<div className="reading-load-error" role="alert"><h1>这篇专题暂未加载成功</h1><p>地图和简要介绍仍可使用。</p><button onClick={article.retry}>重新加载</button><button onClick={onBack}>返回地图</button></div>:!article.data?<p className="reading-loading" role="status">正在加载专题…</p>:<article className="reading-article">
          <section id="introduction" data-reading-section="introduction"><header className="reading-title"><p className="eyebrow">山河图 · {category}</p><h1 tabIndex={-1}>{article.data.title}</h1><div className="reading-meta"><span>约 {topic.reading?.minutes||6} 分钟</span><span>{parts?`${parts.length} 组章节`:`${chapters.length} 节内容`}</span><span>可自由选读</span></div><p>{article.data.introduction}</p></header>
          {!essay&&topic.reading?.coverId&&<ReadingFigure id={topic.reading.coverId} onExplore={id=>leave(()=>onMap(id))}/>}
          {parts&&<div className="reading-part-index" aria-label="选择阅读内容">{parts.map(part=><button key={part.id} onClick={()=>goTo(part.sectionId)}><strong>{part.title}</strong>{!essay&&<span>{part.description}</span>}<ArrowRight size={16}/></button>)}</div>}
          </section>
          {article.data.sections.map(s=><section key={s.id} className={"article-section"+(s.continuation?" reading-continuation":"")+(parts?.some(part=>part.sectionId===s.id)?" article-part-start":"")} id={s.id} aria-label={s.continuation?s.title:undefined} tabIndex={s.continuation?-1:undefined} data-reading-section={s.id}>
            <h2 hidden={s.continuation} tabIndex={-1}>{s.title}</h2>
            {s.mediaPlacement==='before-text'&&s.mediaIds?.filter(id=>essay||id!==topic.reading?.coverId).map(id=><ReadingFigure key={id} id={id} onExplore={id=>leave(()=>onMap(id))}/>)}
            {s.paragraphs.map((p,index)=><Fragment key={index}><p>{p}</p>{s.mediaIds?.filter(id=>s.mediaAfterParagraph?.[id]===index).map(id=><ReadingFigure key={id} id={id} onExplore={id=>leave(()=>onMap(id))}/>)}</Fragment>)}
            {s.mediaPlacement!=='before-text'&&s.mediaIds?.filter(id=>s.mediaAfterParagraph?.[id]===undefined&&(essay||id!==topic.reading?.coverId)).map(id=><ReadingFigure key={id} id={id} onExplore={id=>leave(()=>onMap(id))}/>)}
            {!!s.visuals?.length&&<TopicVisuals visuals={s.visuals} onPick={id=>leave(()=>onMap(id))}/>}
            {s.terms?.map(term=><details className="reading-term" key={term.term}><summary>{term.term}</summary><p>{term.definition}</p></details>)}
            <ReadingMapLinks ids={mapLinks.get(s.id)||[]} labels={s.mapLabels} onPick={id=>leave(()=>onMap(id))}/>
          </section>)}
          {!essay&&!!topic.visuals?.length&&<section className="article-section" data-reading-section="comparison"><h2 tabIndex={-1}>放在一起比较</h2><TopicVisuals visuals={topic.visuals} onPick={id=>leave(()=>onMap(id))}/></section>}
          {!!related.length&&<section className="article-section"><h2>接着读什么</h2><div className="reading-related">{related.map(t=><a href={topicPath(t.id)} key={t.id} onClick={event=>followTopicLink(event,()=>leave(()=>onRead(t)))}><span>{t.title}<small>{t.description}</small></span><ArrowRight size={16}/></a>)}</div></section>}
          <footer className="article-sources"><details><summary>资料来源与图片说明 · {article.data.sources.length} 项参考</summary><p>正文为原创中文讲解，示意图用于说明机制；照片与地图各自保留来源。更新：{article.data.updatedAt}。</p>{article.data.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>)}</details><button onClick={()=>leave(onLibrary)}>浏览其他主题 <ArrowRight size={15}/></button></footer>
        </article>}
      </div>
    </div>
  </section>
}
