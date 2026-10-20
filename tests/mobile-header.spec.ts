import {expect,test,type Page} from '@playwright/test'
import {baseReady,mapSettled,renderFrames,selectedGeometry} from './map-readiness'
import {clickHeaderAction} from './header-actions'

const more=(page:Page)=>page.getByRole('button',{name:'更多操作',exact:true})
const actions=(page:Page)=>page.locator('#header-actions')
const search=(page:Page)=>page.getByRole('textbox',{name:'搜索地理对象',exact:true})
let errors:string[]=[]

test.setTimeout(90000)
test.beforeEach(async({page})=>{
  errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto('/')
  await baseReady(page);await mapSettled(page)
})
test.afterEach(()=>expect(errors,'header runtime errors').toEqual([]))

async function openMore(page:Page){
  await more(page).click()
  await expect(more(page)).toHaveAttribute('aria-expanded','true')
  await expect(actions(page)).toBeVisible()
}

async function compactGeometry(page:Page){
  await renderFrames(page)
  const boxes=await page.evaluate(()=>{
    const box=(selector:string)=>{
      const rect=document.querySelector<HTMLElement>(selector)!.getBoundingClientRect()
      return {left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height}
    }
    return {
      header:box('.header'),stage:box('.map-stage'),brand:box('.brand'),view:box('.map-view-actions'),
      search:box('.search-box'),more:box('.header-more'),viewport:innerWidth,
      overflow:document.documentElement.scrollWidth>innerWidth,
    }
  })
  expect(boxes.header.height).toBeLessThanOrEqual(64)
  expect(boxes.header.height).toBeGreaterThanOrEqual(44)
  expect(boxes.stage.top).toBeCloseTo(boxes.header.bottom,0)
  expect(boxes.overflow).toBe(false)
  for(const item of [boxes.brand,boxes.view,boxes.search,boxes.more]){
    expect(item.top).toBeGreaterThanOrEqual(boxes.header.top)
    expect(item.bottom).toBeLessThanOrEqual(boxes.header.bottom)
    expect(item.left).toBeGreaterThanOrEqual(0)
    expect(item.right).toBeLessThanOrEqual(boxes.viewport)
  }
  const centers=[boxes.brand,boxes.view,boxes.search,boxes.more].map(box=>(box.top+box.bottom)/2)
  expect(Math.max(...centers)-Math.min(...centers)).toBeLessThanOrEqual(2)
  expect(boxes.brand.right).toBeLessThanOrEqual(boxes.view.left+1)
  expect(boxes.view.right).toBeLessThanOrEqual(boxes.search.left+1)
  expect(boxes.search.right).toBeLessThanOrEqual(boxes.more.left+1)
  expect(boxes.more.width).toBeGreaterThanOrEqual(44)
  expect(boxes.more.height).toBeGreaterThanOrEqual(44)
  await expect(search(page)).toBeVisible()
  await expect(search(page)).toBeInViewport({ratio:1})
  await expect(more(page)).toHaveAttribute('aria-controls','header-actions')
  await expect(more(page)).toHaveAttribute('aria-expanded','false')
  await expect(actions(page)).not.toBeVisible()
  return boxes
}

