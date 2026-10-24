import {expect,test,type Page} from '@playwright/test'
import {baseReady,mapSettled,renderFrames,selectedGeometry} from './map-readiness'
import {chooseTheme,readerExpandKey} from './theme-controls'
import {clickHeaderAction} from './header-actions'

const explorer=(page:Page)=>page.locator('.explorer')
const themeEntry=(page:Page)=>page.getByRole('button',{name:'打开主题探索',exact:true})
const layerEntry=(page:Page)=>page.getByRole('button',{name:'打开图层面板',exact:true})
const close=(page:Page)=>page.getByRole('button',{name:'关闭探索面板',exact:true})
const settings=(page:Page)=>page.getByRole('complementary',{name:'图层与底图',exact:true})
const closeSettings=(page:Page)=>page.getByRole('button',{name:'关闭图层面板',exact:true})
let errors:string[]=[]

test.setTimeout(90000)
test.beforeEach(async({page},info)=>{
  test.skip(!info.project.name.startsWith('mobile'),'separate mobile exploration entries')
  errors=[];page.on('pageerror',error=>errors.push(error.message))
  await page.goto('/');await baseReady(page);await mapSettled(page)
})
test.afterEach(()=>expect(errors,'mobile exploration runtime errors').toEqual([]))

async function explorerSettled(page:Page){
  await renderFrames(page)
  await expect.poll(()=>explorer(page).evaluate(element=>element.getAnimations().filter(animation=>animation.playState==='running').length)).toBe(0)
  await renderFrames(page)
}

test('mobile exploration and layer settings have independent entries',async({page},info)=>{
  await expect(themeEntry(page)).toHaveText('继续随便看看')
  await expect(themeEntry(page)).toBeInViewport({ratio:1})
  await expect(layerEntry(page)).toBeInViewport({ratio:1})
  await themeEntry(page).click()
  await expect(page.locator('.discovery-panel')).toBeVisible()
  await expect(explorer(page).locator('.panel-tabs').getByRole('button',{name:'图层',exact:true})).toHaveCount(0)
  await close(page).click()
  await layerEntry(page).click()
  await expect(settings(page)).toBeVisible()
  await expect(explorer(page)).not.toBeVisible()
  await expect(page.getByRole('button',{name:'自然地理底图',exact:true})).toBeInViewport({ratio:1})
  await expect(page.getByRole('checkbox',{name:'三维地形',exact:true})).toBeInViewport({ratio:1})
  await expect(themeEntry(page)).toBeHidden()
  await renderFrames(page)
  const panel=(await settings(page).boundingBox())!,stage=(await page.locator('.map-stage').boundingBox())!
  expect(panel.x).toBeGreaterThanOrEqual(stage.x)
  expect(panel.y).toBeGreaterThanOrEqual(stage.y)
  expect(panel.x+panel.width).toBeLessThanOrEqual(stage.x+stage.width)
  expect(panel.y+panel.height).toBeLessThanOrEqual(stage.y+stage.height)
  expect(panel.width*panel.height,'settings leave a substantial map preview').toBeLessThan(stage.width*stage.height*.8)
  await closeSettings(page).click()
  await expect(layerEntry(page)).toBeFocused()
  await themeEntry(page).click()
  await expect(page.locator('.discovery-panel')).toBeVisible()
  await close(page).click();await layerEntry(page).click()
  await expect(settings(page)).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true)
  await page.screenshot({path:test.info().outputPath('separate-exploration-'+info.project.name+'.png')})
})

