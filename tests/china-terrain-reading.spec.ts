import {expect,test} from '@playwright/test'
import {studyReady as baseReady,selectedGeometry} from './map-readiness'

test.use({reducedMotion:'reduce'})

test('terrain article: opening illustrations, enlargement and real-map return',async({page},info)=>{
  const errors:string[]=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto('/#read=china-terrain&chapter=part-china-plateaus&topic=china-terrain')
  await baseReady(page)
  const reader=page.locator('.topic-reading-page:not([hidden])')
  await expect(reader.locator('h1')).toHaveText('中国地形格局')
  await expect(reader.locator('.reading-illustration')).toHaveCount(4)
  for(const name of ['mountains','plateaus','basins','plains']){
    const figure=reader.locator(`[data-media-id="china-${name}-illustration"]`)
    await figure.locator('.reading-image-button').scrollIntoViewIfNeeded()
    await expect.poll(()=>figure.locator('.reading-image-button img').evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBe(1536)
    expect(await figure.evaluate(element=>{
      const section=element.closest('.article-section')!
      return section.querySelector('h2')!.nextElementSibling===element&&element.nextElementSibling?.tagName==='P'
    })).toBe(true)
    await expect(figure.locator('figcaption')).toContainText('AI 辅助制图')
    await expect(figure.getByRole('link',{name:'参考资料',exact:true})).toHaveAttribute('href',/^https:\/\//)
    expect(await reader.locator('.reading-body').evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true)
    await page.screenshot({path:info.outputPath(`${name}.png`)})
  }
  const plateaus=reader.locator('[data-media-id="china-plateaus-illustration"]')
  const enlarge=plateaus.getByRole('button',{name:'放大图片：中国四大高原位置示意',exact:true})
  await enlarge.click()
  const dialog=page.getByRole('dialog',{name:'中国四大高原位置示意',exact:true})
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('不代表精确边界')
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(enlarge).toBeFocused()
  const explore=plateaus.getByRole('button',{name:'在山河图中探索：内蒙古高原',exact:true})
  await explore.scrollIntoViewIfNeeded()
  const top=await reader.locator('.reading-body').evaluate(element=>element.scrollTop)
  await explore.click()
  await expect(page.locator('.knowledge-panel h2')).toHaveText('内蒙古高原')
  await selectedGeometry(page)
  expect(await page.evaluate(()=>{
    const data=window.__terraAtlas!.map.getSource('selection')!.serialize() as {data:{features:{geometry:{type:string}}[]}}
    return data.data.features.map(feature=>feature.geometry.type)
  })).toEqual(['MultiPolygon'])
  await page.locator('.reading-return-button').click()
  await expect(reader).toBeVisible()
  await expect.poll(async()=>Math.abs(await reader.locator('.reading-body').evaluate(element=>element.scrollTop)-top)).toBeLessThan(4)
  await page.reload();await baseReady(page)
  await expect(reader.locator('h1')).toHaveText('中国地形格局')
  await expect.poll(async()=>Math.abs(await reader.locator('.reading-body').evaluate(element=>element.scrollTop)-top)).toBeLessThan(4)
  expect(errors).toEqual([])
})
