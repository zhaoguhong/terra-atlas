import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'

// Ship the complete runtime dependency license notices with each static build.
await copyFile(new URL('../THIRD_PARTY_NOTICES.md', import.meta.url), new URL('../public/third-party-notices.txt', import.meta.url))
await mkdir(new URL('../public/licenses/', import.meta.url), { recursive: true })
for (const [source, target] of [
  ['LICENSE', 'LICENSE'],
  ['LICENSES/CC-BY-4.0.txt', 'CC-BY-4.0.txt'],
]) {
  await copyFile(new URL('../' + source, import.meta.url), new URL('../public/licenses/' + target, import.meta.url))
}
const contentLicense = await readFile(new URL('../LICENSE-CONTENT.md', import.meta.url), 'utf8')
const images = JSON.parse(await readFile(new URL('../src/data/reading-media.json', import.meta.url), 'utf8')).filter(image => image.kind === 'photo')
await writeFile(new URL('../public/licenses/reading-images.txt', import.meta.url), '山河图 · 专题照片署名\n\n照片保留各自许可，不统一采用项目原创内容许可。下载 Wikimedia Commons 提供的缩略图或原文件，未修改画面。\n\n' + images.map(image => `${image.title}\n文件：${image.path}\n作者：${image.author}\n原作：${image.sourceUrl}\n许可：${image.license} — ${image.licenseUrl}\n`).join('\n'))
await writeFile(new URL('../public/licenses/LICENSE-CONTENT.md', import.meta.url), contentLicense
  .replaceAll('(LICENSES/CC-BY-4.0.txt)', '(CC-BY-4.0.txt)')
  .replaceAll('(THIRD_PARTY_NOTICES.md)', '(../third-party-notices.txt)'))
