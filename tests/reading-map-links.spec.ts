import {readFileSync} from 'node:fs'
import {expect,test,type Page} from '@playwright/test'
import rawTopics from '../src/data/topics.json' with {type:'json'}
import {studyReady as baseReady,articleReady,selectedGeometry} from './map-readiness'

const articles=rawTopics.map(topic=>JSON.parse(readFileSync(new URL(`../public/reading/topics/${topic.id}.json`,import.meta.url),'utf8')))
test.use({reducedMotion:'reduce'})

async function loadArticle(page:Page,id:string,action:()=>Promise<unknown>){
  await action()
  await articleReady(page,id)
  const reader=page.locator('.topic-reading-page:not([hidden])')
  await expect(reader).toHaveAttribute('data-reading-topic',id)
  await expect(reader.locator('h1')).toHaveText(articles.find(article=>article.id===id).title)
}

test('reading links: provinces are compact, touchable and preserve map round trips',async({page},info)=>{
  await loadArticle(page,'china-provinces',()=>page.goto('/#read=china-provinces&chapter=module-central-south&topic=china-provinces'));await baseReady(page)
  const reader=page.locator('.topic-reading-page:not([hidden])')
  const group=reader.locator('[data-reading-section="module-central-south"] .reading-place-links')
  await expect(group.getByRole('button')).toHaveText(['河南','湖北','湖南','广东','广西','海南'])
  await expect(reader.locator('.reading-place-links button')).toHaveCount(34)
  await group.scrollIntoViewIfNeeded()
  const box=await group.boundingBox()
  expect(box!.height).toBeLessThan(100)
  for(const button of await group.getByRole('button').all()){
    const rect=await button.boundingBox();expect(rect!.height).toBeGreaterThanOrEqual(44);expect(rect!.width).toBeGreaterThanOrEqual(44)
    expect(await button.evaluate(element=>getComputedStyle(element).borderTopWidth)).toBe('0px')
  }
  await page.screenshot({path:info.outputPath('province-links-light.png')})
  const target=group.getByRole('button',{name:/在地图上看 · 河南/})
  await target.focus();await expect(target).toBeFocused()
  const top=await reader.locator('.reading-body').evaluate(element=>element.scrollTop)
  await page.keyboard.press('Enter')
  await expect(page.locator('.knowledge-panel h2')).toContainText('河南');await selectedGeometry(page)
  await page.locator('.reading-return-button').click()
  await expect(reader).toBeVisible()
  await expect.poll(async()=>Math.abs(await reader.locator('.reading-body').evaluate(element=>element.scrollTop)-top)).toBeLessThan(4)
  await loadArticle(page,'china-provinces',()=>page.reload());await baseReady(page)
  await expect(group).toBeVisible()
  await expect.poll(async()=>Math.abs(await reader.locator('.reading-body').evaluate(element=>element.scrollTop)-top)).toBeLessThan(4)
  await page.emulateMedia({colorScheme:'dark'})
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
  await page.screenshot({path:info.outputPath('province-links-dark.png')})
})

test('reading links: every topic retains all destinations without overflowing or duplicated local links',async({page},info)=>{
  test.setTimeout(180000)
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
  await page.goto('/');await baseReady(page)
  let oldTotal=0,newTotal=0
  for(const article of articles){
    await page.getByRole('navigation',{name:'浏览方式'}).getByRole('link',{name:'学主题',exact:true}).click()
    await page.getByRole('searchbox',{name:'搜索主题和主题成员'}).fill(article.title)
    await loadArticle(page,article.id,()=>page.getByRole('link',{name:'阅读专题：'+article.title,exact:true}).click())
    const reader=page.locator('.topic-reading-page:not([hidden])')
    await expect(reader.locator('h1')).toHaveText(article.title)
    const cases=article.sections.flatMap((section:{caseIds?:string[]})=>section.caseIds||[]) as string[]
    const destinations=await reader.locator('button[data-place-id]').evaluateAll(buttons=>buttons.map(button=>button.getAttribute('data-place-id')))
    expect([...new Set(cases)].filter(id=>!destinations.includes(id)),article.id+' retains every original destination').toEqual([])
    await expect(reader.locator('.reading-map-links,.reading-cases,.reading-figure-explore')).toHaveCount(0)
    for(const section of await reader.locator('.article-section[data-reading-section]').all()){
      const ids=await section.locator('.reading-place-links button').evaluateAll(buttons=>buttons.map(button=>button.getAttribute('data-place-id')))
      expect(new Set(ids).size,article.id+' has no repeated place links in one section').toBe(ids.length)
    }
    oldTotal+=cases.length
    newTotal+=await reader.locator('.article-section > .reading-place-links button').count()
    expect(await reader.locator('.reading-body').evaluate(panel=>panel.scrollWidth<=panel.clientWidth+1),article.id+' fits').toBe(true)
    if(['world-terrain','map-language','china-terrain','landform-landscapes'].includes(article.id)){
      const links=reader.locator('.reading-place-links').last();await links.scrollIntoViewIfNeeded()
      await page.screenshot({path:info.outputPath(article.id+'-links.png')})
    }
    await reader.getByRole('button',{name:'主题目录',exact:true}).click()
  }
  expect(newTotal).toBeLessThan(oldTotal)
  console.log(`Chapter links: ${oldTotal} → ${newTotal}; all 30 topics retain their destinations`)
  expect(errors).toEqual([])
})
