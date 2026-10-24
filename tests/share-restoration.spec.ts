import {test,expect,type Page} from '@playwright/test'
import knowledge from '../src/data/knowledge.json' with {type:'json'}
import {baseReady,mapSettled,renderFrames,selectedGeometry,sourceLoaded} from './map-readiness'

const tianjinName=knowledge.find(card=>card.id==='tianjin')!.name
test.setTimeout(90000)
let errors:string[]=[]
test.beforeEach(async({page})=>{errors=[];page.on('pageerror',error=>errors.push(error.message))})
test.afterEach(()=>expect(errors,'shared-view runtime errors').toEqual([]))

function shared(place:string,extra:Record<string,string>={}){
  return '/#'+new URLSearchParams({lng:'117.3563',lat:'39.4101',z:'4.25',view:'china',layers:'terrain,mountains,rivers,lakes,borders',topic:'',place,...extra})
}
async function openLayers(page:Page){
  const button=page.getByRole('button',{name:'打开图层面板',exact:true})
  if(await button.isVisible())await button.click()
}
async function closeLayers(page:Page){
  const button=page.getByRole('button',{name:'关闭图层面板',exact:true})
  if(await button.isVisible())await button.click()
}
async function baseSources(page:Page){
  await baseReady(page)
  for(const source of ['regions','rivers','lakes','peaks','summits'])await sourceLoaded(page,source)
}

test('shared: an invalid place warns and never resets controls when new data arrives',async({page})=>{
  await page.goto(shared('river-does-not-exist'));await baseSources(page)
  await expect(page.locator('.map-status')).toContainText('地点已不存在或无法识别')
  await openLayers(page)
  await page.getByRole('checkbox',{name:'经纬网图层',exact:true}).check()
  await page.getByRole('checkbox',{name:'河流图层',exact:true}).uncheck()
  await page.getByRole('checkbox',{name:'中国省区图层',exact:true}).check()
  await sourceLoaded(page,'provinces')
  await expect(page.getByRole('checkbox',{name:'经纬网图层',exact:true})).toBeChecked()
  await expect(page.getByRole('checkbox',{name:'河流图层',exact:true})).not.toBeChecked()
  await expect(page.getByRole('checkbox',{name:'中国省区图层',exact:true})).toBeChecked()
  const visible=await page.evaluate(()=>['grid-lines','river-lines','province-lines'].map(id=>window.__terraAtlas!.map.getLayoutProperty(id,'visibility')))
  expect(visible).toEqual(['visible','none','visible'])
})

for(const [id,name,source,layer] of [
  ['province-cn-12',tianjinName,'provinces','province-lines'],
  ['language-aari1239','Aari','languages','language-dots'],
] as const){
  test(`shared: ${source} place restores while its display layer stays off`,async({page})=>{
    await page.goto(shared(id,{feature:id,source}));await baseSources(page)
    await expect(page.locator('.knowledge-panel h2')).toHaveText(name)
    await sourceLoaded(page,source);await selectedGeometry(page)
    const state=await page.evaluate(({source,layer})=>({
      enabled:JSON.parse(localStorage.getItem('terra-atlas-v1')!).layers[source==='languages'?'language':'provinces'],
      visibility:window.__terraAtlas!.map.getLayoutProperty(layer,'visibility'),
      zoom:window.__terraAtlas!.map.getZoom(),
    }),{source,layer})
    expect(state.enabled).toBe(false);expect(state.visibility).toBe('none');expect(state.zoom).toBe(4.25)
    await expect(page.getByRole('button',{name:'关闭分享提示',exact:true})).toHaveCount(0)
  })
}

test('shared: delayed place resolution keeps newer layer settings and the shared camera',async({page})=>{
  let release!:()=>void,requested!:()=>void
  const gate=new Promise<void>(resolve=>{release=resolve}),request=new Promise<void>(resolve=>{requested=resolve})
  await page.route('**/data/learning-provinces.geojson',async route=>{requested();await gate;await route.continue()})
  try{
    await page.goto(shared('province-cn-12'));await baseSources(page);await request
    await expect(page.locator('.knowledge-panel h2')).toHaveCount(0)
    await openLayers(page)
    await page.getByRole('checkbox',{name:'经纬网图层',exact:true}).check()
    await page.getByRole('checkbox',{name:'河流图层',exact:true}).uncheck()
    await closeLayers(page)
    release();await sourceLoaded(page,'provinces');await selectedGeometry(page)
    await expect(page.locator('.knowledge-panel h2')).toHaveText(tianjinName)
    const state=await page.evaluate(()=>({layers:JSON.parse(localStorage.getItem('terra-atlas-v1')!).layers,zoom:window.__terraAtlas!.map.getZoom()}))
    expect(state.layers.grid).toBe(true);expect(state.layers.rivers).toBe(false);expect(state.layers.provinces).toBe(false)
    expect(state.zoom).toBe(4.25)
  }finally{release()}
})

