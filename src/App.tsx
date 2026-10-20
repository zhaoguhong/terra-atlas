import {useCallback,useEffect,useMemo,useRef,useState,type CSSProperties} from 'react'
import {ArrowDown,ArrowLeftRight,ArrowRight,Bookmark,BookOpen,Check,ChevronLeft,Compass,Download,Globe2,Info,Layers,LocateFixed,MapPin,MoreHorizontal,Mountain,Plus,Ruler,Search,Share2,Shuffle,Trash2,Upload,Users,Languages,Church,Waves,X,ZoomIn,ZoomOut,CloudSun,Grid2X2} from 'lucide-react'
import AtlasMap,{sourceForId,type AtlasHandle,type Measurement} from './components/AtlasMap'
import KnowledgePanel from './components/KnowledgePanel'
import ProbePanel from './components/ProbePanel'
import ComparePanel from './components/ComparePanel'
import TopicPanel from './components/TopicPanel'
import MobileSheetHandle from './components/MobileSheetHandle'
import EarthLab from './components/EarthLab'
import MapLegend from './components/MapLegend'
import {categoryInfo,curatedSearchIndex,dataCard,knowledge,matchCard} from './lib/catalog'
import {createSearchIndex,searchCatalog} from './lib/search'
import {defaultLayers,loadPreferences,parsePreferences,savePreferences,validCamera,validDisplay,validThematic,type Collection,type Preferences} from './lib/storage'
import {climateReference,numberText,readLocalJson,useLocalJson,type HumanData} from './lib/learning'
import {topicForSelection,topicLayers,topicMapMembers,topics} from './lib/topics'
import {distributionIds,legacyTopic,singleOverlay,topicOverlays} from './lib/theme-state'
import type {Camera,Category,ClimateNote,ClimateSeries,GeoProperties,Knowledge,LayerState,MapDisplay,MapProbe,OnlineMapStatus,SavedView,Selection,ThematicState,Topic,TopicGroup,TopicOverlay,TopicScope,View} from './types'
import climateLegend from '../public/data/climate-legend.json'
import climateNotes from './data/climate-notes.json'
import bindings from './data/feature-bindings.json'
import familyMetadata from '../public/data/learning-language-families.json'
import {climateGroups,thematicModes,type LanguageAreaMeta} from './lib/map-presentation'
import {buildMapLegend} from './lib/map-legend'
import {getTopicPresentation} from './lib/topic-presentation'
import {mobileLayoutQuery,useLandscapeLayout,useMobileLayout} from './lib/mobile-layout'
import {useReadingPosition} from './lib/reading-position'

type LayerKey=keyof LayerState
type NavigationEntry={topicId:string|null;library:boolean;view:View;topicScope:TopicScope;topicGroup:TopicGroup|'all';topicQuery:string;selection:Selection|null;trail:Selection[];layers:LayerState;camera:Camera;thematic:ThematicState;opacity:number;display:MapDisplay;tab:'explore'|'topics'|'saved'}
const basicLayers:LayerKey[]=['terrain','mountains','rivers','lakes','cities','basins','plates','borders','provinces','grid']
const layerInfo={
  terrain:{name:'地形底图',label:'地形',description:'土地覆盖配色与地形阴影',icon:Compass},
  mountains:{name:'山脉',label:'山脉',description:'山系、自然地区与山峰',icon:Mountain},
  rivers:{name:'河流',label:'河流',description:'概化河道与主要水系',icon:Waves},
  lakes:{name:'湖泊',label:'湖泊',description:'湖面、水库及水域轮廓',icon:Waves},
  climate:{name:'气候',label:'气候',description:'长期分类 · 1991–2020',icon:CloudSun},
  population:{name:'人口分布',label:'人口分布',description:'GHS-POP · 2020 · 0.5°',icon:Users},
  religion:{name:'宗教构成',label:'宗教构成',description:'国家资料 · 各条目年份',icon:Church},
  language:{name:'语言分布',label:'语言分布',description:'语言区域 · 2007图集／Glottolog参考点',icon:Languages},
  cities:{name:'主要城市与首都',label:'城市与首都',description:'代表城市点 · 源版本首都标记',icon:MapPin},
  basins:{name:'流域与分水岭',label:'流域与分水岭',description:'三级汇水分区与概化分界',icon:Waves},
  plates:{name:'板块边界',label:'板块边界',description:'汇聚、分离与转换边界',icon:Globe2},
  borders:{name:'国家轮廓',label:'国家轮廓',description:'辅助定位的国家／地区范围',icon:Globe2},
  provinces:{name:'中国省区',label:'中国省区',description:'省级参考范围与名称',icon:MapPin},
  grid:{name:'经纬网',label:'经纬网',description:'赤道、回归线与经纬位置',icon:Grid2X2},
} satisfies Record<LayerKey,{name:string;label:string;description:string;icon:typeof Compass}>
const families=climateGroups.map(family=>({...family,id:family.id.toLowerCase()}))
const sourceFor=(p:GeoProperties)=>p.id.startsWith('city-ne-')?'cities':p.id.startsWith('basin-hybas-')?'basins':p.id.startsWith('plate-usgs-')?'plates':p.id.startsWith('language-area-')?'language-areas':p.id.startsWith('language-')?'languages':p.id.startsWith('province-')?'provinces':p.id.startsWith('peak-wikidata-')?'summits':p.id.startsWith('peak-')?'peaks':p.kind==='river'?'rivers':p.kind==='lake'?'lakes':p.kind==='country'?'countries':'regions'
function countryFor(selection:Selection|null){
  if(!selection)return null
  if(selection.source==='countries')return selection.featureId||selection.card.id
  if(selection.card.id.startsWith('country-'))return selection.card.id
  return (bindings as Record<string,string[]>)[selection.card.id]?.find(id=>id.startsWith('country-'))||null
}

