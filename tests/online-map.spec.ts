import {chooseTheme} from './theme-controls'
import {clickHeaderAction} from './header-actions'
import { expect, test, type Page, type Route } from '@playwright/test'
import { baseReady, mapSettled, renderFrames, selectedGeometry, sourceLoaded } from './map-readiness'
import { chineseFixtureName, detailMetadata, terrainMetadata, terrainTile, vectorTile } from './fixtures/online-map'

const detailUrl = 'https://tiles.openfreemap.org/planet'
const terrainUrl = 'https://tiles.mapterhorn.com/tilejson.json'
const responseHeaders = { 'access-control-allow-origin': '*' }
type Provider = 'detail' | 'terrain'
type Interceptor = (route: Route, provider: Provider) => Promise<boolean>
let external: string[] = [], unexpected: string[] = [], runtimeErrors: string[] = []

test.setTimeout(90000)
test.beforeEach(async ({ page }) => {
  external = []; unexpected = []; runtimeErrors = []
  page.on('pageerror', error => runtimeErrors.push(error.message))
})
test.afterEach(() => {
  expect(runtimeErrors, 'browser JavaScript errors').toEqual([])
  expect(unexpected, 'uncontrolled external dependencies').toEqual([])
})

async function fixtures(page: Page, intercept?: Interceptor) {
  const base = new URL(process.env.SITE_URL || 'http://127.0.0.1:4176').origin
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin === base || !/^https?:$/.test(url.protocol)) return route.continue()
    external.push(url.href)
    const provider: Provider | undefined = url.hostname === 'tiles.openfreemap.org' ? 'detail'
      : url.hostname === 'tiles.mapterhorn.com' ? 'terrain' : undefined
    if (!provider) { unexpected.push(url.href); return route.abort() }
    if (url.href === detailUrl || url.href === terrainUrl) {
      if (intercept && await intercept(route, provider)) return
      return route.fulfill({ contentType: 'application/json', headers: responseHeaders,
        json: provider === 'detail' ? detailMetadata : terrainMetadata })
    }
    return route.fulfill({ headers: responseHeaders,
      contentType: provider === 'detail' ? 'application/x-protobuf' : 'image/png',
      body: provider === 'detail' ? vectorTile : terrainTile })
  })
}
async function openLayers(page: Page) {
  const button = page.getByRole('button', { name: '打开图层面板', exact: true })
  if (await button.isVisible()) await button.click()
}
async function closeLayers(page: Page) {
  const settings=page.getByRole('button',{name:'关闭图层面板',exact:true});if(await settings.isVisible())await settings.click()
  const button = page.getByRole('button', { name: '关闭探索面板', exact: true })
  if (await button.isVisible()) await button.click()
}
async function start(page: Page) {
  await page.goto('/'); await baseReady(page)
  // Real GeoJSON parsing confirms the worker is ready before timing online tile recovery.
  await sourceLoaded(page, 'countries'); await mapSettled(page)
}
async function status(page: Page, provider: Provider, value: string) {
  await expect(page.locator('.app')).toHaveAttribute(`data-${provider}-status`, value, { timeout: 45000 })
}
async function enableDetail(page: Page) {
  await openLayers(page)
  await page.getByRole('button', { name: '在线详细地图', exact: true }).click()
  await status(page, 'detail', 'ready')
}
async function select(page: Page, name: string) {
  await closeLayers(page)
  await page.getByRole('combobox', { name: '搜索地理对象', exact: true }).fill(name)
  await page.locator('.search-results>button').first().click()
  await selectedGeometry(page)
}
async function selectionIds(page: Page) {
  return page.evaluate(() => {
    const source = window.__terraAtlas!.map.getSource('selection')!.serialize() as {
      data: { features: { properties: { id: string } }[] }
    }
    return source.data.features.map(feature => feature.properties.id).sort()
  })
}
async function vectorRendered(page: Page) {
  // The real MVT worker, text layout and GPU render must finish; a reachable
  // TileJSON or an added MapLibre source is insufficient for this assertion.
  await page.waitForFunction(name => {
    const map = window.__terraAtlas?.map
    return !!map && map.getLayer('online-place-labels') && map.queryRenderedFeatures({ layers: ['online-place-labels'] })
      .some(feature => feature.source === 'online-detail' && feature.properties?.name === name)
  }, chineseFixtureName, { timeout: 45000 })
}