test('mobile layer changes preview on an interactive map while settings remain open',async({page},info)=>{
  await layerEntry(page).click()
  await page.getByRole('checkbox',{name:'经纬网图层',exact:true}).check()
  await mapSettled(page)
  await expect.poll(()=>page.evaluate(()=>window.__terraAtlas!.map.queryRenderedFeatures(undefined,{layers:['grid-lines']}).length)).toBeGreaterThan(0)
  const target=await page.evaluate(()=>{
    const canvas=window.__terraAtlas!.map.getCanvas(),rect=canvas.getBoundingClientRect()
    // Find actual map input space; panel placement differs between orientations.
    for(let y=rect.top+45;y<rect.bottom-45;y+=35)for(let x=rect.left+45;x<rect.right-85;x+=35)
      if([[0,0],[-30,-30],[65,30]].every(([dx,dy])=>document.elementFromPoint(x+dx,y+dy)===canvas))return{x,y}
    return null
  })
  expect(target,'settings leave a real map drag target').not.toBeNull()
  const before=await page.evaluate(()=>window.__terraAtlas!.map.getCenter().toArray())
  await page.mouse.move(target!.x,target!.y);await page.mouse.down()
  await page.mouse.move(target!.x+65,target!.y+25,{steps:8});await page.mouse.up()
  await expect.poll(()=>page.evaluate(()=>window.__terraAtlas!.map.getCenter().toArray())).not.toEqual(before)
  await mapSettled(page)
  await expect(settings(page)).toBeVisible()
  await expect(page.getByRole('checkbox',{name:'经纬网图层',exact:true})).toBeChecked()
  await expect.poll(()=>page.evaluate(()=>window.__terraAtlas!.map.getLayoutProperty('grid-lines','visibility'))).toBe('visible')
  await explorerSettled(page)
  await page.screenshot({path:test.info().outputPath('layer-map-preview-'+info.project.name+'.png')})
})

test('mobile settings and a closed reader preserve the current theme member and reading size',async({page})=>{
  await chooseTheme(page,'中国四大高原')
  await page.locator('.topic-members').getByRole('button',{name:/黄土高原/}).click()
  await selectedGeometry(page)
  const handle=page.getByRole('button',{name:'调整阅读面板大小',exact:true})
  await handle.press('Home')
  await expect(explorer(page)).toHaveClass(/sheet-peek/)
  await expect(themeEntry(page)).toBeHidden()
  await layerEntry(page).click()
  await expect(settings(page)).toBeVisible()
  await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id','china-plateaus')
  await closeSettings(page).click()
  await expect(explorer(page)).toHaveClass(/topic-active.*sheet-peek/)
  await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id','china-plateaus')
  await handle.press(readerExpandKey(page))
  await expect(page.locator('.knowledge-panel h2')).toHaveText('黄土高原')
  await expect(page.locator('.knowledge-panel h2')).toBeVisible()
  await page.getByRole('button',{name:'主题库',exact:true}).click()
  await expect(page.locator('.topic-library')).toBeVisible()
  await close(page).click()
  await expect(explorer(page)).not.toBeVisible()
  await expect(themeEntry(page)).toContainText('继续探索')
  await expect(themeEntry(page)).toContainText('中国四大高原')
  await themeEntry(page).click()
  await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id','china-plateaus')
  await expect(page.locator('.knowledge-panel h2')).toHaveText('黄土高原')
  await expect(explorer(page)).toHaveClass(/sheet-half/)
  await expect(themeEntry(page)).toBeHidden()
  await page.getByRole('button',{name:'主题库',exact:true}).click()
  await expect(page.locator('.topic-library')).toBeVisible()
  await expect(page.locator('.topic-resume')).toContainText('中国四大高原')
  await page.locator('.topic-resume').click()
  await expect(page.locator('.topic-reader h1')).toHaveText('中国四大高原')
  await expect(explorer(page)).toHaveClass(/sheet-half/)
})

