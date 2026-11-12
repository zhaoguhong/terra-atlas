import {expect,test} from '@playwright/test'
import {baseReady,selectedGeometry} from './map-readiness'
import {chooseTheme} from './theme-controls'
import topics from '../src/data/topics.json' with {type:'json'}
import knowledge from '../src/data/knowledge.json' with {type:'json'}
import {readFileSync} from 'node:fs'

for(const id of ['china-terrain','map-climate','landform-landscapes','weather-systems','climate-change']){
  test(`map guide: ${id} explains the map before full reading and preserves case navigation`,async({page},info)=>{
    const topic=topics.find(t=>t.id===id)!,guide=topic.mapGuide
    const requests:string[]=[],errors:string[]=[]
    page.on('request',r=>{if(r.url().includes('/reading/topics/'))requests.push(r.url())})
    page.on('pageerror',e=>errors.push(e.message))
    await page.goto('/');await baseReady(page);await chooseTheme(page,topic.title,false)
    const panel=page.locator('.topic-reader'),intro=panel.getByRole('region',{name:'地图导读'})
    await expect(intro).toBeVisible()
    await expect(intro.locator('.topic-guide-section')).toHaveCount(guide.sections.length)
    for(const section of guide.sections)await expect(intro).toContainText(section.body)
    expect(await intro.evaluate(element=>element.closest('details')===null)).toBe(true)
    await expect(intro.locator('.topic-map-cases button')).toHaveCount(3)
    await expect(panel.locator('.topic-map-figure')).not.toHaveAttribute('open','')
    expect(requests).toEqual([])
    expect(await intro.evaluate(element=>!!(element.compareDocumentPosition(document.querySelector('.topic-reading-cta')!)&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true)
    await intro.locator('.topic-guide-section').first().scrollIntoViewIfNeeded()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.screenshot({path:info.outputPath('guide-with-map.png')})
    const first=guide.cases[0],card=knowledge.find(k=>k.id===first.id)!
    await intro.locator('.topic-map-cases button').first().click()
    await expect(page.locator('.knowledge-panel h2')).toHaveText(card.name)
    await selectedGeometry(page)
    await page.getByRole('button',{name:'主题全览',exact:true}).click()
    await expect(intro).toBeVisible()
    expect(requests).toEqual([])
    await panel.locator('.topic-map-figure summary').click()
    await expect.poll(()=>panel.locator('.topic-map-figure img').evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0)
    await panel.getByRole('button',{name:'阅读完整专题',exact:true}).click()
    const article=page.locator('.topic-reading-page:not([hidden])')
    await expect(article.locator('h1')).toHaveText(topic.title)
    expect(requests).toHaveLength(1)
    const authored=JSON.parse(readFileSync(`public/reading/topics/${id}.json`,'utf8'))
    for(const section of guide.sections){
      const full=authored.sections.find((item:{id:string})=>item.id===section.sectionId)
      await expect(article.locator(`[data-reading-section="${section.sectionId}"]`)).toContainText(full.paragraphs[0])
    }
    expect(errors).toEqual([])
  })
}
