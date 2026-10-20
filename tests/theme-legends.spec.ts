import {expect,test,type Locator,type Page} from '@playwright/test'
import {baseReady,mapSettled,renderFrames,selectedGeometry,sourceLoaded} from './map-readiness'
import {openThemeLibrary,readerExpandKey} from './theme-controls'
import {clickHeaderAction} from './header-actions'

test.use({reducedMotion:'reduce'})
test.setTimeout(120000)
let errors:string[]=[]
test.beforeEach(async({page})=>{
  errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto('/')
  await baseReady(page)
  await mapSettled(page)
})
test.afterEach(()=>expect(errors,'map and legend runtime errors').toEqual([]))

async function theme(page:Page,title:string){
  await openThemeLibrary(page)
  await page.locator('.topic-categories').getByRole('button',{name:'全部分类',exact:true}).click()
  await page.getByRole('searchbox',{name:'搜索主题和主题成员'}).fill(title)
  await page.locator('.topic-list>button').filter({has:page.getByText(title,{exact:true})}).click()
  await expect(page.locator('.topic-reader h1')).toHaveText(title)
}
async function expand(page:Page){
  const legend=page.locator('.legend.map-legend')
  await expect(legend).toBeVisible()
  const button=legend.getByRole('button',{name:'展开图例',exact:true})
  if(await button.isVisible())await button.click()
  await expect(legend).toHaveClass(/is-expanded/)
  return legend
}
async function sourceFeatures(page:Page,source:string){
  return page.evaluate(source=>{
    const data=window.__terraAtlas!.map.getSource(source)!.serialize() as {data:{features:{geometry:{type:string};properties:Record<string,unknown>}[]}}
    return data.data.features
  },source)
}
async function membersReady(page:Page,ids:string[]){
  await page.waitForFunction(ids=>{
    const atlas=window.__terraAtlas
    if(!atlas)return false
    const source=atlas.map.getSource('relations')?.serialize() as {data?:{features?:{properties:{topicMemberId?:string}}[]}}|undefined
    return ids.every(id=>source?.data?.features?.some(feature=>feature.properties.topicMemberId===id))&&atlas.map.isSourceLoaded('relations')
  },ids,{timeout:45000})
  await mapSettled(page)
}
function rgb(hex:string){
  return `rgb(${parseInt(hex.slice(1,3),16)}, ${parseInt(hex.slice(3,5),16)}, ${parseInt(hex.slice(5,7),16)})`
}
async function swatchColor(entry:Locator){
  return entry.locator('.map-legend-symbol').evaluate(element=>getComputedStyle(element).color)
}
async function closeExplorer(page:Page){
  const handle=page.getByRole('button',{name:'调整阅读面板大小',exact:true})
  if(await handle.isVisible()){
    await handle.press('Home')
    await expect(page.locator('.mobile-reading-sheet')).toHaveClass(/sheet-peek/)
    return
  }
  const close=page.getByRole('button',{name:'关闭探索面板',exact:true})
  if(await close.isVisible())await close.click()
}
async function openExplorer(page:Page){
  const handle=page.getByRole('button',{name:'调整阅读面板大小',exact:true})
  if(await handle.isVisible()){
    await handle.press('Home');await handle.press(readerExpandKey(page))
    await expect(page.locator('.mobile-reading-sheet')).toHaveClass(/sheet-half/)
    return
  }
  const open=page.getByRole('button',{name:'打开主题探索',exact:true})
  if(!await page.locator('.explorer').isVisible()&&await open.isVisible())await open.click()
}

test('theme legends: natural areas and missing geometry have matching colours and explanations',async({page})=>{
  await theme(page,'中国四大高原')
  await sourceLoaded(page,'regions')
  await membersReady(page,['tibetan-plateau','loess-plateau','inner-mongolian-plateau','yunnan-guizhou-plateau'])
  let legend=await expand(page)
  await expect(legend).toContainText('内蒙古高原目前以参考点定位')
  const features=await sourceFeatures(page,'relations')
  expect(new Set(features.map(feature=>feature.properties.topicColor)).size).toBe(4)
  for(const [id,name,type] of [['tibetan-plateau','青藏高原','area'],['loess-plateau','黄土高原','area'],['inner-mongolian-plateau','内蒙古高原','point'],['yunnan-guizhou-plateau','云贵高原','area']] as const){
    const feature=features.find(feature=>feature.properties.topicMemberId===id)!
    expect(feature).toBeTruthy()
    expect(type==='point'?feature.geometry.type==='Point':['Polygon','MultiPolygon'].includes(feature.geometry.type)).toBe(true)
    const entry=legend.locator('.map-legend-entry').filter({hasText:name}).first()
    await expect(entry.locator('.map-legend-symbol')).toHaveClass(new RegExp(`symbol-${type}`))
    expect(await swatchColor(entry)).toBe(rgb(String(feature.properties.topicColor)))
  }
  expect(await page.evaluate(()=>window.__terraAtlas!.map.getPaintProperty('relations-area','fill-color'))).toContainEqual(['get','topicColor'])

  await theme(page,'中国四大地理区')
  await membersReady(page,['northern-china','southern-china','northwestern-china','qinghai-tibet-region'])
  legend=await expand(page)
  await expect(legend).toContainText('尚未绘制区域划分面')
  expect((await sourceFeatures(page,'relations')).every(feature=>feature.geometry.type==='Point')).toBe(true)

  await theme(page,'中国34个省级行政区')
  await sourceLoaded(page,'provinces')
  await membersReady(page,['beijing','taiwan-province','macao'])
  const provinces=await sourceFeatures(page,'relations')
  expect(new Set(provinces.map(feature=>feature.properties.topicColor)).size).toBe(1)
  expect(provinces.find(feature=>feature.properties.topicMemberId==='taiwan-province')?.geometry.type).toBe('Point')
  legend=await expand(page)
  await expect(legend).toContainText('台湾省当前以参考点定位')
})

