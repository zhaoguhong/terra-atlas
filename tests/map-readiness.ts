import {expect,type Page} from '@playwright/test'
import knowledge from '../src/data/knowledge.json' with {type:'json'}
import bindings from '../src/data/feature-bindings.json' with {type:'json'}

const timeout=45000
export async function renderFrames(page:Page){
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))
}
export async function baseReady(page:Page){
  await page.waitForFunction(()=>!!window.__terraAtlas?.data.land?.features.length&&!!window.__terraAtlas?.data.countries?.features.length,undefined,{timeout})
  await expect(page.locator('.app')).toHaveAttribute('data-map-status','ready',{timeout})
  await renderFrames(page)
}
// Treat downloading the lazy article as a load prerequisite, like map data.
export async function articleReady(page:Page,topicId?:string){
  const selector='.topic-reading-page'+(topicId?'[data-reading-topic="'+topicId+'"]':'[data-reading-topic]')+':visible h1'
  await page.locator(selector).waitFor({state:'visible',timeout})
  await renderFrames(page)
}
// Reading routes intentionally do not create a map on cold load.
export async function studyReady(page:Page){
  await page.locator('.app').waitFor({state:'visible',timeout})
  const url=new URL(page.url()),screen=await page.locator('.app').getAttribute('data-study-screen')
  if(screen==='article'||/\/topics\/[^/]+\/?$/.test(url.pathname)||new URLSearchParams(url.hash.slice(1)).has('read')){await articleReady(page);return}
  if(screen==='library'){await expect(page.locator('.study-library .topic-library')).toBeVisible();return}
  await baseReady(page)
}
export async function sourceLoaded(page:Page,name:string){
  // An initialized, empty GeoJSON source can already report loaded. The real
  // collection must arrive before MapLibre's worker and rendered frame settle.
  await page.waitForFunction(name=>!!window.__terraAtlas?.data[name]?.features.length&&window.__terraAtlas.map.isSourceLoaded(name),name,{timeout})
  await renderFrames(page)
}
export async function mapSettled(page:Page){
  await renderFrames(page)
  await page.waitForFunction(()=>{const map=window.__terraAtlas?.map;return !!map&&!map.isMoving()&&map.areTilesLoaded()},undefined,{timeout})
  await renderFrames(page)
}
export async function selectedGeometry(page:Page){
  const title=await page.locator('.knowledge-panel h2').innerText()
  const card=knowledge.find(card=>card.name===title)
  const ids=card?(bindings as Record<string,string[]>)[card.id]||[]:[]
  await page.waitForFunction(({ids,cardId,title})=>{
    const atlas=window.__terraAtlas
    if(!atlas)return false
    const selection=atlas.map.getSource('selection')?.serialize() as {data?:{features?:{properties?:{id?:string;name?:string}}[]}}|undefined
    const features=selection?.data?.features||[]
    if(!features.length||!atlas.map.isSourceLoaded('selection'))return false
    if(!ids.length)return features.some(feature=>cardId?feature.properties?.id===cardId:feature.properties?.name===title)
    return ids.every(id=>{
      const source=Object.entries(atlas.data).find(([name,collection])=>name!=='religion'&&collection.features.some(feature=>feature.properties.id===id))?.[0]
      return !!source&&atlas.map.isSourceLoaded(source)&&features.some(feature=>feature.properties?.id===id)
    })
  },{ids,cardId:card?.id,title},{timeout})
  // locate() schedules its fit after two browser frames; wait beyond that
  // scheduling boundary before reading a camera or saving/sharing its view.
  await mapSettled(page)
}
