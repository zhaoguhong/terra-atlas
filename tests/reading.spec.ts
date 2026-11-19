import {expect,test,type Page} from '@playwright/test'
import {studyReady as baseReady,selectedGeometry,mapSettled} from './map-readiness'
import {clickHeaderAction} from './header-actions'
import rawTopics from '../src/data/topics.json' with {type:'json'}

async function catalogue(page:Page){
  await page.getByRole('navigation',{name:'浏览方式'}).getByRole('link',{name:'学主题',exact:true}).click()
  await expect(page.locator('.study-library')).toBeVisible()
}
async function readTopic(page:Page,title='常见地貌与中国典型景观'){
  await catalogue(page)
  await page.getByRole('searchbox',{name:'搜索主题和主题成员'}).fill(title)
  await page.getByRole('link',{name:'阅读专题：'+title,exact:true}).click()
  await expect(page.locator('.topic-reading-page:not([hidden]) h1')).toHaveText(title)
}
const reader=(page:Page)=>page.locator('.topic-reading-page:not([hidden])')
const progress=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')||'{}').readingProgress?.['landform-landscapes'])
async function selectChapter(page:Page,id:string){
  const nav=reader(page).getByRole('navigation',{name:'专题章节'})
  const select=nav.getByRole('combobox',{name:'跳转专题章节'})
  if(await select.isVisible())await select.selectOption(id)
  else{
    const title=await reader(page).locator(`[data-reading-section="${id}"] h2`).innerText()
    await nav.getByRole('button',{name:title,exact:true}).click()
  }
}
async function expectChapter(page:Page,id:string){
  const nav=reader(page).getByRole('navigation',{name:'专题章节'})
  const select=nav.getByRole('combobox',{name:'跳转专题章节'})
  if(await select.isVisible())await expect(select).toHaveValue(id)
  else{
    const title=await reader(page).locator(`[data-reading-section="${id}"] h2`).innerText()
    await expect(nav.getByRole('button',{name:title,exact:true})).toHaveAttribute('aria-current','location')
  }
}

test('reading: simple map, searchable catalogue, full article and attributed image dialog',async({page})=>{
  const requests:string[]=[],errors:string[]=[]
  page.on('request',r=>{if(r.url().includes('/reading/topics/'))requests.push(r.url())})
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto('/');await baseReady(page)
  expect(requests).toHaveLength(0)
  await catalogue(page)
  await expect(page.locator('.topic-library-card')).toHaveCount(rawTopics.length)
  expect(requests).toHaveLength(0)
  await page.getByRole('searchbox',{name:'搜索主题和主题成员'}).fill('岩溶')
  await expect(page.getByRole('button',{name:'打开专题：常见地貌与中国典型景观',exact:true})).toBeVisible()
  const [response]=await Promise.all([
    page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/reading/topics/landform-landscapes.json')),
    page.getByRole('button',{name:'打开专题：常见地貌与中国典型景观',exact:true}).click(),
  ])
  expect(response.ok()).toBe(true)
  expect(await response.finished()).toBeNull()
  await expect(reader(page).locator('h1')).toHaveText('常见地貌与中国典型景观')
  const chapters=reader(page).getByRole('navigation',{name:'专题章节'})
  const chapterSelect=chapters.getByRole('combobox',{name:'跳转专题章节'})
  if(await chapterSelect.isVisible()){
    await expect(chapterSelect.locator('option')).toHaveCount(10)
    await expect(chapterSelect.locator('option[value="introduction"]')).toHaveText('主题概览')
    await expect(chapterSelect.locator('option[value="questions"]')).toHaveCount(0)
  }else{
    await expect(chapters.getByRole('button')).toHaveCount(10)
    await expect(chapters.getByRole('button',{name:'主题概览',exact:true})).toBeVisible()
  }
  await expect(reader(page).getByRole('heading',{name:'看图与思考',exact:true})).toHaveCount(0)
  await expect(reader(page)).toContainText('洞顶向下垂的是钟乳石，洞底向上长的是石笋')
  const photo=reader(page).locator('img[src$="guilin-photo.jpg"]')
  await photo.scrollIntoViewIfNeeded()
  await expect.poll(()=>photo.evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0)
  await reader(page).getByRole('button',{name:'放大图片：桂林漓江岩溶景观',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'桂林漓江岩溶景观',exact:true})
  await expect(dialog).toBeVisible();await expect(dialog).toContainText('Huangdan2060')
  await expect(dialog.getByRole('link',{name:'CC0 1.0'})).toHaveAttribute('href',/^https:/)
  await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible()
  await expect(page.locator('.app')).toHaveAttribute('data-study-screen','article')
  await reader(page).getByRole('button',{name:'主题目录',exact:true}).click()
  await expect(page.locator('.study-library')).toBeVisible()
  await page.goBack();await expect(reader(page)).toBeVisible()
  expect(requests).toHaveLength(1);expect(errors).toEqual([])
})

