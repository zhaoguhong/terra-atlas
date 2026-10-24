import {test,expect,type Page} from '@playwright/test'
import fs from 'node:fs'
import {baseReady,mapSettled,selectedGeometry} from './map-readiness'
import {clickHeaderAction} from './header-actions'
import {defaultLayers} from '../src/lib/storage'

test.use({reducedMotion:'reduce'})
const savedCamera={center:[100,27] as [number,number],zoom:4.5,bearing:0,pitch:0}
const datasets=[['cities','auxiliary-cities.geojson'],['basins','auxiliary-basins.geojson'],['plates','auxiliary-plates.geojson']] as const
async function seed(page:Page,record:unknown){await page.addInitScript(record=>{if(!localStorage.getItem('review-seeded')){localStorage.setItem('terra-atlas-v1',JSON.stringify(record));localStorage.setItem('review-seeded','true')}},record)}
async function geometry(page:Page){return page.evaluate(()=>{const source=window.__terraAtlas!.map.getSource('selection')!.serialize() as {data:{features:{properties:{id:string};geometry:{type:string}}[]}};return source.data.features.map(f=>({id:f.properties.id,type:f.geometry.type}))})}
for(const [source,file] of datasets){
  const features=JSON.parse(fs.readFileSync('public/data/'+file,'utf8')).features
  const feature=source==='cities'?features.find((f:any)=>f.properties.id==='city-ne-1159147031'):features[0]
  const id=feature.properties.id,name=feature.properties.name
  test(`review fixes: disabled ${source} bookmarks and saved views recover exact features after reload`,async({page})=>{
    await seed(page,{favorites:[id],placeNames:{[id]:name},layers:defaultLayers,topicId:null,savedViews:[{id:'review-view',name:'恢复测试视图',camera:savedCamera,layers:defaultLayers,view:'world',place:id,featureId:id}]})
    await page.goto('/');await baseReady(page)
    expect(await page.evaluate(source=>!!window.__terraAtlas!.data[source]?.features.length,source)).toBe(false)
    await clickHeaderAction(page,'打开收藏')
    await expect(page.locator('.saved-list').first().getByRole('button',{name,exact:true})).toBeVisible()
    await page.locator('.saved-list').first().getByRole('button',{name,exact:true}).click()
    await expect(page.locator('.knowledge-panel h2')).toHaveText(name)
    await selectedGeometry(page)
    expect(await geometry(page)).toContainEqual({id,type:feature.geometry.type})
    await page.reload();await baseReady(page)
    await clickHeaderAction(page,'打开收藏')
    await page.getByRole('button',{name:'恢复测试视图',exact:true}).click()
    await expect(page.locator('.knowledge-panel h2')).toHaveText(name)
    await selectedGeometry(page)
    expect(await geometry(page)).toContainEqual({id,type:feature.geometry.type})
    const camera=await page.evaluate(()=>({center:window.__terraAtlas!.map.getCenter().toArray(),zoom:window.__terraAtlas!.map.getZoom()}))
    expect(camera.zoom).toBeCloseTo(savedCamera.zoom,5)
    camera.center.forEach((v,index)=>expect(v).toBeCloseTo(savedCamera.center[index],5))
  })
}

test('review fixes: Home resets tools, saved tab and filters to free exploration',async({page})=>{
  await page.goto('/#lng=104&lat=35&z=3&place=yangtze&view=china&topic=');await baseReady(page)
  await clickHeaderAction(page,'打开收藏')
  // The mobile overlay covers map tools; close it before enabling measurement.
  const close=page.getByRole('button',{name:'关闭探索面板',exact:true})
  if(await close.isVisible())await close.click()
  await page.getByRole('button',{name:'测距工具',exact:true}).click()
  await expect(page.getByRole('button',{name:'测距工具',exact:true})).toHaveAttribute('aria-pressed','true')
  const canvas=page.locator('.maplibregl-canvas'),box=(await canvas.boundingBox())!
  await canvas.click({position:{x:box.width*.6,y:box.height*.3}})
  await expect.poll(()=>page.evaluate(()=>{const source=window.__terraAtlas!.map.getSource('measurement')!.serialize() as {data:{features:unknown[]}};return source.data.features.length})).toBeGreaterThan(0)
  await page.getByRole('button',{name:'山河图首页',exact:true}).click()
  await expect.poll(()=>page.evaluate(()=>{const source=window.__terraAtlas!.map.getSource('measurement')!.serialize() as {data:{features:unknown[]}};return source.data.features.length})).toBe(0)
  await expect(page.getByRole('button',{name:'测距工具',exact:true})).toHaveAttribute('aria-pressed','false')
  const open=page.getByRole('button',{name:'打开主题探索',exact:true})
  if(await open.isVisible())await open.click()
  await expect(page.locator('.discovery-panel')).toBeVisible()
  await expect(page.locator('.panel-tabs').getByRole('button',{name:'随便看看',exact:true})).toHaveAttribute('aria-pressed','true')
  await expect(page.locator('.suggestions>button')).toHaveCount(3)
  expect(new URL(page.url()).hash).toBe('')
  await page.reload();await baseReady(page)
  await expect(page.locator('.knowledge-panel')).toHaveCount(0)
})

