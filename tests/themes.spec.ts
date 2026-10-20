import {expect,test,type Page} from '@playwright/test'
import {baseReady,mapSettled,selectedGeometry,sourceLoaded} from './map-readiness'
import {chooseTheme,openThemeLibrary,readerCollapseKey,readerExpandKey} from './theme-controls'
import {clickHeaderAction} from './header-actions'

let errors:string[]=[]
test.beforeEach(async({page})=>{
  errors=[];page.on('pageerror',error=>errors.push(error.message))
  await page.goto('/');await baseReady(page);await mapSettled(page)
})
test.afterEach(()=>expect(errors,'theme runtime errors').toEqual([]))
test.setTimeout(90000)
async function relations(page:Page,count:number){
  await page.waitForFunction(count=>{const atlas=window.__terraAtlas!,data=atlas.map.getSource('relation-labels')!.serialize() as {data:{features:unknown[]}};return data.data.features.length===count&&atlas.map.isSourceLoaded('relations')&&atlas.map.isSourceLoaded('relation-labels')},count,{timeout:45000})
  await mapSettled(page)
}
async function library(page:Page){
  await openThemeLibrary(page)
}
async function clickPlace(page:Page,coordinates:[number,number]){
  await page.evaluate(coordinates=>window.__terraAtlas!.map.jumpTo({center:coordinates,zoom:5}),coordinates)
  await mapSettled(page)
  const point=await page.evaluate(coordinates=>{const map=window.__terraAtlas!.map,p=map.project(coordinates),r=map.getContainer().getBoundingClientRect();return{x:p.x+r.left,y:p.y+r.top}},coordinates)
  await page.mouse.click(point.x,point.y)
}

test('themes: scope and geography categories organize one shared library',async({page},info)=>{
  await library(page)
  await expect(page.getByRole('button',{name:'全部主题',exact:true})).toHaveAttribute('aria-pressed','true')
  await expect(page.locator('.topic-list>button').filter({hasText:'中国四大高原'})).toHaveCount(1)
  await expect(page.locator('.topic-list>button').filter({hasText:'世界十四座8000米高峰'})).toHaveCount(1)
  await page.screenshot({path:test.info().outputPath('library-all-'+info.project.name+'.png')})
  const before=await page.evaluate(()=>({center:window.__terraAtlas!.map.getCenter().toArray(),zoom:window.__terraAtlas!.map.getZoom()}))
  await page.getByRole('button',{name:'中国地理',exact:true}).click()
  const after=await page.evaluate(()=>({center:window.__terraAtlas!.map.getCenter().toArray(),zoom:window.__terraAtlas!.map.getZoom()}))
  expect(after).toEqual(before)
  await expect(page.locator('.topic-list>button').filter({hasText:'世界十四座8000米高峰'})).toHaveCount(0)
  await page.getByRole('button',{name:'人口文化',exact:true}).click()
  await expect(page.locator('.topic-list>button').filter({hasText:'人口密度分布'})).toHaveCount(1)
  await expect(page.locator('.topic-list>button').filter({hasText:'中国四大高原'})).toHaveCount(0)
  await page.getByRole('button',{name:'全球视野',exact:true}).click()
  await expect(page.getByRole('button',{name:'中国地理',exact:true})).toHaveAttribute('aria-pressed','true')
  await expect(page.locator('.topic-result-count')).toContainText('中国地理 · 人口文化')
  await page.getByRole('button',{name:'世界地理',exact:true}).click()
  await expect(page.locator('.topic-list>button').filter({hasText:'人口密度分布'})).toHaveCount(1)
  await page.getByRole('button',{name:'地形地貌',exact:true}).click()
  await expect(page.locator('.topic-list>button').filter({hasText:'世界十四座8000米高峰'})).toHaveCount(1)
  await expect(page.locator('.topic-list>button').filter({hasText:'中国四大高原'})).toHaveCount(0)
  await mapSettled(page)
  await page.screenshot({path:test.info().outputPath('library-'+info.project.name+'.png')})
})

