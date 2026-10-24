import {expect, test, type Page} from '@playwright/test'
import knowledge from '../src/data/knowledge.json' with {type: 'json'}
import {geometryBounds} from '../src/lib/geo'
import {baseReady, mapSettled, selectedGeometry} from './map-readiness'
import {clickHeaderAction} from './header-actions'

test.use({reducedMotion: 'reduce'})
test.setTimeout(90000)
test.beforeEach(async ({page}) => {
  await page.goto('/')
  await baseReady(page)
  await mapSettled(page)
})

async function selectCountry(page: Page, id: string) {
  const card = knowledge.find(card => card.id === id)!
  await page.getByRole('combobox', {name: '搜索地理对象', exact: true}).fill(card.name)
  await page.locator('.search-results>button').first().click()
  await expect(page.locator('.knowledge-panel h2')).toHaveText(card.name)
  await selectedGeometry(page)
  return card
}

for (const id of ['usa', 'russia']) {
  test(`dateline country ${id}: canonical reference and both longitude sides render`, async ({page}, info) => {
    const card = await selectCountry(page, id)
    const result = await page.evaluate(coordinates => {
      const {map, data} = window.__terraAtlas!
      const source = map.getSource('selection')!.serialize() as {data: {features: {geometry: unknown; properties: {id: string}}[]}}
      const selected = source.data.features[0]
      const original = data.countries.features.find(feature => feature.properties.id === selected.properties.id)!
      const all: number[][] = []
      const walk = (value: unknown): void => {
        if (!Array.isArray(value)) return
        if (typeof value[0] === 'number') all.push(value as number[])
        else value.forEach(walk)
      }
      if ('coordinates' in original.geometry) walk(original.geometry.coordinates)
      const west = all.reduce((a, b) => a[0] < b[0] ? a : b)
      const east = all.reduce((a, b) => a[0] > b[0] ? a : b)
      const rect = map.getContainer().getBoundingClientRect()
      const panelRects = [...document.querySelectorAll('.explorer,.knowledge-panel:not(.embedded)')]
        .filter(panel => { const style = getComputedStyle(panel); return style.display !== 'none' && style.visibility !== 'hidden' })
        .map(panel => panel.getBoundingClientRect())
      const projectVisible = (coordinate: number[], wrap: boolean) => {
        const lng = coordinate[0] + (wrap ? 360 * Math.round((map.getCenter().lng - coordinate[0]) / 360) : 0)
        const point = map.project([lng, coordinate[1]])
        const x = point.x + rect.left, y = point.y + rect.top
        return {point, visible: point.x >= 0 && point.x <= rect.width && point.y >= 0 && point.y <= rect.height && panelRects.every(box => x < box.left || x > box.right || y < box.top || y > box.bottom)}
      }
      return {
        center: map.getCenter().toArray(), zoom: map.getZoom(), referenceVisible: projectVisible(coordinates, false).visible,
        geometryUnchanged: JSON.stringify(selected.geometry) === JSON.stringify(original.geometry),
        edges: [west, east].map(coordinate => {
          const {point, visible} = projectVisible(coordinate, true)
          return {coordinate, visible, rendered: map.queryRenderedFeatures([[point.x - 5, point.y - 5], [point.x + 5, point.y + 5]], {layers: ['selection-line']}).some(feature => feature.properties.id === selected.properties.id)}
        }),
      }
    }, card.coordinates)
    expect(Math.abs(result.center[0]), 'saved camera stays within the canonical longitude range').toBeLessThanOrEqual(180)
    expect(result.referenceVisible, 'the actual country reference is visible outside panels').toBe(true)
    expect(result.geometryUnchanged, 'world wrapping must never rewrite the source geometry').toBe(true)
    expect(result.edges.every(edge => edge.visible && edge.rendered), JSON.stringify(result)).toBe(true)
    if (id === 'usa') expect(result.center[0]).toBeLessThan(0)
    await page.screenshot({path: info.outputPath(`${id}-${info.project.name}.png`)})
  })
}

