import {chooseTheme,readerExpandKey} from './theme-controls'
import {clickHeaderAction} from './header-actions'
import {test,expect,type Page} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {baseReady,mapSettled,renderFrames,selectedGeometry,sourceLoaded} from './map-readiness'

type Coordinate=[number,number]
let errors:string[]=[]
let foreign:string[]=[]
let requested:string[]=[]
test.beforeEach(async({page})=>{
  errors=[];foreign=[];requested=[]
  page.on('pageerror',error=>errors.push(error.message))
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
  page.on('request',request=>{const url=new URL(request.url());requested.push(url.pathname)})
  await page.route('**/*',route=>{
    const url=new URL(route.request().url()),base=new URL(test.info().project.use.baseURL as string||process.env.SITE_URL||'http://127.0.0.1:4176')
    if(url.origin!==base.origin&&/^https?:/.test(url.protocol)){foreign.push(url.href);return route.abort()}
    return route.continue()
  })
  await page.goto('/')
  await baseReady(page)
})
test.afterEach(async()=>{expect(errors,'browser runtime errors').toEqual([]);expect(foreign,'third-party resources requested by the learning interface').toEqual([])})
test.setTimeout(90000)

async function openLayers(page:Page){const button=page.getByRole('button',{name:'打开图层面板',exact:true});if(await button.isVisible())await button.click()}
async function closeLayers(page:Page){
  const settings=page.getByRole('button',{name:'关闭图层面板',exact:true});if(await settings.isVisible())await settings.click()
  const button=page.getByRole('button',{name:'关闭探索面板',exact:true});if(await button.isVisible())await button.click()
  const handle=page.getByRole('button',{name:'调整阅读面板大小',exact:true})
  if(await handle.isVisible())await handle.press('Home')
}
async function select(page:Page,name:string){
  await page.getByRole('combobox',{name:'搜索地理对象'}).fill(name)
  await page.locator('.search-results>button').first().click()
  await expect(page.locator('.knowledge-panel')).toBeVisible()
  await selectedGeometry(page)
}
async function clickCoordinate(page:Page,coordinates:Coordinate,zoom=5){
  const measuring=await page.locator('.measurement-panel').isVisible()
  await page.evaluate(({coordinates,zoom,measuring})=>{
    const map=window.__terraAtlas!.map,rect=map.getContainer().getBoundingClientRect()
    const measurement=measuring?document.querySelector('.measurement-panel')?.getBoundingClientRect():null
    // Center measurement targets in the real map space above its floating results.
    const bottom=measurement?Math.min(Math.max(0,rect.bottom-measurement.top+12),Math.max(0,rect.height-80)):0
    map.jumpTo({center:coordinates,zoom,padding:{top:0,bottom,left:0,right:0}})
  },{coordinates,zoom,measuring})
  await mapSettled(page)
  const target=await page.evaluate(coordinates=>{
    const map=window.__terraAtlas!.map,point=map.project(coordinates),rect=map.getContainer().getBoundingClientRect()
    const x=point.x+rect.left,y=point.y+rect.top
    return{x,y,canvas:document.elementFromPoint(x,y)===map.getCanvas()}
  },coordinates)
  if(measuring)expect(target.canvas,'measurement coordinates must hit the real map canvas').toBe(true)
  await page.mouse.click(target.x,target.y)
}
async function probe(page:Page,coordinates:Coordinate){
  const close=page.getByRole('button',{name:'关闭点查',exact:true});if(await close.isVisible())await close.click()
  const tool=page.getByRole('button',{name:'位置点查工具',exact:true})
  if(await tool.getAttribute('aria-pressed')!=='true')await tool.click()
  await expect(tool).toHaveAttribute('aria-pressed','true')
  await clickCoordinate(page,coordinates,4)
  await expect(page.locator('.probe-panel')).toBeVisible()
}