test('reading: case map and browser navigation preserve chapter, position and selected geometry',async({page})=>{
  await page.goto('/');await baseReady(page);await readTopic(page)
  await selectChapter(page,'karst')
  const chapter=reader(page).locator('[data-reading-section="karst"]')
  await expect.poll(async()=>(await progress(page))?.sectionId).toBe('karst')
  await chapter.getByRole('button',{name:'在地图上看 · 桂林喀斯特 · 漓江段',exact:true}).scrollIntoViewIfNeeded()
  const top=await reader(page).locator('.reading-body').evaluate(e=>e.scrollTop)
  await chapter.getByRole('button',{name:'在地图上看 · 桂林喀斯特 · 漓江段',exact:true}).click()
  await expect(page.locator('.knowledge-panel h2')).toHaveText('桂林喀斯特 · 漓江段')
  await selectedGeometry(page)
  await mapSettled(page)
  await expect.poll(()=>page.evaluate(()=>{
    const source=window.__terraAtlas!.map.getSource('selection')!.serialize() as {data:{features:{geometry:{type:string}}[]}}
    return source.data.features.map(f=>f.geometry.type)
  })).toEqual(['Point'])
  const mapState=await page.evaluate(()=>({center:window.__terraAtlas!.map.getCenter().toArray(),zoom:window.__terraAtlas!.map.getZoom()}))
  await page.locator('.reading-return-button').click()
  await expect(reader(page)).toBeVisible()
  expect(Math.abs(await reader(page).locator('.reading-body').evaluate(e=>e.scrollTop)-top)).toBeLessThan(30)
  await reader(page).getByRole('button',{name:'返回地图',exact:true}).click()
  await expect(page.locator('.knowledge-panel h2')).toHaveText('桂林喀斯特 · 漓江段')
  const restored=await page.evaluate(()=>({center:window.__terraAtlas!.map.getCenter().toArray(),zoom:window.__terraAtlas!.map.getZoom()}))
  expect(restored.zoom).toBeCloseTo(mapState.zoom,3)
  await page.goBack();await expect(reader(page)).toBeVisible()
  await page.goForward();await expect(page.locator('.app')).toHaveAttribute('data-study-screen','map')
  await page.locator('.reading-return-button').click()
  await page.reload();await baseReady(page);await readTopic(page)
  await expectChapter(page,'karst')
})

