import {expect,test,type Page} from '@playwright/test'
import {baseReady,mapSettled,selectedGeometry} from './map-readiness'
import {chooseTheme} from './theme-controls'

test.use({reducedMotion:'reduce'})
test.setTimeout(120000)
let errors:string[]=[]
test.beforeEach(async({page})=>{errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await baseReady(page);await mapSettled(page)})
test.afterEach(()=>expect(errors,'area presentation runtime errors').toEqual([]))
async function search(page:Page,name:string,label:string){
  const input=page.getByRole('combobox',{name:'搜索地理对象'})
  await input.fill(name)
  const result=page.locator('.search-results>button').first()
  await expect(result).toContainText(label)
  await result.click();await selectedGeometry(page)
  // Uncurated catalog entries initially use a point while their source loads.
  // Wait for the requested representation before inspecting the selected shape.
  await page.waitForFunction(label=>{
    const source=window.__terraAtlas?.map.getSource('selection')?.serialize() as {data?:{features?:{geometry:{type:string}}[]}}|undefined
    const features=source?.data?.features||[]
    return features.length>0&&features.every(f=>label==='区域范围'?/Polygon/.test(f.geometry.type):label==='线状要素'?/LineString/.test(f.geometry.type):f.geometry.type==='Point')
  },label,{timeout:45000})
  await mapSettled(page)
  return page.evaluate(()=>{
    const h=window.__terraAtlas!,source=h.map.getSource('selection')!.serialize() as {data:{features:{properties:{id:string};geometry:{type:string}}[]}}
    return {features:source.data.features.map(f=>({id:f.properties.id,type:f.geometry.type})),rendered:h.map.queryRenderedFeatures({layers:['selection-area','selection-reference']}).map(f=>f.properties?.id)}
  })
}
test('area presentation: four geographical regions have distinct rendered areas and geography matches',async({page},info)=>{
  await chooseTheme(page,'中国四大地理区')
  await page.waitForFunction(()=>{
    const source=window.__terraAtlas?.map.getSource('relations')?.serialize() as {data?:{features?:{geometry:{type:string}}[]}}|undefined
    return source?.data?.features?.length===4&&source.data.features.every(f=>/Polygon/.test(f.geometry.type))
  })
  await mapSettled(page)
  const check=await page.evaluate(()=>{
    const m=window.__terraAtlas!.map
    const samples:[string,number,number][]=[['ii',116.4,39.9],['i',113.26,23.13],['iii',87.62,43.83],['iv',91.13,29.65]]
    return samples.map(([id,lng,lat])=>({id,found:m.queryRenderedFeatures(m.project([lng,lat]),{layers:['relations-area']}).map(f=>f.properties?.id)}))
  })
  for(const row of check)expect(row.found).toContain('region-cn-jiang2023-'+row.id)
  await page.screenshot({path:`${test.info().outputDir}/four-regions-${info.project.name}.png`})
  for(const [name,id] of [['北方地区','ii'],['南方地区','i'],['西北地区','iii'],['青藏地区','iv']]){
    const s=await search(page,name,'区域范围')
    expect(s.features).toHaveLength(1);expect(s.features[0].id).toBe('region-cn-jiang2023-'+id);expect(s.features[0].type).toMatch(/Polygon/)
    expect(s.rendered).toContain('region-cn-jiang2023-'+id)
  }
})
test('area presentation: reviewed landforms and continents fit their real ranges through search',async({page},info)=>{
  for(const [name,id] of [['巴西高原','region-1159104225'],['德干高原','region-1159104233'],['大平原','region-1159104319'],['戈壁','region-1159104335'],['非洲','region-1159104365'],['北美洲','region-1159104607']]){
    const s=await search(page,name,'区域范围')
    expect(s.features[0].id).toBe(id);expect(s.features[0].type).toMatch(/Polygon/);expect(s.rendered).toContain(id)
  }
  await page.screenshot({path:`${test.info().outputDir}/area-search-${info.project.name}.png`})
})
test('area presentation: exact Mongolian Plateau search stays separate from Inner Mongolian reference point',async({page})=>{
  const a=await search(page,'蒙古高原','区域范围')
  expect(a.features[0].id).toBe('region-1159104229');expect(a.features[0].type).toBe('Polygon')
  const b=await search(page,'内蒙古高原','定位点')
  expect(b.features).toHaveLength(1);expect(b.features[0].type).toBe('Point')
  const c=await search(page,'珠穆朗玛峰','定位点')
  expect(c.features.every(f=>f.type==='Point')).toBe(true)
  const d=await search(page,'长江','线状要素')
  expect(d.features.some(f=>/LineString/.test(f.type))).toBe(true)
})