test('themes: scope, category and search survive reading, tab changes and browser Back',async({page})=>{
  await library(page)
  await page.getByRole('button',{name:'中国地理',exact:true}).click()
  await page.getByRole('button',{name:'地形地貌',exact:true}).click()
  const search=page.getByRole('searchbox',{name:'搜索主题和主题成员'})
  await search.fill('高原')
  await page.locator('.topic-list>button').filter({hasText:'中国四大高原'}).click()
  await page.getByRole('button',{name:'主题库',exact:true}).click()
  await expect(search).toHaveValue('高原')
  await expect(page.getByRole('button',{name:'中国地理',exact:true})).toHaveAttribute('aria-pressed','true')
  await expect(page.getByRole('button',{name:'地形地貌',exact:true})).toHaveAttribute('aria-pressed','true')
  const close=page.getByRole('button',{name:'关闭探索面板',exact:true})
  if(await close.isVisible())await close.click()
  await page.getByRole('button',{name:'打开图层面板',exact:true}).click()
  await library(page)
  await expect(search).toHaveValue('高原')
  await expect(page.getByRole('button',{name:'中国地理',exact:true})).toHaveAttribute('aria-pressed','true')
  await page.locator('.topic-list>button').filter({hasText:'中国四大高原'}).click()
  await page.goBack()
  await expect(page.locator('.topic-library')).toBeVisible()
  await expect(search).toHaveValue('高原')
  await expect(page.getByRole('button',{name:'地形地貌',exact:true})).toHaveAttribute('aria-pressed','true')
})

test('themes: empty scoped search can return to every theme',async({page})=>{
  await library(page)
  await page.getByRole('button',{name:'中国地理',exact:true}).click()
  await page.getByRole('button',{name:'地形地貌',exact:true}).click()
  await page.getByRole('searchbox',{name:'搜索主题和主题成员'}).fill('世界十四座8000米高峰')
  await expect(page.locator('.topic-empty')).toBeVisible()
  await page.getByRole('button',{name:'查看全部主题',exact:true}).click()
  await expect(page.getByRole('button',{name:'全部主题',exact:true})).toHaveAttribute('aria-pressed','true')
  await expect(page.getByRole('button',{name:'全部分类',exact:true})).toHaveAttribute('aria-pressed','true')
  await expect(page.getByRole('searchbox',{name:'搜索主题和主题成员'})).toHaveValue('')
  await expect(page.locator('.topic-list>button')).toHaveCount(40)
})

test('themes: all four distribution themes replace each other and preserve the viewport',async({page})=>{
  const before=await page.evaluate(()=>({center:window.__terraAtlas!.map.getCenter().toArray(),zoom:window.__terraAtlas!.map.getZoom()}))
  for(const [title,overlay,source] of [['人口密度分布','population','population-raster'],['国家宗教构成','religion','religion'],['语言分布','language','language-areas'],['长期气候分布','climate','climate']] as const){
    await chooseTheme(page,title)
    if(overlay!=='population')await sourceLoaded(page,source)
    else await page.waitForFunction(()=>window.__terraAtlas!.map.isSourceLoaded('population-raster'))
    await relations(page,0)
    const state=await page.evaluate(()=>({preferences:JSON.parse(localStorage.getItem('terra-atlas-v1')!),center:window.__terraAtlas!.map.getCenter().toArray(),zoom:window.__terraAtlas!.map.getZoom(),visible:Object.fromEntries(['climate-fill','population-raster','religion-fill','language-area-fill'].map(id=>[id,window.__terraAtlas!.map.getLayoutProperty(id,'visibility')]))}))
    expect(['climate','population','religion','language'].filter(key=>state.preferences.layers[key])).toEqual([overlay])
    expect(state.preferences.topicId).toBe('map-'+overlay)
    expect(state.zoom).toBeCloseTo(before.zoom,5);state.center.forEach((coordinate,index)=>expect(coordinate).toBeCloseTo(before.center[index],5))
    expect(Object.values(state.visible).filter(value=>value==='visible')).toHaveLength(1)
  }
})

test('themes: collection members remain visible when a member is read and clicked on the map',async({page},info)=>{
  await chooseTheme(page,'中国四大高原');await sourceLoaded(page,'regions');await relations(page,4)
  await page.locator('.topic-members').getByRole('button',{name:/内蒙古高原/}).click()
  await selectedGeometry(page)
  await expect(page.locator('.knowledge-panel')).toHaveClass(/embedded/)
  const point=await page.evaluate(()=>window.__terraAtlas!.map.getSource('selection')!.serialize() as {data:{features:{geometry:{type:string}}[]}})
  expect(point.data.features).toHaveLength(1);expect(point.data.features[0].geometry.type).toBe('Point')
  await expect(page.locator('.knowledge-panel')).toContainText('不将整个蒙古高原')
  await relations(page,4)
  await page.getByRole('combobox',{name:'切换主题成员'}).selectOption('loess-plateau');await selectedGeometry(page)
  await page.getByRole('button',{name:'主题全览',exact:true}).click();await relations(page,4)
  await clickPlace(page,[107.7,36.7])
  await expect(page.locator('.knowledge-panel h2')).toHaveText('黄土高原');await selectedGeometry(page)
  await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id','china-plateaus')
  await page.screenshot({path:test.info().outputPath('plateau-member-'+info.project.name+'.png')})
  await page.getByRole('button',{name:'主题库',exact:true}).click()
  await page.locator('.topic-list>button').filter({hasText:'中国四大盆地'}).click();await relations(page,4)
  const ids=await page.evaluate(()=>{const source=window.__terraAtlas!.map.getSource('relation-labels')!.serialize() as {data:{features:{properties:{id:string}}[]}};return source.data.features.map(feature=>feature.properties.id)})
  expect(ids).toEqual(['tarim-basin','junggar-basin','qaidam-basin','sichuan-basin'])
})

