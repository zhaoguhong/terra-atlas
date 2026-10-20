import {expect,test,type CDPSession,type Locator,type Page} from '@playwright/test'
import {baseReady,mapSettled,selectedGeometry} from './map-readiness'
import {chooseTheme,openThemeLibrary} from './theme-controls'

type Stop='peek'|'half'|'full'
type Box={x:number;y:number;width:number;height:number}
const sheet=(page:Page)=>page.locator('.mobile-reading-sheet')
const handle=(page:Page)=>page.getByRole('button',{name:'调整阅读面板大小',exact:true})
const landscape=(page:Page)=>{const viewport=page.viewportSize()!;return viewport.width>viewport.height}
const size=(box:Box,horizontal:boolean)=>horizontal?box.width:box.height
const dragPoint=(start:{x:number;y:number},distance:number,horizontal:boolean)=>({x:start.x+(horizontal?distance:0),y:start.y+(horizontal?0:distance)})
let errors:string[]=[]

test.setTimeout(90000)
test.beforeEach(async({page},info)=>{
  test.skip(!info.project.name.startsWith('mobile'),'touch reading sheets use the mobile layout')
  errors=[];page.on('pageerror',error=>errors.push(error.message))
  await page.goto('/');await baseReady(page);await mapSettled(page)
})
test.afterEach(()=>expect(errors,'mobile reader runtime errors').toEqual([]))

async function setStop(page:Page,stop:Stop){
  const current=(await sheet(page).getAttribute('class'))||''
  const horizontal=landscape(page)
  if(!current.includes('sheet-'+stop))await handle(page).press(stop==='peek'?'Home':stop==='full'?'End':current.includes('sheet-peek')?(horizontal?'ArrowLeft':'ArrowUp'):(horizontal?'ArrowRight':'ArrowDown'))
  await expect(sheet(page)).toHaveClass(new RegExp('sheet-'+stop))
  // Wait for the panel's short snap transition before deriving touch coordinates.
  await expect.poll(()=>sheet(page).evaluate(el=>el.getAnimations().filter(animation=>animation.playState==='running').length)).toBe(0)
}

async function sheetBounds(page:Page){
  const panel=(await sheet(page).boundingBox())!,stage=(await page.locator('.map-stage').boundingBox())!
  expect(panel.x).toBeGreaterThanOrEqual(stage.x-1)
  expect(panel.y).toBeGreaterThanOrEqual(stage.y-1)
  expect(panel.x+panel.width).toBeLessThanOrEqual(stage.x+stage.width+1)
  expect(panel.y+panel.height).toBeLessThanOrEqual(stage.y+stage.height+1)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true)
  return panel
}

async function beginHandleDrag(page:Page,distance:number){
  const box=(await handle(page).boundingBox())!,x=box.x+box.width/2,y=box.y+box.height/2
  const moved=dragPoint({x,y},distance,landscape(page))
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(moved.x,moved.y,{steps:8})
  await expect(sheet(page)).toHaveAttribute('data-sheet-dragging','true')
  return {x,y}
}

// Synthetic touches isolate gesture arbitration, including cancellation and excluded
// controls. Trusted CDP input below also exercises the browser's native scrolling.
async function contentTouch(content:Locator,dy:number,dx=0,cancel=false,targetSelector?:string){
  return content.evaluate((panel,{dy,dx,cancel,targetSelector})=>{
    const target=targetSelector?panel.querySelector(targetSelector)!:panel
    const rect=target.getBoundingClientRect(),x=rect.left+Math.min(90,rect.width/2),y=rect.top+Math.min(65,rect.height/2)
    const touch=(clientX:number,clientY:number)=>({identifier:1,target,clientX,clientY})
    const event=(type:string,touches:ReturnType<typeof touch>[])=>{
      const result=new Event(type,{bubbles:true,cancelable:true})
      Object.defineProperty(result,'touches',{value:touches})
      return result
    }
    target.dispatchEvent(event('touchstart',[touch(x,y)]))
    const moved=event('touchmove',[touch(x+dx,y+dy)])
    target.dispatchEvent(moved)
    target.dispatchEvent(event(cancel?'touchcancel':'touchend',[]))
    return moved.defaultPrevented
  },{dy,dx,cancel,targetSelector})
}

