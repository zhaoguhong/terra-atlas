import {expect,test,type Page} from '@playwright/test'
import {baseReady,mapSettled,selectedGeometry} from './map-readiness'
import {openThemeLibrary} from './theme-controls'

const reader=(page:Page)=>page.locator('.topic-reading-page:not([hidden])')
async function openTopic(page:Page,title:string,articleId?:string){
  await openThemeLibrary(page)
  await page.getByRole('searchbox',{name:'搜索主题和主题成员'}).fill(title)
  const button=page.getByRole('button',{name:'阅读专题：'+title,exact:true})
  if(articleId){
    const [response]=await Promise.all([
      page.waitForResponse(response=>new URL(response.url()).pathname===`/reading/topics/${articleId}.json`,{timeout:45000}),
      button.click(),
    ])
    expect(response.ok()).toBe(true)
    expect(await response.finished()).toBeNull()
  }else await button.click()
  await expect(reader(page).locator('h1')).toHaveText(title)
}

test('consolidation: 32 main subjects and direct access to retired titles inside the same article',async({page},info)=>{
  await page.goto('/');await baseReady(page);await openThemeLibrary(page)
  await expect(page.locator('.topic-library-card')).toHaveCount(32)
  for(const [query,chapter] of [['四大盆地','中国四大盆地'],['四大高原','中国四大高原']] as const){
    await openThemeLibrary(page)
    await page.getByRole('searchbox',{name:'搜索主题和主题成员'}).fill(query)
    await expect(page.getByRole('button',{name:'打开专题：中国地形格局',exact:true})).toBeVisible()
    await page.getByRole('button',{name:'直达章节 · '+chapter,exact:true}).click()
    await expect(reader(page).locator('h1')).toHaveText('中国地形格局')
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).readingProgress?.['china-terrain']?.sectionId)).toBe(query==='四大盆地'?'part-china-basins':'part-china-plateaus')
  }
  await expect(reader(page).locator('.reading-part-index button')).toHaveCount(5)
  const select=reader(page).getByRole('combobox',{name:'跳转专题章节'})
  if(await select.isVisible())await select.selectOption('china-plains-module-yangtze')
  else{
    const group=reader(page).locator('.reading-toc-groups details').filter({hasText:'中国主要平原'})
    await group.locator('summary').click()
    await group.getByRole('button',{name:'长江中下游平原',exact:true}).click()
  }
  const chapter=reader(page).locator('[data-reading-section="china-plains-module-yangtze"]')
  await chapter.getByRole('button',{name:'在地图上看',exact:true}).click()
  await selectedGeometry(page);await mapSettled(page)
  await expect(page.locator('.knowledge-panel h2')).toHaveText('长江中下游平原')
  await page.locator('.reading-return-button').click()
  await expect(reader(page)).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:info.outputPath('grouped-reading.png')})
  await page.emulateMedia({colorScheme:'dark'})
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
  await page.waitForFunction(()=>!document.getAnimations().some(animation=>animation.playState==='running'))
  await page.screenshot({path:info.outputPath('grouped-reading-dark.png')})
})

test('consolidation: Danxia and all fourteen summits retain their own reading and map cases',async({page})=>{
  await page.goto('/');await baseReady(page);await openThemeLibrary(page)
  await page.getByRole('searchbox',{name:'搜索主题和主题成员'}).fill('丹霞')
  await page.getByRole('button',{name:'直达章节 · 丹霞与红层景观',exact:true}).click()
  await expect(reader(page).locator('h1')).toHaveText('岩石与地貌形成')
  await expect(reader(page).locator('[data-reading-section="part-landform-danxia"] img')).toHaveAttribute('src',/danxia-photo/)
  const danxia=reader(page).locator('[data-reading-section="landform-danxia-module-case-danxiashan"]')
  await danxia.getByRole('button',{name:'在地图上看',exact:true}).click();await selectedGeometry(page)
  await expect(page.locator('.knowledge-panel h2')).toHaveText('丹霞山')
  await openTopic(page,'世界地形与山系')
  const summits=reader(page).locator('[data-reading-section^="world-high-peaks-module-"] .reading-cases button')
  await expect(summits).toHaveCount(14)
  await summits.first().click();await selectedGeometry(page)
  expect(await page.evaluate(()=>JSON.stringify(window.__terraAtlas!.map.getSource('selection')!.serialize()))).toContain('peak-wikidata-')
})

for(const [id,title,claim] of [['weather-systems','天气为什么变化','较冷空气推进、替代较暖空气，形成冷锋'],['climate-change','气候变化与地球环境','判断气候变化，要把较长时期的观测放在一起']] as const){
  test(`atmosphere: ${id} has sourced explanations, a real diagram and working map cases`,async({page},info)=>{
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
    await page.goto('/');await baseReady(page);await openTopic(page,title,id)
    await expect(reader(page)).toContainText(claim)
    await expect.poll(()=>reader(page).locator('img').first().evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0)
    await reader(page).locator('.article-sources summary').click()
    await expect(reader(page).locator('.article-sources a').filter({hasText:id==='weather-systems'?'NOAA':'NASA'}).first()).toBeVisible()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await reader(page).locator('.reading-body').evaluate(element=>element.scrollTop=0)
    await page.screenshot({path:info.outputPath(id+'.png')})
    await reader(page).locator('.reading-cases button').first().click();await selectedGeometry(page);await mapSettled(page)
    await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id',id)
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).layers.climate)).toBe(false)
    await page.locator('.reading-return-button').click();await expect(reader(page).locator('h1')).toHaveText(title)
    expect(errors).toEqual([])
  })
}

test('consolidation: new bookmarks and shared group chapters work in a fresh browser',async({page,context,browser})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write'])
  await page.goto('/');await baseReady(page);await openTopic(page,'农业与粮食系统')
  await reader(page).locator('.reading-part-index button').filter({hasText:'世界农业与粮食联系'}).click()
  await reader(page).getByRole('button',{name:'收藏专题',exact:true}).click()
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).savedTopics)).toContain('agriculture-food')
  await reader(page).getByRole('button',{name:'分享专题阅读',exact:true}).click()
  await expect(page.locator('.reading-toast')).toContainText('已复制')
  const url=await page.evaluate(()=>navigator.clipboard.readText())
  expect(url).toContain('read=agriculture-food');expect(url).toContain('chapter=part-world-agriculture-food')
  const fresh=await browser.newContext({viewport:page.viewportSize()!}),other=await fresh.newPage()
  await other.goto(url);await baseReady(other)
  await expect(reader(other).locator('h1')).toHaveText('农业与粮食系统')
  await expect.poll(()=>other.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).readingProgress?.['agriculture-food']?.sectionId)).toBe('part-world-agriculture-food')
  await fresh.close()
})
