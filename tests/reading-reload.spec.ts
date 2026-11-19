import {expect,test,type Page} from '@playwright/test'
import {studyReady as baseReady,articleReady,selectedGeometry} from './map-readiness'

const reader=(page:Page)=>page.locator('.topic-reading-page:not([hidden])')
async function chapterNavigation(page:Page){
  // The main map may be ready while the lazy reader is still loading. Wait
  // for its article before deciding which responsive chapter control to use.
  await articleReady(page)
  const nav=reader(page).getByRole('navigation',{name:'专题章节'})
  await expect(nav).toBeVisible()
  return nav
}
async function selectChapter(page:Page,id:string){
  const nav=await chapterNavigation(page)
  const select=nav.getByRole('combobox',{name:'跳转专题章节'})
  if(await select.isVisible())await select.selectOption(id)
  else{
    const title=await reader(page).locator(`[data-reading-section="${id}"] h2`).innerText()
    await nav.getByRole('button',{name:title,exact:true}).click()
  }
}
async function expectChapter(page:Page,id:string){
  const nav=await chapterNavigation(page)
  const select=nav.getByRole('combobox',{name:'跳转专题章节'})
  if(await select.isVisible())await expect(select).toHaveValue(id)
  else{
    const title=await reader(page).locator(`[data-reading-section="${id}"] h2`).innerText()
    await expect(nav.getByRole('button',{name:title,exact:true})).toHaveAttribute('aria-current','location')
  }
}
async function catalogue(page:Page){
  await page.getByRole('navigation',{name:'浏览方式'}).getByRole('link',{name:'学主题',exact:true}).click()
  await expect(page.locator('.study-library')).toBeVisible()
}
async function openArticle(page:Page){
  await catalogue(page)
  await page.getByRole('link',{name:'阅读专题：常见地貌与中国典型景观',exact:true}).click()
  await articleReady(page,'landform-landscapes')
  await expect(reader(page).locator('h1')).toHaveText('常见地貌与中国典型景观')
}
async function scrollWithinChapter(page:Page){
  await selectChapter(page,'granite')
  return reader(page).locator('.reading-body').evaluate(panel=>{
    const block=panel.querySelector<HTMLElement>('[data-reading-section="granite"]')!
    panel.scrollTop+=block.getBoundingClientRect().top-panel.getBoundingClientRect().top+block.offsetHeight*.35-18
    return panel.scrollTop
  })
}
async function expectPosition(page:Page,top:number){
  await articleReady(page,'landform-landscapes')
  await expect(reader(page).locator('h1')).toHaveText('常见地貌与中国典型景观')
  await expectChapter(page,'granite')
  await expect.poll(async()=>Math.abs(await reader(page).locator('.reading-body').evaluate(panel=>panel.scrollTop)-top)).toBeLessThan(4)
}

test('navigation works when randomUUID is unavailable on an HTTP origin',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(crypto,'randomUUID',{value:undefined}))
  await page.goto('/');await baseReady(page)
  const mapEntryId=await page.evaluate(()=>history.state.terraAtlasEntryId)
  await openArticle(page)
  const articleEntryId=await page.evaluate(()=>history.state.terraAtlasEntryId)
  expect(articleEntryId).toBeTruthy()
  expect(articleEntryId).not.toBe(mapEntryId)
  await page.reload();await baseReady(page)
  await articleReady(page,'landform-landscapes')
  await expect(reader(page).locator('h1')).toHaveText('常见地貌与中国典型景观')
  expect(await page.evaluate(()=>history.state.terraAtlasEntryId)).toBe(articleEntryId)
})

