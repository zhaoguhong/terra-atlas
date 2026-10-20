import {expect,test} from '@playwright/test'
import {baseReady,mapSettled,selectedGeometry,sourceLoaded} from './map-readiness'
import {chooseTheme} from './theme-controls'

 test('topic introductions: area bars, plate comparison and expandable module explanations',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
  await page.goto('/');await baseReady(page)
  await chooseTheme(page,'世界七大洲')
  const handle=page.getByRole('button',{name:'调整阅读面板大小',exact:true})
  if(await handle.isVisible())await handle.press('End')
  const figure=page.getByRole('figure',{name:'七大洲陆地面积对比',exact:true})
  await expect(figure).toBeVisible()
  await expect(figure.locator('.topic-bar')).toHaveCount(7)
  await expect(figure).toContainText('44.13');await expect(figure).toContainText('8.94')
  const widths=await figure.locator('.bar-track i').evaluateAll(nodes=>nodes.map(n=>parseFloat((n as HTMLElement).style.width)))
  expect(widths[0]).toBe(100);expect(widths[6]).toBeCloseTo(100*8.94/44.13,4)
  await expect(page.locator('.topic-expanded-intro')).not.toHaveAttribute('open','')
  await page.getByText('展开主题介绍',{exact:true}).click()
  await expect(page.locator('.topic-explanation')).toContainText('亚洲和欧洲同处欧亚大陆')
  const module=page.getByRole('region',{name:'学习模块'}).locator('.topic-module').first()
  await module.getByText('展开说明',{exact:true}).click()
  await expect(module.locator('.module-detail')).toHaveAttribute('open','')
  await expect(module.locator('.module-detail p')).toContainText('连续陆地')
  await figure.getByRole('button',{name:/亚洲，44.13/}).click()
  await expect(page.locator('.knowledge-panel h2')).toHaveText('亚洲：大陆尺度与内部差异')
  await expect(page.getByRole('textbox',{name:'这个地点的笔记',exact:true})).toHaveCount(0)
  await page.getByRole('button',{name:'主题全览',exact:true}).click()
  await page.screenshot({path:test.info().outputPath('continents-introduction-'+info.project.name+'.png')})
  await chooseTheme(page,'板块、地震与火山')
  if(await handle.isVisible())await handle.press('End')
  const plates=page.getByRole('figure',{name:'几种运动，留下不同地表线索',exact:true})
  await expect(page.locator('.topic-expanded-intro')).toHaveCount(1)
  await expect(page.locator('.topic-expanded-intro')).not.toHaveAttribute('open','')
  await page.getByText('展开主题介绍',{exact:true}).click()
  await expect(page.locator('.topic-expanded-intro')).toContainText('运动怎样留下地表痕迹')
  await expect(page.locator('.topic-expanded-intro')).not.toContainText('亚洲和欧洲同处欧亚大陆')
  await page.getByText('展开主题介绍',{exact:true}).click()
  await expect(plates.locator('.plate-process')).toHaveCount(4)
  await sourceLoaded(page,'plates');await mapSettled(page)
  await expect.poll(()=>page.evaluate(()=>window.__terraAtlas!.map.getLayoutProperty('plate-lines','visibility'))).toBe('visible')
  await plates.scrollIntoViewIfNeeded()
  await plates.screenshot({path:test.info().outputPath('plate-diagram-'+info.project.name+'.png')})
  await page.screenshot({path:test.info().outputPath('plate-introduction-'+info.project.name+'.png')})
  expect(errors).toEqual([])
 })

 test('auxiliary layers: actual map clicks open source-specific data overviews',async({page})=>{
  for(const source of ['cities','basins','plates']){
    await page.goto('/#lng=0&lat=20&z=4&view=world&layers='+source)
    await baseReady(page);await sourceLoaded(page,source)
    const picked=await page.evaluate(source=>{
      const atlas=window.__terraAtlas!,features=atlas.data[source].features
      const feature=source==='cities'?features.find(f=>f.properties.nameEn==='Paris')!:source==='basins'?features.find(f=>f.properties.center&&f.properties.center[1]>20&&f.properties.center[1]<50)!:features.find(f=>f.properties.boundaryType==='divergent'&&f.geometry.type==='LineString'&&f.geometry.coordinates.length>20&&Math.abs(f.geometry.coordinates[Math.floor(f.geometry.coordinates.length/2)][1])<50)!
      const line=source==='plates'?(feature.geometry as {type:'LineString';coordinates:[number,number][]}).coordinates:[]
      // Avoid junction endpoints, where several genuine boundary categories meet.
      const coordinates=source==='cities'?(feature.geometry as {type:'Point';coordinates:[number,number]}).coordinates:source==='basins'?feature.properties.center!:line[Math.floor(line.length/2)]
      const map=atlas.map,rect=map.getContainer().getBoundingClientRect()
      map.jumpTo({center:coordinates,zoom:5})
      const target={x:rect.width*.65,y:rect.height*.22}
      map.panBy([rect.width/2-target.x,rect.height/2-target.y],{duration:0})
      return {id:feature.properties.id,name:feature.properties.name,coordinates}
    },source)
    await mapSettled(page)
    const pixel=await page.evaluate(coordinates=>{
      const map=window.__terraAtlas!.map,p=map.project(coordinates),r=map.getContainer().getBoundingClientRect()
      return {x:p.x+r.left,y:p.y+r.top}
    },picked.coordinates)
    await page.mouse.click(pixel.x,pixel.y)
    await expect(page.locator('.knowledge-panel h2')).toHaveText(picked.name)
    await expect(page.locator('.knowledge-panel .summary')).toContainText(source==='cities'?'代表城市定位点':source==='basins'?'第3级汇水分区数据概览':'概化板块边界数据概览')
    if(source==='basins'){
      await expect(page.locator('.knowledge-panel .sources a').first()).toHaveAttribute('href','https://www.hydrosheds.org/hydroatlas')
      await expect(page.locator('.knowledge-panel .sources')).toContainText('BasinATLAS v1.0')
      expect(await page.evaluate(id=>window.__terraAtlas!.data.basins.features.find(f=>f.properties.id===id)!.properties.sourceId,picked.id)).toBe('basinatlas-l3')
    }
    await expect.poll(()=>page.evaluate(id=>{
      const selection=window.__terraAtlas!.map.getSource('selection')!.serialize() as {data:{features:{properties:{id:string}}[]}}
      return selection.data.features.some(f=>f.properties.id===id)
    },picked.id)).toBe(true)
    await expect(page.getByRole('textbox',{name:'这个地点的笔记',exact:true})).toHaveCount(0)
  }
 })

 test('auxiliary layers: pre-migration basin links retain the real selection and saved bookmark',async({page})=>{
  const id='basin-hybas-1030000010'
  await page.goto('/#'+new URLSearchParams({lng:'35.6269',lat:'22.44986',z:'4.25',view:'world',layers:'basins',place:id,feature:id,source:'basins'}))
  await baseReady(page);await sourceLoaded(page,'basins');await selectedGeometry(page)
  await expect(page.locator('.knowledge-panel h2')).toHaveText('非洲汇水分区 111')
  await expect.poll(()=>page.evaluate(()=>window.__terraAtlas!.map.getZoom())).toBe(4.25)
  const handle=page.getByRole('button',{name:'调整阅读面板大小',exact:true})
  if(await handle.isVisible())await handle.press('End')
  await page.getByRole('button',{name:'收藏地点',exact:true}).click()
  await page.reload();await baseReady(page);await sourceLoaded(page,'basins');await selectedGeometry(page)
  if(await handle.isVisible())await handle.press('End')
  await expect(page.getByRole('button',{name:'已收藏',exact:true})).toHaveAttribute('aria-pressed','true')
  await expect(page.locator('.knowledge-panel h2')).toHaveText('非洲汇水分区 111')
 })

 test('auxiliary layers: real features render, toggle independently, persist and survive sharing',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
  await page.goto('/');await baseReady(page)
  await page.getByRole('button',{name:'打开图层面板',exact:true}).click()
  for(const name of ['城市与首都图层','流域与分水岭图层','板块边界图层'])await page.getByRole('checkbox',{name,exact:true}).check()
  for(const source of ['cities','basins','plates'])await sourceLoaded(page,source)
  await page.getByRole('button',{name:'关闭图层面板',exact:true}).click()
  await page.evaluate(()=>window.__terraAtlas!.map.jumpTo({center:[30,15],zoom:2.8}))
  await mapSettled(page)
  const counts=await page.evaluate(()=>Object.fromEntries(['city-dots','basin-fill','plate-lines'].map(layer=>[layer,window.__terraAtlas!.map.queryRenderedFeatures({layers:[layer]}).length])))
  for(const count of Object.values(counts))expect(count).toBeGreaterThan(0)
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).layers)).toMatchObject({cities:true,basins:true,plates:true})
  await page.screenshot({path:test.info().outputPath('auxiliary-layers-'+info.project.name+'.png')})
  await page.getByRole('button',{name:'打开图层面板',exact:true}).click()
  await page.getByRole('checkbox',{name:'流域与分水岭图层',exact:true}).uncheck()
  await page.getByRole('button',{name:'关闭图层面板',exact:true}).click()
  await expect.poll(()=>page.evaluate(()=>window.__terraAtlas!.map.getLayoutProperty('basin-fill','visibility'))).toBe('none')
  await expect.poll(()=>page.evaluate(()=>window.__terraAtlas!.map.getLayoutProperty('plate-lines','visibility'))).toBe('visible')
  await page.reload();await baseReady(page)
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).layers)).toMatchObject({cities:true,basins:false,plates:true})
  // Shared URLs use the same new layer keys and must not fall back to old defaults.
  await page.goto('/#lng=30&lat=15&z=2.8&view=world&layers=cities,basins,plates')
  await baseReady(page)
  for(const source of ['cities','basins','plates'])await sourceLoaded(page,source)
  await mapSettled(page)
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')!).layers)).toMatchObject({cities:true,basins:true,plates:true,terrain:false})
  expect(errors).toEqual([])
 })