async function swipe(page:Page,cdp:CDPSession,x:number,y:number,dy:number,dx=0){
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]})
  for(let step=1;step<=10;step++){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*step/10,y:y+dy*step/10}]})
    await page.waitForTimeout(20)
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
}

async function settledScroll(content:Locator){
  return content.evaluate(el=>new Promise<number>((resolve,reject)=>{
    let previous=el.scrollTop,unchanged=0,frames=0
    const check=()=>{
      const current=el.scrollTop
      unchanged=Math.abs(current-previous)<.5?unchanged+1:0
      previous=current;frames++
      if(unchanged>=8)resolve(current)
      else if(frames>=180)reject(new Error('Native article scrolling did not settle'))
      else requestAnimationFrame(check)
    }
    requestAnimationFrame(check)
  }))
}

test('mobile reader: follows the finger, snaps to three stops, and leaves a usable map when collapsed',async({page,context},info)=>{
  const horizontal=landscape(page)
  await chooseTheme(page,'中国四大高原')
  await expect(sheet(page)).toHaveClass(/sheet-half/)
  const half=await sheetBounds(page)
  await setStop(page,'full');const full=await sheetBounds(page)
  await setStop(page,'half')
  const cdp=await context.newCDPSession(page),grip=(await handle(page).boundingBox())!
  const start={x:grip.x+grip.width/2,y:grip.y+grip.height/2}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]})
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[dragPoint(start,-30,horizontal)]})
  await expect(sheet(page)).toHaveAttribute('data-sheet-dragging','true')
  const moving=(await sheet(page).boundingBox())!
  expect(size(moving,horizontal),'the reader moves before release').toBeGreaterThan(size(half,horizontal)+15)
  expect(size(moving,horizontal)).toBeLessThan(size(full,horizontal)-1)
  await expect(sheet(page)).toHaveClass(/sheet-half/)
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[dragPoint(start,-(size(full,horizontal)-size(half,horizontal))-20,horizontal)]})
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
  await expect(sheet(page)).toHaveClass(/sheet-full/)
  await setStop(page,'full')
  expect(size(await sheetBounds(page),horizontal)).toBeCloseTo(size(full,horizontal),0)
  await beginHandleDrag(page,40)
  expect(size((await sheet(page).boundingBox())!,horizontal)).toBeLessThan(size(full,horizontal)-20)
  await handle(page).dispatchEvent('pointercancel',{pointerId:1,pointerType:'mouse'})
  await page.mouse.up()
  await expect(sheet(page)).toHaveClass(/sheet-full/)
  await expect(sheet(page)).not.toHaveAttribute('data-sheet-dragging','true')
  await setStop(page,'full')
  expect(size(await sheetBounds(page),horizontal),'cancel restores the previous stop').toBeCloseTo(size(full,horizontal),0)
  await beginHandleDrag(page,size(full,horizontal)-size(half,horizontal));await page.mouse.up()
  await expect(sheet(page)).toHaveClass(/sheet-half/)
  await setStop(page,'half')
  await beginHandleDrag(page,size(half,horizontal)-56);await page.mouse.up()
  await expect(sheet(page)).toHaveClass(/sheet-peek/)
  await setStop(page,'peek')
  const peek=await sheetBounds(page)
  expect(size(peek,horizontal)).toBeGreaterThanOrEqual(54);expect(size(peek,horizontal)).toBeLessThanOrEqual(60)
  await expect(page.locator('#topic-reading-content')).toBeHidden()
  await expect(page.locator('.map-legend')).toBeVisible()
  await expect.poll(()=>page.evaluate(()=>window.__terraAtlas!.map.getPadding().left),'the bottom legend must not reserve a left sidebar').toBe(22)
  await expect.poll(()=>page.evaluate(()=>{
    const map=window.__terraAtlas!.map,rect=map.getContainer().getBoundingClientRect(),legend=document.querySelector('.map-legend')!.getBoundingClientRect()
    return map.getPadding().bottom-(rect.bottom-legend.top)
  }),'the camera leaves the bottom legend clear').toBeGreaterThanOrEqual(0)
  const before=await page.evaluate(()=>window.__terraAtlas!.map.getCenter().toArray())
  const stage=(await page.locator('.map-stage').boundingBox())!
  const pan={x:horizontal?stage.x+(peek.x-stage.x)*.4:stage.x+stage.width*.4,y:horizontal?stage.y+stage.height*.4:stage.y+Math.min(90,(peek.y-stage.y)/2)}
  expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)===window.__terraAtlas!.map.getCanvas(),pan),'collapsed reader leaves a real map target').toBe(true)
  await swipe(page,cdp,pan.x,pan.y,20,70)
  await expect.poll(()=>page.evaluate(()=>window.__terraAtlas!.map.getCenter().toArray())).not.toEqual(before)
  await mapSettled(page)
  await expect(sheet(page)).toHaveClass(/sheet-peek/)
  await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id','china-plateaus')
  await openThemeLibrary(page)
  await expect(page.locator('.topic-library')).toBeVisible()
  await page.locator('.topic-resume').click()
  await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id','china-plateaus')
  await expect(sheet(page)).toHaveClass(/sheet-half/)
  await expect(page.locator('.map-stage')).toHaveAttribute('data-reading-sheet','half')
  await expect(page.locator('#topic-reading-content')).toBeVisible()
  await openThemeLibrary(page)
  await expect(page.locator('.topic-library')).toBeVisible()
  await chooseTheme(page,'中国四大盆地')
  await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id','china-basins')
  await page.screenshot({path:test.info().outputPath('draggable-theme-'+info.project.name+'.png')})
})