test('mobile header stays in one row across narrow phones and short landscape viewports',async({page},info)=>{
  test.skip(info.project.name!=='mobile','one touch project covers the complete viewport matrix')
  for(const viewport of [
    {width:320,height:667},{width:360,height:800},{width:390,height:844},
    {width:568,height:320},{width:844,height:390},{width:759,height:900},
  ]){
    await page.setViewportSize(viewport)
    const layout=await compactGeometry(page)
    await openMore(page)
    const menu=(await actions(page).boundingBox())!
    expect(menu.x).toBeGreaterThanOrEqual(0)
    expect(menu.x+menu.width).toBeLessThanOrEqual(viewport.width)
    expect(menu.y).toBeGreaterThanOrEqual(layout.header.bottom-1)
    expect(menu.y+menu.height).toBeLessThanOrEqual(viewport.height)
    for(const name of ['打开两地对比','打开收藏','分享当前地图','资料与关于']){
      const action=actions(page).getByRole('button',{name,exact:true})
      await expect(action).toBeVisible()
      await expect(action.locator('span')).toBeVisible()
      expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
    await page.keyboard.press('Escape')
    await expect(more(page)).toBeFocused()
  }
  await page.setViewportSize({width:390,height:844})
  await page.screenshot({path:test.info().outputPath('compact-mobile-header.png')})
})

test('desktop retains its inline search and direct header actions at the mobile breakpoint',async({page},info)=>{
  test.skip(info.project.name!=='desktop','desktop layout only')
  for(const viewport of [{width:760,height:900},{width:1440,height:950}]){
    await page.setViewportSize(viewport);await renderFrames(page)
    await expect(more(page)).not.toBeVisible()
    await expect(actions(page)).toBeVisible()
    await expect(search(page)).toBeInViewport({ratio:1})
    for(const name of ['打开两地对比','打开收藏','分享当前地图','资料与关于'])
      await expect(actions(page).getByRole('button',{name,exact:true})).toBeInViewport({ratio:1})
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  }
})

test('header share copies a restorable map link and leaves the primary map tools clear',async({page},info)=>{
  await expect(page.locator('.map-tools').getByRole('button',{name:'分享当前地图',exact:true})).toHaveCount(0)
  await expect(page.locator('.map-tools').getByRole('button',{name:'保存当前视图',exact:true})).toHaveCount(0)
  const share=actions(page).getByRole('button',{name:'分享当前地图',exact:true})
  if(info.project.name.startsWith('mobile'))await expect(share).not.toBeVisible()
  else await expect(share).toBeInViewport({ratio:1})
  await page.evaluate(()=>{
    window.__terraAtlas!.map.jumpTo({center:[106.25,34.75],zoom:3.7})
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{document.body.dataset.sharedUrl=text}}})
  })
  await mapSettled(page)
  await clickHeaderAction(page,'分享当前地图')
  await expect(page.locator('.toast')).toHaveText('探索链接已复制')
  if(info.project.name.startsWith('mobile')){
    await expect(actions(page)).not.toBeVisible()
    await expect(more(page)).toHaveAttribute('aria-expanded','false')
  }
  await expect.poll(()=>page.evaluate(()=>document.body.dataset.sharedUrl)).toBeTruthy()
  const url=await page.evaluate(()=>document.body.dataset.sharedUrl!)
  const params=new URLSearchParams(new URL(url).hash.slice(1))
  expect(params.get('lng')).toBe('106.2500')
  expect(params.get('lat')).toBe('34.7500')
  expect(params.get('z')).toBe('3.70')
  await page.evaluate(()=>window.__terraAtlas!.map.jumpTo({center:[-40,10],zoom:1.9}))
  await mapSettled(page)
  await page.goto(url);await baseReady(page);await mapSettled(page)
  const restored=await page.evaluate(()=>({center:window.__terraAtlas!.map.getCenter().toArray(),zoom:window.__terraAtlas!.map.getZoom()}))
  expect(restored.center[0]).toBeCloseTo(106.25,3)
  expect(restored.center[1]).toBeCloseTo(34.75,3)
  expect(restored.zoom).toBeCloseTo(3.7,2)
})

