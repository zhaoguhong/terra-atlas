import {expect,test,type Page} from '@playwright/test'
import {studyReady as baseReady} from './map-readiness'
import {openThemeLibrary} from './theme-controls'
import topics from '../src/data/topics.json' with {type:'json'}

test.use({reducedMotion:'reduce'})

const library=(page:Page)=>page.locator('.study-library .topic-library')
const layouts=(page:Page)=>library(page).getByRole('group',{name:'主题展示方式'})

test('study catalogue: layouts preserve filters, reload and reading/map destinations',async({page},info)=>{
  const errors:string[]=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto('/');await baseReady(page);await openThemeLibrary(page)
  await expect(library(page).locator('.topic-category-filters')).toHaveAttribute('open','')
  await expect(page.getByText('从基础主题读起',{exact:true})).toHaveCount(0)
  await expect(library(page)).toHaveAttribute('data-topic-layout','cards')
  await expect(library(page).locator('.topic-library-card')).toHaveCount(topics.length)
  expect(await library(page).locator('.topic-cover-preview').count()).toBeGreaterThan(0)

  for(const [label,id] of [['紧凑列表','list'],['分类目录','directory'],['图文卡片','cards']] as const){
    await layouts(page).getByRole('button',{name:label,exact:true}).click()
    await expect(library(page)).toHaveAttribute('data-topic-layout',id)
    await expect(layouts(page).getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-pressed','true')
    await expect(library(page).locator('.topic-library-card')).toHaveCount(topics.length)
    if(id!=='cards')await expect(library(page).locator('.topic-cover-preview')).toHaveCount(0)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await library(page).locator('.topic-group').first().scrollIntoViewIfNeeded()
    await page.screenshot({path:info.outputPath('study-'+id+'.png')})
  }

  await library(page).getByRole('button',{name:'中国地理',exact:true}).click()
  await library(page).getByRole('button',{name:'地形地貌',exact:true}).click()
  await library(page).getByRole('searchbox',{name:'搜索主题和主题成员'}).fill('岩溶')
  const before=await library(page).locator('.topic-card-open strong').allTextContents()
  expect(before).toContain('常见地貌与中国典型景观')
  for(const label of ['紧凑列表','分类目录']){
    await layouts(page).getByRole('button',{name:label,exact:true}).click()
    expect(await library(page).locator('.topic-card-open strong').allTextContents()).toEqual(before)
    await expect(library(page).getByRole('searchbox')).toHaveValue('岩溶')
    await expect(library(page).getByRole('button',{name:'地形地貌',exact:true})).toHaveAttribute('aria-pressed','true')
  }
  await page.reload();await baseReady(page)
  await expect(library(page)).toHaveAttribute('data-topic-layout','directory')
  await expect(library(page).getByRole('searchbox')).toHaveValue('岩溶')
  await expect(library(page).getByRole('button',{name:'中国地理',exact:true})).toHaveAttribute('aria-pressed','true')
  await library(page).getByRole('button',{name:'打开专题：常见地貌与中国典型景观',exact:true}).click()
  await expect(page.locator('.topic-reading-page:not([hidden]) h1')).toHaveText('常见地貌与中国典型景观')
  await page.goBack()
  await expect(library(page)).toHaveAttribute('data-topic-layout','directory')
  await library(page).getByRole('button',{name:'在地图上看：常见地貌与中国典型景观',exact:true}).click()
  await expect(page.locator('.topic-reader')).toHaveAttribute('data-topic-id','landform-landscapes')
  expect(errors).toEqual([])
})

test('study catalogue: layout preference synchronizes tabs without replacing their filters',async({page,context})=>{
  await page.goto('/');await baseReady(page);await openThemeLibrary(page)
  await library(page).getByRole('searchbox').fill('气候')
  const other=await context.newPage()
  await other.goto('/');await baseReady(other);await openThemeLibrary(other)
  await library(other).getByRole('searchbox').fill('河流')
  await layouts(other).getByRole('button',{name:'紧凑列表',exact:true}).click()
  await expect(library(page)).toHaveAttribute('data-topic-layout','list')
  await expect(library(page).getByRole('searchbox')).toHaveValue('气候')
  await expect(library(other).getByRole('searchbox')).toHaveValue('河流')
  await other.close()
})

test('study catalogue: layout controls work when browser storage is unavailable',async({page})=>{
  const errors:string[]=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.addInitScript(()=>{
    Storage.prototype.getItem=()=>{throw new DOMException('Storage unavailable','SecurityError')}
    Storage.prototype.setItem=()=>{throw new DOMException('Storage unavailable','SecurityError')}
  })
  await page.goto('/');await baseReady(page);await openThemeLibrary(page)
  await layouts(page).getByRole('button',{name:'分类目录',exact:true}).click()
  await expect(library(page)).toHaveAttribute('data-topic-layout','directory')
  await expect(library(page).locator('.topic-library-card')).toHaveCount(topics.length)
  expect(errors).toEqual([])
})