test('mobile reader: arbitrates article scrolling according to the active orientation',async({page,context},info)=>{
  await chooseTheme(page,'中国四大高原')
  const horizontal=landscape(page),content=page.locator('#topic-reading-content')
  expect(await contentTouch(content,-90)).toBe(!horizontal)
  await expect(sheet(page)).toHaveClass(horizontal?/sheet-half/:/sheet-full/)
  expect(await contentTouch(content,20,100)).toBe(false)
  await expect(sheet(page)).toHaveClass(horizontal?/sheet-half/:/sheet-full/)
  await setStop(page,'full')
  expect(await contentTouch(content,-90)).toBe(false)
  await content.evaluate(el=>{el.scrollTop=180})
  expect(await contentTouch(content,90)).toBe(false)
  await expect(sheet(page)).toHaveClass(/sheet-full/)
  await content.evaluate(el=>{el.scrollTop=0})
  expect(await contentTouch(content,20,100)).toBe(false)
  expect(await contentTouch(content,90,0,true)).toBe(!horizontal)
  await expect(sheet(page)).toHaveClass(/sheet-full/)
  await expect(sheet(page)).not.toHaveAttribute('data-sheet-dragging','true')
  const cdp=await context.newCDPSession(page)
  await setStop(page,'half')
  const halfBounds=(await content.boundingBox())!
  await swipe(page,cdp,halfBounds.x+halfBounds.width*.45,horizontal?halfBounds.y+halfBounds.height-25:halfBounds.y+Math.min(100,halfBounds.height-15),-90)
  if(horizontal){
    await expect(sheet(page)).toHaveClass(/sheet-half/)
    await expect.poll(()=>content.evaluate(el=>el.scrollTop)).toBeGreaterThan(20)
    const halfScrolled=await settledScroll(content)
    await setStop(page,'peek');await setStop(page,'half')
    expect(await content.evaluate(el=>el.scrollTop),'sidebar preserves the half-panel reading position').toBeCloseTo(halfScrolled,0)
    await content.evaluate(el=>{el.scrollTop=0})
    const top=(await content.boundingBox())!
    await swipe(page,cdp,top.x+top.width*.45,top.y+Math.min(90,top.height/3),90)
    await expect(sheet(page)).toHaveClass(/sheet-half/)
  }else await expect(sheet(page)).toHaveClass(/sheet-full/)
  await setStop(page,'full')
  await content.evaluate(el=>{el.scrollTop=0})
  // Begin on prose below the sticky navigation so real input reaches the article.
  await page.getByText('展开主题介绍',{exact:true}).click()
  const prose=(await page.locator('.topic-explanation .reading-section p').first().boundingBox())!
  const bounds=(await content.boundingBox())!,x=bounds.x+bounds.width*.45,y=Math.min(bounds.y+bounds.height-20,Math.max(bounds.y+80,prose.y+15))
  await swipe(page,cdp,x,y,-Math.min(140,y-bounds.y-20))
  await expect.poll(()=>content.evaluate(el=>el.scrollTop)).toBeGreaterThan(20)
  const scrolled=await settledScroll(content)
  await setStop(page,'peek');await setStop(page,'full')
  expect(await content.evaluate(el=>el.scrollTop),'returning from the map preserves the reading position').toBeCloseTo(scrolled,0)
  const after=(await content.boundingBox())!
  await swipe(page,cdp,x,after.y+after.height*.5,Math.min(25,scrolled/3))
  await expect(sheet(page)).toHaveClass(/sheet-full/)
  await content.evaluate(el=>{el.scrollTop=0})
  const topBounds=(await content.boundingBox())!
  await swipe(page,cdp,x,topBounds.y+Math.min(90,topBounds.height/3),90)
  await expect(sheet(page)).toHaveClass(horizontal?/sheet-full/:/sheet-half/)
  await page.screenshot({path:test.info().outputPath('scrolling-theme-'+info.project.name+'.png')})
})

