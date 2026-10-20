import {expect,test,type Page} from '@playwright/test'
import rawTopics from '../src/data/topics.json' with {type:'json'}
import rawKnowledge from '../src/data/knowledge.json' with {type:'json'}
import rawBindings from '../src/data/feature-bindings.json' with {type:'json'}
import type {Knowledge,Topic} from '../src/types'
import {baseReady,mapSettled,renderFrames,selectedGeometry,sourceLoaded} from './map-readiness'
import {openThemeLibrary,readerExpandKey} from './theme-controls'

const topics=rawTopics as Topic[]
const cards=new Map((rawKnowledge as Knowledge[]).map(card=>[card.id,card]))
const bindings=rawBindings as Record<string,string[]>
const timeout=45000

// Each case gets an isolated browser context; catalogue entries have no shared
// state and can be scheduled independently in the desktop/mobile projects.
test.describe.configure({mode:'parallel'})
test.use({reducedMotion:'reduce'})
test.setTimeout(120000)
let errors:string[]=[]
test.beforeEach(async({page})=>{
  errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto('/')
  await baseReady(page)
  await mapSettled(page)
})
test.afterEach(()=>expect(errors,'theme navigation must not produce runtime errors').toEqual([]))

function topicById(id:string){
  const topic=topics.find(item=>item.id===id)
  if(!topic)throw new Error(`Missing required theme: ${id}`)
  return topic
}
function cardById(id:string){
  const card=cards.get(id)
  if(!card)throw new Error(`Missing required member: ${id}`)
  return card
}
async function openLibrary(page:Page){
  await openThemeLibrary(page)
}
async function searchTheme(page:Page,topic:Topic){
  await openLibrary(page)
  await page.locator('.topic-categories').getByRole('button',{name:'全部分类',exact:true}).click()
  await page.getByRole('searchbox',{name:'搜索主题和主题成员'}).fill(topic.title)
  const entry=page.locator('.topic-list>button').filter({has:page.getByText(topic.title,{exact:true})})
  await expect(entry).toHaveCount(1)
  await entry.click()
  await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id',topic.id)
  await expect(page.locator('.topic-reader h1')).toHaveText(topic.title)
  await overviewGeometry(page,topic)
}
function expectedRelationIds(topic:Topic){
  if(topic.kind==='distribution')return []
  return topic.stops.filter(id=>{
    const card=cardById(id)
    return card.mapRole!=='concept'&&(!['climate','population','religion','language'].includes(card.category)||!!bindings[id]?.length)
  })
}
async function overviewGeometry(page:Page,topic:Topic){
  const expected=expectedRelationIds(topic)
  const featureIds=expected.flatMap(id=>bindings[id]||[])
  await page.waitForFunction(({expected,featureIds})=>{
    const atlas=window.__terraAtlas
    if(!atlas)return false
    const source=atlas.map.getSource('relation-labels')?.serialize() as {data?:{features?:{properties?:{id?:string}}[]}}|undefined
    const ids=(source?.data?.features||[]).map(feature=>feature.properties?.id)
    // Reference labels exist before downloads finish; bound geometry must replace those placeholders before the fit is ready.
    const relations=atlas.map.getSource('relations')?.serialize() as {data?:{features?:{properties?:{id?:string}}[]}}|undefined
    const actualFeatures=(relations?.data?.features||[]).map(feature=>feature.properties?.id)
    return ids.length===expected.length&&expected.every(id=>ids.includes(id))&&featureIds.every(id=>actualFeatures.includes(id))&&atlas.map.isSourceLoaded('relations')&&atlas.map.isSourceLoaded('relation-labels')
  },{expected,featureIds},{timeout})
  await mapSettled(page)
}
async function camera(page:Page){
  return page.evaluate(()=>{const map=window.__terraAtlas!.map;return{center:map.getCenter().toArray(),zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch()}})
}
function expectSameCamera(actual:Awaited<ReturnType<typeof camera>>,expected:Awaited<ReturnType<typeof camera>>){
  actual.center.forEach((coordinate,index)=>expect(coordinate).toBeCloseTo(expected.center[index],3))
  expect(actual.zoom).toBeCloseTo(expected.zoom,3)
  expect(actual.bearing).toBeCloseTo(expected.bearing,3)
  expect(actual.pitch).toBeCloseTo(expected.pitch,3)
}
async function memberLocated(page:Page,id:string){
  const card=cardById(id)
  await expect(page.locator('.knowledge-panel h2')).toHaveText(card.name)
  await selectedGeometry(page)
  await expect(page.getByRole('combobox',{name:'切换主题成员',exact:true})).toHaveValue(id)
  await expect.poll(()=>page.evaluate(coordinates=>{
    const map=window.__terraAtlas!.map,point=map.project(coordinates),rect=map.getContainer().getBoundingClientRect()
    const x=point.x+rect.left,y=point.y+rect.top
    const panels=[...document.querySelectorAll('.explorer,.knowledge-panel:not(.embedded)')].filter(panel=>{const style=getComputedStyle(panel);return style.display!=='none'&&style.visibility!=='hidden'})
    return Number.isFinite(x)&&Number.isFinite(y)&&x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom&&panels.every(panel=>{const box=panel.getBoundingClientRect();return x<box.left||x>box.right||y<box.top||y>box.bottom})
  },card.coordinates),{timeout,message:`${card.name} must be visible on the real map, outside reading panels`}).toBe(true)
}
async function selectMember(page:Page,id:string){
  const card=cardById(id)
  await page.locator('.topic-members>button').filter({has:page.getByText(card.name,{exact:true})}).click()
  await memberLocated(page,id)
}
async function returnOverview(page:Page,topic:Topic){
  await page.getByRole('button',{name:'主题全览',exact:true}).click()
  await expect(page.locator('.knowledge-panel')).toHaveCount(0)
  await expect(page.locator('.topic-explanation')).toBeVisible()
  await overviewGeometry(page,topic)
}
function sharedHash(topicId:string,place:string,center:[number,number]=[100,35]){
  return '#'+new URLSearchParams({topic:topicId,place,lng:String(center[0]),lat:String(center[1]),z:'4.2',view:'china',layers:'terrain,mountains,rivers,lakes,borders'})
}

