import {test,expect,type Page} from '@playwright/test'
import {baseReady,mapSettled,selectedGeometry} from './map-readiness'
import {clickHeaderAction} from './header-actions'
import {detailMetadata,vectorTile} from './fixtures/online-map'

test.use({reducedMotion:'reduce'})
async function appearance(page:Page,value:string){
  const more=page.getByRole('button',{name:'更多操作',exact:true})
  if(await more.isVisible()&&await more.getAttribute('aria-expanded')!=='true')await more.click()
  await page.getByRole('combobox',{name:'外观模式',exact:true}).selectOption(value)
  if(await more.isVisible())await more.click()
}
async function theme(page:Page,value:string){await expect(page.locator('html')).toHaveAttribute('data-theme',value)}
async function mapState(page:Page){return page.evaluate(()=>{
  const map=window.__terraAtlas!.map
  return {center:map.getCenter().toArray(),zoom:map.getZoom(),pitch:map.getPitch(),bearing:map.getBearing(),selection:map.getSource('selection')?.serialize(),climate:map.getPaintProperty('climate-fill','fill-color'),religion:map.getPaintProperty('religion-fill','fill-color'),population:map.getPaintProperty('population-raster','raster-brightness-max')}
})}

test('appearance follows live system changes, overrides explicitly and persists without losing records',async({page})=>{
  await page.emulateMedia({colorScheme:'dark'})
  await page.addInitScript(()=>{if(!localStorage.getItem('appearance-seeded')){localStorage.setItem('terra-atlas-v1',JSON.stringify({favorites:['yangtze'],notes:{yangtze:'保留笔记'}}));localStorage.setItem('appearance-seeded','1')}})
  await page.goto('/');await baseReady(page);await theme(page,'dark')
  await page.emulateMedia({colorScheme:'light'});await theme(page,'light')
  await appearance(page,'dark');await theme(page,'dark')
  await page.emulateMedia({colorScheme:'dark'});await page.emulateMedia({colorScheme:'light'});await theme(page,'dark')
  await page.reload();await baseReady(page);await theme(page,'dark')
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!))).toMatchObject({appearance:'dark',favorites:['yangtze'],notes:{yangtze:'保留笔记'}})
  await appearance(page,'light');await page.emulateMedia({colorScheme:'dark'});await theme(page,'light')
  await appearance(page,'system');await theme(page,'dark')
})

test('appearance preserves selected geometry, camera and thematic colors and restores the day basemap',async({page},info)=>{
  await page.emulateMedia({colorScheme:'light'})
  await page.goto('/#lng=104&lat=32&z=3&place=yangtze&view=china&topic=');await baseReady(page);await selectedGeometry(page);await mapSettled(page)
  const before=await mapState(page)
  const day=await page.evaluate(()=>({land:window.__terraAtlas!.map.getPaintProperty('land-fill','fill-color'),label:window.__terraAtlas!.map.getPaintProperty('place-labels','text-color'),brightness:window.__terraAtlas!.map.getPaintProperty('relief','raster-brightness-max')??null}))
  await appearance(page,'dark');await theme(page,'dark')
  await expect.poll(()=>page.evaluate(()=>window.__terraAtlas!.map.getPaintProperty('relief','raster-brightness-max'))).toBe(.34)
  expect(await mapState(page)).toEqual(before)
  await expect(page.locator('.knowledge-panel')).toHaveCSS('background-color','rgb(24, 37, 31)')
  await mapSettled(page)
  await page.screenshot({path:info.outputPath('night-reading.png')})
  await appearance(page,'light')
  const restored=await page.evaluate(()=>({land:window.__terraAtlas!.map.getPaintProperty('land-fill','fill-color'),label:window.__terraAtlas!.map.getPaintProperty('place-labels','text-color'),brightness:window.__terraAtlas!.map.getPaintProperty('relief','raster-brightness-max')??null}))
  expect(restored).toEqual(day)
  expect(await mapState(page)).toEqual(before)
})