test('mobile reader: standalone places keep selection and controls usable after rotation',async({page},info)=>{
  await page.getByRole('textbox',{name:'搜索地理对象',exact:true}).fill('长江')
  await page.locator('.search-results>button').first().click();await selectedGeometry(page)
  await expect(sheet(page)).toHaveClass(/sheet-half/)
  const content=page.locator('#place-reading-content')
  await setStop(page,'half')
  await content.evaluate(el=>{el.scrollTop=0})
  await expect(sheet(page)).toHaveClass(/sheet-half/)
  await setStop(page,'full')
  await page.getByRole('button',{name:'收藏地点',exact:true}).click()
  await page.setViewportSize(info.project.name==='mobile'?{width:844,height:390}:{width:390,height:844})
  await expect(page.locator('.knowledge-panel h2')).toHaveText('长江')
  await expect(sheet(page)).toHaveClass(/sheet-full/)
  const full=await sheetBounds(page),stage=(await page.locator('.map-stage').boundingBox())!
  expect(full.y).toBeLessThanOrEqual(stage.y+10);expect(full.height).toBeGreaterThan(stage.height*.85)
  await expect(page.getByRole('textbox',{name:'这个地点的笔记',exact:true})).toHaveCount(0)
  await expect(page.getByRole('button',{name:'已收藏',exact:true})).toHaveAttribute('aria-pressed','true')
  await expect(page.getByRole('textbox',{name:'搜索地理对象',exact:true})).toBeInViewport({ratio:1})
  await expect(handle(page)).toBeInViewport({ratio:1})
  await setStop(page,'peek')
  expect(size(await sheetBounds(page),landscape(page))).toBeLessThanOrEqual(60)
  await handle(page).press(landscape(page)?'ArrowLeft':'ArrowUp')
  await expect(sheet(page)).toHaveClass(/sheet-half/)
  await page.getByRole('button',{name:'关闭知识卡片',exact:true}).click()
  await expect(sheet(page)).toHaveCount(0)
  await openThemeLibrary(page)
  await expect(page.locator('.topic-library')).toBeVisible()
  await page.screenshot({path:test.info().outputPath('rotated-reader-'+info.project.name+'.png')})
})