// Exercise the displayed product and real local source data, not a mocked map.
test('learning: local human layers render, filter real language points, and preserve unknown religion',async({page},info)=>{
  expect(requested).not.toContain('/data/learning-population.geojson')
  expect(requested).not.toContain('/data/learning-languages.geojson')
  expect(requested).not.toContain('/elevation/source.json')
  await openLayers(page)
  await chooseTheme(page,'人口密度分布')
  await closeLayers(page)
  await expect(page.locator('.legend')).toContainText('人口密度 · 2020')
  await page.waitForFunction(()=>window.__terraAtlas!.map.isSourceLoaded('population-raster'),undefined,{timeout:45000})
  await mapSettled(page)
  expect(requested.some(path=>path.startsWith('/population/')&&path.endsWith('.png'))).toBe(true)
  expect(requested).not.toContain('/data/learning-population.geojson')
  await page.screenshot({path:`${test.info().outputDir}/population-${info.project.name}.png`})
  await openLayers(page)
  await chooseTheme(page,'国家宗教构成')
  await sourceLoaded(page,'religion')
  await page.getByRole('combobox',{name:'宗教着色指标'}).selectOption('largest')
  const colored=await page.evaluate(()=>Object.fromEntries(window.__terraAtlas!.data.religion.features.filter(f=>['country-jpn','country-grc','country-chn'].includes(f.properties.id)).map(f=>[f.properties.id,f.properties.eligible])))
  expect(colored['country-jpn'],'affiliated-only statistics must not color a population map').toBe(false)
  expect(colored['country-grc'],'unresolved largest group must remain uncolored').toBe(false)
  expect(colored['country-chn']).toBe(true)
  await page.getByRole('combobox',{name:'宗教着色指标'}).selectOption('muslim')
  await closeLayers(page)
  await expect(page.locator('.legend')).toContainText('100%')
  await openLayers(page)
  await chooseTheme(page,'语言分布')
  await page.getByRole('combobox',{name:'语言展示方式'}).selectOption('points')
  await sourceLoaded(page,'languages')
  const first=await page.evaluate(()=>window.__terraAtlas!.data.languages.features.find(f=>f.properties.familyId==='sino1245')||window.__terraAtlas!.data.languages.features[0])
  await page.getByRole('combobox',{name:'语言语系筛选'}).selectOption(String(first.properties.familyId))
  const filter=await page.evaluate(()=>window.__terraAtlas!.map.getFilter('language-dots'))
  expect(JSON.stringify(filter)).toContain(String(first.properties.familyId))
  expect(first.properties.center).toEqual((first.geometry as {coordinates:Coordinate}).coordinates)
  await closeLayers(page)
  await select(page,first.properties.name)
  await expect(page.locator('.knowledge-panel')).toContainText('Glottolog')
  await expect(page.locator('.knowledge-panel')).toContainText('参考点')
})

test('learning: country profile separates periods, population, religion denominator and missing categories',async({page})=>{
  await select(page,'日本')
  const profile=page.getByTestId('country-context')
  await expect(profile).toContainText('人口与城镇 · 2024')
  await expect(profile).toContainText('宗教构成 · 2021')
  await expect(profile).toContainText('有宗教关联者')
  await expect(profile).toContainText('未列出的类别为缺失，不能视为0%')
  await expect(profile).toContainText('国家语言概览')
  const religion=profile.locator('.religion-profile')
  await expect(religion.locator('.share-bars>div')).toHaveCount(4)
  await religion.getByText('原资料与口径说明',{exact:true}).click()
  await expect(religion.locator('.source-excerpt')).not.toBeEmpty()
})

test('learning: a delayed previous location cannot move the camera away from the current UI selection',async({page})=>{
  let releaseRivers!:()=>void,requestedRivers!:()=>void
  const gate=new Promise<void>(resolve=>{releaseRivers=resolve}),request=new Promise<void>(resolve=>{requestedRivers=resolve})
  await page.route('**/data/rivers.geojson',async route=>{requestedRivers();await gate;await route.continue()})
  try{
    await page.reload();await baseReady(page);await sourceLoaded(page,'regions')
    await request
    // Deliberately make a second real UI choice while the first locate is
    // pending. Ordinary select() still waits for a complete bound geometry.
    await page.getByRole('combobox',{name:'搜索地理对象'}).fill('长江')
    await page.locator('.search-results>button').first().click()
    await expect(page.locator('.knowledge-panel h2')).toHaveText('长江')
    await renderFrames(page)
    await select(page,'Alps')
    await expect(page.locator('.knowledge-panel h2')).toHaveText('阿尔卑斯山脉')
    const before=await page.evaluate(()=>{const map=window.__terraAtlas!.map;return{center:map.getCenter().toArray(),zoom:map.getZoom(),containsAlps:map.getBounds().contains([9.1,46.5])}})
    expect(before.containsAlps).toBe(true)
    releaseRivers()
    await sourceLoaded(page,'rivers');await mapSettled(page)
    const after=await page.evaluate(()=>{const map=window.__terraAtlas!.map;return{center:map.getCenter().toArray(),zoom:map.getZoom(),containsAlps:map.getBounds().contains([9.1,46.5])}})
    await test.info().attach('delayed-location-camera',{body:Buffer.from(JSON.stringify({before,after},null,2)),contentType:'application/json'})
    await expect(page.locator('.knowledge-panel h2')).toHaveText('阿尔卑斯山脉')
    expect(after.containsAlps,'late Yangtze data must not override the newer Alps camera').toBe(true)
  }finally{releaseRivers()}
})