test('theme legends: energy diamonds and peak triangles agree with the actual map symbols',async({page})=>{
  await theme(page,'中国能源与矿产')
  await sourceLoaded(page,'regions')
  await membersReady(page,['qinshui-coal','hexi-renewables','three-gorges-project','qarhan-resources'])
  const legend=await expand(page),features=await sourceFeatures(page,'relations')
  const colours=[]
  for(const [id,label] of [['qinshui-coal','煤炭与煤层气案例'],['hexi-renewables','风能与太阳能案例'],['three-gorges-project','水能工程案例'],['qarhan-resources','矿产案例']] as const){
    const feature=features.find(feature=>feature.properties.topicMemberId===id)!
    expect(feature.geometry.type).toBe('Point')
    expect(feature.properties.presentationKind).toBe('port')
    expect(await page.evaluate(id=>window.__terraAtlas!.map.hasImage(id),String(feature.properties.symbolId))).toBe(true)
    const entry=legend.locator('.map-legend-entry').filter({hasText:label}).first()
    await expect(entry.locator('.map-legend-symbol')).toHaveClass(/symbol-port/)
    expect(await swatchColor(entry)).toBe(rgb(String(feature.properties.topicColor)))
    colours.push(feature.properties.topicColor)
  }
  expect(new Set(colours).size).toBe(4)
  await expect(legend).toContainText('不表示矿区范围')
  await page.getByRole('button',{name:'全球视野',exact:true}).click()
  await theme(page,'世界十四座8000米高峰')
  await sourceLoaded(page,'summits')
  await membersReady(page,['summit-everest','summit-k2','summit-shishapangma'])
  const peaks=await sourceFeatures(page,'relations')
  expect(peaks).toHaveLength(14)
  expect(peaks.every(feature=>feature.geometry.type==='Point'&&feature.properties.presentationKind==='peak')).toBe(true)
  for(const id of new Set(peaks.map(feature=>String(feature.properties.symbolId))))expect(await page.evaluate(id=>window.__terraAtlas!.map.hasImage(id),id)).toBe(true)
  await expect((await expand(page)).locator('.map-legend-entry').filter({hasText:'山峰位置'}).first().locator('.map-legend-symbol')).toHaveClass(/symbol-peak/)
  await page.screenshot({path:test.info().outputPath(`peaks-${test.info().project.name}.png`)})
})

test('theme legends: climate group and detailed modes use the same colours as their legends',async({page})=>{
  await theme(page,'长期气候分布')
  await sourceLoaded(page,'climate')
  await page.getByRole('combobox',{name:'气候展示方式'}).selectOption('groups')
  const legend=await expand(page)
  const groupPaint=await page.evaluate(()=>window.__terraAtlas!.map.getPaintProperty('climate-fill','fill-color')) as unknown[]
  for(const [code,name] of [['A','热带'],['B','干旱'],['C','温和'],['D','寒冷'],['E','极地与高寒']] as const){
    const index=groupPaint.indexOf(code)
    expect(index).toBeGreaterThan(1)
    const entry=legend.locator('.map-legend-entry').filter({hasText:name}).first()
    expect(await swatchColor(entry)).toBe(rgb(String(groupPaint[index+1])))
  }
  await page.getByRole('combobox',{name:'气候展示方式'}).selectOption('types')
  await renderFrames(page)
  expect(await page.evaluate(()=>window.__terraAtlas!.map.getPaintProperty('climate-fill','fill-color'))).toEqual(['get','color'])
  const detailed=await expand(page)
  const colours=await page.evaluate(()=>Object.fromEntries(window.__terraAtlas!.data.climate.features.map(feature=>[String(feature.properties.code),feature.properties.color])))
  for(const code of ['Af','BWh','Cfa','Dfb','ET']){
    const entry=detailed.locator('.map-legend-entry').filter({hasText:new RegExp(`^${code}\\b`)}).first()
    await expect(entry).toBeVisible()
    expect(await swatchColor(entry)).toBe(rgb(String(colours[code])))
  }
  await page.screenshot({path:test.info().outputPath(`climate-${test.info().project.name}.png`)})
})