// Every current theme is registered separately, so a new theme automatically gets
// the same map-and-reading checks in both Playwright viewport projects.
for(const topic of topics){
  test(`theme catalogue: ${topic.id} has an introduction, modules and working first/last members`,async({page})=>{
    if(topic.region==='world'&&!topic.shared){await page.getByRole('button',{name:'全球视野',exact:true}).click();await mapSettled(page)}
    await searchTheme(page,topic)
    await expect(page.locator('.topic-summary')).toHaveText(topic.description)
    await expect(page.locator('.topic-observation')).toContainText(topic.question)
    const handle=page.getByRole('button',{name:'调整阅读面板大小',exact:true})
    if(await handle.isVisible())await handle.press('End')
    await expect(page.locator('.topic-expanded-intro')).not.toHaveAttribute('open','')
    await page.getByText('展开主题介绍',{exact:true}).click()
    await expect(page.locator('.topic-explanation .reading-section p')).toHaveCount(topic.sections.length)
    for(const section of topic.sections){
      await expect(page.locator('.topic-explanation')).toContainText(section.title)
      await expect(page.locator('.topic-explanation')).toContainText(section.body)
    }
    for(const paragraph of await page.locator('.topic-explanation .reading-section p').all())await expect(paragraph).toBeVisible()
    await expect(page.locator('.topic-visual')).toHaveCount(topic.visuals?.length||0)
    expect(topic.modules?.length,'each expanded theme has explicit learning modules').toBeGreaterThan(0)
    await expect(page.locator('.topic-module')).toHaveCount(topic.modules!.length)
    await expect(page.locator('.topic-members>button')).toHaveCount(topic.stops.length)
    for(const module of topic.modules!){
      const section=page.locator('.topic-module').filter({has:page.getByRole('heading',{name:module.title,exact:true})})
      await expect(section).toContainText(module.description)
      await section.getByText('展开说明',{exact:true}).click()
      await expect(section.locator('.module-detail p')).toBeVisible()
      await expect(section.locator('.module-detail p')).toHaveText(module.detail!)
      await section.getByText('展开说明',{exact:true}).click()
      for(const id of module.stops)await expect(section.locator('.topic-members>button').filter({has:page.getByText(cardById(id).name,{exact:true})})).toContainText(cardById(id).summary)
    }
    expect(await page.locator('.topic-explanation').evaluate(element=>!!(element.compareDocumentPosition(document.querySelector('.topic-members-section')!)&Node.DOCUMENT_POSITION_FOLLOWING)),'topic introduction appears before member modules').toBe(true)
    await expect(page.locator('.topic-sources')).not.toHaveAttribute('open','')
    await page.locator('.topic-sources>summary').click()
    await expect(page.locator('.topic-sources a')).toHaveCount(topic.sources.length)
    for(const id of [...new Set([topic.stops[0],topic.stops.at(-1)!])]){
      // Move away first: a passing card title cannot conceal a broken locate().
      await page.evaluate(()=>window.__terraAtlas!.map.jumpTo({center:[-155,-45],zoom:1.3}))
      await mapSettled(page)
      await selectMember(page,id)
      const card=cardById(id)
      await expect(page.locator('.knowledge-panel .summary')).toHaveText(card.summary)
      await expect(page.locator('.knowledge-panel')).toContainText(card.location)
      await expect(page.locator('.knowledge-panel')).toContainText(card.formation)
      await expect(page.locator('.topic-breadcrumb')).toContainText(topic.title)
      await expect(page.locator('.topic-breadcrumb')).toContainText(card.name)
      const actual=await camera(page)
      expect(Math.abs(actual.center[0]+155)+Math.abs(actual.center[1]+45),'selecting a member actually moves the map').toBeGreaterThan(1)
      await returnOverview(page,topic)
    }
    await page.getByRole('button',{name:'主题库',exact:true}).click()
    await expect(page.locator('.topic-library')).toBeVisible()
    await expect(page.getByRole('searchbox',{name:'搜索主题和主题成员'})).toHaveValue(topic.title)
    await expect(page.locator('.topic-list>button').filter({has:page.getByText(topic.title,{exact:true})})).toHaveCount(1)
  })
}