export default function App(){
  const [initial]=useState(()=>{
    const saved=loadPreferences()
    const restoredTopic=topicForSelection(saved.topicId)
    saved.topicId=restoredTopic?.id||null;saved.layers=topicLayers(saved.layers,restoredTopic)
    if(!location.hash)return saved
    const params=new URLSearchParams(location.hash.slice(1)),display=validDisplay({basemap:params.get('basemap'),terrain3d:params.get('terrain3d')==='1'})
    return {...saved,display,camera:{...saved.camera,pitch:display.terrain3d?saved.camera.pitch??0:0}}
  })
  const [layers,setLayers]=useState(initial.layers)
  const [view,setView]=useState<View>(initial.view)
  const [camera,setCamera]=useState(initial.camera)
  const [favorites,setFavorites]=useState(initial.favorites)
  const [savedViews,setSavedViews]=useState<SavedView[]>(initial.savedViews)
  const [notes,setNotes]=useState(initial.notes)
  const [collections,setCollections]=useState<Collection[]>(initial.collections)
  const [opacity,setOpacity]=useState(initial.opacity)
  const [thematic,setThematic]=useState<ThematicState>(initial.thematic)
  const [display,setDisplay]=useState<MapDisplay>(initial.display)
  const [onlineStatus,setOnlineStatus]=useState<OnlineMapStatus>({detail:'off',terrain:'off'})
  const [selection,setSelection]=useState<Selection|null>(null)
  const [memberTrail,setMemberTrail]=useState<Selection[]>([])
  const [probe,setProbe]=useState<MapProbe|null>(null)
  const [query,setQuery]=useState('')
  const [searchOpen,setSearchOpen]=useState(false)
  const [moreOpen,setMoreOpen]=useState(false)
  const [searchIndex,setSearchIndex]=useState(0)
  const [catalog,setCatalog]=useState<GeoProperties[]>([])
  const [tab,setTab]=useState<'topics'|'saved'>('topics')
  const [topicLibrary,setTopicLibrary]=useState(!initial.topicId)
  const [topicGroup,setTopicGroup]=useState<TopicGroup|'all'>('all')
  const [topicScope,setTopicScope]=useState<TopicScope>('all')
  const [topicQuery,setTopicQuery]=useState('')
  const [mobileLayers,setMobileLayers]=useState(false)
  const [mapSettingsOpen,setMapSettingsOpen]=useState(false)
  const layerPanelRef=useRef<HTMLElement>(null)
  const [explorerOpen,setExplorerOpen]=useState(true)
  const [panelOpen,setPanelOpen]=useState(true)
  const [sheet,setSheet]=useState<'peek'|'half'|'full'>('half')
  const mobileLayout=useMobileLayout()
  const landscapeLayout=useLandscapeLayout()
  const topicPanelRef=useRef<HTMLElement>(null)
  const topicScrollRef=useRef<HTMLDivElement>(null)
  const layerTrigger=useRef<HTMLButtonElement>(null)
  const topicTrigger=useRef<HTMLButtonElement>(null)
  const explorerReturn=useRef<{tab:'topics'|'saved';library:boolean;focus:HTMLElement|null;scroll:number;width:number;block:number;offset:number;height:number}|null>(null)
  const changeSheet=useCallback((next:'peek'|'half'|'full')=>{
    if(matchMedia(mobileLayoutQuery).matches&&next==='peek'){
      const panel=document.querySelector<HTMLElement>('.mobile-reading-sheet:not(.embedded)')
      if(panel?.contains(document.activeElement))panel.querySelector<HTMLButtonElement>('.mobile-sheet-handle')?.focus({preventScroll:true})
    }
    setSheet(next)
  },[])
  const [modal,setModal]=useState<'sources'|'climate'|null>(null)
  const [article,setArticle]=useState<string|null>(null)
  const [status,setStatus]=useState('loading')
  const [retry,setRetry]=useState(0)
  const [toast,setToast]=useState('')
  const [activeCategory,setActiveCategory]=useState<Category|'all'>('all')
  const [bounds,setBounds]=useState<[number,number,number,number]|null>(null)
  const [activeTopic,setActiveTopic]=useState<string|null>(initial.topicId)
  const [compareIds,setCompareIds]=useState<string[]>([])
  const [compareOpen,setCompareOpen]=useState(false)
  const [mode,setMode]=useState<'explore'|'probe'|'measure'>('explore')
  const [measurement,setMeasurement]=useState<Measurement>({distanceKm:0,points:[]})
  const [collectionName,setCollectionName]=useState('')
  const [viewName,setViewName]=useState('')
  const [practice,setPractice]=useState<{ids:string[];index:number;revealed:boolean}|null>(null)
  const atlas=useRef<AtlasHandle|null>(null)
  const attribution=useRef<HTMLDivElement>(null)
  const [attributionHeight,setAttributionHeight]=useState(11)
  const searchBox=useRef<HTMLDivElement>(null)
  const headerMore=useRef<HTMLDivElement>(null)
  const moreTrigger=useRef<HTMLButtonElement>(null)
  const input=useRef<HTMLInputElement>(null)
  const importInput=useRef<HTMLInputElement>(null)
  const hashApplied=useRef('')
  const sharedPlaceRequest=useRef(0)
  const pendingPickIdRequest=useRef(0)
  const retrySharedPlace=useRef<(()=>void)|null>(null)
  const [sharedPlaceError,setSharedPlaceError]=useState('')
  const [urlHash,setUrlHash]=useState(location.hash)
  const restoreHash=useRef<(h:AtlasHandle)=>void>(()=>{})
  const navigation=useRef<NavigationEntry|null>(null)
  const restoredHistoryHash=useRef<string|null>(null)
  const monthly=useLocalJson<ClimateSeries>('data/learning-climate.json')
  const human=useLocalJson<HumanData>(layers.religion?'data/learning-human.json':null)
  const languageMeta=useLocalJson<LanguageAreaMeta>(layers.language?'data/language-areas-meta.json':null)
  const [languageQuery,setLanguageQuery]=useState('')
  const referenceIndex=useMemo(()=>createSearchIndex((monthly.data?.places||[]).map(climateReference),p=>[p.name]),[monthly.data])
  const featureIndex=useMemo(()=>createSearchIndex(catalog.filter(p=>!matchCard(p)&&(!p.id.startsWith('language-')||(thematicModes(thematic).languageMode==='points'?!p.id.startsWith('language-area-'):p.id.startsWith('language-area-')))),p=>[p.name,p.nameEn,...(p.aliases||[])]),[catalog,thematic.languageMode])
  const allResults=useMemo(()=>searchCatalog(query,curatedSearchIndex,referenceIndex,featureIndex),[query,referenceIndex,featureIndex])
  const list=useMemo(()=>knowledge.filter(k=>k.category!=='climate'&&(activeCategory==='all'||k.category===activeCategory)&&(view==='world'||k.region==='china')),[activeCategory,view])
  const suggestions=useMemo(()=>{
    const candidates=list.filter(k=>!selection||k.id!==selection.card.id)
    const inView=(k:Knowledge)=>bounds&&k.coordinates[0]>=bounds[0]&&k.coordinates[0]<=bounds[2]&&k.coordinates[1]>=bounds[1]&&k.coordinates[1]<=bounds[3]
    const related=new Set(selection?.card.relatedIds||[])
    return [...candidates].sort((a,b)=>Number(related.has(b.id))-Number(related.has(a.id))||Number(!!inView(b))-Number(!!inView(a))||Math.hypot(a.coordinates[0]-camera.center[0],a.coordinates[1]-camera.center[1])-Math.hypot(b.coordinates[0]-camera.center[0],b.coordinates[1]-camera.center[1])).slice(0,5)
  },[list,bounds,selection,camera.center])
  const languageFamilies=familyMetadata.families
  const topic=topicForSelection(activeTopic)
  const modes=thematicModes(thematic)
  const languageOptions=(languageMeta.data?.languages||[]).filter(language=>(thematic.language==='all'||language.familyId===thematic.language)&&(!languageQuery||`${language.name} ${language.nameEn} ${language.id}`.toLowerCase().includes(languageQuery.toLowerCase())||language.id===modes.languageId))
  const legend=buildMapLegend({layers,thematic,topic,selection,human:human.data,languageMeta:languageMeta.data})
  const topicPresentation=getTopicPresentation(topic)
  const error=status!=='loading'&&status!=='ready'
  const onlineError=onlineStatus.detail==='error'||onlineStatus.terrain==='error'
  const note=article?(climateNotes as ClimateNote[]).find(n=>n.code===article):null
  navigation.current={topicId:activeTopic,library:topicLibrary,view,topicScope,topicGroup,topicQuery,selection,trail:memberTrail,layers,camera,thematic,opacity,display,tab}

  useEffect(()=>{history.replaceState({...history.state,terraAtlasNavigation:navigation.current},'')},[activeTopic,topicLibrary,view,topicScope,topicGroup,topicQuery,selection,memberTrail,layers,camera,thematic,opacity,display,tab])
  useEffect(()=>{
    const restore=(event:PopStateEvent)=>{
      const saved=event.state?.terraAtlasNavigation as NavigationEntry|undefined
      if(!saved||!validCamera(saved.camera))return
      const restored=topicForSelection(saved.topicId)
      restoredHistoryHash.current=location.hash;hashApplied.current=location.hash
      setThematic(saved.thematic);setOpacity(saved.opacity);setDisplay(saved.display)
      cancelSharedPlace();setActiveTopic(restored?.id||null);setTopicLibrary(saved.library);setView(saved.view);setSelection(saved.selection);setMemberTrail(saved.trail||[])
      setTopicScope(saved.topicScope||'all');setTopicGroup(saved.topicGroup||'all');setTopicQuery(saved.topicQuery||'')
      setLayers(topicLayers(saved.layers,restored));setTab(saved.tab==='saved'?'saved':'topics');setExplorerOpen(true);setPanelOpen(true);setSheet('half');setProbe(null);setCompareOpen(false);setSearchOpen(false);setMobileLayers(saved.library&&saved.tab==='topics')
      void atlas.current?.showRelations(restored?topicMapMembers(restored):[],{fit:false})
      atlas.current?.reframe(saved.selection,saved.camera,saved.display)
    }
    window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore)
  },[])

  function preferences():Preferences{return {favorites,savedViews,layers,camera,view,opacity,thematic,display,notes,collections,topicId:activeTopic}}
  useEffect(()=>{if(!savePreferences({favorites,savedViews,layers,camera,view,opacity,thematic,display,notes,collections,topicId:activeTopic}))setToast('浏览器无法保存记录，本次探索仍可继续。')},[favorites,savedViews,layers,camera,view,opacity,thematic,display,notes,collections,activeTopic])
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),4000);return()=>clearTimeout(timer)},[toast])
  useEffect(()=>{
    if(!attribution.current)return
    const element=attribution.current
    const resize=new ResizeObserver(()=>setAttributionHeight(Math.ceil(element.getBoundingClientRect().height)))
    resize.observe(element)
    return()=>resize.disconnect()
  },[])
  useEffect(()=>{
    const close=(e:PointerEvent)=>{if(!searchBox.current?.contains(e.target as Node))setSearchOpen(false)}
    const key=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){
        if(moreOpen){e.preventDefault();setMoreOpen(false);moreTrigger.current?.focus({preventScroll:true});return}
        if(searchOpen){e.preventDefault();setSearchOpen(false);if(matchMedia(mobileLayoutQuery).matches)moreTrigger.current?.focus({preventScroll:true});return}
        if(modal||article){setModal(null);setArticle(null);return}
        if(mapSettingsOpen){e.preventDefault();closeMapSettings();return}
        if(mobileLayers){e.preventDefault();closeExplorer();return}
      }
      if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();setMoreOpen(false);setSearchOpen(true);input.current?.focus()}
    }
    document.addEventListener('pointerdown',close);document.addEventListener('keydown',key)
    return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key)}
  },[moreOpen,searchOpen,mobileLayers,mapSettingsOpen,tab,topicLibrary,modal,article])
  useEffect(()=>{
    setMoreOpen(false)
    if(mobileLayout&&headerMore.current?.querySelector('.header-actions')?.contains(document.activeElement))moreTrigger.current?.focus({preventScroll:true})
    if(!mobileLayout&&document.activeElement===moreTrigger.current)headerMore.current?.querySelector<HTMLButtonElement>('.header-actions button')?.focus({preventScroll:true})
  },[mobileLayout,landscapeLayout])
  useEffect(()=>{
    if(!moreOpen)return
    const dismiss=(restoreFocus=false)=>{setMoreOpen(false);if(restoreFocus)moreTrigger.current?.focus({preventScroll:true})}
    const outside=(event:PointerEvent)=>{if(!headerMore.current?.contains(event.target as Node))dismiss()}
    const resize=()=>dismiss(!!headerMore.current?.contains(document.activeElement))
    document.addEventListener('pointerdown',outside);window.addEventListener('resize',resize)
    return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',resize)}
  },[moreOpen])
  useEffect(()=>{
    if(!modal&&!article)return
    const previous=document.activeElement as HTMLElement
    const dialog=document.querySelector('.modal') as HTMLElement
    const controls=()=>Array.from(dialog.querySelectorAll<HTMLElement>('button,a,input,select,textarea,[tabindex="0"]')).filter(e=>!e.hasAttribute('disabled'))
    controls()[0]?.focus()
    const trap=(e:KeyboardEvent)=>{if(e.key!=='Tab')return;const c=controls();if(e.shiftKey&&document.activeElement===c[0]){e.preventDefault();c.at(-1)?.focus()}else if(!e.shiftKey&&document.activeElement===c.at(-1)){e.preventDefault();c[0]?.focus()}}
    document.addEventListener('keydown',trap);return()=>{document.removeEventListener('keydown',trap);previous?.focus()}
  },[modal,article])
  useEffect(()=>{const restore=()=>{if(restoredHistoryHash.current===location.hash){restoredHistoryHash.current=null;return}restoredHistoryHash.current=null;cancelSharedPlace();hashApplied.current='';setUrlHash(location.hash);if(atlas.current)restoreHash.current(atlas.current)};window.addEventListener('hashchange',restore);return()=>{sharedPlaceRequest.current++;pendingPickIdRequest.current++;window.removeEventListener('hashchange',restore)}},[])
  useEffect(()=>{if(atlas.current&&location.hash&&hashApplied.current!==location.hash)applyHash(atlas.current)},[urlHash])
  useEffect(()=>{if(panelOpen&&selection&&!landscapeLayout)atlas.current?.reframe(selection)},[sheet,panelOpen,explorerOpen,attributionHeight,landscapeLayout])

  function cancelSharedPlace(){setMapSettingsOpen(false);sharedPlaceRequest.current++;pendingPickIdRequest.current++;retrySharedPlace.current=null;setSharedPlaceError('')}
  function pushNavigation(){
    const map=atlas.current?.map,entry=navigation.current
    if(!entry)return
    const live=map?{...entry,camera:{center:map.getCenter().toArray() as [number,number],zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch()}}:entry
    history.replaceState({...history.state,terraAtlasNavigation:live},'')
    history.pushState({...history.state,terraAtlasNavigation:live},'')
  }
  function retryMap(){
    if(monthly.error)monthly.retry()
    if(atlas.current)void atlas.current.retry().then(()=>retrySharedPlace.current?.())
    else{setRetry(v=>v+1);setStatus('loading')}
  }
  function enableFor(card:Knowledge){
    setLayers(l=>{
      if(card.category==='regions')return {...l,borders:true}
      if(card.category==='human'||topicOverlays.includes(card.category as TopicOverlay))return l
      return {...l,[card.category]:true}
    })
  }
  function pick(s:Selection,fly=true){
    explorerReturn.current=null
    if(s.source==='languages')setThematic(current=>({...current,languageMode:'points'}))
    cancelSharedPlace()
    const distribution=!topic&&topicOverlays.includes(s.card.category as TopicOverlay)?topicForSelection(distributionIds[s.card.category as TopicOverlay]):null
    if(distribution)startTopic(distribution)
    else if(selection?.card.id!==s.card.id){pushNavigation();if(topic&&selection)setMemberTrail(trail=>[...trail,selection].slice(-30))}
    if(topic||distribution){setTab('topics');setTopicLibrary(false);setExplorerOpen(true)}
    setSelection(s);setPanelOpen(true);setProbe(null);setMobileLayers(false);setSearchOpen(false);setQuery('');setCompareOpen(false);setSheet('half')
    if(!topic&&!distribution){enableFor(s.card);if(s.card.region)setView(s.card.region)}
    if(fly)requestAnimationFrame(()=>atlas.current?.locate(s))
  }
  function pickResult(result:Knowledge|GeoProperties){
    if('summary' in result)pick({card:result as Knowledge})
    else{const p=result as GeoProperties;pick({card:matchCard(p)||dataCard(p,p.center||camera.center,sourceFor(p)),featureId:p.id,source:sourceFor(p),geographic:true})}
  }
  function pickId(id:string){
    cancelSharedPlace()
    const request=pendingPickIdRequest.current
    const card=knowledge.find(k=>k.id===id)
    if(card){pick({card});return}
    const reference=monthly.data?.places.find(p=>p.id===id)
    if(reference){pick({card:climateReference(reference)});return}
    const p=catalog.find(p=>p.id===id)
    if(p){pickResult(p);return}
    const source=id.startsWith('language-area-')?'language-areas':id.startsWith('language-')?'languages':id.startsWith('province-')?'provinces':id.startsWith('peak-wikidata-')?'summits':id.startsWith('peak-')?'peaks':null
    if(source)void readLocalJson<{features:{properties:GeoProperties;geometry:{type:string;coordinates:unknown}}[]}>(`data/${source==='languages'?'learning-languages':source==='provinces'?'learning-provinces':source==='summits'?'theme-peaks':source}.geojson`).then(data=>{if(request!==pendingPickIdRequest.current)return;const f=data.features.find(f=>f.properties.id===id);if(f){const center=f.geometry.type==='Point'?f.geometry.coordinates as [number,number]:f.properties.center||camera.center;pick({card:matchCard(f.properties)||dataCard(f.properties,center,source),featureId:id,source,geographic:true})}else setToast('未找到这个地理对象')}).catch(()=>{if(request===pendingPickIdRequest.current)setToast('资料暂未能加载，请重试')})
    else setToast('这个地点的数据暂未加载，请重试或搜索名称。')
  }
  function focusMap(v:View){
    pushNavigation();cancelSharedPlace();setView(v);setMoreOpen(false);setSearchOpen(false)
    atlas.current?.focusView(v)
  }
  function goHome(){
    pushNavigation();setMemberTrail([]);if(activeTopic&&tab==='topics')setMobileLayers(true)
    cancelSharedPlace()
    setView('china');setSelection(null);setProbe(null);setCompareOpen(false);setActiveTopic(null);setTopicLibrary(true);setTopicScope('all');setTopicGroup('all');setTopicQuery('');setMoreOpen(false);setSearchOpen(false);setLayers(l=>singleOverlay(l,null));void atlas.current?.showRelations([],{fit:false})
    requestAnimationFrame(()=>atlas.current?.focusView('china'))
  }
  function toggleLayer(key:LayerKey){
    setLayers(l=>({...l,[key]:!l[key]}))
  }
  function changeDisplay(next:MapDisplay){
    setDisplay(next)
    if(!next.terrain3d)setCamera(c=>({...c,pitch:0}))
  }
  function favorite(){
    if(!selection)return
    const id=selection.card.id
    setFavorites(f=>f.includes(id)?f.filter(i=>i!==id):[...f,id]);setToast(favorites.includes(id)?'已移出收藏':'已收藏这个地方')
  }
  function saveView(){
    const name=viewName.trim()||((view==='china'?'中国':'世界')+' · '+(selection?.card.name||topic?.title||camera.center[0].toFixed(1)+'° / '+camera.center[1].toFixed(1)+'°'))
    setSavedViews(v=>[{id:'view-'+Date.now(),name,camera:{...camera,pitch:display.terrain3d?camera.pitch??0:0},layers,view,opacity,thematic,display,topicId:activeTopic,place:selection?.card.id},...v].slice(0,40));setViewName('');setToast('当前视图已保存，可在收藏中找回')
  }
  function restore(saved:SavedView){
    pushNavigation();setMemberTrail([])
    cancelSharedPlace()
    const savedDisplay=validDisplay(saved.display)
    const restoredTopic=topicForSelection(saved.topicId)
    setActiveTopic(restoredTopic?.id||null);setTopicLibrary(!restoredTopic);setTab('topics');setExplorerOpen(true)
    void atlas.current?.showRelations(restoredTopic?topicMapMembers(restoredTopic):[],{fit:false})
    setDisplay(savedDisplay);setLayers(topicLayers(saved.layers,restoredTopic));setView(saved.view);setOpacity(saved.opacity??.48);setThematic(saved.thematic||initial.thematic);setMobileLayers(false);setCompareOpen(false);setProbe(null)
    const reference=monthly.data?.places.find(p=>p.id===saved.place),object=catalog.find(p=>p.id===saved.place)
    const card=knowledge.find(k=>k.id===saved.place)||(reference?climateReference(reference):object?matchCard(object)||dataCard(object,object.center||camera.center,sourceFor(object)):null)
    const s=card?{card}:null;setSelection(s);setPanelOpen(true)
    atlas.current?.reframe(s,{...saved.camera,pitch:savedDisplay.terrain3d?saved.camera.pitch??0:0},savedDisplay);setToast('已恢复保存的视图')
  }
  function addCollection(){
    if(!collectionName.trim()){setToast('先为这组收藏起个名字。');return}
    setCollections(c=>[...c,{id:'collection-'+Date.now(),name:collectionName.trim().slice(0,80),places:[...favorites]}]);setCollectionName('');setToast('已将当前收藏保存为主题集合')
  }
  function exportRecords(){
    const blob=new Blob([JSON.stringify({format:'terra-atlas-records',version:2,exportedAt:new Date().toISOString(),preferences:preferences()},null,2)],{type:'application/json'})
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='山河图-探索记录.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setToast('探索记录已导出')
  }
  async function importRecords(file?:File){
    if(!file)return
    try{
      if(file.size>2_000_000)throw new Error('记录文件过大')
      const raw=JSON.parse(await file.text());if(raw.format!=='terra-atlas-records'||!raw.preferences)throw new Error('请使用山河图导出的记录文件')
      const p=parsePreferences(raw.preferences)
      setFavorites(f=>[...new Set([...f,...p.favorites])]);setNotes(n=>({...n,...p.notes}));setSavedViews(v=>[...v,...p.savedViews.filter(s=>!v.some(x=>x.id===s.id))].slice(0,40));setCollections(c=>[...c,...p.collections.filter(s=>!c.some(x=>x.id===s.id))].slice(0,40));setToast('已合并收藏与保存视图')
    }catch(e){setToast(e instanceof Error?e.message:'记录未能导入')}
    if(importInput.current)importInput.current.value=''
  }
  async function share(){
    const center=atlas.current?.map.getCenter().toArray()||camera.center,zoom=atlas.current?.map.getZoom()??camera.zoom
    const bearing=atlas.current?.map.getBearing()??camera.bearing??0,pitch=display.terrain3d?(atlas.current?.map.getPitch()??camera.pitch??0):0
    const params=new URLSearchParams({lng:center[0].toFixed(4),lat:center[1].toFixed(4),z:zoom.toFixed(2),bearing:bearing.toFixed(2),pitch:pitch.toFixed(2),basemap:display.basemap,terrain3d:display.terrain3d?'1':'0',view,layers:Object.keys(layers).filter(k=>layers[k as LayerKey]).join(','),opacity:String(opacity),religion:thematic.religion,language:thematic.language,humanOpacity:String(thematic.opacity),climateMode:modes.climateMode,languageMode:modes.languageMode,languageId:modes.languageId})
    params.set('topic',activeTopic||'')
    if(selection){params.set('place',selection.card.id);params.set('plng',String(selection.card.coordinates[0]));params.set('plat',String(selection.card.coordinates[1]));if(selection.featureId){params.set('feature',selection.featureId);params.set('source',selection.source||'')}if(selection.subtype)params.set('subtype',selection.subtype)}
    const url=location.origin+location.pathname+'#'+params.toString()
    try{await navigator.clipboard.writeText(url);setToast('探索链接已复制')}catch{location.hash=params.toString();setToast('链接已写入地址栏，可直接复制网址')}
  }
  function applyHash(handle:AtlasHandle){
    if(!location.hash||hashApplied.current===location.hash)return
    // Restore settings once. Resolving a place must never replay those settings.
    const hash=location.hash,request=++sharedPlaceRequest.current
    pendingPickIdRequest.current++
    hashApplied.current=hash;retrySharedPlace.current=null;setSharedPlaceError('')
    const params=new URLSearchParams(location.hash.slice(1)),id=params.get('place')
    const coordinatesFor=(fallback:[number,number]):[number,number]=>{
      const lng=Number(params.get('plng')),lat=Number(params.get('plat'))
      return params.has('plng')&&params.has('plat')&&[lng,lat].every(Number.isFinite)&&Math.abs(lng)<=180&&Math.abs(lat)<=85?[lng,lat]:fallback
    }
    const hashDisplay=validDisplay({basemap:params.get('basemap'),terrain3d:params.get('terrain3d')==='1'})
    setDisplay(hashDisplay)
    const reference=monthly.data?.places.find(p=>p.id===id)
    const card=knowledge.find(k=>k.id===id)||(reference?climateReference(reference):null)
    const p=catalog.find(p=>p.id===id||p.id===params.get('feature'))
    let selected:Selection|null=null
    if(card){
      selected={card:{...card,coordinates:coordinatesFor(card.coordinates)},...(params.get('feature')?{featureId:params.get('feature')!,source:sourceForId(params.get('feature')!)}:{}),...(params.get('subtype')?{subtype:params.get('subtype')!}:{})}
    }else if(p)selected={card:matchCard(p)||dataCard(p,p.center||camera.center,sourceFor(p)),source:sourceFor(p),featureId:p.id,geographic:true}
    setSelection(selected);setMemberTrail([]);setPanelOpen(true);setProbe(null);setCompareOpen(false);setExplorerOpen(true);setSheet('half');setSearchOpen(false);setMobileLayers(false)
    const enabled=params.has('layers')?new Set((params.get('layers')||'').split(',')):null
    const hashLayers=enabled?Object.fromEntries(Object.keys(defaultLayers).map(k=>[k,enabled.has(k)])) as unknown as LayerState:initial.layers
    const restoredTopic=topicForSelection(params.has('topic')?params.get('topic'):legacyTopic(hashLayers))
    setActiveTopic(restoredTopic?.id||null);setTopicLibrary(!restoredTopic);setTab('topics');setLayers(topicLayers(hashLayers,restoredTopic))
    void handle.showRelations(restoredTopic?topicMapMembers(restoredTopic):[],{fit:false})
    const alpha=Number(params.get('opacity'));if(params.has('opacity')&&alpha>=.15&&alpha<=.85)setOpacity(alpha)
    const humanAlpha=Number(params.get('humanOpacity'));setThematic(t=>validThematic({...t,religion:params.get('religion')||t.religion,language:params.get('language')||t.language,opacity:params.has('humanOpacity')&&humanAlpha>=.15&&humanAlpha<=.9?humanAlpha:t.opacity,...(params.has('climateMode')?{climateMode:params.get('climateMode')}:{}),...(params.has('languageMode')?{languageMode:params.get('languageMode')}:id?.startsWith('language-')&&!id.startsWith('language-area-')?{languageMode:'points'}:{}),...(params.has('languageId')?{languageId:params.get('languageId')}: {})}))
    const c:Camera={center:[Number(params.get('lng')),Number(params.get('lat'))],zoom:Number(params.get('z')),pitch:hashDisplay.terrain3d?Number(params.get('pitch')||0):0,...(params.has('bearing')?{bearing:Number(params.get('bearing'))}:{})}
    const hasCamera=params.has('lng')&&params.has('lat')&&params.has('z')&&validCamera(c)
    if(hasCamera){handle.reframe(selected,c,hashDisplay);setView(params.get('view')==='world'?'world':'china')}
    if(id&&!selected){
      const isCurrent=()=>sharedPlaceRequest.current===request&&location.hash===hash&&atlas.current===handle
      const resolve=async():Promise<Selection|null>=>{
        if(id.startsWith('climate-place-')){
          const series=await readLocalJson<ClimateSeries>('data/learning-climate.json')
          const place=series.places.find(p=>p.id===id)
          return place?{card:{...climateReference(place),coordinates:coordinatesFor(place.coordinates)}}:null
        }
        for(const featureId of new Set([id,params.get('feature')].filter((v):v is string=>!!v))){
          const found=await handle.resolveFeature(featureId)
          if(!isCurrent())return null
          if(found){
            const {properties:p,source}=found
            if(source==='climate'){
              const card=knowledge.find(k=>k.id===`climate-${String(p.family).toLowerCase()}`)
              if(card)return {card:{...card,coordinates:coordinatesFor(p.center||camera.center)},source,featureId:p.id,subtype:`${p.code} · ${p.name}`}
            }
            return {card:matchCard(p)||dataCard(p,p.center||camera.center,source),source,featureId:p.id,geographic:true}
          }
        }
        return null
      }
      const restorePlace=()=>{void resolve().then(s=>{
        if(!isCurrent())return
        retrySharedPlace.current=null
        if(!s){setSharedPlaceError('分享链接中的地点已不存在或无法识别，仍可继续探索地图。');return}
        setSharedPlaceError('');setSelection(s);setPanelOpen(true)
        // Keep the current camera, including any navigation during the download.
        const map=handle.map
        handle.reframe(s,hasCamera?{center:map.getCenter().toArray() as [number,number],zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch()}:undefined)
      }).catch(()=>{if(isCurrent())setSharedPlaceError('分享地点的资料暂未能加载，可重试资料或搜索其他地点。')})}
      retrySharedPlace.current=restorePlace
      restorePlace()
    }
  }
  restoreHash.current=applyHash
  function ready(handle:AtlasHandle){atlas.current=handle;if(location.hash)applyHash(handle);else if(topic)void handle.showRelations(topicMapMembers(topic),{fit:false})}
  function onCatalog(items:GeoProperties[]){setCatalog(items)}
  function startTopic(t:Topic){
    explorerReturn.current=null
    pushNavigation();setMemberTrail([])
    cancelSharedPlace()
    setActiveTopic(t.id);setTopicLibrary(false);setTab('topics');if(!t.shared)setView(t.region);setSelection(null);setProbe(null);setCompareOpen(false);setMobileLayers(false);setExplorerOpen(true);setPanelOpen(true);setSheet('half');setMode('explore')
    setLayers(l=>topicLayers(l,t));setThematic(t=>({...t,religion:'largest',language:'all',languageId:'all'}));setLanguageQuery('')
    requestAnimationFrame(()=>void atlas.current?.showRelations(topicMapMembers(t),{fit:t.kind!=='distribution'}))
  }
  function topicOverview(){pushNavigation();setMemberTrail([]);cancelSharedPlace();setSelection(null);setProbe(null);setCompareOpen(false);setTopicLibrary(false);setMobileLayers(false);setPanelOpen(true);setSheet('half');if(topic)requestAnimationFrame(()=>void atlas.current?.showRelations(topicMapMembers(topic),{fit:topic.kind!=='distribution'}))}
  function focusAfterRender(target:()=>HTMLElement|null|undefined){
    const previous=document.activeElement
    requestAnimationFrame(()=>{
      if(document.activeElement!==previous&&document.activeElement!==document.body)return
      target()?.focus({preventScroll:true})
    })
  }
  function closeMapSettings(){
    setMapSettingsOpen(false)
    focusAfterRender(()=>document.querySelector<HTMLElement>('.map-tools')?.inert?document.querySelector<HTMLButtonElement>('.mobile-reading-sheet .mobile-sheet-handle'):layerTrigger.current)
  }
  function openMapSettings(){
    setMapSettingsOpen(true)
    focusAfterRender(()=>layerPanelRef.current?.querySelector<HTMLButtonElement>('[aria-label="关闭图层面板"]'))
  }
  function showExplorerTab(next:'saved'){
    if(mobileLayout&&!mobileLayers){
      const scroll=topicScrollRef.current,box=scroll?.getBoundingClientRect()
      const nav=scroll?.querySelector<HTMLElement>('.topic-sticky-nav')
      const edge=box&&nav&&getComputedStyle(nav).position==='sticky'?Math.max(4,nav.getBoundingClientRect().bottom-box.top+4):4
      const blocks=Array.from(scroll?.querySelectorAll<HTMLElement>('p,h2,h3,h4,li,figure')||[])
      const block=box?blocks.findIndex(element=>{const rect=element.getBoundingClientRect();return rect.height>0&&rect.bottom>box.top+edge&&rect.top<box.bottom}):-1
      const rect=blocks[block]?.getBoundingClientRect()
      explorerReturn.current={tab,library:topicLibrary,focus:document.activeElement instanceof HTMLElement?document.activeElement:null,scroll:scroll?.scrollTop||0,width:scroll?.clientWidth||0,block,offset:rect&&box?rect.top-box.top-edge:0,height:rect?.height||0}
    }
    cancelSharedPlace();setTab(next);setMobileLayers(true);setExplorerOpen(true)
    if(mobileLayout)focusAfterRender(()=>topicPanelRef.current?.querySelector<HTMLButtonElement>('.panel-tabs>button[aria-pressed="true"]'))
  }
  function closeExplorer(){
    const previous=explorerReturn.current;explorerReturn.current=null
    const dismissalFocus=document.activeElement
    setMobileLayers(false)
    if(previous){setTab(previous.tab);setTopicLibrary(previous.library)}
    else if(topic&&tab==='topics')setPanelOpen(false)
    requestAnimationFrame(()=>{
      const scroll=topicScrollRef.current
      if(previous?.tab==='topics'&&!previous.library&&scroll){
        scroll.scrollTop=previous.scroll
        if(scroll.clientWidth!==previous.width&&previous.block>=0){
          const block=scroll.querySelectorAll<HTMLElement>('p,h2,h3,h4,li,figure')[previous.block]
          const box=scroll.getBoundingClientRect(),nav=scroll.querySelector<HTMLElement>('.topic-sticky-nav')
          const edge=nav&&getComputedStyle(nav).position==='sticky'?Math.max(4,nav.getBoundingClientRect().bottom-box.top+4):4
          if(block){const rect=block.getBoundingClientRect();scroll.scrollTop+=rect.top-box.top-edge-(previous.offset<0&&previous.height?previous.offset/previous.height*rect.height:previous.offset)}
        }
      }
      if(document.activeElement!==dismissalFocus&&document.activeElement!==document.body)return
      const candidates=[previous?.focus,topicPanelRef.current?.querySelector<HTMLButtonElement>('.mobile-sheet-handle'),topicPanelRef.current?.querySelector<HTMLButtonElement>('.panel-tabs>button[aria-pressed="true"]'),topicTrigger.current,layerTrigger.current]
      candidates.find(element=>element!==document.body&&element?.isConnected&&element.getClientRects().length&&getComputedStyle(element).visibility!=='hidden'&&!element.closest('[inert]'))?.focus({preventScroll:true})
    })
  }
  function headerAction(action:()=>void){setMoreOpen(false);if(mobileLayout)moreTrigger.current?.focus({preventScroll:true});action()}
  function showTopicLibrary(){explorerReturn.current=null;if(!topicLibrary||tab!=='topics')pushNavigation();cancelSharedPlace();setTopicLibrary(true);setTab('topics');setPanelOpen(true);setExplorerOpen(true);setMobileLayers(true);if(mobileLayout)focusAfterRender(()=>topicPanelRef.current?.querySelector<HTMLButtonElement>('.panel-tabs>button[aria-pressed="true"]'))}
  function resumeTopic(){explorerReturn.current=null;cancelSharedPlace();setTab('topics');setTopicLibrary(false);setPanelOpen(true);setExplorerOpen(true);setMobileLayers(false);setProbe(null);setCompareOpen(false);setSheet(value=>value==='peek'?'half':value);if(mobileLayout)focusAfterRender(()=>topicPanelRef.current?.querySelector<HTMLButtonElement>('.mobile-sheet-handle'))}
  function previousMember(){
    const previous=memberTrail.at(-1);if(!previous)return
    pushNavigation();cancelSharedPlace();setMemberTrail(trail=>trail.slice(0,-1));setSelection(previous);setPanelOpen(true);setProbe(null);setCompareOpen(false);setSheet('half')
    requestAnimationFrame(()=>atlas.current?.locate(previous))
  }
  function showTopicMap(){cancelSharedPlace();changeSheet('peek');requestAnimationFrame(()=>{if(selection)atlas.current?.locate(selection);else if(topic)void atlas.current?.showRelations(topicMapMembers(topic),{fit:topic.kind!=='distribution'})})}
  function exitTopic(){pushNavigation();setMemberTrail([]);cancelSharedPlace();setActiveTopic(null);setTopicLibrary(true);setSelection(null);setProbe(null);setCompareOpen(false);setLayers(l=>singleOverlay(l,null));void atlas.current?.showRelations([],{fit:false});setTab('topics');setMobileLayers(false)}
  function relations(ids:string[]){
    cancelSharedPlace()
    const cards=ids.map(id=>knowledge.find(k=>k.id===id)).filter((k):k is Knowledge=>!!k)
    const actual=cards.filter(k=>!['climate','population','religion','language','human'].includes(k.category))
    setLayers(l=>({...l,terrain:true,borders:true,...Object.fromEntries(actual.filter(k=>['mountains','rivers','lakes'].includes(k.category)).map(k=>[k.category,true]))}))
    void atlas.current?.showRelations(actual.map(k=>k.id));setToast('已突出相关地点，观察它们的位置与相互关系')
  }
  function openCompare(id?:string){
    cancelSharedPlace()
    const defaults=[monthly.data?.places.find(p=>p.name==='成都')?.id||'sichuan-basin',monthly.data?.places.find(p=>p.name==='拉萨')?.id||'tibetan-plateau']
    setCompareIds(ids=>id?[id,ids.find(other=>other!==id)||defaults.find(other=>other!==id)!]:ids.length===2?ids:defaults)
    setCompareOpen(true);setPanelOpen(false);setProbe(null);setMobileLayers(false)
  }
  function probeClimate(code:string,coordinates:[number,number]){
    const group=knowledge.find(k=>k.id==='climate-'+code[0].toLowerCase()),legend=climateLegend.find(c=>c.code===code)
    if(group)pick({card:{...group,coordinates},subtype:code+' · '+(legend?.name||'')},false)
  }
  function startPractice(){
    cancelSharedPlace()
    const pool=favorites.map(id=>knowledge.find(k=>k.id===id)).filter((k):k is Knowledge=>!!k)
    const cards=(pool.length?pool:suggestions).slice(0,5)
    if(!cards.length)return
    setPractice({ids:cards.map(k=>k.id),index:0,revealed:false});setSelection(null);setPanelOpen(false);setMobileLayers(false);setToast('先想一想，再展开解释；可以随时继续探索')
  }
  const practiceCard=practice?knowledge.find(k=>k.id===practice.ids[practice.index]):null
  const topicReaderOpen=!!topic&&tab==='topics'&&!topicLibrary&&panelOpen&&!compareOpen&&!probe&&!mobileLayers
  const standaloneReaderOpen=!!selection&&panelOpen&&!topic&&!compareOpen&&!probe&&!mobileLayers
  const readingSheetOpen=topicReaderOpen||standaloneReaderOpen
  const fullReader=mobileLayout&&readingSheetOpen&&sheet==='full'&&!mapSettingsOpen
  const sidePanel=mapSettingsOpen?'library':readingSheetOpen?sheet:mobileLayers?'library':undefined
  useReadingPosition(topicScrollRef,topicReaderOpen?`${topic!.id}:${selection?.card.id||'overview'}:${selection?.subtype||''}`:null)
  useEffect(()=>{
    if(!landscapeLayout||fullReader)return
    const frame=requestAnimationFrame(()=>atlas.current?.resize())
    return()=>cancelAnimationFrame(frame)
  },[landscapeLayout,fullReader,sidePanel])
  useEffect(()=>{
    const elements=Array.from(document.querySelectorAll<HTMLElement>('.maplibregl-map,.map-tools,.map-legend,.topic-launch'))
    const moveFocus=fullReader&&elements.some(element=>element.contains(document.activeElement))
    if(moveFocus)document.querySelector<HTMLButtonElement>('.mobile-reading-sheet .mobile-sheet-handle')?.focus({preventScroll:true})
    for(const element of elements)element.inert=fullReader
    return()=>{for(const element of elements)element.inert=false}
  },[fullReader])
  useEffect(()=>{
    const elements=Array.from(document.querySelectorAll<HTMLElement>('.map-stage>.knowledge-panel,.map-stage>.compare-panel,.map-stage>.probe-panel,.map-stage>.practice-panel,.map-stage>.measurement-panel'))
    for(const element of elements)element.inert=mobileLayout&&(mobileLayers||mapSettingsOpen)
    return()=>{for(const element of elements)element.inert=false}
  },[mobileLayout,mobileLayers,mapSettingsOpen,selection,compareOpen,probe,practice,mode])
  const detail=selection&&panelOpen&&!compareOpen&&!probe?<KnowledgePanel embedded={!!topic} selection={selection} favorite={favorites.includes(selection.card.id)} countryId={countryFor(selection)} sheet={sheet} onSheet={changeSheet} onClose={()=>topic?topicOverview():setPanelOpen(false)} onFavorite={favorite} onLocate={()=>{if(mobileLayout)changeSheet('peek');requestAnimationFrame(()=>atlas.current?.locate(selection))}} onShare={()=>void share()} onCompare={()=>openCompare(selection.card.id)} onPick={pickId} onRelations={relations} onClimate={setArticle}/>:null

  const topicControls=<div className="topic-map-controls">
    {topicPresentation.caseNote&&<p className="topic-presentation-note">{topicPresentation.caseNote}</p>}
    {layers.climate&&<div className="thematic-control"><label>气候展示<select aria-label="气候展示方式" value={modes.climateMode} onChange={event=>setThematic(value=>({...value,climateMode:event.target.value as 'groups'|'types'}))}><option value="groups">A–E 五大类</option><option value="types">详细气候类型</option></select></label></div>}
{layers.climate&&<div className="opacity-control"><label htmlFor="climate-opacity">气候透明度 <span>{Math.round(opacity*100)}%</span></label><input id="climate-opacity" type="range" min=".15" max=".85" step=".05" value={opacity} onChange={e=>setOpacity(Number(e.target.value))}/><button className="text-button" onClick={()=>setModal('climate')}>查看 30 类气候图例 <ArrowRight size={13}/></button></div>}
            {(layers.population||layers.religion||layers.language&&modes.languageMode!=='points')&&<div className="opacity-control"><label htmlFor="human-opacity">色层透明度 <span>{Math.round(thematic.opacity*100)}%</span></label><input id="human-opacity" type="range" min=".15" max=".9" step=".05" value={thematic.opacity} onChange={e=>setThematic(t=>({...t,opacity:Number(e.target.value)}))}/></div>}
            {layers.religion&&<div className="thematic-control"><label>宗教着色<select aria-label="宗教着色指标" value={thematic.religion} onChange={e=>setThematic(t=>({...t,religion:e.target.value}))}><option value="largest">已报告比例最高的类别</option>{human.data?.religion.categories.map(c=><option key={c.id} value={c.id}>{c.name} · 已报告比例</option>)}</select></label><p className="data-caption">各条目时期和口径不同；国家着色不能代表其内部所有地区或居民。</p></div>}
            {layers.language&&<div className="thematic-control"><label>语言展示<select aria-label="语言展示方式" value={modes.languageMode} onChange={e=>setThematic(t=>({...t,languageMode:e.target.value as 'areas'|'families'|'points'}))}><option value="areas">语言区域</option><option value="families">语系概览</option><option value="points">语言参考点</option></select></label><label>语系筛选<select aria-label="语言语系筛选" value={thematic.language} onChange={e=>{setThematic(t=>({...t,language:e.target.value,languageId:'all'}));setLanguageQuery('')}}><option value="all">全部语系与分类</option>{languageFamilies.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>{modes.languageMode!=='points'&&<><label>查找语言<input aria-label="查找区域语言" placeholder="中文、英文名称或编号" value={languageQuery} onChange={event=>setLanguageQuery(event.target.value)}/></label><label>具体语言<select aria-label="区域语言筛选" value={modes.languageId} onChange={event=>setThematic(value=>({...value,languageId:event.target.value}))}><option value="all">全部语言区域</option>{languageOptions.map(language=><option key={language.id} value={language.id}>{language.name}</option>)}</select></label><p className="data-caption">{languageMeta.error||'2007图集参考范围；可重叠，部分地区未覆盖。颜色不表示人数、官方地位或当地唯一语言。'}</p>{languageMeta.error&&<button onClick={languageMeta.retry}>重试语言目录</button>}</>}<p className="data-caption">{modes.languageMode==='points'?'Glottolog参考点表示语种记录位置，点密度不表示人数。':'点击区域查看语言名称与来源；底部图例说明每种颜色。'}</p><button className="text-button" onClick={()=>{setThematic(value=>({...value,language:'all',languageId:'all'}));setLanguageQuery('')}}>显示全部语言</button></div>}
  </div>

  const discoveries=<details className="topic-discoveries"><summary><Compass size={14}/>从附近地点开始<ArrowDown size={13}/></summary>
    <div className="section-label discoveries"><BookOpen size={14}/><span>{selection?'接着探索':'附近与推荐'}</span><button aria-label="随机探索一个地方" onClick={()=>{const pool=list.length?list:knowledge.filter(k=>k.category!=='climate');pick({card:pool[Math.floor(Math.random()*pool.length)]})}}><Shuffle size={14}/></button></div>
    <div className="category-filter">{(['all','mountains','terrain','rivers','lakes','regions','human','population','religion','language'] as const).map(c=><button aria-pressed={activeCategory===c} key={c} onClick={()=>setActiveCategory(c)}>{c==='all'?'全部':categoryInfo[c].name}</button>)}</div>
    <div className="suggestions">{suggestions.map(k=><button key={k.id} onClick={()=>pick({card:k})}><span className="suggestion-dot" style={{background:categoryInfo[k.category].color}}/><span><strong>{k.name}</strong><small>{k.location.split('。')[0].slice(0,28)}</small></span><ArrowRight size={14}/></button>)}</div>
  </details>

  const mapStatus=(status==='loading'||error||sharedPlaceError)&&<div className={'map-status panel '+(error||sharedPlaceError?'error':'')} role="status">{status==='loading'?<><span className="loading-dot"/>正在打开地图…</>:error?<><Info size={16}/><span>{status}</span><button onClick={retryMap}>重试</button></>:<><Info size={16}/><span>{sharedPlaceError}</span>{retrySharedPlace.current&&<button onClick={retryMap}>重试</button>}<button aria-label="关闭分享提示" onClick={()=>setSharedPlaceError('')}>关闭</button></>}</div>

  return <div className="app" style={{'--map-attribution-height':`${attributionHeight}px`} as CSSProperties} data-map-status={status} data-detail-status={onlineStatus.detail} data-terrain-status={onlineStatus.terrain}>
    <header className="header">
      <button className="brand" onClick={goHome} aria-label="山河图首页"><span className="brand-mark"><Mountain size={25} strokeWidth={1.4}/><span/></span><span><strong>山河图</strong><small>TERRA ATLAS</small></span></button>
      <div className="map-view-actions" role="group" aria-label="地图定位"><button onClick={()=>focusMap('china')} title="将地图定位到中国"><MapPin size={14}/>定位中国</button><button onClick={()=>focusMap('world')} title="查看全球地图"><Globe2 size={14}/>全球视野</button></div>
      <div className={`search-box ${mobileLayout&&searchOpen?'mobile-search-open':''}`} ref={searchBox} onBlur={event=>{if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget))setSearchOpen(false)}}><Search size={18}/><input ref={input} aria-label="搜索地理对象" placeholder={mobileLayout&&!searchOpen?'搜索':'搜索地点、气候、人口、语言…'} value={query} onFocus={()=>{setSearchOpen(true);setMoreOpen(false)}} onChange={e=>{setQuery(e.target.value);setSearchOpen(true);setMoreOpen(false);setSearchIndex(0)}} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setSearchIndex(i=>Math.min(i+1,allResults.length-1))}if(e.key==='ArrowUp'){e.preventDefault();setSearchIndex(i=>Math.max(0,i-1))}if(e.key==='Enter'&&allResults[searchIndex])pickResult(allResults[searchIndex])}}/>{query?<button className="icon-button search-clear" aria-label="清空搜索" onClick={()=>{setQuery('');input.current?.focus()}}><X size={16}/></button>:<kbd>⌘ K</kbd>}{mobileLayout&&searchOpen&&<button className="icon-button search-close" aria-label="关闭搜索" onClick={()=>{setSearchOpen(false);moreTrigger.current?.focus({preventScroll:true})}}><ChevronLeft size={20}/></button>}
        {searchOpen&&query.trim()&&<div className="search-results" aria-label="搜索结果">{allResults.length?allResults.map((r,i)=><button key={r.id} className={searchIndex===i?'focused':''} onClick={()=>pickResult(r)}><MapPin size={16}/><span><strong>{r.name}</strong><small>{'summary' in r?categoryInfo[(r as Knowledge).category].name:'地理数据'} · {String('englishName' in r?r.englishName:r.nameEn)}</small></span><ArrowRight size={15}/></button>):<div className="empty-result"><Search size={22}/><strong>没有找到“{query}”</strong><span>试试中文、英文名称或主题，如“昆仑山”“人口”“Alps”。</span></div>}<div className="search-foot">精选知识与本地地理索引 · ↑ ↓ 选择，Enter 定位</div></div>}
      </div>
      <div className="header-more-wrap" ref={headerMore} onBlur={event=>{
        // A breakpoint can hide the focused control before the layout effect runs.
        if(event.target instanceof HTMLElement&&!event.target.getClientRects().length){
          const replacement=matchMedia(mobileLayoutQuery).matches?moreTrigger.current:headerMore.current?.querySelector<HTMLButtonElement>('.header-actions button')
          replacement?.focus({preventScroll:true});setMoreOpen(false);return
        }
        if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget))setMoreOpen(false)
      }}>
        <button ref={moreTrigger} className="icon-button header-more" aria-label="更多操作" aria-expanded={moreOpen} aria-controls="header-actions" onClick={()=>{setMoreOpen(open=>!open);setSearchOpen(false)}}><MoreHorizontal size={22}/></button>
        <div id="header-actions" className={`header-actions ${moreOpen?'mobile-open':''}`}><button className="icon-button compare-launch" aria-label="打开两地对比" onClick={()=>headerAction(()=>openCompare())}><ArrowLeftRight size={19}/><span className="header-action-label">两地对比</span></button><button className="icon-button" aria-label="打开收藏" onClick={()=>headerAction(()=>showExplorerTab('saved'))}><Bookmark size={19}/><span className="header-action-label">我的收藏</span></button><button className="icon-button" aria-label="分享当前地图" onClick={()=>headerAction(()=>void share())}><Share2 size={19}/><span className="header-action-label">分享当前地图</span></button><button className="icon-button" aria-label="资料与关于" onClick={()=>headerAction(()=>setModal('sources'))}><Info size={19}/><span className="header-action-label">资料与关于</span></button></div>
      </div>
    </header>
    <main className="map-stage" data-reading-sheet={readingSheetOpen&&!mapSettingsOpen?sheet:undefined} data-side-panel={sidePanel} data-map-settings={mapSettingsOpen||undefined}>
      <AtlasMap key={retry} topic={topic} layers={layers} opacity={opacity} camera={initial.camera} selection={selection} thematic={thematic} display={display} onOnlineStatus={setOnlineStatus} mode={mode} onSelect={s=>pick(s,false)} onCamera={setCamera} onReady={ready} onStatus={setStatus} onCatalog={onCatalog} onVisible={setBounds} onProbe={p=>{cancelSharedPlace();setProbe(p);setPanelOpen(false);setCompareOpen(false);setMobileLayers(false)}} onMeasurement={setMeasurement}/>
      <div className="map-vignette"/>
      <aside id="explorer-panel" ref={topicPanelRef} inert={mobileLayout&&mapSettingsOpen} className={['explorer','panel',mobileLayers?'mobile-open':'',topicReaderOpen?'topic-active mobile-reading-sheet sheet-'+sheet:'',!explorerOpen?'desktop-collapsed':''].join(' ')} aria-label="探索与主题">
        {topicReaderOpen&&<MobileSheetHandle sheet={sheet} title={selection?.card.name||topic!.title} panelRef={topicPanelRef} scrollRef={topicScrollRef} onSheet={changeSheet} contentId="topic-reading-content"/>}
        <div className="panel-tabs"><button aria-pressed={tab==='topics'} onClick={showTopicLibrary}><BookOpen size={14}/>主题</button><button aria-pressed={tab==='saved'} onClick={()=>showExplorerTab('saved')}><Bookmark size={14}/>收藏{favorites.length>0&&<sup>{favorites.length}</sup>}</button><button className="mobile-only icon-button" aria-label="关闭探索面板" onClick={closeExplorer}><X size={17}/></button><button className="desktop-only collapse-explorer icon-button" aria-label="收起探索面板" onClick={()=>setExplorerOpen(false)}><ChevronLeft size={17}/></button></div>
        {mobileLayers&&mapStatus}
        <div className="explorer-scroll" ref={topicScrollRef} id="topic-reading-content" inert={mobileLayout&&topicReaderOpen&&sheet==='peek'}>
          {tab==='topics'&&<TopicPanel scope={topicScope} query={topicQuery} topic={topic} library={topicLibrary} group={topicGroup} selection={panelOpen&&!compareOpen&&!probe?selection:null} controls={topicControls} discoveries={discoveries} learningTools={topic?<EarthLab topicId={topic.id}/>:null} detail={detail} onScope={setTopicScope} onQuery={setTopicQuery} onGroup={setTopicGroup} onStart={startTopic} onLibrary={showTopicLibrary} onBack={previousMember} canGoBack={memberTrail.length>0} onShowMap={showTopicMap} onExit={exitTopic} onPick={pickId} onOverview={topicOverview} onSave={saveView} onShare={()=>void share()} sheet={sheet} onSheet={changeSheet}/>}
          {tab==='saved'&&<>
            <div className="explorer-intro"><span className="eyebrow">YOUR EXPLORATION</span><h1>收藏与保存视图</h1><p>保存在当前浏览器。<br/>导出文件可以在另一台设备导入。</p></div>
            <div className="record-actions"><button onClick={exportRecords}><Download size={14}/>导出记录</button><button onClick={()=>importInput.current?.click()}><Upload size={14}/>导入记录</button><input ref={importInput} type="file" accept=".json,application/json" hidden aria-label="导入探索记录文件" onChange={e=>void importRecords(e.target.files?.[0])}/></div>
            <div className="section-label"><Bookmark size={14}/><span>收藏地点</span><small>{favorites.length}</small></div>
            <div className="saved-list">{favorites.length?favorites.map(id=>{const k=knowledge.find(k=>k.id===id),p=catalog.find(p=>p.id===id),r=monthly.data?.places.find(p=>p.id===id);return <div key={id}><button onClick={()=>pickId(id)}><MapPin size={14}/><span>{k?.name||p?.name||r?.name||'已保存的地理对象'}</span></button><button className="icon-button" aria-label={'移除收藏 '+(k?.name||p?.name||id)} onClick={()=>setFavorites(f=>f.filter(v=>v!==id))}><Trash2 size={13}/></button></div>}):<p className="empty-saved">打开地点卡片，收藏想继续研究的地方。</p>}</div>
            <button className="secondary-button practice-launch" onClick={startPractice}><BookOpen size={14}/>用收藏或附近地点回顾一下</button>
            <div className="section-label saved-section"><Layers size={14}/><span>主题集合</span></div><div className="name-control"><input aria-label="新收藏集合名称" placeholder="如：河流与城市" value={collectionName} onChange={e=>setCollectionName(e.target.value)}/><button aria-label="将当前收藏保存为集合" onClick={addCollection}><Plus size={16}/></button></div>
            <div className="collection-list">{collections.map(c=><details key={c.id}><summary>{c.name}<small>{c.places.length}个地点</small></summary>{c.places.map(id=><button key={id} onClick={()=>pickId(id)}>{knowledge.find(k=>k.id===id)?.name||catalog.find(p=>p.id===id)?.name||id}</button>)}<button className="text-button" onClick={()=>setCollections(v=>v.filter(x=>x.id!==c.id))}>删除集合</button></details>)}</div>
            <div className="section-label saved-section"><MapPin size={14}/><span>保存的地图视图</span></div><div className="name-control"><input aria-label="地图视图名称" placeholder="给当前视图起个名字" value={viewName} onChange={e=>setViewName(e.target.value)}/><button aria-label="保存命名地图视图" onClick={saveView}><Plus size={16}/></button></div>
            <div className="saved-list">{savedViews.length?savedViews.map(v=><div key={v.id}><button onClick={()=>restore(v)}><MapPin size={14}/><span>{v.name}</span></button><button className="icon-button" aria-label={'删除视图 '+v.name} onClick={()=>setSavedViews(a=>a.filter(x=>x.id!==v.id))}><Trash2 size={13}/></button></div>):<p className="empty-saved">主题、底图、辅助图层、透明度、地点和位置会一起保存。</p>}</div>
          </>}
        </div>
        <div className="explorer-foot"><span><i/>本地资料 · 自由探索</span><button aria-label="打开资料说明" onClick={()=>setModal('sources')}><Info size={14}/></button></div>
      </aside>
      {!explorerOpen&&<button className="reopen-explorer panel desktop-only" aria-label="展开探索面板" onClick={()=>setExplorerOpen(true)}><BookOpen size={16}/>探索</button>}
      {!topic&&detail}
      {((selection&&!panelOpen)||topic&&!panelOpen)&&(!mobileLayout||!topic)&&!probe&&!compareOpen&&<button className="reopen-card panel" onClick={()=>{setPanelOpen(true);if(topic){setTab('topics');setTopicLibrary(false)}}}><BookOpen size={14}/>{topic?.title||selection?.card.name}<ArrowDown size={13}/></button>}
      {probe&&<ProbePanel probe={probe} atlas={atlas.current} onClose={()=>setProbe(null)} onClimate={probeClimate} onPlace={pickId}/>}
      {compareOpen&&<ComparePanel ids={compareIds} onChange={setCompareIds} onClose={()=>setCompareOpen(false)} onLocate={card=>{cancelSharedPlace();setSelection({card});atlas.current?.locate({card})}}/>}
      {practice&&practiceCard&&<aside className="practice-panel panel" aria-label="探索回顾"><div className="knowledge-top"><span>回顾 {practice.index+1} / {practice.ids.length}</span><button className="icon-button" aria-label="退出回顾" onClick={()=>setPractice(null)}><X size={17}/></button></div><div><h2>{practiceCard.name}</h2><p>{practiceCard.questions?.[0]||'它在哪里？它与周围地形、气候或人的生活有什么联系？'}</p>{practice.revealed&&<p className="practice-answer">{practiceCard.sections?.[0]?.body||practiceCard.formation}</p>}<button className="secondary-button" onClick={()=>{setPractice(p=>p?{...p,revealed:true}:p);atlas.current?.locate({card:practiceCard})}}>展开解释并在地图上看</button><button className="text-button" onClick={()=>practice.index+1<practice.ids.length?setPractice(p=>p?{...p,index:p.index+1,revealed:false}:p):(setPractice(null),setToast('回顾完成，可以继续探索'))}>{practice.index+1<practice.ids.length?'下一处':'完成回顾'}<ArrowRight size={14}/></button></div></aside>}
      {mobileLayout&&!mapSettingsOpen&&!mobileLayers&&!readingSheetOpen&&!compareOpen&&!probe&&!practice&&mode==='explore'&&<button ref={topicTrigger} className="topic-launch panel" aria-label="打开主题探索" aria-controls="explorer-panel" onClick={()=>topic?resumeTopic():showTopicLibrary()}><BookOpen size={18}/><span>{topic?'继续探索 · '+topic.title:'主题探索'}</span><ArrowRight size={15}/></button>}
      {mapSettingsOpen&&<aside id="map-layer-panel" ref={layerPanelRef} className="layer-panel panel" aria-labelledby="map-layer-heading">
        <div className="layer-panel-heading"><div><Layers size={17}/><h2 id="map-layer-heading">图层与底图</h2></div><button className="icon-button" aria-label="关闭图层面板" onClick={closeMapSettings}><X size={18}/></button></div>
        <div className="layer-panel-scroll">
            <section className="map-display" aria-label="底图与地形">
              <div className="basemap-switch" aria-label="底图选择"><button aria-label="自然地理底图" aria-pressed={display.basemap==='natural'} onClick={()=>changeDisplay({...display,basemap:'natural'})}>自然地理</button><button aria-label="在线详细地图" aria-pressed={display.basemap==='detail'} onClick={()=>changeDisplay({...display,basemap:'detail'})}>在线详细地图</button></div>
              <label className="terrain-display"><span><Mountain size={15}/>三维地形</span><input type="checkbox" aria-label="三维地形" checked={display.terrain3d} onChange={e=>changeDisplay({...display,terrain3d:e.target.checked})}/><span className="toggle"/></label>
              <p className="data-caption">详细地图与三维地形需联网，按当前视野加载。</p>
              {(onlineStatus.detail==='loading'||onlineStatus.terrain==='loading')&&<p className="online-map-message" role="status">{onlineStatus.detail==='loading'?'正在加载详细地图…':'正在加载三维地形…'}</p>}
              {onlineError&&<div className="online-map-error" role="status">{onlineStatus.detail==='error'&&<p>在线详细地图暂未能加载，基础地图继续可用。<button aria-label="重试在线地图" onClick={()=>void atlas.current?.retry()}>重试</button></p>}{onlineStatus.terrain==='error'&&<p>三维地形暂不可用，当前显示二维地图。<button aria-label="重试三维地形" onClick={()=>void atlas.current?.retry()}>重试</button></p>}</div>}
            </section>
            <div className="section-label"><Layers size={14}/><span>辅助图层</span><small>可叠加</small></div>
            <div className="layers-list">{basicLayers.map(key=>{const layer=layerInfo[key],Icon=layer.icon;return <label key={key} className={['layer-row',layers[key]?'enabled':''].join(' ')}><span className={'layer-icon '+key}><Icon size={18} strokeWidth={1.6}/></span><span className="layer-copy"><strong>{layer.name}</strong><small>{layer.description}</small></span><input type="checkbox" aria-label={layer.label+'图层'} checked={layers[key]} onChange={()=>toggleLayer(key)}/><span className="toggle"/></label>})}</div>
            {layers.cities&&<p className="data-caption">城市随缩放逐步显示。首都符号来自Natural Earth固定版本，并非实时迁都状态。</p>}
            {layers.basins&&<p className="data-caption">BasinATLAS第3级汇水分区，部分单元为沿海汇水分组；不全是完整大河流域。分界经概化，不表示精确山脊。</p>}
            {layers.plates&&<p className="data-caption">USGS概化板块边界；颜色区分边界类型，不表示地震活动或风险。</p>}
            <p className="data-caption layer-rule">辅助图层可叠加；气候、人口、宗教和语言在“主题”中选择。</p>
        </div>
      </aside>}
      <div className="map-tools panel" aria-label="地图工具"><button ref={layerTrigger} title="图层与底图" aria-label="打开图层面板" aria-expanded={mapSettingsOpen} aria-controls="map-layer-panel" onClick={()=>mapSettingsOpen?closeMapSettings():openMapSettings()}><Layers size={18}/></button><button aria-label="放大地图" onClick={()=>atlas.current?.map.zoomIn()}><ZoomIn size={18}/></button><button aria-label="缩小地图" onClick={()=>atlas.current?.map.zoomOut()}><ZoomOut size={18}/></button><button aria-label="位置点查工具" aria-pressed={mode==='probe'} onClick={()=>{setMode(m=>m==='probe'?'explore':'probe');setToast('点击地图，查看气候和人口密度')}}><LocateFixed size={18}/></button><button aria-label="测距工具" aria-pressed={mode==='measure'} onClick={()=>{setMode(m=>m==='measure'?'explore':'measure');setProbe(null);setToast('依次点击地图测量约数距离')}}><Ruler size={18}/></button></div>
      {mode==='measure'&&<div className="measurement-panel panel"><Ruler size={16}/><span>{measurement.points.length<2?'依次点选地图上的位置':numberText(measurement.distanceKm,' km')}<small>球面大圆约数 · 不含地形高差</small></span><button onClick={()=>{atlas.current?.clearMeasurement();setMeasurement({distanceKm:0,points:[]})}}>清空</button><button aria-label="结束测距" onClick={()=>setMode('explore')}><X size={15}/></button></div>}
      <MapLegend {...legend} onEntryClick={id=>{
        const [_,kind,value]=id.split(':')
        if(kind==='climate'){if(value.length===1)pick({card:knowledge.find(card=>card.id==='climate-'+value.toLowerCase())!});else setArticle(value)}
        if(kind==='family'){setThematic(current=>({...current,language:current.language===value?'all':value,languageId:'all'}));setLanguageQuery('')}
        if(kind==='language'){setThematic(current=>({...current,language:'all',languageId:current.languageId===value?'all':value}));setLanguageQuery('')}
      }}/>
      {!mobileLayers&&mapStatus}
      <div ref={attribution} className="map-attribution"><span>Natural Earth · 局部高程 Mapzen/Tilezen</span>{display.basemap==='detail'&&onlineStatus.detail!=='error'&&onlineStatus.detail!=='off'&&<span className="online-map-attribution">详细地图：<a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a></span>}{display.terrain3d&&onlineStatus.terrain!=='error'&&onlineStatus.terrain!=='off'&&<span className="online-map-attribution">高程：<a href="https://mapterhorn.com/attribution/" target="_blank" rel="noopener noreferrer">Mapterhorn</a></span>}{layers.climate&&<span>气候：Beck V3 · CC BY 4.0</span>}{layers.population&&<span>人口：JRC GHS-POP 2020</span>}{layers.language&&<span>语言：{modes.languageMode==='points'?'Glottolog 5.3':'Glottography · 2007图集'}</span>}{layers.basins&&<span>流域：BasinATLAS · Linke et al. (2019) · CC BY 4.0</span>}{layers.plates&&<span>板块：USGS · Bird (2003)</span>}<button onClick={()=>setModal('sources')}>资料与许可</button></div>
      {toast&&<div className="toast panel" role="status"><Check size={15}/>{toast}</div>}
    </main>
    {(modal||article)&&<div className="modal-backdrop" onClick={()=>{setModal(null);setArticle(null)}}><div className="modal panel" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={e=>e.stopPropagation()}><button className="modal-close icon-button" aria-label="关闭对话框" onClick={()=>{setModal(null);setArticle(null)}}><X size={20}/></button>
      {note?<><span className="eyebrow">CLIMATE NOTE · {note.code}</span><h2 id="modal-title">{note.title}</h2><p>{note.description}</p><h3>季节变化</h3><p>{note.seasons}</p><h3>景观与生活</h3><p>{note.landscape}</p><h3>典型区域参考</h3><ul>{note.examples.map((e,i)=><li key={i}>{e}</li>)}</ul><h3>观察问题</h3><ul>{note.questions.map((q,i)=><li key={i}>{q}</li>)}</ul><div className="source-links">{note.sources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">{s.title} ↗</a>)}</div><button className="secondary-button" onClick={()=>{setArticle(null);setModal('climate')}}>返回气候图例</button></>:modal==='climate'?<><span className="eyebrow">KÖPPEN–GEIGER · V3</span><h2 id="modal-title">气候，也有自己的地图</h2><p className="modal-lead">1991–2020长期气候 · 点击类型阅读详细笔记</p><p>第一字母表示A–E大组，后续字母描述降水季节性和温度特点。分类图采用0.5°格网，边界是概化表达，不能视为实地的突变界线。C/D按最冷月0°C分开，无独立H类。</p><div className="full-climate-legend">{families.map(f=><section key={f.id}><h3>{f.id.toUpperCase()} · {f.name}<small>{f.note}</small></h3>{climateLegend.filter(c=>c.family.toLowerCase()===f.id).map(c=><button key={c.code} onClick={()=>setArticle(c.code)}><i style={{background:c.color}}/><strong>{c.code}</strong><span>{c.name}</span>{!c.presentAtResolution&&<small>此尺度未出现</small>}<ArrowRight size={12}/></button>)}</section>)}</div></>:<><span className="eyebrow">ABOUT THIS ATLAS</span><h2 id="modal-title">山河图 · Terra Atlas</h2><p className="modal-lead">自由探索中国与世界的自然、人文地理。</p><p>现有{knowledge.length}张精选知识卡、30种气候详细笔记和{topics.length}个可单选的地图主题。参考义务教育地理主要主题组织，保持自由探索；知识为原创中文概述，附可核对来源。</p><h3>自然地理与气候</h3><ul><li><a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener noreferrer">Natural Earth</a>：公共领域。国家与陆地1:5000 万，自然区域、河湖和山峰1:1000 万；自然区域多为制图标注范围。省级范围采用1:1000 万参考数据。</li><li>十四座8000米主峰名录参考UIAA，定位采用有版本记录的Wikidata坐标（CC0）。山峰点不代表山体范围，地图高程采样不用于峰顶排名。</li><li>全球地形底图为土地覆盖配色与阴影，原生瓦片到4级；珠峰与富士山区域另提供Mapzen/Tilezen局部高程阴影，主要来自USGS SRTM/GMTED及NOAA ETOPO1。高程点查按真实像元读取，不代表山峰正式海拔或全球高精度地形。</li><li><a href="https://www.gloh2o.org/koppen/" target="_blank" rel="noopener noreferrer">Beck V3</a>：CC BY 4.0。分类和月资料使用1991–2020、0.5°，赤道附近约55公里；月表为长期格网估计，不是站点实测或实时天气。</li></ul><h3>辅助图层资料</h3><p>城市来自Natural Earth固定版本，首都标记按来源记录；流域采用BasinATLAS v1.0第3级汇水分区（Linke等，2019；CC BY 4.0），含沿海汇水分组，北纬60°以北资料较粗，南极未覆盖；板块边界来自USGS公开服务，归属Bird（2003）PB2002。三者均用于区域尺度定位和比较。</p><h3>在线详细地图与三维地形</h3><p>默认使用本站提供的自然底图与学习资料。在线详细地图与三维地形可按需要开启，浏览器仅请求当前视野内的地图与高程；网络不可用时，可继续使用基础地图。在线详细地图补充城镇、道路与地名，缺少中文名称时优先使用英文，再使用当地名称。</p><ul><li>详细地图由<a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a>提供，使用<a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a>与<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>数据；OpenStreetMap数据采用ODbL许可。</li><li>在线三维高程来自<a href="https://mapterhorn.com/" target="_blank" rel="noopener noreferrer">Mapterhorn</a>，汇集多种来源的高程数据。不同地区的精度和更新时间可能不同，山体用于观察地形，不代表山峰正式海拔；现有高程点查仍使用本站的局部数据。</li></ul><h3>人文分布的读法</h3><ul><li>人口：JRC GHS-POP R2023A，2020居住人口估计；按真实人口格网求和聚合至0.5°，密度以完整格网面积计算，包含格网内水域。缺失保留未知，不能当作0。</li><li>宗教：公开历史国家资料，年份、分母与口径各不相同。国家着色表示已报告类别或比例，不能推断某个地方或个人的宗教。非全体人口口径不参与比例着色。</li><li>语言：Glottography v2.0（CC BY 4.0）提供2007年《世界语言地图集》的语言使用参考范围，部分地区与多语言重叠欠表示；名称与语系按真实Glottocode连接Glottolog 5.3。可切换语系概览或Glottolog参考点。颜色不表示人数、使用者比例或官方地位，空白不表示没有语言。国家语言概览另使用有时期说明的历史资料。</li><li>国家人口与城镇人口占比：世界银行WDI、2024年；城镇定义因国家而异。</li></ul><h3>我的探索记录</h3><p>收藏、主题集合和保存视图只存于当前浏览器，不上传。当前主题、底图选择、三维地形与地图角度会随视图保存。导出／导入文件可迁移记录。核心地图与知识由本站提供；在线地图与高程需要外部网络。</p><div className="source-links"><a href={import.meta.env.BASE_URL+'data/sources.json'} target="_blank" rel="noopener noreferrer">自然地图来源 ↗</a><a href={import.meta.env.BASE_URL+'data/content-sources.json'} target="_blank" rel="noopener noreferrer">知识参考清单 ↗</a><a href={import.meta.env.BASE_URL+'data/auxiliary-sources.json'} target="_blank" rel="noopener noreferrer">辅助图层来源 ↗</a><a href={import.meta.env.BASE_URL+'data/topic-intro-review.json'} target="_blank" rel="noopener noreferrer">主题介绍审查 ↗</a><a href={import.meta.env.BASE_URL+'data/theme-sources.json'} target="_blank" rel="noopener noreferrer">主题与山峰来源 ↗</a><a href={import.meta.env.BASE_URL+'data/online-map-sources.json'} target="_blank" rel="noopener noreferrer">在线地图来源 ↗</a><a href={import.meta.env.BASE_URL+'data/learning-data-sources.json'} target="_blank" rel="noopener noreferrer">新增数据与处理 ↗</a><a href={import.meta.env.BASE_URL+'data/language-area-sources.json'} target="_blank" rel="noopener noreferrer">语言区域来源 ↗</a><a href={import.meta.env.BASE_URL+'data/country-context-sources.json'} target="_blank" rel="noopener noreferrer">国家概览来源 ↗</a><a href={import.meta.env.BASE_URL+'elevation/source.json'} target="_blank" rel="noopener noreferrer">局部高程来源 ↗</a><a href={import.meta.env.BASE_URL+'third-party-notices.txt'} target="_blank" rel="noopener noreferrer">第三方声明 ↗</a><a href={import.meta.env.BASE_URL+'licenses/LICENSE-CONTENT.md'} target="_blank" rel="noopener noreferrer">项目许可 ↗</a></div><p className="modal-note">适合全球与区域尺度学习。地图经过制图概化，不用于导航、精确测量或判断边界。</p></>}
    </div></div>}
  </div>
}
