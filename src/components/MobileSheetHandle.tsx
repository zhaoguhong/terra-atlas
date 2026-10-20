import {useEffect,useId,useRef,type RefObject} from 'react'
import {ChevronUp,Maximize2,Minimize2,PanelRightClose} from 'lucide-react'
import {landscapeLayoutQuery,mobileLayoutQuery,useLandscapeLayout} from '../lib/mobile-layout'

type Sheet = 'peek'|'half'|'full'
const sheets:Sheet[] = ['peek','half','full']

export default function MobileSheetHandle({sheet,title,panelRef,scrollRef,onSheet,contentId}:{
  sheet:Sheet
  title:string
  panelRef:RefObject<HTMLElement|null>
  scrollRef:RefObject<HTMLDivElement|null>
  onSheet:(sheet:Sheet)=>void
  contentId:string
}){
  const handleRef=useRef<HTMLButtonElement>(null)
  const suppressClickUntil=useRef(0)
  const hintId=useId()
  const titleId=useId()
  const landscape=useLandscapeLayout()

  useEffect(()=>{
    const handle=handleRef.current
    const panel=panelRef.current
    const scroll=scrollRef.current
    if(!handle||!panel||!scroll)return
    const media=matchMedia(mobileLayoutQuery)
    const wide=matchMedia(landscapeLayoutQuery)
    let gesture:{
      kind:'pointer'|'touch'
      pointerId:number|null
      x:number
      y:number
      delta:number
      size:number
      horizontal:boolean
      stops:number[]
      fromContent:boolean
      atTop:boolean
      claimed:boolean
    }|null=null
    let frame=0

    const clear=()=>{
      cancelAnimationFrame(frame)
      frame=0
      const pointerId=gesture?.pointerId
      gesture=null
      panel.style.removeProperty('--sheet-drag-height')
      panel.style.removeProperty('--sheet-drag-width')
      delete panel.dataset.sheetDragging
      if(pointerId!=null&&handle.hasPointerCapture(pointerId))handle.releasePointerCapture(pointerId)
    }
    const start=(x:number,y:number,kind:'pointer'|'touch',pointerId:number|null=null)=>{
      if(!media.matches||kind==='touch'&&wide.matches)return
      const stage=panel.closest<HTMLElement>('.map-stage')
      if(!stage)return
      clear()
      suppressClickUntil.current=0
      const style=getComputedStyle(panel)
      const cssNumber=(name:string,fallback:number)=>{
        const value=parseFloat(style.getPropertyValue(name))
        return Number.isFinite(value)?value:fallback
      }
      const peek=cssNumber('--sheet-peek-height',56)
      const topGap=cssNumber('--sheet-top-gap',8)
      const halfRatio=cssNumber('--sheet-half-ratio',.52)
      const stageBox=stage.getBoundingClientRect()
      const panelBox=panel.getBoundingClientRect()
      const horizontal=wide.matches
      // CSS owns the responsive widths, including safe areas and narrow phones.
      const cssWidth=(name:string,fallback:number)=>{
        const value=style.getPropertyValue(name).trim()
        if(!value)return fallback
        const measure=document.createElement('span')
        measure.style.cssText='position:absolute;visibility:hidden;pointer-events:none;height:0;'
        measure.style.width=value
        stage.append(measure)
        const width=measure.getBoundingClientRect().width
        measure.remove()
        return width||fallback
      }
      const minimum=horizontal?cssNumber('--reader-rail-width',56):peek
      const full=Math.max(minimum,horizontal?cssWidth('--reader-full-width',stageBox.width-24):stageBox.height-(stageBox.bottom-panelBox.bottom)-topGap)
      const half=Math.max(minimum,Math.min(full,horizontal?cssWidth('--reader-side-width',Math.max(320,Math.min(420,innerWidth*.43))):full*halfRatio))
      gesture={kind,pointerId,x,y,delta:0,size:horizontal?panelBox.width:panelBox.height,horizontal,stops:[minimum,half,full],fromContent:kind==='touch',atTop:scroll.scrollTop<=1,claimed:false}
    }
    const move=(x:number,y:number,event:Event)=>{
      if(!gesture)return
      const dx=x-gesture.x
      const dy=y-gesture.y
      const delta=gesture.horizontal?dx:dy
      const cross=gesture.horizontal?dy:dx
      if(!gesture.claimed){
        if(Math.max(Math.abs(dx),Math.abs(dy))<8)return
        // Leave horizontal controls and native article scrolling to the browser.
        if(Math.abs(cross)>Math.abs(delta)||(gesture.fromContent&&(dy>0?!gesture.atTop:sheet==='full'))){
          clear()
          return
        }
        gesture.claimed=true
      }
      if(event.cancelable)event.preventDefault()
      gesture.delta=delta
      const size=Math.max(gesture.stops[0],Math.min(gesture.stops[2],gesture.size-delta))
      const property=gesture.horizontal?'--sheet-drag-width':'--sheet-drag-height'
      cancelAnimationFrame(frame)
      frame=requestAnimationFrame(()=>{
        panel.style.setProperty(property,`${size}px`)
        panel.dataset.sheetDragging='true'
      })
    }
    const finish=(cancelled=false)=>{
      if(!gesture)return
      const {delta,claimed,size,stops}=gesture
      let next:Sheet|null=null
      if(claimed){
        // A drag may produce a click on its original target. Do not let that
        // click open a link or cycle the handle; fresh input resets this guard.
        suppressClickUntil.current=performance.now()+600
        if(!cancelled){
          const target=Math.max(stops[0],Math.min(stops[2],size-delta))
          let index=stops.reduce((best,stop,i)=>Math.abs(stop-target)<Math.abs(stops[best]-target)?i:best,0)
          const current=sheets.indexOf(sheet)
          if(Math.abs(delta)>=40&&index===current)index=Math.max(0,Math.min(2,index+(delta<0?1:-1)))
          next=sheets[index]
          if(next==='peek'&&panel.contains(document.activeElement))handle.focus({preventScroll:true})
        }
      }
      clear()
      if(next)onSheet(next)
    }
    const cancel=()=>finish(true)
    const down=(event:PointerEvent)=>{
      if(!event.isPrimary||event.button!==0)return
      start(event.clientX,event.clientY,'pointer',event.pointerId)
      if(gesture)handle.setPointerCapture(event.pointerId)
    }
    const pointerMove=(event:PointerEvent)=>{
      if(gesture?.kind==='pointer'&&gesture.pointerId===event.pointerId)move(event.clientX,event.clientY,event)
    }
    const pointerUp=(event:PointerEvent)=>{
      if(gesture?.kind==='pointer'&&gesture.pointerId===event.pointerId)finish()
    }
    const pointerCancel=(event:PointerEvent)=>{
      if(gesture?.kind==='pointer'&&gesture.pointerId===event.pointerId)cancel()
    }
    const touchStart=(event:TouchEvent)=>{
      if(event.touches.length!==1){cancel();return}
      const target=event.target
      if(target instanceof Element&&target.closest('input,select,textarea,[contenteditable="true"],[contenteditable=""]'))return
      start(event.touches[0].clientX,event.touches[0].clientY,'touch')
    }
    const touchMove=(event:TouchEvent)=>{
      if(gesture?.kind!=='touch')return
      if(event.touches.length!==1){cancel();return}
      move(event.touches[0].clientX,event.touches[0].clientY,event)
    }
    const touchEnd=()=>{if(gesture?.kind==='touch')finish()}
    const touchCancel=()=>{if(gesture?.kind==='touch')cancel()}
    const freshPointer=(event:PointerEvent)=>{
      suppressClickUntil.current=0
      if(event.pointerType==='touch'&&!event.isPrimary)cancel()
    }
    const stopClick=(event:MouseEvent)=>{
      // Keyboard activation has detail 0 and must remain available after a drag.
      if(event.detail!==0&&performance.now()<suppressClickUntil.current){
        event.preventDefault()
        event.stopPropagation()
      }
      suppressClickUntil.current=0
    }

    if(sheet==='peek'&&media.matches&&panel.contains(document.activeElement)&&document.activeElement!==handle)handle.focus({preventScroll:true})
    handle.addEventListener('pointerdown',down)
    handle.addEventListener('pointermove',pointerMove)
    handle.addEventListener('pointerup',pointerUp)
    handle.addEventListener('pointercancel',pointerCancel)
    handle.addEventListener('lostpointercapture',pointerCancel)
    scroll.addEventListener('touchstart',touchStart,{passive:true})
    scroll.addEventListener('touchmove',touchMove,{passive:false})
    scroll.addEventListener('touchend',touchEnd)
    scroll.addEventListener('touchcancel',touchCancel)
    panel.addEventListener('pointerdown',freshPointer,true)
    panel.addEventListener('click',stopClick,true)
    window.addEventListener('resize',cancel)
    media.addEventListener('change',cancel)
    return()=>{
      clear()
      handle.removeEventListener('pointerdown',down)
      handle.removeEventListener('pointermove',pointerMove)
      handle.removeEventListener('pointerup',pointerUp)
      handle.removeEventListener('pointercancel',pointerCancel)
      handle.removeEventListener('lostpointercapture',pointerCancel)
      scroll.removeEventListener('touchstart',touchStart)
      scroll.removeEventListener('touchmove',touchMove)
      scroll.removeEventListener('touchend',touchEnd)
      scroll.removeEventListener('touchcancel',touchCancel)
      panel.removeEventListener('pointerdown',freshPointer,true)
      panel.removeEventListener('click',stopClick,true)
      window.removeEventListener('resize',cancel)
      media.removeEventListener('change',cancel)
    }
  },[sheet,panelRef,scrollRef,onSheet,landscape])

  return <><button
    ref={handleRef}
    type="button"
    className="mobile-sheet-handle"
    data-sheet={sheet}
    aria-label="调整阅读面板大小"
    aria-expanded={sheet!=='peek'}
    aria-controls={contentId}
    aria-describedby={`${titleId} ${hintId}`}
    onClick={()=>onSheet(sheets[(sheets.indexOf(sheet)+1)%sheets.length])}
    onKeyDown={event=>{
      suppressClickUntil.current=0
      const index=sheets.indexOf(sheet)
      const next=event.key==='ArrowUp'||landscape&&event.key==='ArrowLeft'?Math.min(2,index+1):event.key==='ArrowDown'||landscape&&event.key==='ArrowRight'?Math.max(0,index-1):event.key==='Home'?0:event.key==='End'?2:null
      if(next!==null){event.preventDefault();onSheet(sheets[next])}
    }}
  >
    <span className="sheet-handle-grip" aria-hidden="true"/>
    <span className="sheet-handle-rail-label" aria-hidden="true">资料</span>
    <span id={titleId} className="sheet-handle-title">{title}</span>
    <span id={hintId} className="sheet-handle-hint">{landscape?(sheet==='peek'?'点击查看资料':sheet==='half'?'左右拖动':'右拖收起'):(sheet==='peek'?'上拉查看资料':sheet==='half'?'上拉阅读 · 下拉收起':'下拉收起')}</span>
    <ChevronUp size={16} aria-hidden="true"/>
  </button><div className="landscape-sheet-actions">
    <button type="button" aria-label={sheet==='full'?'返回地图与资料':'展开阅读'} title={sheet==='full'?'返回地图与资料':'展开阅读'} aria-controls={contentId} onClick={()=>onSheet(sheet==='full'?'half':'full')}>{sheet==='full'?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button>
    <button type="button" aria-label="收起资料面板" title="收起资料面板" aria-controls={contentId} onClick={()=>onSheet('peek')}><PanelRightClose size={17}/></button>
  </div></>
}