test('learning: a shared camera survives a same-document hash while the previous region locate is delayed',async({page})=>{
  let releaseRegions!:()=>void,requestedRegions!:()=>void
  const gate=new Promise<void>(resolve=>{releaseRegions=resolve}),request=new Promise<void>(resolve=>{requestedRegions=resolve})
  await page.route('**/data/regions.geojson',async route=>{requestedRegions();await gate;await route.continue()})
  try{
    await page.reload();await baseReady(page);await request
    await page.evaluate(()=>{const atlas=window.__terraAtlas!,locate=atlas.locate;atlas.locate=selection=>{atlas.map.getContainer().dataset.lastLocateId=selection.card.id;locate(selection)}})
    await page.getByRole('combobox',{name:'搜索地理对象'}).fill('喜马拉雅')
    await page.locator('.search-results>button').first().click()
    await expect(page.locator('.knowledge-panel h2')).toHaveText('喜马拉雅山脉')
    await renderFrames(page)
    await expect.poll(()=>page.evaluate(()=>window.__terraAtlas!.map.getContainer().dataset.lastLocateId)).toBe('himalayas')
    expect(await page.evaluate(()=>!!window.__terraAtlas!.data.regions)).toBe(false)
    const response=await page.goto('/#lng=86.9&lat=28.2&z=4.2&view=china&layers=terrain%2Cmountains%2Crivers%2Clakes%2Cborders&place=himalayas&plng=86.9&plat=28.2')
    expect(response,'this exercises a retained map and a same-document hash change').toBeNull()
    await expect.poll(()=>page.evaluate(()=>window.__terraAtlas!.map.getZoom()),{timeout:45000}).toBe(4.2)
    releaseRegions()
    await sourceLoaded(page,'regions');await selectedGeometry(page)
    await renderFrames(page);await mapSettled(page)
    const camera=await page.evaluate(()=>{const map=window.__terraAtlas!.map;return{center:map.getCenter().toArray(),zoom:map.getZoom(),moving:map.isMoving()}})
    await test.info().attach('delayed-region-shared-camera',{body:Buffer.from(JSON.stringify(camera,null,2)),contentType:'application/json'})
    expect(camera.moving).toBe(false)
    expect(camera.zoom,'the earlier Himalayas fit must not override an explicit shared zoom').toBe(4.2)
    await expect(page.locator('.knowledge-panel h2')).toHaveText('喜马拉雅山脉')
  }finally{releaseRegions()}
})