test('shared: a late place response cannot replace a newer search selection',async({page})=>{
  let release!:()=>void,requested!:()=>void
  const gate=new Promise<void>(resolve=>{release=resolve}),request=new Promise<void>(resolve=>{requested=resolve})
  await page.route('**/data/learning-provinces.geojson',async route=>{requested();await gate;await route.continue()})
  try{
    await page.goto(shared('province-cn-12'));await baseSources(page);await request
    await page.getByRole('combobox',{name:'搜索地理对象'}).fill('Alps')
    await page.locator('.search-results>button').first().click();await selectedGeometry(page)
    const before=await page.evaluate(()=>({center:window.__terraAtlas!.map.getCenter().toArray(),zoom:window.__terraAtlas!.map.getZoom()}))
    release();await sourceLoaded(page,'provinces');await mapSettled(page)
    await expect(page.locator('.knowledge-panel h2')).toHaveText('阿尔卑斯山脉')
    const after=await page.evaluate(()=>({center:window.__terraAtlas!.map.getCenter().toArray(),zoom:window.__terraAtlas!.map.getZoom()}))
    expect(after.zoom).toBeCloseTo(before.zoom,5)
    after.center.forEach((value,index)=>expect(value).toBeCloseTo(before.center[index],5))
  }finally{release()}
})

test('shared: a late response cannot replace a newer same-document link',async({page})=>{
  let release!:()=>void,requested!:()=>void
  const gate=new Promise<void>(resolve=>{release=resolve}),request=new Promise<void>(resolve=>{requested=resolve})
  await page.route('**/data/learning-provinces.geojson',async route=>{requested();await gate;await route.continue()})
  try{
    await page.goto(shared('province-cn-12'));await baseSources(page);await request
    const response=await page.goto(shared('alps',{lng:'9.3',lat:'46.5',z:'4.5',view:'world'}))
    expect(response).toBeNull()
    await expect(page.locator('.knowledge-panel h2')).toHaveText('阿尔卑斯山脉');await selectedGeometry(page)
    release();await sourceLoaded(page,'provinces');await mapSettled(page)
    await expect(page.locator('.knowledge-panel h2')).toHaveText('阿尔卑斯山脉')
    expect(await page.evaluate(()=>window.__terraAtlas!.map.getZoom())).toBe(4.5)
  }finally{release()}
})

test('shared: a monthly reference waits for its real data without replaying settings',async({page})=>{
  let release!:()=>void,requested!:()=>void
  const gate=new Promise<void>(resolve=>{release=resolve}),request=new Promise<void>(resolve=>{requested=resolve})
  await page.route('**/data/learning-climate.json',async route=>{requested();await gate;await route.continue()})
  try{
    await page.goto(shared('climate-place-lhasa',{lng:'91.1',lat:'29.65'}));await baseSources(page);await request
    await openLayers(page);await page.getByRole('checkbox',{name:'经纬网图层',exact:true}).check();await closeLayers(page)
    release()
    await expect(page.locator('.knowledge-panel h2')).toHaveText('拉萨');await selectedGeometry(page)
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).layers.grid)).toBe(true)
  }finally{release()}
})

test('shared: retrying failed place data restores the card without resetting controls',async({page})=>{
  let attempts=0
  await page.route('**/data/learning-provinces.geojson',route=>++attempts===1
    ?route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({type:'FeatureCollection',features:null})})
    :route.continue())
  await page.goto(shared('province-cn-12'))
  await page.waitForFunction(()=>!!window.__terraAtlas?.data.land&&!!window.__terraAtlas.data.countries)
  await expect(page.locator('.map-status').getByRole('button',{name:'重试',exact:true})).toBeVisible()
  await openLayers(page);await page.getByRole('checkbox',{name:'经纬网图层',exact:true}).check();await closeLayers(page)
  await page.locator('.map-status').getByRole('button',{name:'重试',exact:true}).click()
  await sourceLoaded(page,'provinces')
  await expect(page.locator('.knowledge-panel h2')).toHaveText(tianjinName);await selectedGeometry(page);await renderFrames(page)
  expect(attempts).toBe(2)
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).layers.grid)).toBe(true)
})

test('shared: failed monthly data can be retried from the warning and restores search references',async({page})=>{
  let attempts=0
  let release!:()=>void
  const gate=new Promise<void>(resolve=>{release=resolve})
  await page.route('**/data/learning-climate.json',async route=>{
    if(++attempts===1){await gate;await route.fulfill({status:200,contentType:'application/json',body:'{'})}
    else await route.continue()
  })
  try{
    await page.goto(shared('climate-place-lhasa',{lng:'91.1',lat:'29.65'}));await baseSources(page)
    // Fail the request shared by the search index and the ready map's resolver.
    release()
    await expect(page.locator('.map-status')).toContainText('分享地点的资料暂未能加载')
    await openLayers(page);await page.getByRole('checkbox',{name:'经纬网图层',exact:true}).check();await closeLayers(page)
    await page.locator('.map-status').getByRole('button',{name:'重试',exact:true}).click()
    await expect(page.locator('.knowledge-panel h2')).toHaveText('拉萨');await selectedGeometry(page)
    await expect(page.locator('.map-status')).toHaveCount(0)
    expect(attempts).toBe(2)
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).layers.grid)).toBe(true)
    await page.getByRole('combobox',{name:'搜索地理对象'}).fill('拉萨')
    await expect(page.locator('.search-results>button').filter({hasText:'拉萨'})).toHaveCount(1)
  }finally{release()}
})