test('natural default renders without contacting either online provider', async ({ page }) => {
  await fixtures(page); await start(page)
  await sourceLoaded(page, 'lakes')
  await openLayers(page)
  await expect(page.getByRole('button', { name: '自然地理底图', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('checkbox', { name: '三维地形', exact: true })).not.toBeChecked()
  await status(page, 'detail', 'off'); await status(page, 'terrain', 'off')
  const map = await page.evaluate(() => {
    const map = window.__terraAtlas!.map
    return { sources: Object.keys(map.getStyle().sources), terrain: map.getTerrain(), pitch: map.getPitch() }
  })
  expect(map.sources).not.toContain('online-detail'); expect(map.sources).not.toContain('online-terrain')
  expect(map.terrain).toBeNull(); expect(map.pitch).toBe(0)
  expect(external, 'default exploration stays entirely on the static site').toEqual([])
})

test('detail downloads real vector tiles and Chinese labels while native lake selection survives', async ({ page }) => {
  await fixtures(page); await start(page)
  await select(page, '青海湖')
  const ids = await selectionIds(page)
  expect(ids).toContain('lake-1159126725')
  await enableDetail(page)
  expect(await selectionIds(page)).toEqual(ids)
  await expect(page.locator('.knowledge-panel h2')).toHaveText('青海湖')
  await closeLayers(page)
  await page.getByRole('button', { name: '关闭知识卡片', exact: true }).click()
  // The fixed MVT puts its label at each tile's center. Center this known z5
  // fixture first: Qinghai's narrower mobile viewport can fall between labels.
  await page.evaluate(() => window.__terraAtlas!.map.jumpTo({ center: [95.625, 36.597889], zoom: 5.5, padding: { top: 0, bottom: 0, left: 0, right: 0 } }))
  await vectorRendered(page); await mapSettled(page)
  const screenshot = test.info().outputPath('rendered-online-Chinese-labels.png')
  await page.screenshot({ path: screenshot })
  await test.info().attach('rendered-online-Chinese-labels', { path: screenshot, contentType: 'image/png' })
  expect(external.some(url => /\/test-only\/\d+\/\d+\/\d+\.pbf$/.test(url))).toBe(true)
  expect(external.some(url => url.includes('mapterhorn'))).toBe(false)
  await page.evaluate(() => window.__terraAtlas!.map.jumpTo({ center: [100.2, 36.9], zoom: 5.5, padding: { top: 0, bottom: 0, left: 0, right: 0 } }))
  await mapSettled(page)
  const point = await page.evaluate(() => {
    const map = window.__terraAtlas!.map, point = map.project([100.18, 36.85])
    return { x: point.x, y: point.y, ids: map.queryRenderedFeatures(point, { layers: ['lake-fill'] }).map(feature => feature.properties?.id) }
  })
  expect(point.ids).toContain('lake-1159126725')
  const box = await page.locator('.atlas-map').boundingBox()
  await page.mouse.click(box!.x + point.x, box!.y + point.y)
  await expect(page.locator('.knowledge-panel h2')).toHaveText('青海湖')
  await selectedGeometry(page)
  expect(await selectionIds(page)).toEqual(ids)
})

test('detail metadata failure retains the natural map and offers a working retry', async ({ page }) => {
  let fail = true
  await fixtures(page, async (route, provider) => {
    if (provider !== 'detail' || !fail) return false
    await route.fulfill({ status: 503, contentType: 'application/json', headers: responseHeaders, body: '{}' })
    return true
  })
  await start(page); await select(page, '长江')
  const ids = await selectionIds(page)
  await openLayers(page)
  await page.getByRole('button', { name: '在线详细地图', exact: true }).click()
  await status(page, 'detail', 'error')
  await expect(page.getByRole('button', { name: '重试在线地图', exact: true })).toBeVisible()
  await expect(page.locator('.knowledge-panel h2')).toHaveText('长江')
  expect(await selectionIds(page)).toEqual(ids)
  const fallback = await page.evaluate(() => {
    const map = window.__terraAtlas!.map
    return { relief: map.getLayoutProperty('relief', 'visibility'), detail: !!map.getSource('online-detail') }
  })
  expect(fallback.detail).toBe(false); expect(fallback.relief).not.toBe('none')
  fail = false
  await page.getByRole('button', { name: '重试在线地图', exact: true }).click()
  await status(page, 'detail', 'ready')
  await closeLayers(page)
  await mapSettled(page)
  // This fixture has one label at a tile center, not city coverage everywhere.
  // Use that known center after the mobile panel layout has settled.
  await page.evaluate(() => window.__terraAtlas!.map.jumpTo({ center: [95.625, 36.597889], zoom: 5.5, padding: { top: 0, bottom: 0, left: 0, right: 0 } }))
  await vectorRendered(page)
  expect(await selectionIds(page)).toEqual(ids)
})

test('a failed viewport vector tile falls back and retry renders fresh tile data', async ({ page }) => {
  await fixtures(page)
  const brokenTiles = 'https://tiles.openfreemap.org/planet/test-only/**'
  await page.route(brokenTiles, route => route.fulfill({ status: 503, headers: responseHeaders, body: '' }))
  await start(page); await openLayers(page)
  await page.getByRole('button', { name: '在线详细地图', exact: true }).click()
  await status(page, 'detail', 'error')
  const fallback = await page.evaluate(() => ({
    source: !!window.__terraAtlas!.map.getSource('online-detail'),
    relief: window.__terraAtlas!.map.getLayoutProperty('relief', 'visibility'),
  }))
  expect(fallback.source).toBe(false); expect(fallback.relief).not.toBe('none')
  await page.unroute(brokenTiles)
  await page.getByRole('button', { name: '重试在线地图', exact: true }).click()
  await status(page, 'detail', 'ready'); await closeLayers(page)
  await mapSettled(page)
  await page.evaluate(() => window.__terraAtlas!.map.jumpTo({ center: [95.625, 36.597889], zoom: 5.5, padding: { top: 0, bottom: 0, left: 0, right: 0 } }))
  await vectorRendered(page)
})

test('an undecodable DEM returns to a flat map and can be retried', async ({ page }) => {
  await fixtures(page)
  const brokenTiles = /^https:\/\/tiles\.mapterhorn\.com\/\d+\/\d+\/\d+\.webp$/
  await page.route(brokenTiles, route => route.fulfill({ headers: responseHeaders, contentType: 'image/png', body: Buffer.from('not an image') }))
  await start(page); await openLayers(page)
  await page.getByRole('checkbox', { name: '三维地形', exact: true }).check()
  await status(page, 'terrain', 'error')
  const flat = await page.evaluate(() => ({ source: !!window.__terraAtlas!.map.getSource('online-terrain'),
    terrain: window.__terraAtlas!.map.getTerrain(), pitch: window.__terraAtlas!.map.getPitch() }))
  expect(flat.source).toBe(false); expect(flat.terrain).toBeNull(); expect(flat.pitch).toBe(0)
  await page.unroute(brokenTiles)
  await page.getByRole('button', { name: '重试三维地形', exact: true }).click()
  await status(page, 'terrain', 'ready'); await closeLayers(page); await mapSettled(page)
  expect(await page.evaluate(() => window.__terraAtlas!.map.getTerrain()?.source)).toBe('online-terrain')
  expect(await page.evaluate(() => window.__terraAtlas!.map.getPitch())).toBeGreaterThan(20)
})

test('DEM is lazy and a rendered DEM activates real MapLibre terrain and camera tilt', async ({ page }) => {
  await fixtures(page); await start(page); await enableDetail(page)
  expect(external.some(url => url.includes('mapterhorn'))).toBe(false)
  await page.getByRole('checkbox', { name: '三维地形', exact: true }).check()
  await status(page, 'terrain', 'ready'); await closeLayers(page); await mapSettled(page)
  expect(external.some(url => /mapterhorn\.com\/\d+\/\d+\/\d+\.webp$/.test(url))).toBe(true)
  const terrain = await page.evaluate(() => {
    const map = window.__terraAtlas!.map
    return { terrain: map.getTerrain(), pitch: map.getPitch(), loaded: map.isSourceLoaded('online-terrain'),
      source: map.getSource('online-terrain')!.serialize() }
  })
  expect(terrain.terrain?.source).toBe('online-terrain')
  expect(terrain.loaded).toBe(true); expect(terrain.pitch).toBeGreaterThan(20)
  expect(terrain.source).toMatchObject({ type: 'raster-dem', encoding: 'terrarium', tileSize: 512 })
  await openLayers(page)
  await page.getByRole('checkbox', { name: '三维地形', exact: true }).uncheck()
  await status(page, 'terrain', 'off'); await closeLayers(page); await mapSettled(page)
  const flat = await page.evaluate(() => ({ terrain: window.__terraAtlas!.map.getTerrain(), pitch: window.__terraAtlas!.map.getPitch() }))
  expect(flat.terrain).toBeNull(); expect(flat.pitch).toBe(0)
  await status(page, 'detail', 'ready')
})

for (const provider of ['detail', 'terrain'] as const) {
  test(`switching ${provider} off aborts pending metadata and rejects its late response`, async ({ page }) => {
    let release!: () => void, seen!: () => void
    const gate = new Promise<void>(resolve => { release = resolve }), requested = new Promise<void>(resolve => { seen = resolve })
    await fixtures(page, async (route, current) => {
      if (current !== provider) return false
      seen(); await gate
      await route.fulfill({ contentType: 'application/json', headers: responseHeaders,
        json: provider === 'detail' ? detailMetadata : terrainMetadata }).catch(() => {})
      return true
    })
    try {
      await start(page); await openLayers(page)
      if (provider === 'detail') await page.getByRole('button', { name: '在线详细地图', exact: true }).click()
      else await page.getByRole('checkbox', { name: '三维地形', exact: true }).check()
      await requested; await status(page, provider, 'loading')
      const failed = page.waitForEvent('requestfailed', { predicate: request => request.url() === (provider === 'detail' ? detailUrl : terrainUrl) })
      if (provider === 'detail') await page.getByRole('button', { name: '自然地理底图', exact: true }).click()
      else await page.getByRole('checkbox', { name: '三维地形', exact: true }).uncheck()
      await status(page, provider, 'off'); release()
      expect((await failed).failure()?.errorText).toContain('ERR_ABORTED')
      await renderFrames(page); await mapSettled(page)
      expect(await page.evaluate(id => !!window.__terraAtlas!.map.getSource(id), provider === 'detail' ? 'online-detail' : 'online-terrain')).toBe(false)
      await status(page, provider, 'off')
      expect(external.filter(url => url !== detailUrl && url !== terrainUrl)).toEqual([])
    } finally { release() }
  })
}

test('browser preferences and named views restore online mode and the three-dimensional camera', async ({ page }) => {
  await fixtures(page); await start(page); await enableDetail(page)
  await page.getByRole('checkbox', { name: '三维地形', exact: true }).check()
  await status(page, 'terrain', 'ready'); await closeLayers(page); await mapSettled(page)
  await page.evaluate(() => window.__terraAtlas!.map.jumpTo({ center: [104, 35], zoom: 5.2, pitch: 35, bearing: 18 }))
  await mapSettled(page)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('terra-atlas-v1')!).camera.pitch)).toBe(35)
  await page.reload(); await baseReady(page); await status(page, 'detail', 'ready'); await status(page, 'terrain', 'ready'); await mapSettled(page)
  const restored = await page.evaluate(() => ({ pitch: window.__terraAtlas!.map.getPitch(), bearing: window.__terraAtlas!.map.getBearing(), zoom: window.__terraAtlas!.map.getZoom() }))
  expect(restored.pitch).toBeCloseTo(35); expect(restored.bearing).toBeCloseTo(18); expect(restored.zoom).toBeCloseTo(5.2)
  await clickHeaderAction(page,'打开收藏')
  await page.getByRole('textbox', { name: '地图视图名称', exact: true }).fill('在线三维学习视图')
  await page.getByRole('button', { name: '保存命名地图视图', exact: true }).click()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('terra-atlas-v1')!).savedViews.find((view: { name: string }) => view.name === '在线三维学习视图'))
  expect(saved.display).toEqual({ basemap: 'detail', terrain3d: true }); expect(saved.camera.pitch).toBeCloseTo(35)
  await closeLayers(page); await openLayers(page)
  await page.getByRole('button', { name: '自然地理底图', exact: true }).click()
  await page.getByRole('checkbox', { name: '三维地形', exact: true }).uncheck()
  await status(page, 'detail', 'off'); await status(page, 'terrain', 'off')
  await closeLayers(page)
  await clickHeaderAction(page,'打开收藏')
  await page.locator('.saved-list').nth(1).getByRole('button', { name: '在线三维学习视图', exact: true }).click()
  await status(page, 'detail', 'ready'); await status(page, 'terrain', 'ready'); await mapSettled(page)
  const camera = await page.evaluate(() => ({ pitch: window.__terraAtlas!.map.getPitch(), bearing: window.__terraAtlas!.map.getBearing(), zoom: window.__terraAtlas!.map.getZoom(), terrain: window.__terraAtlas!.map.getTerrain() }))
  expect(camera.pitch).toBeCloseTo(35); expect(camera.bearing).toBeCloseTo(18); expect(camera.zoom).toBeCloseTo(5.2)
  expect(camera.terrain?.source).toBe('online-terrain')
})

