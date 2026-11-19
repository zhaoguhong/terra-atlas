import {expect,test} from '@playwright/test'
import {baseReady,mapSettled,selectedGeometry} from './map-readiness'

test.use({reducedMotion:'reduce'})
test.setTimeout(120000)

test('selection restoration: old region metadata refreshes on reload and browser back without moving the saved camera',async({page})=>{
  await page.goto('/#topic=china-terrain&place=inner-mongolian-plateau&lng=112&lat=44&z=4')
  await baseReady(page);await selectedGeometry(page)
  const camera=await page.evaluate(()=>({center:window.__terraAtlas!.map.getCenter().toArray(),zoom:window.__terraAtlas!.map.getZoom()}))
  await page.evaluate(()=>{
    const old=structuredClone(history.state)
    old.terraAtlasNavigation.selection.card.summary='STALE PLATEAU SUMMARY'
    old.terraAtlasNavigation.selection.card.geometryNote='STALE POINT ONLY NOTE'
    old.terraAtlasNavigation.trail=[structuredClone(old.terraAtlasNavigation.selection)]
    history.replaceState(old,'')
    const taiwan=structuredClone(old)
    taiwan.terraAtlasEntryId+='-taiwan'
    taiwan.terraAtlasNavigation.topicId=null
    taiwan.terraAtlasNavigation.selection={
      card:{...old.terraAtlasNavigation.selection.card,id:'country-twn',name:'中华民国',englishName:'Republic of China',category:'regions',summary:'STALE INDEPENDENT COUNTRY SUMMARY',geometryNote:'STALE COUNTRY NOTE',facts:[{label:'国家',value:'中华民国'}],coordinates:[121.1,24.2]},
      source:'countries',featureId:'country-twn',geographic:true,
    }
    history.pushState(taiwan,'')
  })
  await page.reload();await baseReady(page);await mapSettled(page)
  await expect(page.locator('.knowledge-panel h2')).toHaveText('中国台湾')
  await expect(page.locator('.knowledge-panel')).not.toContainText('STALE')
  await expect(page.locator('.knowledge-panel')).not.toContainText('中华民国')
  await expect(page.locator('.knowledge-panel .map-extent-description')).toContainText('不表示独立国家')
  await expect.poll(()=>page.evaluate(()=>history.state.terraAtlasNavigation.selection.card.coordinates)).toEqual([121.1,24.2])
  await expect.poll(()=>page.evaluate(()=>history.state.terraAtlasNavigation.trail[0].card.geometryNote)).toContain('Zhang')
  const afterReload=await page.evaluate(()=>({center:window.__terraAtlas!.map.getCenter().toArray(),zoom:window.__terraAtlas!.map.getZoom()}))
  expect(afterReload.center[0]).toBeCloseTo(camera.center[0],5);expect(afterReload.center[1]).toBeCloseTo(camera.center[1],5);expect(afterReload.zoom).toBeCloseTo(camera.zoom,5)
  await page.goBack();await selectedGeometry(page)
  await expect(page.locator('.knowledge-panel h2')).toHaveText('内蒙古高原')
  await expect(page.locator('.knowledge-panel .map-extent-description')).toHaveAttribute('data-representation','area')
  await expect(page.locator('.knowledge-panel .map-extent-description')).toContainText('Zhang')
  await expect(page.locator('.knowledge-panel')).not.toContainText('STALE')
  await page.goForward();await mapSettled(page)
  await expect(page.locator('.knowledge-panel h2')).toHaveText('中国台湾')
  await expect(page.locator('.knowledge-panel')).not.toContainText('中华民国')
})

test('selection restoration: current climate prose preserves the clicked coordinates and exact feature identity',async({page})=>{
  const params=new URLSearchParams({topic:'map-climate',place:'climate-d',feature:'climate-Dwa',subtype:'Dwa · 定位格网',plng:'114.23',plat:'35.61',lng:'116',lat:'35',z:'5'})
  await page.goto('/#'+params);await baseReady(page)
  await page.waitForFunction(()=>{
    const source=window.__terraAtlas?.map.getSource('selection')?.serialize() as {data?:{features?:{properties:{id:string}}[]}}|undefined
    return source?.data?.features?.some(feature=>feature.properties.id==='climate-Dwa')
  })
  await mapSettled(page)
  const before=await page.evaluate(()=>({selection:history.state.terraAtlasNavigation.selection,camera:history.state.terraAtlasNavigation.camera}))
  await page.evaluate(()=>{
    const state=structuredClone(history.state)
    state.terraAtlasNavigation.selection.card.summary='STALE CLIMATE SUMMARY'
    state.terraAtlasNavigation.selection.card.geometryNote='STALE CLIMATE NOTE'
    history.replaceState(state,'')
  })
  await page.reload();await baseReady(page);await mapSettled(page)
  await expect(page.locator('.knowledge-panel')).not.toContainText('STALE')
  await expect(page.locator('.knowledge-panel .map-extent-description')).toHaveAttribute('data-representation','area')
  const after=await page.evaluate(()=>({selection:history.state.terraAtlasNavigation.selection,camera:history.state.terraAtlasNavigation.camera}))
  expect(after.selection.card.coordinates).toEqual([114.23,35.61])
  expect(after.selection.source).toBe(before.selection.source)
  expect(after.selection.featureId).toBe(before.selection.featureId)
  expect(after.selection.subtype).toBe(before.selection.subtype)
  expect(after.camera.center[0]).toBeCloseTo(before.camera.center[0],5)
  expect(after.camera.center[1]).toBeCloseTo(before.camera.center[1],5)
  expect(after.camera.zoom).toBeCloseTo(before.camera.zoom,5)
})

test('selection restoration: old regional city cards and trails refresh China affiliation and capital facts',async({page})=>{
  for(const [id,name,region] of [['city-ne-1159151567','台北','台湾'],['city-ne-1159151629','香港','香港特别行政区'],['city-ne-1159149085','澳门','澳门特别行政区']] as const){
  await page.goto('/#place='+id+'&feature='+id+'&lng=121&lat=25&z=6')
  await baseReady(page)
  await expect(page.locator('.knowledge-panel h2')).toHaveText(name)
  await selectedGeometry(page)
  await page.evaluate(()=>{
    const state=structuredClone(history.state)
    state.terraAtlasNavigation.selection.card.summary='STALE TAIPEI SUMMARY'
    state.terraAtlasNavigation.selection.card.facts=[{label:'所在国家／地区',value:'Taiwan'},{label:'国家首都标记',value:'是'}]
    state.terraAtlasNavigation.trail=[structuredClone(state.terraAtlasNavigation.selection)]
    history.replaceState(state,'')
  })
  await page.reload();await baseReady(page);await selectedGeometry(page)
  await expect(page.locator('.knowledge-panel')).not.toContainText('STALE')
  const facts=page.locator('.knowledge-panel .facts')
  await expect(facts).toContainText('中国 · '+region)
  await expect(facts.locator('div').filter({hasText:'国家首都标记'}).locator('dd')).toHaveText('否')
  const restored=await page.evaluate(()=>history.state.terraAtlasNavigation)
  expect(restored.selection.featureId).toBe(id)
  expect(restored.selection.source).toBe('cities')
  expect(restored.trail[0].card.facts).toEqual(restored.selection.card.facts)
  }
})