test('landscape reader: preserves the paragraph being read through expansion and rotation',async({page},info)=>{
  test.skip(info.project.name!=='mobile-landscape','reading across sidebar width changes')
  await chooseTheme(page,'中国四大高原')
  const content=page.locator('#topic-reading-content')
  await page.getByText('展开主题介绍',{exact:true}).click()
  const paragraph=page.locator('.topic-explanation .reading-section p').nth(1)
  const text=await paragraph.innerText(),halfWidth=(await sheet(page).boundingBox())!.width
  // Place one third of this known paragraph above the visible reading edge.
  // Its earlier sections and later modules give the browser room to restore it.
  await paragraph.evaluate(element=>{
    const scroll=element.closest<HTMLElement>('.explorer-scroll')!,box=scroll.getBoundingClientRect()
    const nav=scroll.querySelector<HTMLElement>('.topic-sticky-nav')!,navigation=nav.getBoundingClientRect()
    const edge=Math.max(box.top,getComputedStyle(nav).position==='sticky'?navigation.bottom:box.top)
    const rect=element.getBoundingClientRect()
    scroll.scrollTop+=rect.top-edge+rect.height/3
  })
  await settledScroll(content)
  const reading=()=>paragraph.evaluate(element=>{
    const scroll=element.closest<HTMLElement>('.explorer-scroll')!,box=scroll.getBoundingClientRect()
    const nav=scroll.querySelector<HTMLElement>('.topic-sticky-nav')!,navigation=nav.getBoundingClientRect()
    const edge=Math.max(box.top,getComputedStyle(nav).position==='sticky'?navigation.bottom:box.top)
    const rect=element.getBoundingClientRect()
    return{edge,top:rect.top,bottom:rect.bottom,height:rect.height,progress:(edge-rect.top)/rect.height,readingBottom:box.bottom}
  })
  const initial=await reading()
  expect(initial.progress).toBeCloseTo(1/3,1)
  await expect(paragraph).toBeInViewport()
  const retained=async()=>{
    await settledScroll(content)
    await expect(paragraph).toHaveText(text)
    await expect(paragraph).toBeInViewport()
    await expect.poll(async()=>{
      const position=await reading()
      return Math.abs(position.edge-position.top-initial.progress*position.height)
    },{message:'the same paragraph and its already-read fraction remain at the reading edge'}).toBeLessThanOrEqual(24)
    const position=await reading()
    expect(position.bottom,'unread paragraph text remains below the reading edge').toBeGreaterThan(position.edge)
    expect(position.top).toBeLessThan(position.readingBottom)
  }
  await page.getByRole('button',{name:'展开阅读',exact:true}).click()
  await expect(sheet(page)).toHaveClass(/sheet-full/)
  expect((await sheetBounds(page)).width).toBeGreaterThan(halfWidth*1.5)
  await retained()
  await page.setViewportSize({width:390,height:844})
  await expect(sheet(page)).toHaveClass(/sheet-full/)
  await sheetBounds(page)
  await retained()
  await chooseTheme(page,'中国四大盆地')
  await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id','china-basins')
  expect(await settledScroll(content),'a different introduction starts at its beginning').toBeLessThan(2)
  await expect(page.locator('.topic-heading')).toBeInViewport({ratio:1})
  await page.screenshot({path:test.info().outputPath('reading-paragraph-after-topic-change.png')})
})