test('a legacy shared view overrides persisted online preferences before requesting providers', async ({ page }) => {
  await fixtures(page)
  await page.addInitScript(() => localStorage.setItem('terra-atlas-v1', JSON.stringify({
    favorites: ['yangtze'], display: { basemap: 'detail', terrain3d: true },
    camera: { center: [104, 35], zoom: 5, pitch: 35, bearing: 18 },
  })))
  await page.goto('/#lng=9.1&lat=46.5&z=4.5&view=world&place=alps')
  await baseReady(page); await selectedGeometry(page)
  await expect(page.locator('.knowledge-panel h2')).toHaveText('阿尔卑斯山脉')
  await status(page, 'detail', 'off'); await status(page, 'terrain', 'off')
  expect(external).toEqual([])
  const state = await page.evaluate(() => ({ preferences: JSON.parse(localStorage.getItem('terra-atlas-v1')!),
    terrain: window.__terraAtlas!.map.getTerrain(), pitch: window.__terraAtlas!.map.getPitch(), zoom: window.__terraAtlas!.map.getZoom() }))
  expect(state.preferences.favorites).toEqual(['yangtze'])
  expect(state.preferences.display).toEqual({ basemap: 'natural', terrain3d: false })
  expect(state.terrain).toBeNull(); expect(state.pitch).toBe(0); expect(state.zoom).toBeCloseTo(4.5)
})

