import {expect,test} from '@playwright/test'
import {baseReady,selectedGeometry} from './map-readiness'

const visibleReader='.topic-reading-page:not([hidden])'
test.use({reducedMotion:'reduce'})

for(const [id,chapter,next,section] of [
  ['world-continents','world-regional-comparison-module-countries','world-regional-comparison','world-regional-comparison-module-countries'],
  ['world-continents','world-continents-module-eurasia','world-continents','asia'],
  ['world-regional-comparison','section-1','world-regional-comparison','world-regional-comparison-section-1'],
] as const)test(`world geography: legacy ${id}/${chapter} reaches its independent article`,async({page})=>{
  await page.goto(`/#read=${id}&chapter=${chapter}&topic=${id}`)
  await baseReady(page)
  await expect(page.locator(visibleReader)).toHaveAttribute('data-reading-topic',next)
  await expect.poll(()=>page.evaluate(id=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).readingProgress[id]?.sectionId,next)).toBe(section)
  await page.reload();await baseReady(page)
  await expect(page.locator(visibleReader)).toHaveAttribute('data-reading-topic',next)
  await expect.poll(()=>page.evaluate(id=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).readingProgress[id]?.sectionId,next)).toBe(section)
})

test('world geography: seven continent chapters follow the area comparison and link back to the map',async({page},info)=>{
  await page.goto('/#read=world-continents');await baseReady(page)
  const reader=page.locator(visibleReader)
  await expect(reader.locator('h1')).toHaveText('七大洲')
  const chart=reader.getByRole('figure',{name:'七大洲陆地面积对比',exact:true})
  await chart.scrollIntoViewIfNeeded()
  await expect(chart.locator('.topic-bar')).toHaveCount(7)
  for(const id of ['asia','africa','north-america','south-america','antarctica','europe','oceania'])await expect(reader.locator(`[data-reading-section="${id}"] h2`)).toHaveCount(1)
  expect(await reader.locator('.reading-body').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await page.screenshot({path:info.outputPath('seven-continents-area-comparison.png')})
  await chart.getByRole('button',{name:/^亚洲，/}).click()
  await expect(page.locator('.knowledge-panel h2')).toContainText('亚洲')
  await selectedGeometry(page)
  await page.locator('.reading-return-button').click()
  await expect(reader).toBeVisible()
  await expect(reader.locator('h1')).toHaveText('七大洲')
})

test('world geography: five oceans explain the current agreement and retain area-chart map navigation',async({page},info)=>{
  await page.goto('/#read=world-oceans');await baseReady(page)
  const reader=page.locator(visibleReader)
  await expect(reader.locator('h1')).toHaveText('五大洋')
  const controversy=reader.locator('[data-reading-section="four-or-five-oceans"]')
  for(const text of ['四大洋','五大洋','2023','南纬60°','阿根廷','澳大利亚'])await expect(controversy).toContainText(text)
  await expect(reader.locator('[data-reading-section="questions"]')).toHaveCount(0)
  await expect(reader.getByText('看图与思考',{exact:true})).toHaveCount(0)
  const chart=reader.getByRole('figure',{name:'五大洋面积对比',exact:true})
  await expect(chart.locator('.topic-bar')).toHaveCount(5)
  await chart.scrollIntoViewIfNeeded()
  expect(await reader.locator('.reading-body').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await page.screenshot({path:info.outputPath('five-oceans-area-comparison.png')})
  await chart.getByRole('button',{name:/^南大洋，/}).click()
  await expect(page.locator('.knowledge-panel h2')).toContainText('南大洋')
  await page.locator('.reading-return-button').click()
  await expect(reader.locator('h1')).toHaveText('五大洋')
})

test('world geography: existing continent and region bookmarks remain separate after the split',async({page})=>{
  await page.addInitScript(()=>{if(!localStorage.getItem('terra-atlas-v1'))localStorage.setItem('terra-atlas-v1',JSON.stringify({savedTopics:['world-continents','world-regional-comparison'],readingProgress:{'world-continents':{sectionId:'world-regional-comparison-module-countries',offset:.2,updatedAt:1},'world-regional-comparison':{sectionId:'section-1',offset:.4,updatedAt:2}}}))})
  await page.goto('/');await baseReady(page)
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).savedTopics)).toEqual(['world-continents','world-regional-comparison'])
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).readingProgress['world-regional-comparison']?.sectionId)).toBe('world-regional-comparison-section-1')
  await page.getByRole('button',{name:'学主题',exact:true}).click()
  await page.getByRole('button',{name:'阅读专题：世界区域比较',exact:true}).click()
  await expect(page.locator(visibleReader).getByRole('button',{name:'取消收藏专题',exact:true})).toBeVisible()
  await expect(page.locator(visibleReader).locator('h1')).toHaveText('世界区域比较')
})