test('learning: two places expose real twelve-month charts and consistent long-term period',async({page},info)=>{
  await clickHeaderAction(page,'打开两地对比')
  const panel=page.getByRole('complementary',{name:'两地对比'})
  await expect(panel).toBeVisible()
  await page.getByRole('combobox',{name:'对比地点 A'}).selectOption('climate-place-chengdu')
  await page.getByRole('combobox',{name:'对比地点 B'}).selectOption('climate-place-lhasa')
  await expect(panel.locator('.climate-chart')).toHaveCount(2)
  await expect(panel.locator('.climate-chart svg').nth(0)).toHaveAttribute('aria-label','成都十二个月平均气温与降水图')
  await expect(panel.locator('.climate-chart svg').nth(1)).toHaveAttribute('aria-label','拉萨十二个月平均气温与降水图')
  for(const chart of await panel.locator('.climate-chart svg').all()){await expect(chart.locator('rect')).toHaveCount(12);await expect(chart.locator('circle')).toHaveCount(12)}
  const charts=panel.locator('.climate-chart svg'),axes=await Promise.all([0,1].map(index=>charts.nth(index).locator('g:has(> line)>text').allTextContents()))
  expect(axes[0],'both temperature and precipitation have five axis ticks').toHaveLength(10)
  expect(axes[1],'comparison charts use the same temperature and precipitation scales').toEqual(axes[0])
  const graphA=await charts.nth(0).boundingBox(),graphB=await charts.nth(1).boundingBox()
  if(info.project.name==='mobile'){
    expect(graphA!.width,'portrait charts use the available panel width').toBeGreaterThan(250)
    expect(graphB!.width).toBeGreaterThan(250)
    expect(graphB!.y,'portrait charts stack vertically').toBeGreaterThanOrEqual(graphA!.y+graphA!.height)
  }else expect(graphB!.x,'desktop charts remain side by side').toBeGreaterThan(graphA!.x)
  await expect(panel.locator('.comparison-insight')).toContainText('1991–2020')
  await expect(panel.locator('.comparison-insight')).toContainText('不能证明')
  await page.screenshot({path:`${test.info().outputDir}/compare-${info.project.name}.png`})
  await panel.getByRole('button',{name:'关闭对比',exact:true}).click()
  await select(page,'成都')
  await page.locator('.knowledge-panel .climate-chart summary').click()
  await expect(page.locator('.knowledge-panel .monthly-table tbody tr')).toHaveCount(12)
  await expect(page.locator('.knowledge-panel .climate-chart')).toContainText('不能视为城市气象站观测')
})

test('learning: actual point probes distinguish empty population from missing data and read bounded DEM',async({page},info)=>{
  const response=await page.request.get('/data/learning-population.json');expect(response.ok()).toBe(true)
  const grid=await response.json() as {width:number;height:number;west:number;north:number;resolutionDegrees:number;values:(number|null)[][]}
  let zero:Coordinate|null=null
  for(let row=30;row<grid.height-30&&!zero;row++)for(let col=40;col<grid.width-40;col++)if(grid.values[row][col]===0){zero=[grid.west+(col+.5)*grid.resolutionDegrees,grid.north-(row+.5)*grid.resolutionDegrees];break}
  expect(zero,'the real source includes valid empty land cells').not.toBeNull()
  await probe(page,zero!)
  const population=page.locator('.probe-panel .reading-section').filter({has:page.getByRole('heading',{name:'人口密度 · 2020',exact:true})})
  await expect(population.locator('.probe-number')).toHaveText('0人 / km²')
  await probe(page,[0,0])
  await expect(population).toContainText('缺失不表示无人居住')
  await expect(population.locator('.probe-number')).toHaveCount(0)
  await probe(page,[138.7309,35.3579])
  await expect(page.locator('.probe-panel')).toContainText('局部高程参考',{timeout:35000})
  await expect(page.locator('.probe-panel')).toContainText('不代表山峰正式海拔')
  const elevation=await page.evaluate(()=>({fuji:window.__terraAtlas!.sampleElevation([138.7309,35.3579]),outside:window.__terraAtlas!.sampleElevation([104,35])}))
  expect(elevation.fuji).toBeGreaterThan(3000);expect(elevation.fuji).toBeLessThan(4000);expect(elevation.outside).toBeNull()
  await page.screenshot({path:`${test.info().outputDir}/probe-${info.project.name}.png`})
})

test('learning: actual map clicks create and clear a great-circle measurement',async({page})=>{
  await page.getByRole('button',{name:'测距工具',exact:true}).click()
  await expect(page.getByRole('button',{name:'测距工具',exact:true})).toHaveAttribute('aria-pressed','true')
  await clickCoordinate(page,[0,0],5)
  await clickCoordinate(page,[1,0],5)
  await expect(page.locator('.measurement-panel')).toContainText('111 km')
  await expect(page.locator('.measurement-panel')).toContainText('不含地形高差')
  const source=await page.evaluate(()=>window.__terraAtlas!.map.getSource('measurement')!.serialize())
  expect(JSON.stringify(source)).toContain('MultiLineString')
  await page.locator('.measurement-panel').getByRole('button',{name:'清空',exact:true}).click()
  await expect(page.locator('.measurement-panel')).toContainText('依次点选地图上的位置')
  await page.getByRole('button',{name:'结束测距',exact:true}).click()
  await expect(page.locator('.measurement-panel')).toHaveCount(0)
})