test('same-document online links restore both tilted and explicitly level terrain views', async ({ page }) => {
  await fixtures(page); await start(page)
  const link = (pitch: number) => `/#lng=104&lat=35&z=5.2&view=china&basemap=detail&terrain3d=1&pitch=${pitch}&bearing=18`
  expect(await page.goto(link(35)), 'hash links reuse the already initialized map').toBeNull()
  await status(page, 'detail', 'ready'); await status(page, 'terrain', 'ready'); await mapSettled(page)
  const tilted = await page.evaluate(() => ({ terrain: window.__terraAtlas!.map.getTerrain(), pitch: window.__terraAtlas!.map.getPitch(), bearing: window.__terraAtlas!.map.getBearing() }))
  expect(tilted.terrain?.source).toBe('online-terrain'); expect(tilted.pitch).toBeCloseTo(35); expect(tilted.bearing).toBeCloseTo(18)
  expect(await page.goto(link(0))).toBeNull()
  await status(page, 'terrain', 'ready'); await mapSettled(page)
  const level = await page.evaluate(() => ({ terrain: window.__terraAtlas!.map.getTerrain(), pitch: window.__terraAtlas!.map.getPitch(), zoom: window.__terraAtlas!.map.getZoom() }))
  expect(level.terrain?.source).toBe('online-terrain'); expect(level.pitch).toBe(0); expect(level.zoom).toBeCloseTo(5.2)
})

