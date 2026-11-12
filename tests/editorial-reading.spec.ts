import {readFileSync} from 'node:fs'
import {expect,test,type Locator,type Page} from '@playwright/test'
import {baseReady} from './map-readiness'
import rawTopics from '../src/data/topics.json' with {type:'json'}
import rawMedia from '../src/data/reading-media.json' with {type:'json'}

type Article={id:string;parts?:unknown[];sections:{id:string;mediaIds?:string[]}[]}
const articles=new Map(rawTopics.map(topic=>[
  topic.id,
  JSON.parse(readFileSync(new URL(`../public/reading/topics/${topic.id}.json`,import.meta.url),'utf8')) as Article,
]))
const mediaById=new Map(rawMedia.map(item=>[item.id,item]))
// Discover from the built registry so additional authored maps are covered too.
const illustratedMedia=new Set(rawMedia.filter(item=>['illustration','map'].includes(item.kind)).map(item=>item.id))
const reader=(page:Page)=>page.locator('.topic-reading-page:not([hidden])')

test.use({reducedMotion:'reduce'})

async function catalogue(page:Page){
  if(await reader(page).isVisible()){
    await reader(page).getByRole('button',{name:'主题目录',exact:true}).click()
  }else{
    await page.getByRole('navigation',{name:'浏览方式'}).getByRole('button',{name:'学主题',exact:true}).click()
  }
  await expect(page.locator('.study-library')).toBeVisible()
}

async function openTopic(page:Page,id:string){
  const topic=rawTopics.find(item=>item.id===id)!
  await catalogue(page)
  await page.getByRole('searchbox',{name:'搜索主题和主题成员'}).fill(topic.title)
  await page.getByRole('button',{name:'阅读专题：'+topic.title,exact:true}).click()
  await expect(reader(page)).toHaveAttribute('data-reading-topic',id)
  await expect(reader(page).locator('h1')).toHaveText(topic.title)
}

async function noHorizontalOverflow(page:Page){
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  expect(await reader(page).locator('.reading-body').evaluate(panel=>panel.scrollWidth<=panel.clientWidth+1)).toBe(true)
}

async function loadedFigure(page:Page,id:string):Promise<Locator>{
  const figure=reader(page).locator(`[data-media-id="${id}"]`)
  await expect(figure).toHaveCount(1)
  const button=figure.locator('.reading-image-button')
  await button.scrollIntoViewIfNeeded()
  const image=button.locator('img')
  await expect.poll(()=>image.evaluate((element:HTMLImageElement)=>element.complete&&element.naturalWidth>0&&element.naturalHeight>0),{message:`${id} loads its real image`}).toBe(true)
  const media=mediaById.get(id)!
  expect(await image.evaluate((element:HTMLImageElement,path)=>element.currentSrc.endsWith('/'+path),media.path)).toBe(true)
  expect(await image.evaluate(element=>{
    const box=element.getBoundingClientRect()
    const panel=element.closest('.reading-body')!.getBoundingClientRect()
    return box.width>0&&box.height>0&&box.left>=panel.left-1&&box.right<=panel.right+1
  }),`${id} stays inside the reading viewport`).toBe(true)
  await noHorizontalOverflow(page)
  return figure
}

test('editorial: all topics open from the library and every authored illustration or map renders',async({page})=>{
  // One initial map startup, then in-app catalogue navigation for every article.
  test.setTimeout(process.env.SITE_URL?.startsWith('https:')?300000:180000)
  const errors:string[]=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto('/');await baseReady(page)
  await catalogue(page)
  await expect(page.locator('.topic-library-card')).toHaveCount(rawTopics.length)
  const seen=new Set<string>()
  for(const topic of rawTopics){
    await test.step(topic.id,async()=>{
      await openTopic(page,topic.id)
      const article=articles.get(topic.id)!
      const ids=article.sections.flatMap(section=>section.mediaIds||[])
      expect(ids.length,`${topic.id} has an article image`).toBeGreaterThan(0)
      // Check a real visible image in every article, plus each not-yet-seen
      // illustration/map. Reused media do not cause a full-gallery scroll.
      const toCheck=[...new Set([ids[0],...ids.filter(id=>illustratedMedia.has(id)&&!seen.has(id))])]
      for(const id of toCheck){
        await loadedFigure(page,id)
        if(illustratedMedia.has(id))seen.add(id)
      }
    })
  }
  expect([...seen].sort()).toEqual([...illustratedMedia].sort())
  expect(errors).toEqual([])
})