test('theme navigation: all four plateaus locate, reset scroll and restore the whole group',async({page},info)=>{
  const topic=topicById('china-plateaus')
  await searchTheme(page,topic)
  const overview=await camera(page)
  if(info.project.name.startsWith('mobile')){
    const handle=page.getByRole('button',{name:'调整阅读面板大小',exact:true})
    await handle.press('Home')
    await expect(page.locator('.explorer')).toHaveClass(/sheet-peek/)
    await expect(page.locator('.topic-module-jump')).toBeHidden()
    await handle.press(readerExpandKey(page))
  }
  await page.locator('.topic-module-jump').click()
  await expect(page.locator('.topic-module').first()).toBeInViewport()
  if(info.project.name.startsWith('mobile'))await expect(page.locator('.explorer')).toHaveClass(/sheet-full/)
  await selectMember(page,topic.stops[0])
  const handle=page.getByRole('button',{name:'调整阅读面板大小',exact:true})
  const previous=page.getByRole('button',{name:'上一个主题成员',exact:true})
  const next=page.getByRole('button',{name:'下一个主题成员',exact:true})
  const memberSelect=page.getByRole('combobox',{name:'切换主题成员',exact:true})
  if(await handle.isVisible())await handle.press('End')
  if(await previous.isVisible()){
    await expect(previous).toBeDisabled()
    await expect(next).toBeEnabled()
  }else{
    // Short landscape uses the sticky member selector instead of pagination.
    await expect(memberSelect).toBeInViewport()
    await expect(memberSelect).toHaveValue(topic.stops[0])
    await expect(memberSelect.locator('option')).toHaveCount(topic.stops.length)
    for(const [index,id] of topic.stops.entries()){
      const option=memberSelect.locator('option').nth(index)
      await expect(option).toHaveAttribute('value',id)
      await expect(option).toBeEnabled()
    }
  }
  await expect(page.locator('.topic-member-pagination')).toContainText('1 / 4')
  for(let index=1;index<topic.stops.length;index++){
    if(await handle.isVisible())await handle.press('End')
    await page.locator('.explorer-scroll').evaluate(element=>{element.scrollTop=element.scrollHeight})
    await expect(page.getByRole('button',{name:'主题全览',exact:true})).toBeInViewport()
    await expect(page.getByRole('button',{name:'主题库',exact:true})).toBeInViewport()
    if(index===2||!await next.isVisible()){
      await expect(memberSelect).toBeInViewport()
      await memberSelect.selectOption(topic.stops[index])
    }else await next.click()
    await memberLocated(page,topic.stops[index])
    await expect(page.locator('.topic-member-pagination')).toContainText(`${index+1} / 4`)
    await expect.poll(()=>page.locator('.explorer-scroll').evaluate(element=>element.scrollTop)).toBeLessThan(2)
  }
  if(await handle.isVisible())await handle.press('End')
  if(await next.isVisible()){
    await expect(previous).toBeEnabled()
    await expect(next).toBeDisabled()
  }else{
    await expect(memberSelect).toBeInViewport()
    await expect(memberSelect).toHaveValue(topic.stops.at(-1)!)
  }
  await page.screenshot({path:test.info().outputPath(`four-plateaus-${info.project.name}.png`)})
  await returnOverview(page,topic)
  expectSameCamera(await camera(page),overview)
  await page.getByRole('button',{name:'主题库',exact:true}).click()
  await page.getByRole('searchbox',{name:'搜索主题和主题成员'}).fill('黄土高原')
  await expect(page.locator('.topic-list>button').filter({has:page.getByText(topic.title,{exact:true})})).toHaveCount(1)
  await page.getByRole('searchbox',{name:'搜索主题和主题成员'}).fill('没有这个地理主题123')
  await expect(page.locator('.topic-empty')).toBeVisible()
  await page.getByRole('button',{name:'查看全部主题',exact:true}).click()
  await expect(page.getByRole('searchbox',{name:'搜索主题和主题成员'})).toHaveValue('')
  await expect(page.locator('.topic-list>button')).toHaveCount(topics.length)
})

