import {expect,type Page} from '@playwright/test'
import {clickHeaderAction} from './header-actions'

export async function openDiscoveries(page:Page){
  const button=page.locator('.panel-tabs').getByRole('button',{name:'随便看看',exact:true})
  if(!await button.isVisible())await clickHeaderAction(page,'打开收藏')
  await button.click()
}

export function readerExpandKey(page:Page){const viewport=page.viewportSize()!;return viewport.width>viewport.height?'ArrowLeft':'ArrowUp'}
export function readerCollapseKey(page:Page){const viewport=page.viewportSize()!;return viewport.width>viewport.height?'ArrowRight':'ArrowDown'}

export async function openThemeLibrary(page:Page,expandFilters=false){
  await page.getByRole('navigation',{name:'浏览方式'}).getByRole('button',{name:'学主题',exact:true}).click()
  await expect(page.locator('.study-library .topic-library')).toBeVisible()
  const filters=page.locator('.study-library .topic-category-filters')
  if(expandFilters&&!await filters.evaluate(element=>(element as HTMLDetailsElement).open))await filters.locator('summary').click()
}

export async function chooseTheme(page:Page,title:string,expandMembers=true){
  await openThemeLibrary(page)
  await page.getByRole('button',{name:'在地图上看：'+title,exact:true}).click()
  await expect(page.locator('.topic-reader h1')).toHaveText(title)
  if(expandMembers)await expandThemeMembers(page)
}

export async function expandThemeMembers(page:Page){
  const details=page.locator('.topic-preview-members').filter({has:page.locator('summary').filter({hasText:'地点与学习模块'})})
  if(await details.count()&&!await details.evaluate(element=>(element as HTMLDetailsElement).open))await details.locator('summary').first().click()
}