test('mobile more menu supports keyboard dismissal and preserves all four actions',async({page},info)=>{
  test.skip(!info.project.name.startsWith('mobile'),'mobile overflow menu only')
  const tabKey=info.project.use.browserName==='webkit'?'Alt+Tab':'Tab'
  await more(page).focus();await page.keyboard.press('Enter')
  await expect(actions(page)).toBeVisible()
  await page.screenshot({path:test.info().outputPath('mobile-more-menu.png')})
  // macOS WebKit uses Option-Tab to include buttons without Full Keyboard Access.
  await page.keyboard.press(tabKey)
  await expect(actions(page).getByRole('button',{name:'打开两地对比',exact:true})).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(actions(page)).not.toBeVisible();await expect(more(page)).toBeFocused()

  await openMore(page)
  await page.locator('.brand').click()
  await expect(actions(page)).not.toBeVisible()
  await expect(more(page)).toHaveAttribute('aria-expanded','false')

  await openMore(page)
  await actions(page).getByRole('button',{name:'打开两地对比',exact:true}).click()
  await expect(page.locator('.compare-panel')).toBeVisible()
  await expect(actions(page)).not.toBeVisible()
  await page.getByRole('button',{name:'关闭对比',exact:true}).click()

  await openMore(page)
  await actions(page).getByRole('button',{name:'打开收藏',exact:true}).click()
  await expect(page.locator('.explorer')).toHaveClass(/mobile-open/)
  await expect(page.locator('.explorer')).toContainText('收藏与保存视图')
  await expect(actions(page)).not.toBeVisible()
  await openMore(page)
  await page.keyboard.press('Escape')
  await expect(actions(page)).not.toBeVisible()
  await expect(page.locator('.explorer')).toHaveClass(/mobile-open/)
  await expect(more(page)).toBeFocused()
  await search(page).fill('青海湖')
  await expect(page.locator('.search-results>button').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.search-box')).not.toHaveClass(/mobile-search-open/)
  await expect(page.locator('.search-results')).not.toBeVisible()
  await expect(page.locator('.explorer')).toHaveClass(/mobile-open/)
  await expect(more(page)).toBeFocused()
  await page.getByRole('button',{name:'关闭探索面板',exact:true}).click()

  await openMore(page)
  await actions(page).getByRole('button',{name:'资料与关于',exact:true}).click()
  await expect(page.getByRole('dialog')).toContainText('山河图 · Terra Atlas')
  await expect(actions(page)).not.toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(more(page)).toBeFocused()

  const mobileViewport=page.viewportSize()!
  await openMore(page);await more(page).focus();await page.keyboard.press(tabKey)
  const firstAction=actions(page).getByRole('button',{name:'打开两地对比',exact:true})
  await expect(firstAction).toBeFocused()
  await page.setViewportSize({width:760,height:900})
  await expect(more(page)).not.toBeVisible()
  await expect(actions(page)).toBeVisible()
  await expect(firstAction).toBeFocused()
  await page.setViewportSize(mobileViewport)
  await expect(actions(page)).not.toBeVisible()
  await expect(more(page)).toBeFocused()
})

test('mobile compact search expands, selects a real place, and stays usable after rotation',async({page},info)=>{
  test.skip(!info.project.name.startsWith('mobile'),'compact mobile search only')
  const stageTop=(await page.locator('.map-stage').boundingBox())!.y
  await openMore(page)
  await search(page).fill('长江')
  await expect(actions(page)).not.toBeVisible()
  await expect(page.locator('.search-box')).toHaveClass(/mobile-search-open/)
  await expect(page.getByRole('button',{name:'关闭搜索',exact:true})).toBeVisible()
  await page.screenshot({path:test.info().outputPath('mobile-expanded-search.png')})
  expect((await page.locator('.map-stage').boundingBox())!.y).toBeCloseTo(stageTop,0)
  await expect(page.locator('.search-results>button').first()).toBeVisible()
  await search(page).press('Enter')
  await expect(page.locator('.knowledge-panel h2')).toHaveText('长江')
  await selectedGeometry(page)
  await expect(page.locator('.search-box')).not.toHaveClass(/mobile-search-open/)
  await expect(search(page)).toBeFocused()
  await page.keyboard.press('Control+k')
  await expect(page.locator('.search-box')).toHaveClass(/mobile-search-open/)
  await expect(search(page)).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('.search-box')).not.toHaveClass(/mobile-search-open/)

  await search(page).fill('青海湖')
  await expect(page.locator('.search-results>button')).toBeVisible()
  await page.getByRole('button',{name:'关闭搜索',exact:true}).click()
  await expect(page.locator('.search-box')).not.toHaveClass(/mobile-search-open/)
  await expect(page.locator('.search-results')).not.toBeVisible()

  await search(page).fill('Alps')
  await expect(page.locator('.search-box')).toHaveClass(/mobile-search-open/)
  await openMore(page)
  await expect(page.locator('.search-box')).not.toHaveClass(/mobile-search-open/)
  await expect(page.locator('.search-results')).not.toBeVisible()
  await page.setViewportSize(info.project.name==='mobile'?{width:844,height:390}:{width:390,height:844})
  await expect(actions(page)).not.toBeVisible()
  await compactGeometry(page)
  await search(page).fill('Alps')
  await page.locator('.search-results>button').first().click()
  await expect(page.locator('.knowledge-panel h2')).toHaveText('阿尔卑斯山脉')
  await selectedGeometry(page)
})