test('theme navigation: browser Back and Forward restore member, overview and camera',async({page})=>{
  const topic=topicById('china-plateaus'),first=topic.stops[0],second=topic.stops[1]
  await searchTheme(page,topic)
  const overview=await camera(page)
  await selectMember(page,first)
  const firstCamera=await camera(page)
  const next=page.getByRole('button',{name:'下一个主题成员',exact:true})
  if(await next.isVisible())await next.click()
  else await page.getByRole('combobox',{name:'切换主题成员',exact:true}).selectOption(second)
  await memberLocated(page,second)
  const secondCamera=await camera(page)
  await page.goBack()
  await memberLocated(page,first)
  expectSameCamera(await camera(page),firstCamera)
  await page.goBack()
  await expect(page.locator('.knowledge-panel')).toHaveCount(0)
  await overviewGeometry(page,topic)
  expectSameCamera(await camera(page),overview)
  await page.goForward()
  await memberLocated(page,first)
  expectSameCamera(await camera(page),firstCamera)
  await page.goForward()
  await memberLocated(page,second)
  expectSameCamera(await camera(page),secondCamera)
})

test('theme navigation: related places keep context and can return to the previous member',async({page})=>{
  const topic=topicById('china-plateaus'),member=cardById('loess-plateau'),related=cardById('yellow-river')
  await searchTheme(page,topic)
  await selectMember(page,member.id)
  await page.locator('.related').getByRole('button',{name:related.name,exact:true}).click()
  await expect(page.locator('.knowledge-panel h2')).toHaveText(related.name)
  await selectedGeometry(page)
  await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id',topic.id)
  await expect(page.locator('.topic-related-notice')).toContainText('延伸探索')
  await expect(page.getByRole('combobox',{name:'切换主题成员',exact:true})).toHaveCount(0)
  await page.getByRole('button',{name:'返回上一地点',exact:true}).click()
  await memberLocated(page,member.id)
  await expect(page.locator('.topic-related-notice')).toHaveCount(0)
  await returnOverview(page,topic)
})