test('learning: a topic highlights multiple real locations and allows free jumping and exit',async({page},info)=>{
  await chooseTheme(page,'从雪山到江湖')
  await expect(page.locator('.topic-summary')).toContainText('长江把高原源区、四川盆地、中游湖泊和河口连接起来')
  await page.waitForFunction(()=>{const atlas=window.__terraAtlas!,data=atlas.map.getSource('relations')!.serialize() as {data?:{features?:unknown[]}};return (data.data?.features?.length||0)>2&&atlas.map.isSourceLoaded('relations')},undefined,{timeout:45000})
  await mapSettled(page)
  await page.locator('.topic-members').getByRole('button',{name:/四川盆地/}).click()
  await expect(page.locator('.knowledge-panel h2')).toHaveText('四川盆地')
  await page.getByRole('combobox',{name:'切换主题成员',exact:true}).selectOption('yangtze')
  await selectedGeometry(page)
  await expect(page.locator('.knowledge-panel h2')).toHaveText('长江')
  await page.screenshot({path:`${test.info().outputDir}/topic-${info.project.name}.png`})
  const handle=page.getByRole('button',{name:'调整阅读面板大小',exact:true})
  if(await handle.isVisible())await handle.press('End')
  await page.getByRole('button',{name:'退出主题',exact:true}).click()
  await expect(page.locator('.topic-reader')).toHaveCount(0)
  await page.waitForFunction(()=>{const source=window.__terraAtlas!.map.getSource('relations')!.serialize() as {data:{features:unknown[]}};return source.data.features.length===0&&window.__terraAtlas!.map.isSourceLoaded('relations')})
})

test('learning: favorites and named collections export and import without notes UI',async({page})=>{
  await select(page,'长江')
  await expect(page.getByRole('textbox',{name:'这个地点的笔记'})).toHaveCount(0)
  await page.getByRole('button',{name:'收藏地点',exact:true}).click()
  await clickHeaderAction(page,'打开收藏')
  await page.getByRole('textbox',{name:'新收藏集合名称'}).fill('河流观察')
  await page.getByRole('button',{name:'将当前收藏保存为集合',exact:true}).click()
  await expect(page.locator('.collection-list')).toContainText('河流观察')
  const downloadEvent=page.waitForEvent('download')
  await page.getByRole('button',{name:'导出记录',exact:true}).click()
  const download=await downloadEvent,path=await download.path();expect(path).not.toBeNull()
  const records=JSON.parse(await readFile(path!,'utf8'))
  expect(records.format).toBe('terra-atlas-records');expect(records.preferences.favorites).toContain('yangtze')
  expect(records.preferences.collections[0].places).toContain('yangtze')
  records.preferences.favorites.push('qinghai-lake')
  await page.getByLabel('导入探索记录文件',{exact:true}).setInputFiles({name:'山河图记录.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(records))})
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).favorites)).toContain('qinghai-lake')
  await closeLayers(page)
  await select(page,'长江')
  await expect(page.getByRole('textbox',{name:'这个地点的笔记'})).toHaveCount(0)
  await expect(page.getByRole('button',{name:'已收藏',exact:true})).toHaveAttribute('aria-pressed','true')
  await page.reload();await baseReady(page)
  await select(page,'长江')
  await expect(page.getByRole('textbox',{name:'这个地点的笔记'})).toHaveCount(0)
  await expect(page.getByRole('button',{name:'已收藏',exact:true})).toHaveAttribute('aria-pressed','true')
})

test('learning: old browser preferences retain favorites and camera while receiving new defaults',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('terra-atlas-v1',JSON.stringify({favorites:['yangtze'],savedViews:[{id:'old-view',name:'旧地图视图',camera:{center:[107,33],zoom:4.7},layers:{terrain:true,mountains:true,rivers:true,lakes:false,climate:false,borders:true},view:'world'}],layers:{terrain:true,mountains:true,rivers:true,lakes:false,climate:false,borders:true},camera:{center:[107,33],zoom:4.7},view:'world'})))
  await page.reload();await baseReady(page)
  await expect(page.getByRole('button',{name:'全球视野',exact:true})).toBeVisible()
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!))
  expect(state.view).toBe('world')
  expect(state.favorites).toEqual(['yangtze']);expect(state.savedViews[0].name).toBe('旧地图视图')
  expect(state.layers.language).toBe(false);expect(state.layers.population).toBe(false);expect(state.opacity).toBe(.48);expect(state.thematic.language).toBe('all')
  expect(state.notes).toEqual({});expect(state.collections).toEqual([])
})

