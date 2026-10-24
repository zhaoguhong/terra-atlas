import {test,expect,type Page} from '@playwright/test'
import {baseReady,mapSettled,selectedGeometry} from './map-readiness'
import {clickHeaderAction} from './header-actions'
import {openThemeLibrary} from './theme-controls'

async function select(page:Page,name:string){
  await page.getByRole('combobox',{name:'搜索地理对象'}).fill(name)
  await page.locator('.search-results>button').filter({has:page.locator('strong',{hasText:new RegExp(`^${name}$`)})}).click()
  await expect(page.locator('.knowledge-panel h2')).toHaveText(name)
  await selectedGeometry(page)
}

async function expandCard(page:Page){
  const handle=page.getByRole('button',{name:'调整阅读面板大小',exact:true})
  if(await handle.isVisible())await handle.press('End')
}

test.beforeEach(async({page})=>{await page.goto('/');await baseReady(page)})

test('optimization: casual exploration is a peer of the theme catalogue',async({page},info)=>{
  await openThemeLibrary(page)
  await expect(page.getByRole('region',{name:'附近探索'})).toHaveCount(0)
  await page.locator('.panel-tabs').getByRole('button',{name:'随便看看',exact:true}).click()
  await expect(page.locator('.topic-library')).toHaveCount(0)
  const nearby=page.getByRole('region',{name:'附近探索'})
  await expect(nearby).toBeVisible()
  await expect(nearby.getByRole('button',{name:'随机探索一个地方'})).toBeInViewport()
  await expect(nearby.locator('.suggestions>button')).toHaveCount(3)
  const before=await nearby.locator('.suggestions strong').allTextContents()
  await nearby.getByRole('button',{name:'换一批',exact:true}).click()
  expect(await nearby.locator('.suggestions strong').allTextContents()).not.toEqual(before)
  const first=nearby.locator('.suggestions>button').first()
  await expect(first).toBeInViewport()
  await page.screenshot({path:info.outputPath('nearby.png')})
  const name=await first.locator('strong').innerText()
  await first.click()
  await expect(page.locator('.knowledge-panel h2')).toHaveText(name)
  await selectedGeometry(page)
  await openThemeLibrary(page)
  await expect(page.locator('.theme-catalogue-heading')).toBeInViewport()
  await expect(page.locator('.topic-list>button')).toHaveCount(40)
  await page.locator('.topic-scope').getByRole('button',{name:'中国地理',exact:true}).click()
  await page.getByRole('searchbox',{name:'搜索主题和主题成员'}).fill('河流')
  await page.getByRole('button',{name:'重置主题筛选'}).click()
  await expect(page.getByRole('searchbox',{name:'搜索主题和主题成员'})).toHaveValue('')
  await expect(page.locator('.topic-scope').getByRole('button',{name:'全部主题',exact:true})).toHaveAttribute('aria-pressed','true')
  await expect(page.locator('.topic-list>button')).toHaveCount(40)
})

test('optimization: reading frees map space and a pinned explorer remains open',async({page},info)=>{
  test.skip(info.project.name!=='desktop','Desktop panel behavior')
  await select(page,'青海湖')
  await expect(page.locator('.explorer')).not.toBeVisible()
  await expect(page.getByRole('button',{name:'展开探索面板'})).toBeVisible()
  await page.screenshot({path:info.outputPath('reading-space.png')})
  await page.getByRole('button',{name:'关闭知识卡片',exact:true}).click()
  await expect(page.locator('.explorer')).toBeVisible()
  await page.getByRole('button',{name:'固定探索面板'}).click()
  await select(page,'长江')
  await expect(page.locator('.explorer')).toBeVisible()
  await expect(page.getByRole('button',{name:'固定探索面板'})).toHaveAttribute('aria-pressed','true')
  await page.getByRole('button',{name:'固定探索面板'}).click()
  await expect(page.locator('.explorer')).not.toBeVisible()
})