test('mobile online attribution and the climate legend remain readable in separate space', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'portrait attribution layout')
  await fixtures(page); await start(page); await enableDetail(page)
  await page.getByRole('checkbox', { name: '三维地形', exact: true }).check()
  await status(page, 'terrain', 'ready')
  await chooseTheme(page, '长期气候分布')
  await sourceLoaded(page, 'climate'); await closeLayers(page); await mapSettled(page)
  const attribution = page.locator('.map-attribution'), legend = page.locator('.legend')
  await expect(attribution.getByRole('link', { name: 'OpenStreetMap', exact: true })).toBeVisible()
  await expect(attribution.getByRole('link', { name: 'Mapterhorn', exact: true })).toBeVisible()
  await expect(legend).toBeVisible()
  const screenshot = test.info().outputPath('mobile-online-terrain-climate-attribution.png')
  await page.screenshot({ path: screenshot })
  await test.info().attach('mobile-online-terrain-climate-attribution', { path: screenshot, contentType: 'image/png' })
  const attributionBox = await attribution.boundingBox(), legendBox = await legend.boundingBox()
  await test.info().attach('mobile-attribution-layout', { body: Buffer.from(JSON.stringify({ attributionBox, legendBox }, null, 2)), contentType: 'application/json' })
  expect(attributionBox!.y + attributionBox!.height <= legendBox!.y || legendBox!.y + legendBox!.height <= attributionBox!.y,
    'attribution and legend do not cover each other').toBe(true)
})
