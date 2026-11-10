import {test,expect} from '@playwright/test'
import {baseReady,mapSettled} from './map-readiness'
import {openDiscoveries} from './theme-controls'

test('map topic list: sidebar opens all themes without leaving or moving the map',async({page},info)=>{
  await page.goto('/');await baseReady(page);await openDiscoveries(page);await mapSettled(page)
  const before=await page.evaluate(()=>({center:window.__terraAtlas!.map.getCenter().toArray(),zoom:window.__terraAtlas!.map.getZoom()}))
  await page.locator('.panel-tabs').getByRole('button',{name:'主题地图',exact:true}).click()
  await expect(page.locator('.app')).toHaveAttribute('data-study-screen','map')
  await expect(page.locator('.map-topic-library .topic-library-card')).toHaveCount(32)
  await expect(page.locator('.study-library')).toHaveCount(0)
  if(info.project.name!=='desktop'){
    const field=page.locator('.map-topic-library .topic-search')
    expect((await field.boundingBox())!.height).toBeLessThanOrEqual(40)
    await expect(page.getByRole('searchbox',{name:'搜索主题和主题成员'})).not.toBeFocused()
  }
  const after=await page.evaluate(()=>({center:window.__terraAtlas!.map.getCenter().toArray(),zoom:window.__terraAtlas!.map.getZoom()}))
  expect(after).toEqual(before)
  await page.screenshot({path:info.outputPath('map-topic-list.png')})
  await page.getByRole('searchbox',{name:'搜索主题和主题成员'}).fill('中国地形格局')
  await page.getByRole('button',{name:'选择主题地图：中国地形格局',exact:true}).click()
  await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id','china-terrain')
  await expect(page.locator('.app')).toHaveAttribute('data-study-screen','map')
  await page.getByRole('button',{name:'返回主题列表',exact:true}).click()
  await expect(page.locator('.topic-current-label')).toHaveText('当前主题')
  await expect(page.getByRole('button',{name:'选择主题地图：中国地形格局',exact:true})).toHaveAttribute('aria-current','true')
  await page.locator('.panel-tabs').getByRole('button',{name:'主题地图',exact:true}).click()
  await expect(page.locator('.map-topic-library')).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})

test('map topic list: switching themes stays on map and full reading remains separate',async({page})=>{
  await page.goto('/');await baseReady(page);await openDiscoveries(page)
  await page.locator('.panel-tabs').getByRole('button',{name:'主题地图',exact:true}).click()
  await page.getByRole('searchbox',{name:'搜索主题和主题成员'}).fill('天气')
  await page.getByRole('button',{name:'选择主题地图：天气为什么变化',exact:true}).click()
  await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id','weather-systems')
  await page.getByRole('button',{name:'返回主题列表',exact:true}).click()
  await page.getByRole('searchbox',{name:'搜索主题和主题成员'}).fill('气候变化')
  await page.getByRole('button',{name:'选择主题地图：气候变化与地球环境',exact:true}).click()
  await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id','climate-change')
  await expect(page.locator('.app')).toHaveAttribute('data-study-screen','map')
  await page.getByRole('navigation',{name:'浏览方式'}).getByRole('button',{name:'学主题',exact:true}).click()
  await expect(page.locator('.study-library')).toBeVisible()
  const [articleResponse]=await Promise.all([
    page.waitForResponse(response=>new URL(response.url()).pathname==='/reading/topics/climate-change.json',{timeout:45000}),
    page.getByRole('button',{name:'阅读专题：气候变化与地球环境',exact:true}).click(),
  ])
  expect(articleResponse.ok()).toBe(true)
  expect(await articleResponse.finished()).toBeNull()
  await expect(page.locator('.topic-reading-page:not([hidden]) h1')).toHaveText('气候变化与地球环境')
})
