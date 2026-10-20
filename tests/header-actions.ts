import type {Page} from '@playwright/test'

type HeaderAction='打开收藏'|'打开两地对比'|'资料与关于'|'分享当前地图'

export async function clickHeaderAction(page:Page,name:HeaderAction){
  const more=page.getByRole('button',{name:'更多操作',exact:true})
  if(await more.isVisible()&&await more.getAttribute('aria-expanded')!=='true')await more.click()
  await page.getByRole('button',{name,exact:true}).click()
}
