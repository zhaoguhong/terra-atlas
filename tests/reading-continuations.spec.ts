import {expect,test} from '@playwright/test'
import {articleReady} from './map-readiness'
import article from '../public/reading/topics/china-rivers.json' with {type:'json'}

test('a passage inside a chapter keeps its search entry, deep link and reading position',async({page})=>{
  const index=article.sections.findIndex(s=>s.continuation)
  const passage=article.sections[index]
  const chapter=article.sections.slice(0,index).filter(s=>!s.continuation).at(-1)!
  const reader=page.locator('.topic-reading-page:not([hidden])')
  const currentPassage=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('terra-atlas-v1')||'{}').readingProgress?.['china-rivers']?.sectionId)
  await page.goto('/topics/china-rivers/#'+passage.id)
  await articleReady(page,'china-rivers')
  await expect.poll(currentPassage).toBe(passage.id)
  await expect(reader.locator('.reading-chapter-select select')).toHaveValue(chapter.id)
  const block=reader.locator(`[data-reading-section="${passage.id}"]`)
  await expect(block.locator('h2')).toBeHidden()
  await expect(block.locator('p').first()).toBeInViewport()
  await page.reload()
  await articleReady(page,'china-rivers')
  await expect.poll(currentPassage).toBe(passage.id)
  await expect(block.locator('p').first()).toBeInViewport()
  await reader.getByRole('button',{name:'主题目录'}).click()
  await page.getByRole('searchbox',{name:'搜索主题和主题成员'}).fill(passage.title)
  await page.getByRole('button',{name:'直达章节 · '+passage.title,exact:true}).click()
  await expect(block.locator('p').first()).toBeInViewport()
  await expect.poll(currentPassage).toBe(passage.id)
})
