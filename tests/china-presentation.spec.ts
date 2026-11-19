import {expect,test} from '@playwright/test'
import {baseReady,mapSettled,selectedGeometry,sourceLoaded} from './map-readiness'

test.use({reducedMotion:'reduce'})

test('China presentation: national highlight includes Taiwan and region records remain Chinese',async({page})=>{
  await page.goto('/#place=china-country&lng=109&lat=32&z=3')
  await baseReady(page);await selectedGeometry(page)
  const result=await page.evaluate(()=>{
    const atlas=window.__terraAtlas!,map=atlas.map
    const regions=atlas.data.countries.features.filter(f=>['country-twn','country-hkg','country-mac'].includes(f.properties.id))
    return regions.map(f=>({id:f.properties.id,name:f.properties.name,kind:f.properties.kind,parent:f.properties.parentCountryId,selected:map.queryRenderedFeatures(map.project(f.properties.center!),{layers:['selection-area']}).some(feature=>feature.properties?.id==='country-chn')}))
  })
  expect(result.map(row=>row.name)).toEqual(['中国香港','中国澳门','中国台湾'])
  expect(result.every(row=>row.kind==='region'&&row.parent==='country-chn')).toBe(true)
  expect(result.find(row=>row.id==='country-twn')?.selected).toBe(true)
  await expect(page.locator('.knowledge-panel h2')).toContainText('中国')
  await page.locator('.place-expanded-details>summary').click()
  await expect(page.getByTestId('china-statistics-scope')).toContainText('中国大陆统计口径')
})

test('China presentation: Taiwan province has a rendered area and Chinese regional statistics',async({page})=>{
  await page.goto('/#topic=china-provinces&place=taiwan-province')
  await baseReady(page);await selectedGeometry(page);await sourceLoaded(page,'provinces')
  const result=await page.evaluate(()=>{
    const atlas=window.__terraAtlas!,map=atlas.map
    const selection=map.getSource('selection')!.serialize() as {data:{features:{geometry:{type:string};properties:{id:string}}[]}}
    return {features:selection.data.features.map(f=>({id:f.properties.id,type:f.geometry.type})),rendered:map.queryRenderedFeatures(map.project([121,24]),{layers:['selection-area']}).map(f=>f.properties?.id)}
  })
  expect(result.features).toEqual([{id:'province-cn-71',type:'MultiPolygon'}])
  expect(result.rendered).toContain('province-cn-71')
  await expect(page.locator('.knowledge-panel h2')).toContainText('台湾省')
  await page.locator('.place-expanded-details>summary').click()
  await expect(page.getByTestId('china-statistics-scope')).toContainText('中国台湾地区资料')
  await expect(page.locator('.knowledge-panel')).toContainText('所属国家')
  await expect(page.locator('.knowledge-panel')).not.toContainText('中华民国')
})

test('China presentation: thematic statistics retain their original regional footprints',async({page})=>{
  for(const [topic,layer] of [['map-language','language-overview-fill'],['map-religion','religion-fill']]){
    await page.goto(`/#topic=${topic}&lng=121&lat=24&z=6`)
    await baseReady(page)
    if(topic==='map-religion')await page.waitForFunction(()=>!!window.__terraAtlas?.data.religion?.features.length)
    await mapSettled(page)
    const ids=await page.evaluate(layer=>window.__terraAtlas!.map.queryRenderedFeatures(window.__terraAtlas!.map.project([121,24]),{layers:[layer]}).map(f=>f.properties?.id),layer)
    expect(ids).toContain('country-twn')
    expect(ids).not.toContain('country-chn')
    if(topic==='map-language'){
      const sheetHandle=page.getByRole('button',{name:'调整阅读面板大小',exact:true})
      if(await sheetHandle.isVisible())await sheetHandle.press('Home')
      await mapSettled(page)
      const point=await page.evaluate(()=>{const p=window.__terraAtlas!.map.project([121,24.1]);return {x:p.x,y:p.y}})
      await page.mouse.click(point.x,point.y)
      await expect(page.locator('.knowledge-panel h2')).toHaveText('中国台湾')
      await page.locator('.place-expanded-details>summary').click()
      await expect(page.getByTestId('china-statistics-scope')).toContainText('中国台湾地区资料')
      await expect(page.locator('.knowledge-panel')).toContainText('所属国家')
      await expect(page.locator('.knowledge-panel')).not.toContainText('中华民国')
    }
  }
})

test('China presentation: official China names and Taiwan searches use consistent Chinese geography',async({page})=>{
  await page.goto('/')
  await baseReady(page)
  const input=page.getByRole('combobox',{name:'搜索地理对象'})
  await input.fill('中华人民共和国')
  const china=page.locator('.search-results>button').first()
  await expect(china).toContainText('中国')
  await china.click();await selectedGeometry(page)
  expect(await page.evaluate(()=>window.__terraAtlas!.map.queryRenderedFeatures(window.__terraAtlas!.map.project([121,24]),{layers:['selection-area']}).some(feature=>feature.properties?.id==='country-chn'))).toBe(true)
  await input.fill('中国台湾')
  const results=page.locator('.search-results')
  await expect(results).toContainText('中国台湾')
  await expect(results).not.toContainText('中华民国')
  await results.locator('button').first().click()
  await selectedGeometry(page)
  await expect(page.locator('.knowledge-panel')).toContainText('中国')
})