test('editorial: polar regions are introduced before their differences and the new image enlarges',async({page},info)=>{
  await page.goto('/');await baseReady(page)
  await openTopic(page,'world-polar-comparison')
  const introduction=await reader(page).locator('.reading-title>p').last().innerText()
  expect(introduction).toMatch(/北极.*北冰洋/s)
  expect(introduction).toMatch(/南极.*南极洲/s)
  const order=await reader(page).locator('.article-section[data-reading-section]').evaluateAll(sections=>sections.map(section=>section.getAttribute('data-reading-section')))
  expect(order.indexOf('module-north')).toBeGreaterThanOrEqual(0)
  expect(order.indexOf('module-north')).toBeLessThan(order.indexOf('module-south'))
  expect(order.indexOf('module-south')).toBeLessThan(order.indexOf('section-1'))
  expect(order.indexOf('section-1')).toBeLessThan(order.indexOf('section-2'))
  const figure=await loadedFigure(page,'polar-worlds-illustration')
  const enlarge=figure.locator('.reading-image-button')
  await enlarge.click()
  const dialog=figure.locator('dialog')
  await expect(dialog).toBeVisible()
  await expect.poll(()=>dialog.locator('img').evaluate((image:HTMLImageElement)=>image.complete&&image.naturalWidth>0)).toBe(true)
  expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true)
  const fittedWidth=await dialog.locator('img').evaluate(image=>image.getBoundingClientRect().width)
  await dialog.getByRole('button',{name:'放大细节',exact:true}).click()
  const canvas=dialog.getByRole('region',{name:'图片细节',exact:true})
  expect(await dialog.locator('img').evaluate(image=>image.getBoundingClientRect().width)).toBeGreaterThan(fittedWidth)
  expect(await canvas.evaluate(element=>element.scrollWidth>element.clientWidth)).toBe(true)
  await canvas.evaluate(element=>{element.scrollLeft=150})
  expect(await canvas.evaluate(element=>element.scrollLeft)).toBeGreaterThan(0)
  await page.screenshot({path:info.outputPath('polar-illustration-enlarged.png')})
  await dialog.getByRole('button',{name:'适应窗口',exact:true}).click()
  expect(await canvas.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(enlarge).toBeFocused()
})

test('editorial: mobile chapter selector restores an ungrouped article after reload',async({page,isMobile},info)=>{
  test.skip(!isMobile,'The compact chapter selector is used in phone layouts.')
  const topicId='world-polar-comparison',chapterId='section-2'
  expect(articles.get(topicId)!.parts).toBeUndefined()
  await page.goto('/');await baseReady(page)
  await openTopic(page,topicId)
  const select=reader(page).getByRole('combobox',{name:'跳转专题章节',exact:true})
  await expect(select).toBeVisible()
  await select.selectOption(chapterId)
  await expect(select).toHaveValue(chapterId)
  await expect.poll(()=>page.evaluate(id=>JSON.parse(localStorage.getItem('terra-atlas-v1')||'{}').readingProgress?.[id]?.sectionId,topicId)).toBe(chapterId)
  const top=await reader(page).locator('.reading-body').evaluate((panel,id)=>{
    const block=panel.querySelector<HTMLElement>(`[data-reading-section="${id}"]`)!
    panel.scrollTop+=block.getBoundingClientRect().top-panel.getBoundingClientRect().top+block.offsetHeight*.25-18
    return panel.scrollTop
  },chapterId)
  await expect.poll(()=>page.evaluate(id=>JSON.parse(localStorage.getItem('terra-atlas-v1')||'{}').readingProgress?.[id]?.offset,topicId)).toBeGreaterThan(.2)
  await page.reload()
  await expect(reader(page)).toHaveAttribute('data-reading-topic',topicId)
  await expect(reader(page).getByRole('combobox',{name:'跳转专题章节',exact:true})).toHaveValue(chapterId)
  await expect.poll(async()=>Math.abs(await reader(page).locator('.reading-body').evaluate(panel=>panel.scrollTop)-top)).toBeLessThan(4)
  await noHorizontalOverflow(page)
  await page.screenshot({path:info.outputPath('ungrouped-chapter-restored.png')})
})

test('editorial: night reading keeps maps, illustrations and text within the page',async({page},info)=>{
  test.setTimeout(process.env.SITE_URL?.startsWith('https:')?180000:90000)
  await page.emulateMedia({colorScheme:'dark'})
  await page.goto('/');await baseReady(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
  for(const id of ['china-terrain','china-provinces','world-continents','map-language','map-climate','world-polar-comparison']){
    await test.step(id,async()=>{
      await openTopic(page,id)
      const article=articles.get(id)!
      const ids=article.sections.flatMap(section=>section.mediaIds||[])
      const picture=ids.find(mediaId=>illustratedMedia.has(mediaId))||ids[0]
      await loadedFigure(page,picture)
      const overflow=await reader(page).locator('.reading-article').evaluate(article=>
        Array.from(article.querySelectorAll<HTMLElement>('h1,h2,.article-section>p,figure')).filter(element=>element.clientWidth>0&&element.scrollWidth>element.clientWidth+1).map(element=>({tag:element.tagName,media:element.dataset.mediaId,text:element.textContent?.slice(0,50)})),
      )
      expect(overflow,`${id} has no overflowing prose, heading or figure`).toEqual([])
      expect(await reader(page).locator('.article-section>p').first().evaluate(element=>parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16)
    })
  }
  await page.screenshot({path:info.outputPath('editorial-night-reading.png')})
})
