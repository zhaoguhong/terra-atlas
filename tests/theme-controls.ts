import {expect,type Page} from '@playwright/test'

export function readerExpandKey(page:Page){const viewport=page.viewportSize()!;return viewport.width>viewport.height?'ArrowLeft':'ArrowUp'}
export function readerCollapseKey(page:Page){const viewport=page.viewportSize()!;return viewport.width>viewport.height?'ArrowRight':'ArrowDown'}

export async function openThemeLibrary(page:Page){
  const settings=page.getByRole('button',{name:'关闭图层面板',exact:true})
  if(await settings.isVisible())await settings.click()
  const open=page.getByRole('button',{name:'打开主题探索',exact:true})
  if(!await open.isVisible()&&!await page.locator('.explorer').isVisible()){
    const handle=page.getByRole('button',{name:'调整阅读面板大小',exact:true})
    if(await handle.isVisible()){await handle.press('Home');await handle.press(readerExpandKey(page))}
    for(const name of ['关闭知识卡片','关闭对比','关闭点查']){
      const close=page.getByRole('button',{name,exact:true})
      if(await close.isVisible())await close.click()
    }
  }
  if(await open.isVisible())await open.click()
  else if(!await page.locator('.explorer').isVisible()){
    const reopen=page.getByRole('button',{name:'展开探索面板',exact:true})
    if(await reopen.isVisible())await reopen.click()
  }
  const handle=page.getByRole('button',{name:'调整阅读面板大小',exact:true})
  if(await handle.isVisible()&&await page.locator('.explorer.topic-active.sheet-peek').count())await handle.press(readerExpandKey(page))
  const back=page.getByRole('button',{name:'主题库',exact:true})
  if(await back.isVisible())await back.click()
  else await page.locator('.panel-tabs').getByRole('button',{name:'主题',exact:true}).click()
  await expect(page.locator('.topic-library')).toBeVisible()
}

export async function chooseTheme(page:Page,title:string){
  await openThemeLibrary(page)
  await page.locator('.topic-list>button').filter({has:page.getByText(title,{exact:true})}).click()
  await expect(page.locator('.topic-reader h1')).toHaveText(title)
}