test('reading: bookmarks, export/import and a cold shared chapter',async({page,context,browser})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write'])
  await page.goto('/');await baseReady(page);await readTopic(page)
  await reader(page).getByRole('button',{name:'收藏专题',exact:true}).click()
  await selectChapter(page,'granite')
  await reader(page).getByRole('button',{name:'分享专题阅读',exact:true}).click()
  await expect(page.locator('.reading-toast')).toContainText('已复制')
  const url=await page.evaluate(()=>navigator.clipboard.readText())
  expect(new URL(url).pathname).toBe('/topics/landform-landscapes/');expect(new URL(url).hash).toBe('#granite')
  const cold=await browser.newContext({viewport:page.viewportSize()!}),other=await cold.newPage()
  await other.goto(url);await baseReady(other)
  await expect(reader(other).locator('h1')).toHaveText('常见地貌与中国典型景观')
  await expectChapter(other,'granite')
  await clickHeaderAction(page,'打开收藏')
  await expect(page.locator('.saved-reading-topics')).toContainText('常见地貌与中国典型景观')
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出记录',exact:true}).click()
  const file=await download,stream=await file.createReadStream(),chunks:Buffer[]=[]
  for await(const chunk of stream!)chunks.push(chunk)
  const buffer=Buffer.concat(chunks),data=JSON.parse(buffer.toString())
  expect(data.preferences.savedTopics).toContain('landform-landscapes')
  expect(data.preferences.readingProgress['landform-landscapes'].sectionId).toBe('granite')
  await clickHeaderAction(other,'打开收藏')
  await other.locator('input[type="file"]').setInputFiles({name:'records.json',mimeType:'application/json',buffer})
  await expect.poll(()=>other.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).savedTopics)).toContain('landform-landscapes')
  await cold.close()
})

test('reading: article and image failures have a working retry',async({page})=>{
  const article='**/reading/topics/landform-landscapes.json'
  await page.route(article,route=>route.fulfill({status:503,body:'unavailable'}))
  await page.goto('/');await baseReady(page);await catalogue(page)
  await page.getByRole('link',{name:'阅读专题：常见地貌与中国典型景观',exact:true}).click()
  await expect(reader(page).getByRole('alert')).toContainText('暂未加载成功')
  await page.unroute(article)
  await page.route('**/media/reading/guilin-photo.jpg',route=>route.abort())
  await reader(page).getByRole('button',{name:'重新加载',exact:true}).click()
  await expect(reader(page).locator('h1')).toHaveText('常见地貌与中国典型景观')
  await reader(page).locator('[data-media-id="guilin-photo"]').scrollIntoViewIfNeeded()
  await expect(reader(page).getByRole('button',{name:'重新加载图片',exact:true})).toBeVisible()
  await page.unroute('**/media/reading/guilin-photo.jpg')
  await reader(page).getByRole('button',{name:'重新加载图片',exact:true}).click()
  await expect.poll(()=>reader(page).locator('img[src$="guilin-photo.jpg"]').evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0)
  await reader(page).getByRole('button',{name:'返回地图',exact:true}).click()
  await expect(page.locator('.app')).toHaveAttribute('data-study-screen','map')
})

test('reading: every subject group has readable local images and stable light/dark layouts',async({page},info)=>{
  await page.goto('/');await baseReady(page)
  for(const title of ['中国区域与南北差异','岩石与地貌的形成','中国河流与湖泊','气候分布与成因','人口分布、变化与迁移','能源、矿产与产业','地球自转、季节与地方时']){
    await readTopic(page,title)
    const image=reader(page).locator('.reading-image-button img').first()
    await image.scrollIntoViewIfNeeded()
    await expect.poll(()=>image.evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0)
    expect(await reader(page).locator('.article-section>p').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  }
  await page.screenshot({path:info.outputPath('reading-light.png')})
  await page.emulateMedia({colorScheme:'dark'})
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
  await page.screenshot({path:info.outputPath('reading-dark.png')})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})

test('reading: map overview stays compact and full text is requested only on demand',async({page})=>{
  const requests:string[]=[];page.on('request',request=>{if(request.url().includes('/reading/topics/'))requests.push(request.url())})
  await page.goto('/');await baseReady(page);await catalogue(page)
  await page.getByRole('button',{name:'在地图上看：常见地貌与中国典型景观',exact:true}).click()
  await expect(page.locator('.topic-reader h1')).toHaveText('常见地貌与中国典型景观')
  await expect(page.locator('.topic-expanded-intro')).not.toHaveAttribute('open','')
  await expect(page.locator('.topic-preview-members').filter({hasText:'地点与学习模块'})).not.toHaveAttribute('open','')
  expect(requests).toHaveLength(0)
  await page.getByRole('button',{name:'阅读完整专题',exact:true}).click()
  await expect(reader(page).locator('h1')).toHaveText('常见地貌与中国典型景观')
  expect(requests).toHaveLength(1)
})