test('review fixes: search exposes keyboard selection and no arbitrary comparison partner',async({page})=>{
  await page.goto('/');await baseReady(page)
  const input=page.getByRole('combobox',{name:'搜索地理对象',exact:true})
  await input.fill('长江')
  await expect(input).toHaveAttribute('aria-expanded','true')
  const options=page.getByRole('listbox',{name:'搜索结果'}).getByRole('option')
  await expect(options.first()).toHaveAttribute('aria-selected','true')
  await input.press('Enter');await selectedGeometry(page)
  await expect(input).toHaveAttribute('aria-expanded','false')
  const handle=page.getByRole('button',{name:'调整阅读面板大小',exact:true})
  if(await handle.isVisible())await handle.press('End')
  await page.getByRole('button',{name:'加入两地对比'}).click()
  await expect(page.getByRole('combobox',{name:'对比地点 A',exact:true})).toHaveValue('yangtze')
  await expect(page.getByRole('combobox',{name:'对比地点 B',exact:true})).toHaveValue('')
  await page.getByRole('searchbox',{name:'筛选对比地点 B'}).fill('黄河')
  await page.getByRole('combobox',{name:'对比地点 B',exact:true}).selectOption('yellow-river')
  await expect(page.locator('.compare-overview')).toContainText('长江')
  await expect(page.locator('.compare-overview')).toContainText('黄河')
})

test('review fixes: deleted bookmark and saved view can be undone and survive reload',async({page})=>{
  await seed(page,{favorites:['yangtze'],savedViews:[{id:'review-view',name:'可撤销视图',camera:savedCamera,layers:defaultLayers,view:'china'}]})
  await page.goto('/');await baseReady(page);await clickHeaderAction(page,'打开收藏')
  await page.getByRole('button',{name:'移除收藏 长江',exact:true}).click()
  await expect(page.locator('.saved-list').first().getByRole('button',{name:'长江',exact:true})).toHaveCount(0)
  await page.getByRole('button',{name:'撤销',exact:true}).click()
  await page.getByRole('button',{name:'删除视图 可撤销视图',exact:true}).click()
  await expect(page.getByRole('button',{name:'可撤销视图',exact:true})).toHaveCount(0)
  await page.getByRole('button',{name:'撤销',exact:true}).click()
  await page.reload();await baseReady(page);await clickHeaderAction(page,'打开收藏')
  await expect(page.locator('.saved-list').first().getByRole('button',{name:'长江',exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'可撤销视图',exact:true})).toBeVisible()
})

test('review fixes: late saved-view data cannot replace a newer selection',async({page})=>{
  const id='city-ne-1159147031'
  await seed(page,{layers:defaultLayers,topicId:null,savedViews:[{id:'review-view',name:'延迟城市视图',camera:savedCamera,layers:defaultLayers,view:'world',place:id,featureId:id}]})
  let release!:()=>void,requested!:()=>void
  const gate=new Promise<void>(resolve=>{release=resolve}),request=new Promise<void>(resolve=>{requested=resolve})
  await page.route('**/data/auxiliary-cities.geojson',async route=>{requested();await gate;await route.continue()})
  try{
    await page.goto('/');await baseReady(page);await clickHeaderAction(page,'打开收藏')
    await page.getByRole('button',{name:'延迟城市视图',exact:true}).click();await request
    await page.getByRole('combobox',{name:'搜索地理对象',exact:true}).fill('青海湖')
    await page.getByRole('option').first().click();await selectedGeometry(page)
    const camera=await page.evaluate(()=>window.__terraAtlas!.map.getCenter().toArray())
    release();await page.waitForFunction(()=>!!window.__terraAtlas!.data.cities?.features.length);await mapSettled(page)
    await expect(page.locator('.knowledge-panel h2')).toHaveText('青海湖')
    const after=await page.evaluate(()=>window.__terraAtlas!.map.getCenter().toArray())
    after.forEach((value,index)=>expect(value).toBeCloseTo(camera[index],5))
  }finally{release()}
})

test('review fixes: newly saved city retains its readable bookmark name and full view reference',async({page})=>{
  await seed(page,{layers:{...defaultLayers,cities:true},topicId:null})
  await page.goto('/');await baseReady(page)
  await page.waitForFunction(()=>!!window.__terraAtlas!.data.cities?.features.length)
  await page.getByRole('combobox',{name:'搜索地理对象',exact:true}).fill('丽江')
  await page.getByRole('option').filter({has:page.getByText('丽江',{exact:true})}).click();await selectedGeometry(page)
  const handle=page.getByRole('button',{name:'调整阅读面板大小',exact:true})
  if(await handle.isVisible())await handle.press('End')
  await page.getByRole('button',{name:'收藏地点',exact:true}).click()
  await clickHeaderAction(page,'打开收藏')
  await page.getByRole('textbox',{name:'地图视图名称'}).fill('丽江实存视图')
  await page.getByRole('button',{name:'保存命名地图视图'}).click()
  const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!))
  expect(record.placeNames['city-ne-1159147031']).toBe('丽江')
  expect(record.savedViews[0]).toMatchObject({place:'city-ne-1159147031',featureId:'city-ne-1159147031'})
  const close=page.getByRole('button',{name:'关闭探索面板',exact:true})
  if(await close.isVisible())await close.click()
  if(await handle.isVisible())await handle.press('Home')
  await page.getByRole('button',{name:'打开图层面板',exact:true}).click()
  await page.getByRole('checkbox',{name:'城市与首都图层',exact:true}).uncheck()
  await page.reload();await baseReady(page);await clickHeaderAction(page,'打开收藏')
  await page.locator('.saved-list').first().getByRole('button',{name:'丽江',exact:true}).click()
  await expect(page.locator('.knowledge-panel h2')).toHaveText('丽江')
  await selectedGeometry(page)
})
