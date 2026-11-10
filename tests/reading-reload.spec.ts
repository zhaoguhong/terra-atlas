import {expect,test,type Page} from '@playwright/test'
import {baseReady,selectedGeometry} from './map-readiness'

const reader=(page:Page)=>page.locator('.topic-reading-page:not([hidden])')
const chapterButton=(page:Page,name:string)=>reader(page).getByRole('navigation',{name:'专题章节'}).getByRole('button',{name,exact:true})
async function catalogue(page:Page){
  await page.getByRole('navigation',{name:'浏览方式'}).getByRole('button',{name:'学主题',exact:true}).click()
  await expect(page.locator('.study-library')).toBeVisible()
}
async function openArticle(page:Page){
  await catalogue(page)
  await page.getByRole('button',{name:'阅读专题：喀斯特地貌',exact:true}).click()
  await expect(reader(page).locator('h1')).toHaveText('喀斯特地貌')
}
async function scrollWithinChapter(page:Page){
  await chapterButton(page,'地下河、溶洞和洞穴沉积').click()
  return reader(page).locator('.reading-body').evaluate(panel=>{
    const block=panel.querySelector<HTMLElement>('[data-reading-section="section-3"]')!
    panel.scrollTop+=block.getBoundingClientRect().top-panel.getBoundingClientRect().top+block.offsetHeight*.35-18
    return panel.scrollTop
  })
}
async function expectPosition(page:Page,top:number){
  await expect(reader(page).locator('h1')).toHaveText('喀斯特地貌')
  await expect(chapterButton(page,'地下河、溶洞和洞穴沉积')).toHaveAttribute('aria-current','location')
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
  await expect(reader(page).locator('h1')).toHaveText('喀斯特地貌')
  expect(await page.evaluate(()=>history.state.terraAtlasEntryId)).toBe(articleEntryId)
})

test('reload: catalogue keeps search, scope and category, with browser back and forward',async({page})=>{
  await page.goto('/');await baseReady(page)
  await expect(page.locator('.app')).toHaveAttribute('data-study-screen','map')
  await catalogue(page)
  await page.getByRole('group',{name:'主题范围'}).getByRole('button',{name:'中国地理',exact:true}).click()
  await page.locator('.topic-category-filters summary').click()
  await page.getByRole('button',{name:'地形地貌',exact:true}).click()
  await page.getByRole('searchbox',{name:'搜索主题和主题成员'}).fill('喀斯特')
  await page.reload();await baseReady(page)
  await expect(page.locator('.study-library')).toBeVisible()
  await expect(page.getByRole('searchbox',{name:'搜索主题和主题成员'})).toHaveValue('喀斯特')
  await expect(page.getByRole('button',{name:'中国地理',exact:true})).toHaveAttribute('aria-pressed','true')
  await expect(page.getByRole('button',{name:'地形地貌',exact:true})).toHaveAttribute('aria-pressed','true')
  await expect(page.getByRole('button',{name:'打开专题：喀斯特地貌',exact:true})).toBeVisible()
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
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')||'{}').readingProgress?.['landform-karst']?.offset)).toBeGreaterThan(.3)
  await page.reload();await baseReady(page);await expectPosition(page,top)
  const latest=await reader(page).locator('.reading-body').evaluate(panel=>{panel.scrollTop+=80;return panel.scrollTop})
  await page.reload();await baseReady(page);await expectPosition(page,latest)
  await page.screenshot({path:info.outputPath('restored-reading.png')})
})

test('reload: a shared chapter starts fresh but refreshing keeps subsequent reading or catalogue navigation',async({page,context})=>{
  const link='/#read=landform-karst&chapter=section-3&topic=landform-karst'
  await page.goto(link);await baseReady(page)
  await expect(chapterButton(page,'地下河、溶洞和洞穴沉积')).toHaveAttribute('aria-current','location')
  await chapterButton(page,'桂林喀斯特 · 漓江段').click()
  await page.reload();await baseReady(page)
  await expect(chapterButton(page,'桂林喀斯特 · 漓江段')).toHaveAttribute('aria-current','location')
  await catalogue(page);await page.reload();await baseReady(page)
  await expect(page.locator('.study-library')).toBeVisible()
  const other=await context.newPage()
  await other.goto(link);await baseReady(other)
  await expect(chapterButton(other,'地下河、溶洞和洞穴沉积')).toHaveAttribute('aria-current','location')
  await other.goto('/');await baseReady(other)
  await expect(other.locator('.app')).toHaveAttribute('data-study-screen','map')
  await other.close()
})

test('reload: case map stays on the map and can return to the saved article',async({page})=>{
  await page.goto('/');await baseReady(page);await openArticle(page)
  await chapterButton(page,'桂林喀斯特 · 漓江段').click()
  await reader(page).locator('[data-reading-section="module-case-guilin-karst"]').getByRole('button',{name:'在地图上看',exact:true}).click()
  await selectedGeometry(page)
  await page.reload();await baseReady(page)
  await expect(page.locator('.app')).toHaveAttribute('data-study-screen','map')
  await expect(page.locator('.knowledge-panel h2')).toHaveText('桂林喀斯特 · 漓江段')
  await selectedGeometry(page)
  await page.locator('.reading-return-button').click()
  await expect(chapterButton(page,'桂林喀斯特 · 漓江段')).toHaveAttribute('aria-current','location')
  await page.goBack();await expect(page.locator('.app')).toHaveAttribute('data-study-screen','map')
  await page.goForward();await expect(reader(page)).toBeVisible()
})

test('reload: another tab reading the same topic does not overwrite this entry position',async({page,context})=>{
  await page.goto('/');await baseReady(page);await openArticle(page)
  const top=await scrollWithinChapter(page)
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')||'{}').readingProgress?.['landform-karst']?.offset)).toBeGreaterThan(.3)
  const other=await context.newPage()
  await other.goto('/');await baseReady(other);await openArticle(other)
  await chapterButton(other,'桂林喀斯特 · 漓江段').click()
  await expect.poll(()=>other.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).readingProgress['landform-karst'].sectionId)).toBe('module-case-guilin-karst')
  await page.reload();await baseReady(page);await expectPosition(page,top)
  await other.close()
})
