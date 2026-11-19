import { test, expect } from '@playwright/test'
import { baseReady, mapSettled, selectedGeometry, sourceLoaded } from './map-readiness'
import { chooseTheme } from './theme-controls'
import { clickHeaderAction } from './header-actions'

test('bundled full articles, local images and case navigation work below the configured base path',async({page,baseURL})=>{
  const errors:string[]=[]
  page.on('pageerror',error=>errors.push(error.message))
  page.on('response',response=>{if(response.status()>=400)errors.push(`HTTP ${response.status()}: ${response.url()}`)})
  const expectedHome = new URL(new URL(baseURL!).pathname, process.env.SITE_ORIGIN || 'https://terraatlas.zhaoguhong.com')
  const response = await page.goto('./')
  expect(await response!.text()).toContain(`rel="canonical" href="${expectedHome.href}"`)
  await baseReady(page)
  await page.getByRole('link',{name:'学主题',exact:true}).click()
  await page.getByRole('searchbox',{name:'搜索主题和主题成员'}).fill('喀斯特')
  await page.getByRole('link',{name:'阅读专题：常见地貌与中国典型景观',exact:true}).click()
  const article=page.locator('.topic-reading-page:not([hidden])')
  await expect(article.locator('h1')).toHaveText('常见地貌与中国典型景观')
  const articleUrl = new URL('topics/landform-landscapes/', expectedHome).href
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', articleUrl)
  expect(JSON.parse(await page.locator('#topic-structured-data').innerText()).mainEntityOfPage).toBe(articleUrl)
  const cover=article.locator('img').first()
  await expect.poll(()=>cover.evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0)
  expect(await cover.getAttribute('src')).toContain(new URL('media/reading/',baseURL).pathname)
  const chapterSelect=article.getByRole('combobox',{name:'跳转专题章节',exact:true})
  if(await chapterSelect.isVisible())await chapterSelect.selectOption('karst')
  else await article.getByRole('navigation',{name:'专题章节'}).getByRole('button',{name:'喀斯特：从地表峰林到地下水路',exact:true}).click()
  await article.locator('[data-reading-section="karst"]').getByRole('button',{name:'在地图上看 · 桂林喀斯特 · 漓江段',exact:true}).click()
  await expect(page.locator('.knowledge-panel h2')).toHaveText('桂林喀斯特 · 漓江段')
  await selectedGeometry(page)
  await page.locator('.reading-return-button').click()
  await expect(article).toBeVisible()
  expect(errors).toEqual([])
})

test('production map, reading, bookmarks and shared links work', async ({ page, context }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`)
  })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('./')
  await baseReady(page)
  await mapSettled(page)
  await page.waitForFunction(() => window.__terraAtlas!.map.queryRenderedFeatures({ layers: ['place-labels'] }).some(feature => /[\u3400-\u9fff]/.test(String(feature.properties?.name || ''))))
  expect(await page.evaluate(() => window.__terraAtlas!.map.queryRenderedFeatures({ layers: ['land-fill'] }).length)).toBeGreaterThan(0)
  await page.getByRole('combobox', { name: '搜索地理对象' }).fill('长江')
  await page.locator('.search-results>button').first().click()
  await expect(page.locator('.knowledge-panel h2')).toHaveText('长江')
  await selectedGeometry(page)
  await expect(page.locator('.sources a').first()).toHaveAttribute('href', /^https:/)
  const handle = page.getByRole('button', { name: '调整阅读面板大小', exact: true })
  if (await handle.isVisible()) await handle.press('End')
  await page.getByRole('button', { name: '收藏地点', exact: true }).click()
  await page.getByRole('button', { name: '分享这个地点', exact: true }).click()
  await expect(page.locator('.toast')).toContainText('已复制')
  const link = await page.evaluate(() => navigator.clipboard.readText())
  const original = new URL(page.url())
  expect(new URL(link).pathname).toBe(original.pathname)
  expect(new URL(link).hash).toContain('place=')
  await page.goto(link)
  await baseReady(page)
  await selectedGeometry(page)
  await expect(page.locator('.knowledge-panel h2')).toHaveText('长江')
  await page.reload()
  await baseReady(page)
  await selectedGeometry(page)
  if (await handle.isVisible()) await handle.press('End')
  await expect(page.getByRole('button', { name: '已收藏', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({ path: info.outputPath(`${info.project.name}.png`) })
  expect(errors, 'runtime and resource errors').toEqual([])
})

test('theme, rendered climate legend and bundled licenses work', async ({ page, request }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('./')
  await baseReady(page)
  await chooseTheme(page, '气候分布与成因')
  await sourceLoaded(page, 'climate')
  await mapSettled(page)
  await expect(page.getByRole('complementary', { name: '地图图例', exact: true })).toBeVisible()
  await expect(page.locator('.map-legend')).toContainText('气候')
  expect(await page.evaluate(() => window.__terraAtlas!.map.getLayoutProperty('climate-fill', 'visibility'))).toBe('visible')
  expect(await page.evaluate(() => window.__terraAtlas!.map.queryRenderedFeatures({ layers: ['climate-fill'] }).length)).toBeGreaterThan(0)
  for (const [path, text] of [
    ['third-party-notices.txt', 'BasinATLAS v1.0'],
    ['licenses/LICENSE', 'Terra Atlas contributors'],
    ['licenses/LICENSE-CONTENT.md', 'CC BY 4.0'],
    ['licenses/CC-BY-4.0.txt', 'Attribution 4.0 International'],
  ]) {
    const response = await request.get(path)
    expect(response.ok(), path).toBe(true)
    expect(await response.text(), path).toContain(text)
  }
  await clickHeaderAction(page, '资料与关于')
  const links = page.getByRole('dialog').locator('.source-links a')
  const basePath = new URL(page.url()).pathname
  for (const href of await links.evaluateAll(nodes => nodes.map(node => node.getAttribute('href')!))) {
    expect(href.startsWith(basePath), href).toBe(true)
    const response = await request.get(href)
    expect(response.ok(), href).toBe(true)
  }
  expect(errors, 'theme runtime errors').toEqual([])
})
