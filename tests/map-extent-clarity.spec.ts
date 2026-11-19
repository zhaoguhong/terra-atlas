import {expect,test,type Page} from '@playwright/test'
import {baseReady,mapSettled,selectedGeometry,sourceLoaded} from './map-readiness'
import {chooseTheme} from './theme-controls'
import bindings from '../src/data/feature-bindings.json' with {type:'json'}

test.use({reducedMotion:'reduce'})
test.setTimeout(120000)

async function searchPlace(page:Page,name:string){
  await page.getByRole('combobox',{name:'搜索地理对象'}).fill(name)
  const result=page.locator('.search-results>button').first()
  await expect(result).toContainText(name)
  await result.click();await selectedGeometry(page)
}

test('map extent clarity: five oceans render their bound reference areas in the theme',async({page},info)=>{
  await page.goto('/');await baseReady(page)
  await chooseTheme(page,'五大洋',false)
  await sourceLoaded(page,'marine-regions');await mapSettled(page)
  const ids=['pacific-ocean','atlantic-ocean','indian-ocean','arctic-ocean','southern-ocean']
  const expected=ids.flatMap(id=>(bindings as Record<string,string[]>)[id])
  await expect.poll(()=>page.evaluate(()=>{
    const map=window.__terraAtlas!.map
    return [...new Set(map.queryRenderedFeatures({layers:['relations-area']}).map(feature=>String(feature.properties?.id)))]
  })).toEqual(expect.arrayContaining(expected))
  const representation=await page.evaluate(()=>{
    const source=window.__terraAtlas!.map.getSource('relations')!.serialize() as {data:{features:{geometry:{type:string};properties:{topicMemberId:string}}[]}}
    return source.data.features.map(feature=>({member:feature.properties.topicMemberId,type:feature.geometry.type}))
  })
  expect(representation.every(feature=>/Polygon/.test(feature.type))).toBe(true)
  for(const id of ids)expect(representation.some(feature=>feature.member===id)).toBe(true)
  await page.screenshot({path:info.outputPath('five-oceans-rendered-extents.png')})
})

test('map extent clarity: ocean and strait searches render areas and show their scope above details',async({page})=>{
  const errors:string[]=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto('/');await baseReady(page)
  for(const [name,id] of [['太平洋','pacific-ocean'],['大西洋','atlantic-ocean'],['印度洋','indian-ocean'],['北冰洋','arctic-ocean'],['南大洋','southern-ocean'],['马六甲海峡','malacca-strait'],['直布罗陀海峡','gibraltar-strait'],['地中海','mediterranean']] as const){
    await searchPlace(page,name)
    const expected=(bindings as Record<string,string[]>)[id]
    await expect.poll(()=>page.evaluate(()=>{
      const map=window.__terraAtlas!.map
      return [...new Set(map.queryRenderedFeatures({layers:['selection-area']}).map(feature=>String(feature.properties?.id)))]
    })).toEqual(expect.arrayContaining(expected))
    const note=page.locator('.knowledge-panel .map-extent-description')
    await note.scrollIntoViewIfNeeded()
    await expect(note).toHaveAttribute('data-representation','area')
    await expect(note).toBeVisible()
    await expect(note).toContainText('参考范围')
    await expect(note.locator('strong')).toContainText('区域范围')
    await expect(page.locator('.place-expanded-details')).not.toHaveAttribute('open','')
  }
  expect(errors).toEqual([])
})

test('map extent clarity: a point-only regional case explains its limitation before expanding details',async({page})=>{
  await page.goto('/');await baseReady(page)
  await searchPlace(page,'恒河平原')
  const note=page.locator('.knowledge-panel .map-extent-description')
  await note.scrollIntoViewIfNeeded()
  await expect(note).toHaveAttribute('data-representation','point')
  await expect(note).toBeVisible()
  await expect(note.locator('strong')).toHaveText('定位点')
  await expect(note).toContainText('恒河平原')
  await expect(page.locator('.place-expanded-details')).not.toHaveAttribute('open','')
  expect(await page.evaluate(()=>{
    const source=window.__terraAtlas!.map.getSource('selection')!.serialize() as {data:{features:{geometry:{type:string}}[]}}
    return source.data.features.map(feature=>feature.geometry.type)
  })).toEqual(['Point'])
})

test('map extent clarity: reviewed catalogue names keep central Brazil and Arctic Bear Islands distinct',async({page})=>{
  await page.goto('/');await baseReady(page)
  await searchPlace(page,'巴西中央高原')
  await expect(page.locator('.knowledge-panel h2')).toHaveText('巴西中央高原')
  await expect.poll(()=>page.evaluate(()=>window.__terraAtlas!.map.queryRenderedFeatures({layers:['selection-area']}).map(feature=>feature.properties?.id))).toContain('region-1159104049')
  await searchPlace(page,'巴西高原')
  await expect(page.locator('.knowledge-panel h2')).toContainText('巴西高原')
  await expect.poll(()=>page.evaluate(()=>window.__terraAtlas!.map.queryRenderedFeatures({layers:['selection-area']}).map(feature=>feature.properties?.id))).toContain('region-1159104225')
  await page.getByRole('combobox',{name:'搜索地理对象'}).fill('Batu Islands')
  await expect(page.locator('.search-results')).not.toContainText('熊岛')
  await page.getByRole('combobox',{name:'搜索地理对象'}).fill('Bear Islands')
  await expect(page.locator('.search-results')).toContainText('熊岛（东西伯利亚海）')
})
