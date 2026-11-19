import {test,expect,type Page} from '@playwright/test'
import {readFileSync} from 'node:fs'
import {baseReady as mapReady,mapSettled} from './map-readiness'
const topics=JSON.parse(readFileSync('src/data/topics.json','utf8'))
const path=(id:string)=>'/topics/'+id.replace(/^map-/,'')+'/'

async function chapter(page:Page,id:string){
  const select=page.locator('.reading-chapter-select select')
  if(await select.isVisible())await select.selectOption(id)
  else {const title=await select.locator(`option[value="${id}"]`).textContent();await page.locator('.reading-toc').getByRole('button',{name:title!,exact:true}).click()}
}

test('every topic has crawlable complete HTML and canonical metadata',async({request})=>{
  for(const topic of topics){
    const response=await request.get(path(topic.id));expect(response.status()).toBe(200)
    const html=await response.text(),article=JSON.parse(readFileSync(`public/reading/topics/${topic.id}.json`,'utf8'))
    expect(html).toContain(`<title>${topic.title} · 山河图</title>`)
    expect(html).toContain(`href="https://terraatlas.zhaoguhong.com${path(topic.id)}"`)
    for(const section of article.sections){expect(html).toContain(section.title);expect(html).toContain(section.paragraphs[0].replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll("'",'&#x27;').replaceAll('<','&lt;').replaceAll('>','&gt;'))}
  }
  const directory=await (await request.get('/topics/')).text()
  for(const topic of topics)expect(directory).toContain(`href="${path(topic.id)}"`)
  expect(await (await request.get('/sitemap.xml')).text()).toContain('/topics/climate/')
})

test('cold reading skips map resources; homepage offers explicit resume',async({page,context})=>{
  const requests:string[]=[];page.on('request',r=>requests.push(r.url()))
  await page.goto('/topics/landform-landscapes/')
  const reader=page.getByRole('region',{name:'完整专题阅读'})
  await expect(reader.locator('h1')).toBeVisible()
  await expect(page.locator('.app')).toHaveAttribute('data-study-screen','article')
  expect(requests.filter(url=>/\.geojson|\/assets\/map-/.test(url))).toEqual([])
  await chapter(page,'granite')
  await page.waitForTimeout(350)
  const section=await reader.locator('.reading-chapter-select select').inputValue()
  await page.reload();await expect(reader.locator('.reading-chapter-select select')).toHaveValue(section)
  const other=await context.newPage();await other.goto('/')
  await expect(other.locator('.app')).toHaveAttribute('data-study-screen','map')
  await expect(other.getByRole('link',{name:/继续上次阅读/})).toBeVisible()
  await other.getByRole('link',{name:/继续上次阅读/}).click()
  await expect(other).toHaveURL(/\/topics\/landform-landscapes\/$/)
  await expect(other.locator('.reading-chapter-select select')).toHaveValue(section)
  await other.close()
  await reader.getByRole('button',{name:'返回地图',exact:true}).click()
  await expect(page).toHaveURL(/\/$/)
  await mapReady(page);await mapSettled(page)
  await expect.poll(()=>page.evaluate(()=>window.__terraAtlas!.map.queryRenderedFeatures({layers:['land-fill']}).length)).toBeGreaterThan(0)
  await page.getByRole('button',{name:/返回刚才的阅读/}).click()
  await expect(page).toHaveURL(/\/topics\/landform-landscapes\/$/)
  await page.goBack();await expect(page.locator('.app')).toHaveAttribute('data-study-screen','map')
  await page.goForward();await expect(reader).toBeVisible()
})

test('explicit chapter wins over another tab and follows reload position',async({page,context})=>{
  await page.goto('/topics/landform-landscapes/#granite')
  await expect(page.locator('.reading-chapter-select select')).toHaveValue('granite')
  await chapter(page,'karst')
  await page.waitForTimeout(300)
  const other=await context.newPage();await other.goto('/topics/landform-landscapes/#granite')
  await expect(other.locator('.reading-chapter-select select')).toHaveValue('granite')
  await page.reload();await expect(page.locator('.reading-chapter-select select')).toHaveValue('karst')
  await other.close()
})