test('dateline collection: Pacific members render together and globe-wide view remains usable', async ({page}, info) => {
  const ids = ['usa', 'russia', 'japan']
  await page.evaluate(async ids => { await window.__terraAtlas!.showRelations(ids) }, ids)
  await page.waitForFunction(() => window.__terraAtlas!.map.isSourceLoaded('relations') && window.__terraAtlas!.map.isSourceLoaded('relation-labels'))
  await mapSettled(page)
  const result = await page.evaluate(members => {
    const map = window.__terraAtlas!.map, rect = map.getContainer().getBoundingClientRect()
    return {
      center: map.getCenter().toArray(),
      members: members.map(member => {
        const longitude = member.coordinates[0] + 360 * Math.round((map.getCenter().lng - member.coordinates[0]) / 360)
        const point = map.project([longitude, member.coordinates[1]])
        return {id: member.id, visible: point.x >= 0 && point.x <= rect.width && point.y >= 0 && point.y <= rect.height,
          rendered: map.queryRenderedFeatures(point, {layers: ['relations-area']}).some(feature => feature.properties.topicMemberId === member.id)}
      }),
    }
  }, knowledge.filter(card => ids.includes(card.id)))
  expect(Math.abs(result.center[0])).toBeLessThanOrEqual(180)
  expect(result.members.every(member => member.visible && member.rendered), JSON.stringify(result)).toBe(true)
  await page.screenshot({path: info.outputPath(`pacific-${info.project.name}.png`)})
  await page.getByRole('button', {name: '全球视野', exact: true}).click()
  await mapSettled(page)
  await expect.poll(() => page.evaluate(() => window.__terraAtlas!.map.queryRenderedFeatures(undefined, {layers: ['land-fill']}).length)).toBeGreaterThan(0)
  await page.screenshot({path: info.outputPath(`world-${info.project.name}.png`)})
})

test('dateline bounds keep a short arc and choose the standard midpoint copy', () => {
  const feature = (coordinates: number[][]) => ({type: 'Feature' as const, properties: {}, geometry: {type: 'LineString' as const, coordinates}})
  expect(geometryBounds([feature([[178, 12], [-179, 16]])])).toEqual([178, 12, 181, 16])
  expect(geometryBounds([feature([[170, 10], [-170, 20]])])).toEqual([170, 10, 190, 20])
  expect(geometryBounds([feature([[172, 20], [-98, 39], [-66, 72]])])).toEqual([-188, 20, -66, 72])
})

test('dateline camera survives saving and sharing after crossing 180 degrees', async ({page}) => {
  await page.evaluate(() => window.__terraAtlas!.map.jumpTo({center: [185, 45], zoom: 2.4}))
  await mapSettled(page)
  expect(await page.evaluate(() => window.__terraAtlas!.map.getCenter().lng)).toBeCloseTo(-175, 4)
  await clickHeaderAction(page,'打开收藏')
  await page.getByRole('button',{name:'保存命名地图视图',exact:true}).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('terra-atlas-v1')!).savedViews.at(-1)?.camera.center[0])).toBeCloseTo(-175, 4)
  // Capture the app's real share action without touching the user's clipboard.
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async (text: string) => { document.body.dataset.sharedUrl = text }}}))
  await clickHeaderAction(page,'分享当前地图')
  await expect.poll(() => page.evaluate(() => document.body.dataset.sharedUrl)).toBeTruthy()
  const url = await page.evaluate(() => document.body.dataset.sharedUrl!)
  expect(Number(new URLSearchParams(new URL(url).hash.slice(1)).get('lng'))).toBeCloseTo(-175, 4)
  await page.goto(url)
  await baseReady(page)
  await mapSettled(page)
  expect(await page.evaluate(() => window.__terraAtlas!.map.getCenter().lng)).toBeCloseTo(-175, 4)
  expect(await page.evaluate(() => window.__terraAtlas!.map.getZoom())).toBeCloseTo(2.4, 3)
})