test('mobile layers preserve the paragraph being read when settings close before and after rotation',async({page})=>{
  await chooseTheme(page,'中国四大高原')
  await explorerSettled(page)
  await page.getByText('展开主题介绍',{exact:true}).click()
  const paragraph=page.locator('.topic-explanation .reading-section p').nth(1)
  const text=await paragraph.innerText()
  await paragraph.evaluate(element=>{
    const scroll=element.closest<HTMLElement>('.explorer-scroll')!,box=scroll.getBoundingClientRect()
    const nav=scroll.querySelector<HTMLElement>('.topic-sticky-nav')!,navigation=nav.getBoundingClientRect()
    const edge=getComputedStyle(nav).position==='sticky'?Math.max(box.top,navigation.bottom):box.top
    const rect=element.getBoundingClientRect()
    scroll.scrollTop+=rect.top-edge+rect.height/3
  })
  await renderFrames(page)
  const position=()=>paragraph.evaluate(element=>{
    const scroll=element.closest<HTMLElement>('.explorer-scroll')!,box=scroll.getBoundingClientRect()
    const nav=scroll.querySelector<HTMLElement>('.topic-sticky-nav')!,navigation=nav.getBoundingClientRect()
    const edge=getComputedStyle(nav).position==='sticky'?Math.max(box.top,navigation.bottom):box.top
    const rect=element.getBoundingClientRect()
    return{edge,top:rect.top,bottom:rect.bottom,height:rect.height,progress:(edge-rect.top)/rect.height,readingBottom:box.bottom}
  })
  const initial=await position()
  expect(initial.progress).toBeCloseTo(1/3,1)
  await expect(paragraph).toBeInViewport()
  const retained=async()=>{
    await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id','china-plateaus')
    await expect(explorer(page)).toHaveClass(/sheet-half/)
    await explorerSettled(page)
    await expect(paragraph).toHaveText(text)
    await expect(paragraph).toBeInViewport()
    await expect.poll(async()=>{
      const current=await position()
      return Math.abs(current.edge-current.top-initial.progress*current.height)
    },{message:'the same paragraph and its already-read fraction return to the reading edge'}).toBeLessThanOrEqual(24)
    const current=await position()
    expect(current.bottom,'unread text remains below the reading edge').toBeGreaterThan(current.edge)
    expect(current.top).toBeLessThan(current.readingBottom)
  }
  await layerEntry(page).click()
  await expect(settings(page)).toBeVisible()
  await renderFrames(page)
  await closeSettings(page).click()
  await retained()
  const original=page.viewportSize()!
  await layerEntry(page).click()
  await expect(settings(page)).toBeVisible()
  await page.setViewportSize(original.width>original.height?{width:390,height:844}:{width:844,height:390})
  await explorerSettled(page)
  await expect(closeSettings(page)).toBeInViewport({ratio:1})
  await closeSettings(page).click()
  await retained()
})

test('mobile settings return keyboard focus to the toolbar after resizing to desktop',async({page})=>{
  await chooseTheme(page,'中国四大高原')
  await layerEntry(page).click()
  await expect(settings(page)).toBeVisible()
  await page.setViewportSize({width:1440,height:950})
  await explorerSettled(page)
  await expect(layerEntry(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.topic-reader h1')).toHaveText('中国四大高原')
  await expect(layerEntry(page)).toBeInViewport({ratio:1})
  await expect(layerEntry(page)).toBeFocused()
  expect(await page.evaluate(()=>{
    const element=document.activeElement
    return element instanceof HTMLElement&&element.getClientRects().length>0&&getComputedStyle(element).visibility!=='hidden'
  }),'Escape restores focus to a control that is still visible').toBe(true)
})

test('mobile theme entry yields space to place cards and comparison',async({page})=>{
  await page.getByRole('combobox',{name:'搜索地理对象',exact:true}).fill('长江')
  await page.locator('.search-results>button').first().click();await selectedGeometry(page)
  await expect(themeEntry(page)).toBeHidden()
  await page.getByRole('button',{name:'关闭知识卡片',exact:true}).click()
  await expect(themeEntry(page)).toBeVisible()
  await clickHeaderAction(page,'打开两地对比')
  await expect(page.locator('.compare-panel')).toBeVisible()
  await expect(themeEntry(page)).toBeHidden()
  await page.getByRole('button',{name:'关闭对比',exact:true}).click()
  await expect(themeEntry(page)).toBeVisible()
})


test('layer settings remain usable when a full reader rotates through desktop',async({page})=>{
  await chooseTheme(page,'中国四大高原')
  const handle=page.getByRole('button',{name:'调整阅读面板大小',exact:true})
  await handle.press('End')
  const original=page.viewportSize()!
  await page.setViewportSize({width:1440,height:950})
  await layerEntry(page).click()
  await page.setViewportSize(original)
  await expect(closeSettings(page)).toBeInViewport({ratio:1})
  await expect(page.locator('.map-tools')).not.toHaveAttribute('inert')
  await closeSettings(page).click()
  await expect(explorer(page)).toHaveClass(/sheet-full/)
  await expect(handle).toBeFocused()
  await handle.press('Home')
  await expect(layerEntry(page)).toBeVisible()
})