test('themes: the plains use three commonly grouped plains and keep unmatched geometry as a reference point',async({page})=>{
  await chooseTheme(page,'中国主要平原');await relations(page,3)
  await expect(page.locator('.topic-reader')).toContainText('三大平原')
  await page.locator('.topic-members').getByRole('button',{name:/长江中下游平原/}).click();await selectedGeometry(page)
  const source=await page.evaluate(()=>window.__terraAtlas!.map.getSource('selection')!.serialize() as {data:{features:{geometry:{type:string}}[]}})
  expect(source.data.features).toHaveLength(1);expect(source.data.features[0].geometry.type).toBe('Point')
  await expect(page.locator('.knowledge-panel')).toContainText('未把长江三角洲或沿江省区当作全部平原边界')
})

test('themes: fourteen real summit points display and a summit selection keeps the group',async({page},info)=>{
  await page.getByRole('button',{name:'全球视野',exact:true}).click()
  await chooseTheme(page,'世界十四座8000米高峰');await sourceLoaded(page,'summits');await relations(page,14)
  const features=await page.evaluate(()=>window.__terraAtlas!.data.summits.features)
  expect(features).toHaveLength(14);expect(new Set(features.map(feature=>feature.properties.id)).size).toBe(14)
  expect(features.every(feature=>feature.geometry.type==='Point'&&feature.properties.id.startsWith('peak-wikidata-'))).toBe(true)
  await page.locator('.topic-members').getByRole('button',{name:/乔戈里峰/}).click();await selectedGeometry(page)
  await expect(page.locator('.knowledge-panel h2')).toContainText('乔戈里峰')
  const selection=await page.evaluate(()=>window.__terraAtlas!.map.getSource('selection')!.serialize())
  expect(JSON.stringify(selection)).toContain('peak-wikidata-q43512');await relations(page,14)
  await page.screenshot({path:test.info().outputPath('summit-member-'+info.project.name+'.png')})
})

test('themes: saved views, reload and share restore the theme, member and camera',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write'])
  await chooseTheme(page,'中国四大盆地');await relations(page,4)
  await page.locator('.topic-members').getByRole('button',{name:/柴达木盆地/}).click();await selectedGeometry(page)
  const saveHandle=page.getByRole('button',{name:'调整阅读面板大小',exact:true})
  if(await saveHandle.isVisible())await saveHandle.press('End')
  await page.getByRole('button',{name:'保存主题视图',exact:true}).click()
  const expected=await page.evaluate(()=>({center:window.__terraAtlas!.map.getCenter().toArray(),zoom:window.__terraAtlas!.map.getZoom()}))
  await clickHeaderAction(page,'分享当前地图')
  const url=await page.evaluate(()=>navigator.clipboard.readText())
  expect(new URL(url).hash).toContain('topic=china-basins')
  const handle=page.getByRole('button',{name:'调整阅读面板大小',exact:true})
  if(await handle.isVisible())await handle.press('End')
  await page.getByRole('button',{name:'退出主题',exact:true}).click()
  await clickHeaderAction(page,'打开收藏')
  await page.locator('.saved-list').nth(1).getByRole('button',{name:'中国 · 柴达木盆地',exact:true}).click()
  await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id','china-basins');await selectedGeometry(page);await relations(page,4)
  expect(await page.evaluate(()=>window.__terraAtlas!.map.getZoom())).toBeCloseTo(expected.zoom,5)
  await page.reload();await baseReady(page);await relations(page,4)
  await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id','china-basins')
  await page.goto(url);await baseReady(page);await selectedGeometry(page);await relations(page,4)
  await expect(page.locator('.knowledge-panel h2')).toHaveText('柴达木盆地')
  const actual=await page.evaluate(()=>({center:window.__terraAtlas!.map.getCenter().toArray(),zoom:window.__terraAtlas!.map.getZoom()}))
  expect(actual.zoom).toBeCloseTo(expected.zoom,2);actual.center.forEach((coordinate,index)=>expect(coordinate).toBeCloseTo(expected.center[index],3))
})