test('landscape reader: cancelling a width drag restores the paragraph at the end of the article',async({page},info)=>{
  test.skip(info.project.name!=='mobile-landscape','cancelled sidebar reflow')
  await chooseTheme(page,'中国四大高原')
  const half=await sheetBounds(page)
  await setStop(page,'full');const full=await sheetBounds(page)
  await setStop(page,'half')
  const content=page.locator('#topic-reading-content'),paragraph=page.locator('.topic-reader>.geometry-note')
  await content.evaluate(el=>{el.scrollTop=el.scrollHeight})
  await settledScroll(content)
  await expect(paragraph).toBeInViewport({ratio:1})
  const text=await paragraph.innerText(),before=await content.evaluate(el=>({top:el.scrollTop,height:el.scrollHeight}))
  const paragraphTop=(await paragraph.boundingBox())!.y-(await content.boundingBox())!.y
  expect(before.top).toBeGreaterThan(100)
  await beginHandleDrag(page,-(full.width-half.width-20))
  // Give layout and ResizeObserver a chance to observe the temporary wider prose.
  const afterLayout=()=>content.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))
  await afterLayout()
  expect((await sheetBounds(page)).width).toBeGreaterThan(half.width*1.5)
  const during=await content.evaluate(el=>({top:el.scrollTop,height:el.scrollHeight}))
  expect(during.height,'wider prose is shorter while the pointer is held').toBeLessThan(before.height-40)
  expect(during.top,'the browser clamps the old end position during reflow').toBeLessThan(before.top-40)
  await handle(page).dispatchEvent('pointercancel',{pointerId:1,pointerType:'mouse'})
  await page.mouse.up()
  await expect(sheet(page)).not.toHaveAttribute('data-sheet-dragging','true')
  await setStop(page,'half');await afterLayout();await settledScroll(content)
  expect((await sheetBounds(page)).width).toBeCloseTo(half.width,0)
  await expect(paragraph).toHaveText(text)
  await expect(paragraph).toBeInViewport({ratio:1})
  expect(await content.evaluate(el=>el.scrollTop),'cancel returns to the same end-of-article reading position').toBeCloseTo(before.top,0)
  expect((await paragraph.boundingBox())!.y-(await content.boundingBox())!.y,'the same paragraph returns to its previous visible position').toBeCloseTo(paragraphTop,0)
})

