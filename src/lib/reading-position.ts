import {useLayoutEffect,type RefObject} from 'react'

const readingBlocks='p,h2,h3,h4,li,figure'

/** Keep the same reading block through width changes; height-only sheet changes keep scrollTop. */
export function useReadingPosition(scrollRef:RefObject<HTMLDivElement|null>,identity:string|null){
  useLayoutEffect(()=>{
    const panel=scrollRef.current
    if(!panel||identity===null)return
    let width=panel.clientWidth
    let widthChangedWhileUnavailable=false
    let anchor:{element:HTMLElement;offset:number;height:number}|null=null

    const available=()=>{
      if(!panel.clientWidth||!panel.clientHeight||panel.closest('[inert]'))return false
      const sheet=panel.closest<HTMLElement>('.mobile-reading-sheet')
      if(sheet?.hasAttribute('data-sheet-dragging'))return false
      const style=getComputedStyle(panel)
      return style.visibility!=='hidden'&&style.display!=='none'
    }
    const readingEdge=(box:DOMRect)=>{
      let edge=4
      const navigation=panel.querySelector<HTMLElement>('.topic-sticky-nav')
      if(navigation&&getComputedStyle(navigation).position==='sticky'){
        const nav=navigation.getBoundingClientRect()
        if(nav.top<=box.top+2&&nav.bottom>box.top)edge=Math.max(edge,nav.bottom-box.top+4)
      }
      return edge
    }
    const capture=()=>{
      // Reflow can emit a clamped scroll before ResizeObserver. Retain the
      // old-width anchor until the observer has restored it at the new width.
      if(!available()||panel.clientWidth!==width||widthChangedWhileUnavailable)return
      if(panel.scrollTop<=1){anchor=null;return}
      const box=panel.getBoundingClientRect()
      const edge=readingEdge(box)
      if(edge>=box.height)return
      let block:HTMLElement|null=null
      for(const offset of [0,12,28,44]){
        if(edge+offset>=box.height)break
        const element=document.elementFromPoint(box.left+box.width/2,box.top+edge+offset)?.closest<HTMLElement>(readingBlocks)
        if(element&&panel.contains(element)){block=element;break}
      }
      // A chart or multi-column section may leave the middle of the edge blank.
      if(!block){
        for(const element of panel.querySelectorAll<HTMLElement>(readingBlocks)){
          const rect=element.getBoundingClientRect()
          if(rect.height&&rect.bottom>box.top+edge&&rect.top<box.bottom){block=element;break}
        }
      }
      if(!block)return
      const rect=block.getBoundingClientRect()
      if(rect.height)anchor={element:block,offset:rect.top-box.top-edge,height:rect.height}
    }
    const observer=new ResizeObserver(()=>{
      const nextWidth=panel.clientWidth
      if(!available()){
        if(nextWidth!==width)widthChangedWhileUnavailable=true
        return
      }
      if(nextWidth!==width||widthChangedWhileUnavailable){
        const previous=anchor
        width=nextWidth
        widthChangedWhileUnavailable=false
        if(previous&&panel.contains(previous.element)){
          const box=panel.getBoundingClientRect()
          const rect=previous.element.getBoundingClientRect()
          if(rect.height){
            // Preserve the fraction already read inside a partially visible
            // paragraph, whose line count changes with the new column width.
            const offset=previous.offset<0?previous.offset/previous.height*rect.height:previous.offset
            panel.scrollTop+=rect.top-box.top-readingEdge(box)-offset
          }
        }
      }
      capture()
    })
    capture()
    panel.addEventListener('scroll',capture,{passive:true})
    observer.observe(panel)
    return()=>{
      observer.disconnect()
      panel.removeEventListener('scroll',capture)
    }
    // A stable content identity discards the previous article's resize anchor.
  },[scrollRef,identity])
}