test('theme legends: language areas, families and reference points switch and filter together',async({page})=>{
  await theme(page,'语言分布')
  await sourceLoaded(page,'language-areas')
  const mode=page.getByRole('combobox',{name:'语言展示方式'})
  await expect(mode).toHaveValue('areas')
  let legend=await expand(page)
  await expect(legend).toContainText('2007')
  await expect(legend).toContainText(/其他语言/)
  const languagePaint=await page.evaluate(()=>window.__terraAtlas!.map.getPaintProperty('language-area-fill','fill-color')) as unknown[]
  const mandarin=languagePaint.indexOf('mand1415')
  expect(mandarin).toBeGreaterThan(1)
  expect(await swatchColor(legend.locator('.map-legend-entry').filter({hasText:'官话'}).first())).toBe(rgb(String(languagePaint[mandarin+1])))
  expect(await page.evaluate(()=>window.__terraAtlas!.data['language-areas'].features.every(feature=>['Polygon','MultiPolygon'].includes(feature.geometry.type)))).toBe(true)
  await legend.getByRole('button',{name:'收起图例',exact:true}).click()
  await closeExplorer(page)
  legend=await expand(page)
  await page.screenshot({path:test.info().outputPath(`language-areas-${test.info().project.name}.png`)})
  await legend.getByRole('button',{name:'收起图例',exact:true}).click()
  await openExplorer(page)

  await mode.selectOption('families')
  await renderFrames(page)
  legend=await expand(page)
  const familyPaint=await page.evaluate(()=>window.__terraAtlas!.map.getPaintProperty('language-area-fill','fill-color')) as unknown[]
  const familyIndex=familyPaint.indexOf('sino1245')
  expect(await swatchColor(legend.locator('.map-legend-entry').filter({hasText:'汉藏语系'}).first())).toBe(rgb(String(familyPaint[familyIndex+1])))
  await page.getByRole('combobox',{name:'语言语系筛选'}).selectOption('sino1245')
  expect(JSON.stringify(await page.evaluate(()=>window.__terraAtlas!.map.getFilter('language-area-fill')))).toContain('sino1245')

  await mode.selectOption('points')
  await sourceLoaded(page,'languages')
  await renderFrames(page)
  const visibility=await page.evaluate(()=>['language-area-fill','language-dots'].map(layer=>window.__terraAtlas!.map.getLayoutProperty(layer,'visibility')))
  expect(visibility).toEqual(['none','visible'])
  expect(JSON.stringify(await page.evaluate(()=>window.__terraAtlas!.map.getFilter('language-dots')))).toContain('sino1245')
  legend=await expand(page)
  await expect(legend).toContainText(/参考点/)
  await expect(legend.locator('.map-legend-entry').filter({hasText:'汉藏语系'}).first().locator('.map-legend-symbol')).toHaveClass(/symbol-point/)
  await mode.selectOption('areas')
  await page.getByRole('combobox',{name:'语言语系筛选'}).selectOption('all')
  await page.getByRole('combobox',{name:'区域语言筛选'}).selectOption('nucl1643')
  await mode.selectOption('points')
  await renderFrames(page)
  legend=await expand(page)
  const pointPaint=await page.evaluate(()=>window.__terraAtlas!.map.getPaintProperty('language-dots','circle-color')) as unknown[]
  expect(pointPaint[0]).toBe('literal')
  expect(await swatchColor(legend.locator('.map-legend-entry').filter({hasText:'日语'}).first())).toBe(rgb(String(pointPaint[1])))
  expect(JSON.stringify(await page.evaluate(()=>window.__terraAtlas!.map.getFilter('language-dots')))).toContain('nucl1643')
})

