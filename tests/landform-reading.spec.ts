import {expect,test} from '@playwright/test'
import {baseReady,selectedGeometry} from './map-readiness'
const reader='.topic-reading-page:not([hidden])'

for(const [old,chapter,next,section] of [
  ['landform-karst','section-3','landform-landscapes','karst'],
  ['landform-processes','landform-danxia-module-case-danxiashan','landform-landscapes','redbeds-sandstone'],
  ['landform-wind','landform-loess-section-3','landform-landscapes','loess'],
  ['landform-processes','earth-rocks-section-1','landform-processes','rocks'],
] as const)test(`landforms: legacy ${old}/${chapter} resolves to its rewritten chapter`,async({page})=>{
  await page.goto(`/#read=${old}&chapter=${chapter}&topic=${old}`);await baseReady(page)
  await expect(page.locator(reader)).toHaveAttribute('data-reading-topic',next)
  await expect.poll(()=>page.evaluate(id=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).readingProgress[id]?.sectionId,next)).toBe(section)
  await page.reload();await baseReady(page)
  await expect(page.locator(reader)).toHaveAttribute('data-reading-topic',next)
  await expect.poll(()=>page.evaluate(id=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).readingProgress[id]?.sectionId,next)).toBe(section)
})

test('landforms: old bookmarks merge and the most recent old chapter remains readable',async({page})=>{
  await page.addInitScript(()=>{if(!localStorage.getItem('terra-atlas-v1'))localStorage.setItem('terra-atlas-v1',JSON.stringify({savedTopics:['landform-karst','landform-wind'],readingProgress:{'landform-karst':{sectionId:'section-3',offset:.4,updatedAt:1},'landform-wind':{sectionId:'landform-loess-section-2',offset:.6,updatedAt:2}}}))})
  await page.goto('/');await baseReady(page)
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).savedTopics)).toEqual(['landform-landscapes'])
  await page.getByRole('button',{name:'学主题',exact:true}).click()
  await page.getByRole('button',{name:'阅读专题：常见地貌与中国典型景观',exact:true}).click()
  await expect(page.locator(reader).getByRole('button',{name:'取消收藏专题',exact:true})).toBeVisible()
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).readingProgress['landform-landscapes'].sectionId)).toBe('loess')
})

test('landforms: an already open old Danxia article restores to the new landscape article',async({page})=>{
  await page.goto('/#read=landform-processes');await baseReady(page)
  await expect(page.locator(reader)).toHaveAttribute('data-reading-topic','landform-processes')
  const state=await page.evaluate(()=>history.state)
  await page.addInitScript(state=>{
    const progress={sectionId:'landform-danxia-section-2',offset:.3,updatedAt:Date.now()+1000}
    history.replaceState({...state,terraAtlasNavigation:{...state.terraAtlasNavigation,readerTopicId:'landform-processes',readerProgress:progress}},'')
    sessionStorage.setItem('terra-atlas-reading-resume-v1',JSON.stringify({entryId:state.terraAtlasEntryId,topicId:'landform-processes',progress}))
  },state)
  await page.reload();await baseReady(page)
  await expect(page.locator(reader)).toHaveAttribute('data-reading-topic','landform-landscapes')
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).readingProgress['landform-landscapes']?.sectionId)).toBe('redbeds-sandstone')
})

test('landforms: long chapters have inline figures, working map cases and no overflow',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
  await page.goto('/#read=landform-landscapes&chapter=karst');await baseReady(page)
  const article=page.locator(reader)
  await expect(article.locator('.article-section[data-reading-section]:not([data-reading-section="questions"])')).toHaveCount(9)
  const figure=article.locator('[data-media-id="diagram-karst"]')
  await figure.scrollIntoViewIfNeeded()
  await expect.poll(()=>figure.locator('.reading-image-button img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0)
  expect(await figure.evaluate(el=>el.previousElementSibling?.tagName==='P'&&el.nextElementSibling?.tagName==='P')).toBe(true)
  expect(await article.locator('.reading-body').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await page.screenshot({path:info.outputPath('landform-inline-reading.png')})
  await article.locator('[data-reading-section="karst"]').getByRole('button',{name:'在地图上看 · 桂林喀斯特 · 漓江段',exact:true}).click()
  await selectedGeometry(page)
  await page.locator('.reading-return-button').click();await expect(article).toBeVisible()
  await page.goto('/#read=landform-processes');await baseReady(page)
  await expect(article.locator('.article-section[data-reading-section]:not([data-reading-section="questions"])')).toHaveCount(5)
  expect(errors).toEqual([])
})