test('optimization: two ordinary countries retain their comparison details and real geometry',async({page},info)=>{
  await select(page,'法国');await expandCard(page)
  await page.getByRole('button',{name:'加入两地对比'}).click()
  await expect(page.getByRole('combobox',{name:'对比地点 A'})).toHaveValue('country-fra')
  await expect(page.locator('.compare-place').first()).toContainText('法国')
  await page.getByRole('button',{name:'关闭对比',exact:true}).click()
  await expect(page.locator('.knowledge-panel h2')).toHaveText('法国')
  await select(page,'瑞典');await expandCard(page)
  await page.getByRole('button',{name:'加入两地对比'}).click()
  await expect(page.locator('.compare-chooser summary')).toContainText('瑞典 / 法国')
  await page.locator('.compare-chooser summary').click()
  await expect(page.getByRole('combobox',{name:'对比地点 A'})).toHaveValue('country-swe')
  await expect(page.getByRole('combobox',{name:'对比地点 B'})).toHaveValue('country-fra')
  await expect(page.locator('.compare-overview thead')).toContainText('瑞典')
  await expect(page.locator('.compare-overview thead')).toContainText('法国')
  await expect(page.locator('.compare-overview')).toContainText('暂无附近月表')
  await page.screenshot({path:info.outputPath('ordinary-comparison.png')})
  await page.locator('.compare-place').filter({has:page.getByText('法国',{exact:true})}).click()
  await expect.poll(()=>page.evaluate(()=>{
    const source=window.__terraAtlas!.map.getSource('selection')!.serialize() as {data:{features:{properties:{id:string};geometry:{type:string}}[]}}
    return source.data.features.map(feature=>[feature.properties.id,feature.geometry.type])
  })).toEqual([['country-fra','MultiPolygon']])
  await mapSettled(page)
  await page.getByRole('button',{name:'关闭对比',exact:true}).click()
  await expect(page.locator('.knowledge-panel h2')).toHaveText('法国')
  await page.getByRole('button',{name:'关闭知识卡片',exact:true}).click()
  await clickHeaderAction(page,'打开两地对比')
  await page.getByRole('button',{name:'关闭对比',exact:true}).click()
  await expect(page.locator('.knowledge-panel')).not.toBeVisible()
})

test('optimization: both places and annual climate values are visible together',async({page},info)=>{
  await clickHeaderAction(page,'打开两地对比')
  await page.getByRole('combobox',{name:'对比地点 A'}).selectOption('climate-place-chengdu')
  await page.getByRole('combobox',{name:'对比地点 B'}).selectOption('climate-place-lhasa')
  const summary=page.getByRole('region',{name:'两地差异摘要'})
  await expect(summary.getByRole('columnheader',{name:'成都'})).toBeInViewport()
  await expect(summary.getByRole('columnheader',{name:'拉萨'})).toBeInViewport()
  await expect(summary.getByRole('row',{name:/年均温/})).toContainText('°C')
  await expect(summary.getByRole('row',{name:/年降水/})).toContainText('mm')
  if(info.project.name==='mobile')await expect(summary.getByRole('row',{name:/年降水/})).toBeInViewport()
  await expect(summary).toContainText('1991–2020')
  await expect(summary).toContainText('不代表整个国家、山脉或流域')
  await page.screenshot({path:info.outputPath('climate-summary.png')})
})

test('optimization: a real country without statistics finishes loading with an honest empty state',async({page},info)=>{
  let release!:()=>void
  const gate=new Promise<void>(resolve=>{release=resolve})
  await page.route('**/data/learning-country-languages.json',async route=>{await gate;await route.continue()})
  try{
    await select(page,'奥兰')
    const profile=page.getByTestId('country-context')
    await expect(profile.getByRole('status')).toHaveText('正在读取区域统计资料…')
    release()
    await expect(profile.getByRole('status')).toContainText('当前资料未收录这个地区的统计信息')
    await expect(profile).not.toContainText('正在读取')
    await expandCard(page)
    await profile.scrollIntoViewIfNeeded()
    await page.screenshot({path:info.outputPath('missing-country-data.png')})
  }finally{release()}
})

test('optimization: language overviews display translated and preserved source entries in order',async({page},info)=>{
  await select(page,'希腊')
  await expect(page.locator('.country-language-list')).toContainText('希腊语')
  await select(page,'挪威')
  await expect(page.locator('.country-language-list>li')).toHaveText(['挪威语（书面语）','挪威语（新挪威语）','原文条目small Sami- and Finnish-speaking minorities'])
  await select(page,'阿富汗')
  await expect(page.locator('.country-language-list>li').nth(0)).toHaveText('达里语')
  await expect(page.locator('.country-language-list>li').nth(1)).toHaveText('普什图语')
  await expect(page.locator('.country-language-list')).toContainText('Nuristani 1%')
  await expandCard(page)
  await page.locator('.country-languages').scrollIntoViewIfNeeded()
  await page.screenshot({path:info.outputPath('country-languages.png')})
})
