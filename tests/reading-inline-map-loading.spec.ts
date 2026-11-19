import {expect,test} from '@playwright/test'
import {studyReady as baseReady,sourceLoaded} from './map-readiness'

test.use({reducedMotion:'reduce'})

test('figure map: controls wait for the real geometry before accepting a selection',async({page})=>{
  await page.goto('/#read=china-terrain&chapter=part-china-plateaus&topic=china-terrain')
  await baseReady(page);await sourceLoaded(page,'regions')
  let release=()=>{},requests=0
  const loading=new Promise<void>(resolve=>{release=resolve})
  await page.route('**/data/regions.geojson{,.gz}',async route=>{requests++;await loading;await route.continue()})
  const article=page.locator('.topic-reading-page:not([hidden])')
  const figure=article.locator('[data-media-id="china-plateaus-illustration"]')
  await figure.getByRole('button',{name:'看地图：中国四大高原位置示意',exact:true}).click()
  const inset=figure.locator('.reading-inline-map')
  const place=inset.getByRole('button',{name:'内蒙古高原 区域范围',exact:true})
  try{
    await expect.poll(()=>requests).toBe(1)
    await expect(inset).toHaveAttribute('data-map-ready','false')
    await expect(place).toBeDisabled()
    await expect(inset.getByRole('button',{name:'全部地点',exact:true})).toBeDisabled()
    for(const name of ['放大配图地图','缩小配图地图','查看配图全部地点'])await expect(inset.getByRole('button',{name,exact:true})).toBeDisabled()
    await expect(inset).toHaveAttribute('data-selected-place','')
    await expect(inset.getByRole('button',{name:'在完整地图中继续探索',exact:true})).toBeEnabled()
  }finally{release()}
  await expect(inset).toHaveAttribute('data-map-ready','true',{timeout:30000})
  await expect(place).toBeEnabled()
  await expect.poll(async()=>JSON.parse(await inset.getAttribute('data-relations-geometry')||'[]').filter((feature:{type:string})=>/Polygon/.test(feature.type)).length).toBe(4)
  await place.click()
  await expect(inset).toHaveAttribute('data-selected-place','inner-mongolian-plateau')
  await expect.poll(async()=>JSON.parse(await inset.getAttribute('data-selection-geometry')||'[]')).toEqual([{id:'region-cn-zhang2025-inner-mongolian-plateau',type:'MultiPolygon'}])
})