test('theme navigation: map positioning preserves the theme, member, layers and reading position',async({page})=>{
  const china=topicById('china-plateaus'),world=topicById('world-high-peaks')
  await searchTheme(page,china)
  await selectMember(page,china.stops[1])
  const original=await camera(page)
  const layers=await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).layers)
  await page.locator('.explorer-scroll').evaluate(element=>{element.scrollTop=180})
  const scroll=await page.locator('.explorer-scroll').evaluate(element=>element.scrollTop)
  await page.getByRole('button',{name:'全球视野',exact:true}).click()
  await mapSettled(page)
  await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id',china.id)
  await expect(page.locator('.knowledge-panel h2')).toHaveText(cardById(china.stops[1]).name)
  await expect(page.getByRole('combobox',{name:'切换主题成员',exact:true})).toHaveValue(china.stops[1])
  expect(await page.locator('.explorer-scroll').evaluate(element=>element.scrollTop)).toBeCloseTo(scroll,0)
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).layers)).toEqual(layers)
  expect((await camera(page)).zoom).toBeLessThan(original.zoom)
  await page.goBack()
  await memberLocated(page,china.stops[1])
  expectSameCamera(await camera(page),original)
  await openLibrary(page)
  await page.getByRole('searchbox',{name:'搜索主题和主题成员'}).fill('')
  await expect(page.locator('.topic-list>button').filter({has:page.getByText(china.title,{exact:true})})).toHaveCount(1)
  await expect(page.locator('.topic-list>button').filter({has:page.getByText(world.title,{exact:true})})).toHaveCount(1)
  await searchTheme(page,world)
  await page.getByRole('button',{name:'定位中国',exact:true}).click()
  await mapSettled(page)
  await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id',world.id)
  await expect(page.locator('.topic-reader h1')).toHaveText(world.title)
  const ids=await page.evaluate(()=>{const source=window.__terraAtlas!.map.getSource('relation-labels')!.serialize() as {data:{features:{properties:{id:string}}[]}};return source.data.features.map(feature=>feature.properties.id)})
  expect(ids).toEqual(expectedRelationIds(world))
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true)
})

test('theme navigation: opening an already open library does not add duplicate browser history',async({page})=>{
  await openLibrary(page)
  await renderFrames(page)
  const length=await page.evaluate(()=>history.length)
  for(let index=0;index<3;index++)await page.locator('.panel-tabs').getByRole('button',{name:'主题',exact:true}).click()
  expect(await page.evaluate(()=>history.length)).toBe(length)
})