test('night menus, search and dialogs remain readable and keyboard accessible',async({page},info)=>{
  await page.emulateMedia({colorScheme:'dark'})
  await page.goto('/');await baseReady(page)
  await clickHeaderAction(page,'资料与关于')
  await expect(page.locator('.modal')).toHaveCSS('background-color','rgb(24, 37, 31)')
  await page.screenshot({path:info.outputPath('night-dialog.png')})
  await page.keyboard.press('Escape')
  const expand=page.getByRole('button',{name:'打开搜索',exact:true})
  if(await expand.isVisible())await expand.click()
  const search=page.getByRole('combobox',{name:'搜索地理对象',exact:true})
  await search.fill('长江')
  await expect(page.getByRole('listbox',{name:'搜索结果'})).toBeVisible()
  await expect(page.locator('.search-results')).toHaveCSS('background-color','rgb(24, 37, 31)')
  await search.press('Enter');await selectedGeometry(page)
  await expect(page.locator('.knowledge-panel h2')).toHaveText('长江')
})

test('appearance still follows the system when local storage is unavailable',async({page})=>{
  await page.emulateMedia({colorScheme:'dark'})
  await page.addInitScript(()=>{Object.defineProperty(Storage.prototype,'getItem',{value(){throw new DOMException('Unavailable','SecurityError')}});Object.defineProperty(Storage.prototype,'setItem',{value(){throw new DOMException('Unavailable','SecurityError')}})})
  await page.goto('/');await baseReady(page);await theme(page,'dark')
  await appearance(page,'light');await theme(page,'light')
  await expect(page.locator('.toast')).toContainText('浏览器无法保存记录')
})

test('online detail loads in night colors and switches without new metadata or camera resets',async({page})=>{
  let requests=0
  await page.route('https://tiles.openfreemap.org/**',route=>{const metadata=route.request().url()==='https://tiles.openfreemap.org/planet';if(metadata)requests++;return route.fulfill({headers:{'access-control-allow-origin':'*'},contentType:metadata?'application/json':'application/x-protobuf',...(metadata?{json:detailMetadata}:{body:vectorTile})})})
  await page.emulateMedia({colorScheme:'dark'})
  await page.goto('/');await baseReady(page)
  await page.getByRole('button',{name:'打开图层面板',exact:true}).click()
  await page.getByRole('button',{name:'在线详细地图',exact:true}).click()
  await expect(page.locator('.app')).toHaveAttribute('data-detail-status','ready',{timeout:30000})
  await expect.poll(()=>page.evaluate(()=>window.__terraAtlas!.map.getPaintProperty('online-detail-water','fill-color'))).toBe('#203d4b')
  const close=page.getByRole('button',{name:'关闭图层面板',exact:true});if(await close.isVisible())await close.click()
  await mapSettled(page);const before=await mapState(page)
  await appearance(page,'light')
  expect(await page.evaluate(()=>window.__terraAtlas!.map.getPaintProperty('online-detail-water','fill-color'))).toBe('#a9cbd0')
  await appearance(page,'dark')
  expect(await page.evaluate(()=>window.__terraAtlas!.map.getPaintProperty('online-place-labels','text-color'))).toBe('#e1e8d7')
  expect(await mapState(page)).toEqual(before);expect(requests).toBe(1)
})

for(const overlay of ['climate','language'] as const){
  test(`night ${overlay} preserves data colors and legend swatches`,async({page},info)=>{
    await page.emulateMedia({colorScheme:'light'})
    await page.addInitScript(overlay=>localStorage.setItem('terra-atlas-v1',JSON.stringify({appearance:'light',topicId:`map-${overlay}`,layers:{[overlay]:true},camera:{center:[104,35],zoom:3}})),overlay)
    await page.goto('/');await baseReady(page);await mapSettled(page)
    const layer=overlay==='climate'?'climate-fill':'language-overview-fill'
    await expect.poll(()=>page.evaluate(layer=>window.__terraAtlas!.map.getLayoutProperty(layer,'visibility'),layer)).toBe('visible')
    const colors=()=>page.evaluate(layer=>({fill:window.__terraAtlas!.map.getPaintProperty(layer,'fill-color'),opacity:window.__terraAtlas!.map.getPaintProperty(layer,'fill-opacity'),swatches:Array.from(document.querySelectorAll('.map-legend-symbol')).map(element=>({color:getComputedStyle(element).color,background:getComputedStyle(element).backgroundColor}))}),layer)
    const before=await colors()
    expect(before.swatches.length).toBeGreaterThan(0)
    await appearance(page,'dark');await theme(page,'dark');await mapSettled(page)
    expect(await colors()).toEqual(before)
    await page.screenshot({path:info.outputPath(`night-${overlay}.png`)})
  })
}
