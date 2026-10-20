import {test,expect,type Page} from '@playwright/test'
import {baseReady,mapSettled,renderFrames,selectedGeometry,sourceLoaded} from './map-readiness'
import {chooseTheme} from './theme-controls'
import {clickHeaderAction} from './header-actions'

test.use({reducedMotion:'reduce'})
test.setTimeout(120000)
let errors:string[]=[]
test.beforeEach(async({page})=>{
  errors=[]
  page.on('pageerror',error=>errors.push(error.message))
})
test.afterEach(()=>expect(errors,'navigation must not produce runtime errors').toEqual([]))

async function camera(page:Page){
  await mapSettled(page)
  return page.evaluate(()=>({center:window.__terraAtlas!.map.getCenter().toArray(),zoom:window.__terraAtlas!.map.getZoom()}))
}
function sameCamera(actual:Awaited<ReturnType<typeof camera>>,expected:Awaited<ReturnType<typeof camera>>){
  expect(actual.zoom).toBeCloseTo(expected.zoom,5)
  actual.center.forEach((value,index)=>expect(value).toBeCloseTo(expected.center[index],5))
}

async function delayedFavorite(page:Page){
  let release!:()=>void,requested!:()=>void
  const gate=new Promise<void>(resolve=>{release=resolve})
  const request=new Promise<void>(resolve=>{requested=resolve})
  await page.addInitScript(()=>{
    localStorage.setItem('terra-atlas-v1',JSON.stringify({favorites:['language-aari1239'],view:'china',topicId:null}))
    // Observe completion of the real JSON parse, so a negative stale-update
    // assertion cannot pass before the delayed callback has had a chance to run.
    const original=Response.prototype.json
    Response.prototype.json=async function(){
      const value=await original.call(this)
      if(this.url.includes('/data/learning-languages.geojson'))(window as Window&{__raceJsonReady?:boolean}).__raceJsonReady=true
      return value
    }
  })
  await page.route('**/data/learning-languages.geojson',async route=>{
    requested();await gate;await route.continue()
  })
  await page.goto('/');await baseReady(page);await mapSettled(page)
  await clickHeaderAction(page,'打开收藏')
  await page.locator('.saved-list').first().getByRole('button',{name:'已保存的地理对象',exact:true}).click()
  await request
  return {
    release,
    settle:async()=>{
      release()
      await page.waitForFunction(()=>(window as Window&{__raceJsonReady?:boolean}).__raceJsonReady===true)
      await renderFrames(page);await mapSettled(page)
    },
  }
}

for(const destination of ['theme','selection','library'] as const){
  test(`navigation race: a late favorite cannot replace a newer ${destination}`,async({page},testInfo)=>{
    const pending=await delayedFavorite(page)
    try{
      if(destination==='theme'){
        await chooseTheme(page,'中国四大高原')
        // Labels appear before the region geometry; wait for its real fit before recording the camera.
        await sourceLoaded(page,'regions')
        await page.waitForFunction(()=>{
          const source=window.__terraAtlas!.map.getSource('relation-labels').serialize() as {data?:{features?:unknown[]}}
          return source.data?.features?.length===4
        })
      }else if(destination==='selection'){
        await page.getByRole('textbox',{name:'搜索地理对象',exact:true}).fill('Alps')
        await page.locator('.search-results>button').first().click()
        await expect(page.locator('.knowledge-panel h2')).toHaveText('阿尔卑斯山脉')
        await selectedGeometry(page)
      }else{
        await page.locator('.panel-tabs').getByRole('button',{name:'主题',exact:true}).click()
        await expect(page.locator('.topic-library')).toBeVisible()
      }
      const before=await camera(page)
      await pending.settle()
      if(destination==='theme'){
        await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id','china-plateaus')
        await expect(page.locator('.topic-reader h1')).toHaveText('中国四大高原')
        await expect(page.locator('.knowledge-panel h2')).toHaveCount(0)
      }else if(destination==='selection'){
        await expect(page.locator('.knowledge-panel h2')).toHaveText('阿尔卑斯山脉')
        await selectedGeometry(page)
      }else{
        await expect(page.locator('.topic-library')).toBeVisible()
        await expect(page.locator('.knowledge-panel h2')).toHaveCount(0)
      }
      sameCamera(await camera(page),before)
      await page.screenshot({path:testInfo.outputPath(`late-favorite-${destination}.png`)})
    }finally{pending.release()}
  })
}

test('navigation race: an uncancelled lazy favorite still opens and locates its real feature',async({page},testInfo)=>{
  const pending=await delayedFavorite(page)
  try{
    await pending.settle()
    await expect(page.locator('.knowledge-panel h2')).toHaveText('Aari')
    await sourceLoaded(page,'languages');await selectedGeometry(page)
    const selection=await page.evaluate(()=>{
      const atlas=window.__terraAtlas!
      const source=atlas.map.getSource('selection').serialize() as {data:{features:{properties:{id:string}}[]}}
      return {ids:source.data.features.map(feature=>feature.properties.id),zoom:atlas.map.getZoom()}
    })
    expect(selection.ids).toContain('language-aari1239')
    expect(selection.zoom).toBeGreaterThan(3)
    await page.screenshot({path:testInfo.outputPath('lazy-favorite-opened.png')})
  }finally{pending.release()}
})

for(const previous of ['collapsed reader','comparison'] as const){
  test(`navigation hash: a same-document link restores the reader after ${previous}`,async({page,isMobile},testInfo)=>{
    await page.goto('/');await baseReady(page)
    await chooseTheme(page,'中国四大高原')
    await page.locator('.topic-members>button').filter({has:page.getByText('黄土高原',{exact:true})}).click()
    await expect(page.locator('.knowledge-panel h2')).toHaveText('黄土高原');await selectedGeometry(page)
    if(isMobile){
      await page.getByRole('button',{name:'卡片全屏',exact:true}).click()
      await page.getByRole('button',{name:'关闭探索面板',exact:true}).click()
    }else await page.getByRole('button',{name:'收起探索面板',exact:true}).click()
    await expect(page.locator('.explorer')).not.toBeVisible()
    if(previous==='comparison'){
      await clickHeaderAction(page,'打开两地对比')
      await expect(page.locator('.compare-panel')).toBeVisible()
    }
    const response=await page.goto('/#'+new URLSearchParams({topic:'china-basins',place:'sichuan-basin',lng:'104',lat:'30.5',z:'4.2',view:'china',layers:'terrain,mountains,rivers,lakes,borders'}))
    expect(response,'this must exercise hashchange without reloading React').toBeNull()
    await expect(page.locator('.compare-panel')).toHaveCount(0)
    await expect(page.locator('.explorer')).toBeVisible()
    await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id','china-basins')
    await expect(page.locator('.knowledge-panel h2')).toHaveText('四川盆地')
    await expect(page.locator('.knowledge-panel h2')).toBeVisible()
    if(isMobile)await expect(page.locator('.explorer')).toHaveClass(/sheet-half/)
    await selectedGeometry(page)
    expect((await camera(page)).zoom).toBeCloseTo(4.2,5)
    await page.screenshot({path:testInfo.outputPath(`hash-after-${previous.replaceAll(' ','-')}.png`)})
  })
}