test('theme navigation: Back across a hash restores the member visited after that shared URL',async({page})=>{
  const first=cardById('tibetan-plateau'),second=cardById('loess-plateau'),third=cardById('sichuan-basin')
  const originalHash=sharedHash('china-plateaus',first.id,first.coordinates)
  await page.goto('/'+originalHash)
  await expect(page.locator('.knowledge-panel h2')).toHaveText(first.name)
  await selectedGeometry(page)
  await page.getByRole('combobox',{name:'切换主题成员',exact:true}).selectOption(second.id)
  await memberLocated(page,second.id)
  const secondCamera=await camera(page)
  await page.goto('/'+sharedHash('china-basins',third.id,third.coordinates))
  await expect(page.locator('.knowledge-panel h2')).toHaveText(third.name)
  await selectedGeometry(page)
  await page.goBack()
  await expect(page).toHaveURL(url=>url.hash===originalHash)
  await memberLocated(page,second.id)
  expectSameCamera(await camera(page),secondCamera)
  await page.goForward()
  await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id','china-basins')
  await expect(page.locator('.knowledge-panel h2')).toHaveText(third.name)
  await selectedGeometry(page)
})

for(const [id,label,source,layer] of [
  ['map-religion','宗教着色指标','religion','religion-fill'],
  ['map-language','语言语系筛选','language-areas','language-area-fill'],
] as const){
  test(`theme navigation: Back restores ${id} filters and the actual map layer`,async({page})=>{
    const topic=topicById(id)
    await searchTheme(page,topic)
    await sourceLoaded(page,source)
    const select=page.getByRole('combobox',{name:label,exact:true})
    await expect.poll(()=>select.locator('option').count()).toBeGreaterThan(1)
    const chosen=await select.locator('option').nth(1).getAttribute('value')
    expect(chosen).toBeTruthy()
    await select.selectOption(chosen!)
    if(id==='map-religion'){
      await page.locator('#human-opacity').focus()
      await page.keyboard.press('Home')
      await expect(page.locator('#human-opacity')).toHaveValue('0.15')
    }
    await mapSettled(page)
    const before=await page.evaluate(layer=>({thematic:JSON.parse(localStorage.getItem('terra-atlas-v1')!).thematic,filter:window.__terraAtlas!.map.getFilter(layer),paint:window.__terraAtlas!.map.getPaintProperty(layer,layer==='religion-fill'||layer==='language-area-fill'?'fill-color':'circle-color')}),layer)
    await searchTheme(page,topicById('china-plateaus'))
    await page.goBack()
    await expect(page.locator('.topic-library')).toBeVisible()
    await page.goBack()
    await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id',id)
    await expect(page.getByRole('combobox',{name:label,exact:true})).toHaveValue(chosen!)
    await sourceLoaded(page,source)
    await mapSettled(page)
    const after=await page.evaluate(layer=>({thematic:JSON.parse(localStorage.getItem('terra-atlas-v1')!).thematic,filter:window.__terraAtlas!.map.getFilter(layer),paint:window.__terraAtlas!.map.getPaintProperty(layer,layer==='religion-fill'||layer==='language-area-fill'?'fill-color':'circle-color')}),layer)
    expect(after).toEqual(before)
  })
}

for(const [oldId,currentId] of [
  ['world-mountains','world-mountain-ranges'],
  ['world-lake-origins','world-lakes'],
  ['world-population-scales','map-population'],
  ['world-culture-evidence','map-religion'],
] as const){
  test(`theme navigation: saved share alias ${oldId} opens ${currentId}`,async({page})=>{
    const topic=topicById(currentId),card=cardById(topic.stops[0])
    const params=new URLSearchParams({topic:oldId,place:card.id,view:'world',lng:String(card.coordinates[0]),lat:String(card.coordinates[1]),z:'3.4',layers:'terrain,mountains,rivers,lakes,borders'})
    await page.goto('/#'+params)
    await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id',currentId)
    await expect(page.locator('.knowledge-panel h2')).toHaveText(card.name)
    await selectedGeometry(page)
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).topicId)).toBe(currentId)
    expect(await page.evaluate(()=>window.__terraAtlas!.map.getZoom())).toBeCloseTo(3.4,3)
    await returnOverview(page,topic)
    await page.getByRole('button',{name:'主题库',exact:true}).click()
    await page.getByRole('searchbox',{name:'搜索主题和主题成员'}).fill(topic.title)
    await expect(page.locator('.topic-list>button').filter({has:page.getByText(topic.title,{exact:true})})).toHaveCount(1)
  })
}