test('learning: a card shows its own climate grid class without inventing monthly observations',async({page})=>{
  await select(page,'青藏高原')
  const classification=page.getByTestId('card-climate')
  await expect(classification).toContainText('ET ·')
  await expect(classification).toContainText('Beck V3 · 1991–2020 · 0.5°')
  await expect(classification).toContainText('不能代表整片区域')
  await expect(page.locator('.knowledge-panel .climate-chart')).toHaveCount(0)
  await classification.getByRole('button').click()
  await expect(page.getByRole('dialog')).toContainText('ET')
  await page.getByRole('button',{name:'关闭对话框',exact:true}).click()
  await expect(page.locator('.knowledge-panel h2')).toHaveText('青藏高原')
  await select(page,'太平洋')
  await expect(page.getByTestId('card-climate')).toContainText('海洋或缺失位置不作推断')
  await expect(page.getByTestId('card-climate').getByRole('button')).toHaveCount(0)
})

test('learning: province references and real coordinate grid render independently',async({page})=>{
  await openLayers(page)
  await page.getByRole('checkbox',{name:'中国省区图层',exact:true}).check()
  await page.getByRole('checkbox',{name:'经纬网图层',exact:true}).check()
  await sourceLoaded(page,'provinces')
  const state=await page.evaluate(()=>({count:window.__terraAtlas!.data.provinces.features.length,grid:window.__terraAtlas!.map.getSource('grid')!.serialize()}))
  expect(state.count).toBe(34);expect(JSON.stringify(state.grid)).toContain('23.436');expect(JSON.stringify(state.grid)).toContain('赤道')
  await closeLayers(page)
  await select(page,'北京市')
  await expect(page.locator('.knowledge-panel h2')).toContainText('北京')
  await expect(page.locator('.knowledge-panel')).toContainText('参考')
})

test('learning: mobile reader covers the map when full and preserves shared zoom when collapsed',async({page},info)=>{
  test.skip(!info.project.name.startsWith('mobile'),'mobile reading sheet controls')
  await openLayers(page);await chooseTheme(page,'长期气候分布');await closeLayers(page)
  await select(page,'喜马拉雅')
  await expect(page.locator('.legend')).toBeVisible()
  const handle=page.getByRole('button',{name:'调整阅读面板大小',exact:true})
  for(const [key,cls] of [['Home','sheet-peek'],[readerExpandKey(page),'sheet-half'],['End','sheet-full']] as const){
    await handle.press(key);await expect(page.locator('.mobile-reading-sheet')).toHaveClass(new RegExp(cls))
    if(cls==='sheet-full')await expect(page.locator('.legend')).toBeHidden()
    else await expect(page.locator('.legend')).toBeVisible()
  }
  await handle.press('Home')
  const legend=await page.locator('.legend').boundingBox(),card=await page.locator('.explorer.topic-active').boundingBox()
  expect(legend!.x+legend!.width<=card!.x+2||card!.x+card!.width<=legend!.x+2||legend!.y+legend!.height<=card!.y+2||card!.y+card!.height<=legend!.y+2,'legend and card have separate usable space').toBe(true)
  await page.screenshot({path:`${test.info().outputDir}/mobile-sheet-legend.png`})
  await page.goto('/#lng=86.9&lat=28.2&z=4.2&view=china&layers=terrain%2Cmountains%2Crivers%2Clakes%2Cborders&place=himalayas&plng=86.9&plat=28.2')
  await sourceLoaded(page,'regions')
  await expect(page.locator('.knowledge-panel h2')).toHaveText('喜马拉雅山脉')
  await selectedGeometry(page)
  await expect.poll(()=>page.evaluate(()=>window.__terraAtlas!.map.getZoom()),{timeout:45000}).toBe(4.2)
  await expect.poll(()=>page.evaluate(()=>{const map=window.__terraAtlas!.map,p=map.project([86.9,28.2]),r=map.getContainer().getBoundingClientRect(),c=document.querySelector('.mobile-reading-sheet')!.getBoundingClientRect();return innerWidth>innerHeight?p.x+r.left<c.left:p.y+r.top<c.top})).toBe(true)
})
