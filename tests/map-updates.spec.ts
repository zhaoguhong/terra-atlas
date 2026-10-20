import {test,expect,type Page} from '@playwright/test'
import {baseReady,mapSettled,renderFrames,sourceLoaded} from './map-readiness'
import {chooseTheme} from './theme-controls'

const sources=['places','selection','relations','relation-labels','religion']
async function resetWrites(page:Page){
  await mapSettled(page)
  await page.evaluate(sources=>{
    const map=window.__terraAtlas!.map,element=map.getContainer()
    if(!element.dataset.writesInstalled){
      for(const id of sources){
        const source=map.getSource(id) as {setData:(...args:unknown[])=>unknown},setData=source.setData
        source.setData=function(...args){
          const counts=JSON.parse(element.dataset.sourceWrites||'{}')
          counts[id]=(counts[id]||0)+1;element.dataset.sourceWrites=JSON.stringify(counts)
          return setData.apply(this,args)
        }
      }
      element.dataset.writesInstalled='true'
    }
    element.dataset.sourceWrites='{}'
  },sources)
}
async function writes(page:Page){
  await renderFrames(page)
  return page.evaluate(()=>JSON.parse(window.__terraAtlas!.map.getContainer().dataset.sourceWrites!))
}

test('map updates: opacity and language filters preserve source geometry while religion metrics update only religion',async({page})=>{
  await page.goto('/');await baseReady(page)
  for(const source of ['regions','rivers','lakes','peaks','summits'])await sourceLoaded(page,source)
  await chooseTheme(page,'长期气候分布');await sourceLoaded(page,'climate');await resetWrites(page)
  await page.locator('#climate-opacity').fill('0.65')
  expect(await writes(page),'climate opacity must not reserialize any source geometry').toEqual({})
  expect(await page.evaluate(()=>window.__terraAtlas!.map.getPaintProperty('climate-fill','fill-opacity'))).toBe(.65)

  await page.getByRole('button',{name:'退出主题',exact:true}).click()
  await chooseTheme(page,'语言分布');await page.getByRole('combobox',{name:'语言展示方式'}).selectOption('points');await sourceLoaded(page,'languages');await resetWrites(page)
  await page.getByRole('combobox',{name:'语言语系筛选'}).selectOption('sino1245')
  expect(await writes(page),'a language filter must not reserialize source geometry').toEqual({})
  expect(JSON.stringify(await page.evaluate(()=>window.__terraAtlas!.map.getFilter('language-dots')))).toContain('sino1245')

  await page.getByRole('button',{name:'退出主题',exact:true}).click()
  await chooseTheme(page,'国家宗教构成');await sourceLoaded(page,'religion');await resetWrites(page)
  await page.getByRole('combobox',{name:'宗教着色指标'}).selectOption('muslim')
  expect(await writes(page)).toEqual({religion:1})
  const china=await page.evaluate(()=>window.__terraAtlas!.data.religion.features.find(f=>f.properties.id==='country-chn')!.properties)
  expect(china.eligible).toBe(true);expect(china.share).toBeGreaterThan(0)
  await resetWrites(page)
  await page.locator('#human-opacity').fill('0.5')
  expect(await writes(page),'religion opacity must not rebuild religion statistics or other geometry').toEqual({})
})