test('theme provinces: all 34 administrative entries have distinct introductions and visible map locations',async({page})=>{
  const topic=topicById('china-provinces')
  expect(topic.stops).toHaveLength(34)
  await searchTheme(page,topic)
  await selectMember(page,topic.stops[0])
  for(const id of topic.stops){
    await page.getByRole('combobox',{name:'切换主题成员',exact:true}).selectOption(id)
    await memberLocated(page,id)
    const card=cardById(id)
    await expect(page.locator('.knowledge-panel .summary')).toHaveText(card.summary)
    for(const section of card.sections||[])await expect(page.locator('.knowledge-panel')).toContainText(section.body)
    await expect(page.getByRole('button',{name:'主题全览',exact:true})).toBeInViewport()
  }
  await returnOverview(page,topic)
})

test('theme labs: seasons and latitude change daylight, and longitude changes solar time',async({page})=>{
  const topic=topicById('earth-seasons')
  if(topic.region==='world'&&!topic.shared)await page.getByRole('button',{name:'全球视野',exact:true}).click()
  await searchTheme(page,topic)
  const handle=page.getByRole('button',{name:'调整阅读面板大小',exact:true})
  if(await handle.isVisible())await handle.press('End')
  const lab=page.getByRole('region',{name:'昼夜与经度实验'})
  await lab.getByRole('combobox',{name:'季节位置'}).selectOption('march')
  await expect(lab.locator('.lab-result')).toContainText('白昼 12.0 小时')
  await lab.getByRole('slider',{name:'观察纬度'}).focus()
  await page.keyboard.press('End')
  await lab.getByRole('combobox',{name:'季节位置'}).selectOption('june')
  await expect(lab.locator('.lab-result')).toContainText('白昼 24.0 小时')
  await lab.getByRole('slider',{name:'观察纬度'}).focus()
  await page.keyboard.press('Home')
  await expect(lab.locator('.lab-result')).toContainText('白昼 0.0 小时')
  await lab.getByRole('slider',{name:'经度时差'}).focus()
  await page.keyboard.press('Home')
  await expect(page.getByTestId('solar-offset')).toHaveText('地方时慢 12 小时')
  await page.keyboard.press('End')
  await expect(page.getByTestId('solar-offset')).toHaveText('地方时快 12 小时')
  await expect(page.getByRole('button',{name:'主题库',exact:true})).toBeInViewport()
})

test('theme labs: scale and paper distance change the real-distance calculation',async({page})=>{
  const topic=topicById('earth-map-reading')
  if(topic.region==='world'&&!topic.shared)await page.getByRole('button',{name:'全球视野',exact:true}).click()
  await searchTheme(page,topic)
  const handle=page.getByRole('button',{name:'调整阅读面板大小',exact:true})
  if(await handle.isVisible())await handle.press('End')
  const lab=page.getByRole('region',{name:'比例尺实验'})
  await lab.getByRole('combobox',{name:'纸图比例尺'}).selectOption('1000000')
  await lab.getByRole('slider',{name:'图上距离'}).focus()
  await page.keyboard.press('End')
  await expect(page.getByTestId('scale-result')).toHaveText('对应实地 100 千米')
  await page.keyboard.press('Home')
  await expect(page.getByTestId('scale-result')).toHaveText('对应实地 10 千米')
  await lab.getByRole('combobox',{name:'纸图比例尺'}).selectOption('10000')
  await expect(page.getByTestId('scale-result')).toHaveText('对应实地 0.1 千米')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true)
})