test('theme legends: a language area can be clicked and its display survives save and share',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write'])
  await theme(page,'语言分布')
  await sourceLoaded(page,'language-areas')
  await page.getByRole('combobox',{name:'语言展示方式'}).selectOption('areas')
  await page.getByRole('combobox',{name:'语言语系筛选'}).selectOption('sino1245')
  await page.getByRole('combobox',{name:'区域语言筛选'}).selectOption('mand1415')
  await closeExplorer(page)
  await page.evaluate(()=>window.__terraAtlas!.map.jumpTo({center:[116.228,40.0209],zoom:5,padding:{top:0,bottom:0,left:0,right:0}}))
  await mapSettled(page)
  await page.waitForFunction(()=>{
    const map=window.__terraAtlas!.map
    return map.queryRenderedFeatures(map.project([116.228,40.0209]),{layers:['language-area-fill']}).some(feature=>feature.properties?.glottocode==='mand1415')
  })
  const point=await page.evaluate(()=>{const map=window.__terraAtlas!.map,point=map.project([116.228,40.0209]),rect=map.getContainer().getBoundingClientRect();return{x:point.x+rect.left,y:point.y+rect.top}})
  await page.mouse.click(point.x,point.y)
  await expect(page.locator('.knowledge-panel h2')).toHaveText('官话')
  await selectedGeometry(page)
  const saveHandle=page.getByRole('button',{name:'调整阅读面板大小',exact:true})
  if(await saveHandle.isVisible())await saveHandle.press('End')
  await page.getByRole('button',{name:'保存主题视图',exact:true}).click()
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).savedViews[0])
  expect(saved.topicId).toBe('map-language')
  expect(saved.thematic.languageMode).toBe('areas')
  expect(saved.thematic.language).toBe('sino1245')
  expect(saved.thematic.languageId).toBe('mand1415')
  await clickHeaderAction(page,'分享当前地图')
  const url=await page.evaluate(()=>navigator.clipboard.readText())
  await page.goto(url)
  await baseReady(page)
  await sourceLoaded(page,'language-areas')
  await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id','map-language')
  await expect(page.locator('.knowledge-panel h2')).toHaveText('官话')
  const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).thematic)
  expect(restored.languageMode).toBe('areas')
  expect(restored.language).toBe('sino1245')
  expect(restored.languageId).toBe('mand1415')
  await selectedGeometry(page)
})

test('theme legends: mobile expanded search, collapse and Escape retain usable map space',async({page},info)=>{
  test.skip(!info.project.name.startsWith('mobile'),'mobile legend layout')
  await theme(page,'长期气候分布')
  await sourceLoaded(page,'climate')
  await page.getByRole('combobox',{name:'气候展示方式'}).selectOption('types')
  await closeExplorer(page)
  const legend=await expand(page)
  const search=legend.getByRole('textbox',{name:'搜索图例'})
  await expect(search).toBeVisible()
  await search.fill('Af')
  await expect(legend.locator('.map-legend-entry').filter({hasText:/^Af\b/})).toHaveCount(1)
  await search.fill('不存在的类别')
  await expect(legend).toContainText('没有找到对应的图例')
  await search.fill('')
  const box=await legend.boundingBox(),viewport=page.viewportSize()!
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x+box!.width).toBeLessThanOrEqual(viewport.width)
  expect(box!.y).toBeGreaterThanOrEqual((await page.locator('.map-stage').boundingBox())!.y)
  expect(box!.y+box!.height).toBeLessThanOrEqual(viewport.height)
  await page.keyboard.press('Escape')
  await expect(legend).not.toHaveClass(/is-expanded/)
  await expect(legend.getByRole('button',{name:'展开图例',exact:true})).toBeFocused()
  await expand(page)
  await legend.getByRole('button',{name:'收起图例',exact:true}).click()
  await expect(legend).not.toHaveClass(/is-expanded/)
  await openExplorer(page)
  await page.getByRole('button',{name:'调整阅读面板大小',exact:true}).press('Home')
  await page.getByRole('button',{name:'调整阅读面板大小',exact:true}).press(readerExpandKey(page))
  await expect(page.locator('.explorer')).toHaveClass(/topic-active.*sheet-half/)
  await renderFrames(page)
  const panel=await page.locator('.explorer').boundingBox(),collapsed=await legend.boundingBox()
  await test.info().attach('mobile-layout-bounds',{body:JSON.stringify({panel,legend:collapsed}),contentType:'application/json'})
  expect(panel!.x+panel!.width<=collapsed!.x+2||collapsed!.x+collapsed!.width<=panel!.x+2||panel!.y+panel!.height<=collapsed!.y+2||collapsed!.y+collapsed!.height<=panel!.y+2).toBe(true)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true)
  await page.screenshot({path:test.info().outputPath('mobile-theme-legend.png')})
  await page.setViewportSize({width:390,height:667})
  await clickHeaderAction(page,'打开收藏')
  await page.getByRole('button',{name:'保存命名地图视图',exact:true}).click()
  await page.getByRole('button',{name:'关闭探索面板',exact:true}).click()
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).savedViews.length)).toBe(1)
  await page.context().grantPermissions(['clipboard-read','clipboard-write'])
  await clickHeaderAction(page,'分享当前地图')
  await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toContain('topic=map-climate')
  await page.screenshot({path:test.info().outputPath('mobile-short-theme-toolbar.png')})
})