test('reload: catalogue keeps search, scope and category, with browser back and forward',async({page})=>{
  await page.goto('/');await baseReady(page)
  await expect(page.locator('.app')).toHaveAttribute('data-study-screen','map')
  await catalogue(page)
  await page.getByRole('group',{name:'主题范围'}).getByRole('button',{name:'中国地理',exact:true}).click()
  await expect(page.locator('.topic-category-filters')).toHaveAttribute('open','')
  await page.getByRole('button',{name:'地形地貌',exact:true}).click()
  await page.getByRole('searchbox',{name:'搜索主题和主题成员'}).fill('喀斯特')
  await page.reload();await baseReady(page)
  await expect(page.locator('.study-library')).toBeVisible()
  await expect(page.getByRole('searchbox',{name:'搜索主题和主题成员'})).toHaveValue('喀斯特')
  await expect(page.getByRole('button',{name:'中国地理',exact:true})).toHaveAttribute('aria-pressed','true')
  await expect(page.getByRole('button',{name:'地形地貌',exact:true})).toHaveAttribute('aria-pressed','true')
  await expect(page.getByRole('button',{name:'打开专题：常见地貌与中国典型景观',exact:true})).toBeVisible()
  await page.goBack();await expect(page.locator('.app')).toHaveAttribute('data-study-screen','map')
  await page.goForward();await expect(page.locator('.study-library')).toBeVisible()
  await expect(page.getByRole('searchbox',{name:'搜索主题和主题成员'})).toHaveValue('喀斯特')
  // Existing tabs from the previous release already contain navigation, but no URL marker.
  await page.evaluate(()=>history.replaceState({terraAtlasNavigation:history.state.terraAtlasNavigation},''))
  await page.reload();await baseReady(page)
  await expect(page.locator('.study-library')).toBeVisible()
  await expect(page.getByRole('searchbox',{name:'搜索主题和主题成员'})).toHaveValue('喀斯特')
})

test('reload: article restores position, including a scroll immediately before refresh',async({page},info)=>{
  await page.goto('/');await baseReady(page);await openArticle(page)
  const top=await scrollWithinChapter(page)
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')||'{}').readingProgress?.['landform-landscapes']?.offset)).toBeGreaterThan(.3)
  await page.reload();await baseReady(page);await expectPosition(page,top)
  const latest=await reader(page).locator('.reading-body').evaluate(panel=>{panel.scrollTop+=80;return panel.scrollTop})
  await page.reload();await baseReady(page);await expectPosition(page,latest)
  await page.screenshot({path:info.outputPath('restored-reading.png')})
})

test('reload: a shared chapter starts fresh but refreshing keeps subsequent reading or catalogue navigation',async({page,context})=>{
  const link='/#read=landform-landscapes&chapter=granite&topic=landform-landscapes'
  await page.goto(link);await baseReady(page)
  await expectChapter(page,'granite')
  await selectChapter(page,'karst')
  await page.reload();await baseReady(page)
  await expectChapter(page,'karst')
  await catalogue(page);await page.reload();await baseReady(page)
  await expect(page.locator('.study-library')).toBeVisible()
  const other=await context.newPage()
  await other.goto(link);await baseReady(other)
  await expectChapter(other,'granite')
  await other.goto('/');await baseReady(other)
  await expect(other.locator('.app')).toHaveAttribute('data-study-screen','map')
  await other.close()
})

test('reload: case map stays on the map and can return to the saved article',async({page})=>{
  await page.goto('/');await baseReady(page);await openArticle(page)
  await selectChapter(page,'karst')
  await reader(page).locator('[data-reading-section="karst"]').getByRole('button',{name:'在地图上看 · 桂林喀斯特 · 漓江段',exact:true}).click()
  await selectedGeometry(page)
  await page.reload();await baseReady(page)
  await expect(page.locator('.app')).toHaveAttribute('data-study-screen','map')
  await expect(page.locator('.knowledge-panel h2')).toHaveText('桂林喀斯特 · 漓江段')
  await selectedGeometry(page)
  await page.locator('.reading-return-button').click()
  await expectChapter(page,'karst')
  await page.goBack();await expect(page.locator('.app')).toHaveAttribute('data-study-screen','map')
  await page.goForward();await expect(reader(page)).toBeVisible()
})

test('reload: another tab reading the same topic does not overwrite this entry position',async({page,context})=>{
  await page.goto('/');await baseReady(page);await openArticle(page)
  const top=await scrollWithinChapter(page)
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')||'{}').readingProgress?.['landform-landscapes']?.offset)).toBeGreaterThan(.3)
  const other=await context.newPage()
  await other.goto('/');await baseReady(other);await openArticle(other)
  await selectChapter(other,'karst')
  await expect.poll(()=>other.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).readingProgress['landform-landscapes'].sectionId)).toBe('karst')
  await page.reload();await baseReady(page);await expectPosition(page,top)
  await other.close()
})