test('themes: an old language and religion view restores one theme and an exact camera',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('terra-atlas-v1',JSON.stringify({favorites:['yangtze'],layers:{terrain:true,borders:true,religion:true,language:true},camera:{center:[105,33],zoom:4.25},view:'china'})))
  await page.reload();await baseReady(page);await sourceLoaded(page,'religion');await relations(page,0)
  await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id','map-religion')
  expect(await page.evaluate(()=>window.__terraAtlas!.map.getZoom())).toBe(4.25)
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!))
  expect(state.favorites).toEqual(['yangtze']);expect(state.layers.language).toBe(false)
})

test('themes: a delayed collection load cannot restore the previous theme or move the new distribution view',async({page})=>{
  let release!:()=>void,requested!:()=>void
  const gate=new Promise<void>(resolve=>{release=resolve}),request=new Promise<void>(resolve=>{requested=resolve})
  await page.route('**/data/regions.geojson',async route=>{requested();await gate;await route.continue()})
  try{
    await page.reload();await baseReady(page);await request
    await chooseTheme(page,'中国四大高原')
    await chooseTheme(page,'人口密度分布')
    const camera=await page.evaluate(()=>({center:window.__terraAtlas!.map.getCenter().toArray(),zoom:window.__terraAtlas!.map.getZoom()}))
    release();await sourceLoaded(page,'regions');await relations(page,0)
    await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id','map-population')
    const after=await page.evaluate(()=>({center:window.__terraAtlas!.map.getCenter().toArray(),zoom:window.__terraAtlas!.map.getZoom()}))
    expect(after.zoom).toBeCloseTo(camera.zoom,5);after.center.forEach((coordinate,index)=>expect(coordinate).toBeCloseTo(camera.center[index],5))
  }finally{release()}
})

test('themes: map positioning wins over a delayed theme fit while preserving its members',async({page})=>{
  let release!:()=>void,requested!:()=>void
  const gate=new Promise<void>(resolve=>{release=resolve}),request=new Promise<void>(resolve=>{requested=resolve})
  await page.route('**/data/regions.geojson',async route=>{requested();await gate;await route.continue()})
  try{
    await page.reload();await baseReady(page);await request
    await chooseTheme(page,'中国四大高原')
    await page.getByRole('button',{name:'全球视野',exact:true}).click();await mapSettled(page)
    const before=await page.evaluate(()=>({center:window.__terraAtlas!.map.getCenter().toArray(),zoom:window.__terraAtlas!.map.getZoom()}))
    release();await sourceLoaded(page,'regions');await relations(page,4)
    await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id','china-plateaus')
    const after=await page.evaluate(()=>({center:window.__terraAtlas!.map.getCenter().toArray(),zoom:window.__terraAtlas!.map.getZoom()}))
    expect(after.zoom).toBeCloseTo(before.zoom,5);after.center.forEach((coordinate,index)=>expect(coordinate).toBeCloseTo(before.center[index],5))
  }finally{release()}
})

test('themes: mobile reading heights offer a compact map view and cover the map for reading',async({page},info)=>{
  test.skip(!info.project.name.startsWith('mobile'),'mobile theme sheet controls')
  await chooseTheme(page,'中国四大高原');await relations(page,4)
  const handle=page.getByRole('button',{name:'调整阅读面板大小',exact:true})
  const horizontal=page.viewportSize()!.width>page.viewportSize()!.height
  for(const [key,cls] of [['Home','sheet-peek'],[readerExpandKey(page),'sheet-half'],['End','sheet-full']] as const){
    await handle.press(key)
    await expect(page.locator('.explorer')).toHaveClass(new RegExp(cls))
    const panel=(await page.locator('.explorer').boundingBox())!,stage=(await page.locator('.map-stage').boundingBox())!
    expect(panel.y+panel.height).toBeLessThanOrEqual(stage.y+stage.height+2)
    if(cls==='sheet-peek')expect(horizontal?panel.width:panel.height).toBeLessThanOrEqual(60)
    if(cls==='sheet-full'){expect(panel.y).toBeLessThanOrEqual(stage.y+10);expect(panel.height).toBeGreaterThan(stage.height*.85);await expect(page.locator('.legend')).toBeHidden()}
  }
  await handle.press(readerCollapseKey(page))
  await page.locator('.topic-members').getByRole('button',{name:/黄土高原/}).click();await selectedGeometry(page)
  await handle.press('Home');await mapSettled(page)
  const point=await page.evaluate(()=>{const map=window.__terraAtlas!.map,p=map.project([107.7,36.7]),rect=map.getContainer().getBoundingClientRect(),panel=document.querySelector('.explorer')!.getBoundingClientRect();return{x:p.x+rect.left,y:p.y+rect.top,panelLeft:panel.left,panelTop:panel.top}})
  if(horizontal)expect(point.x).toBeLessThan(point.panelLeft)
  else expect(point.y).toBeLessThan(point.panelTop)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true)
  await page.screenshot({path:test.info().outputPath('mobile-theme-sheet.png')})
})