for(const viewport of [{width:568,height:320},{width:932,height:430}]){
  test.describe(`initial phone landscape ${viewport.width}x${viewport.height}`,()=>{
  // Initial screen metrics keep Chromium's native touch viewport in sync.
  // Rotation itself is covered separately by the selection and paragraph cases.
  test.use({viewport,screen:viewport})
  test(`landscape reader: right sidebar keeps reading, modules, and the map usable at ${viewport.width}x${viewport.height}`,async({page,context},info)=>{
    test.skip(info.project.name!=='mobile-landscape','additional phone landscape sizes')
    await chooseTheme(page,'中国四大高原')
    const stage=(await page.locator('.map-stage').boundingBox())!,half=await sheetBounds(page)
    const insets=await sheet(page).evaluate(el=>{const style=getComputedStyle(el);return{top:parseFloat(style.top),bottom:parseFloat(style.bottom)}})
    expect(half.y).toBeCloseTo(stage.y+insets.top,0)
    expect(half.y+half.height).toBeCloseTo(stage.y+stage.height-insets.bottom,0)
    expect(insets.top).toBeGreaterThanOrEqual(0);expect(insets.top).toBeLessThanOrEqual(10)
    const attribution=(await page.locator('.map-attribution').boundingBox())!
    expect(insets.bottom,'the bottom gap preserves the displayed attribution').toBeGreaterThanOrEqual(attribution.height)
    expect(insets.bottom).toBeLessThanOrEqual(attribution.height+16)
    expect(half.x,'reading is anchored to the right with usable map space on the left').toBeGreaterThan(stage.x+stage.width*.35)
    expect(half.width).toBeGreaterThan(stage.width*.3)
    expect(half.width).toBeLessThan(stage.width*.65)
    expect(stage.x+stage.width-half.x-half.width).toBeLessThanOrEqual(20)
    await expect(handle(page)).toBeInViewport({ratio:1})
    await page.locator('.topic-module-jump').click()
    await expect(page.locator('.topic-module').first()).toBeInViewport()
    await page.locator('.topic-members').getByRole('button',{name:/黄土高原/}).click();await selectedGeometry(page)
    await expect(page.locator('.knowledge-panel h2')).toHaveText('黄土高原')
    await expect(sheet(page)).toHaveClass(/sheet-half/)
    const point=await page.evaluate(()=>{
      const map=window.__terraAtlas!.map,p=map.project([107.7,36.7]),rect=map.getContainer().getBoundingClientRect()
      const x=p.x+rect.left,y=p.y+rect.top
      return{x,y,canvas:document.elementFromPoint(x,y)===map.getCanvas(),panelLeft:document.querySelector('.mobile-reading-sheet')!.getBoundingClientRect().left}
    })
    expect(point.x,'selected place is visible on the map left of the sidebar').toBeLessThan(point.panelLeft)
    expect(point.canvas,'selected place must remain on the real map canvas').toBe(true)
    const content=page.locator('#topic-reading-content')
    await settledScroll(content)
    const rect=(await content.boundingBox())!,cdp=await context.newCDPSession(page)
    const touchTarget=await content.evaluate((panel,{x,y})=>{
      const hit=document.elementFromPoint(x,y),ancestors=[]
      for(let el=hit;el&&panel.contains(el);el=el.parentElement){const style=getComputedStyle(el);ancestors.push({tag:el.tagName,class:el.className,overflow:style.overflowY,touchAction:style.touchAction,overscroll:style.overscrollBehaviorY})}
      return{x,y,hit:hit?.outerHTML.slice(0,500),readingBody:!!hit?.closest('.knowledge-scroll'),interactive:!!hit?.closest('button,input,select,textarea,a'),ancestors,scrollHeight:panel.scrollHeight,clientHeight:panel.clientHeight}
    },{x:rect.x+rect.width*.5,y:rect.y+rect.height-20})
    await test.info().attach('native-sidebar-touch-target',{body:JSON.stringify(touchTarget,null,2),contentType:'application/json'})
    expect(touchTarget.readingBody,'native swipe must start in the displayed article body').toBe(true)
    expect(touchTarget.interactive,'native swipe must avoid sticky controls and inputs').toBe(false)
    await swipe(page,cdp,rect.x+rect.width*.5,rect.y+rect.height-20,-Math.min(90,rect.height*.5))
    await expect.poll(()=>content.evaluate(el=>el.scrollTop)).toBeGreaterThan(20)
    await expect(sheet(page)).toHaveClass(/sheet-half/)
    await page.getByRole('button',{name:'展开阅读',exact:true}).click()
    await expect(sheet(page)).toHaveClass(/sheet-full/)
    const full=await sheetBounds(page)
    expect(full.x).toBeLessThanOrEqual(stage.x+16)
    expect(full.width).toBeGreaterThan(stage.width*.9)
    await expect(page.getByRole('button',{name:'主题库',exact:true})).toBeInViewport({ratio:1})
    await expect(page.getByRole('button',{name:'主题全览',exact:true})).toBeInViewport({ratio:1})
    await page.getByRole('button',{name:'返回地图与资料',exact:true}).click()
    await expect(sheet(page)).toHaveClass(/sheet-half/)
    await page.getByRole('button',{name:'收起资料面板',exact:true}).click()
    await expect(sheet(page)).toHaveClass(/sheet-peek/)
    expect((await sheetBounds(page)).width).toBeLessThanOrEqual(60)
    await expect(content).toBeHidden()
    await openThemeLibrary(page)
    await expect(page.locator('.topic-library')).toBeVisible()
    await page.screenshot({path:test.info().outputPath(`right-sidebar-${viewport.width}x${viewport.height}.png`)})
  })
  })
}
