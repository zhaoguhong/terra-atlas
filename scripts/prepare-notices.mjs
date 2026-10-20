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
await writeFile(new URL('../public/licenses/LICENSE-CONTENT.md', import.meta.url), contentLicense
  .replaceAll('(LICENSES/CC-BY-4.0.txt)', '(CC-BY-4.0.txt)')
  .replaceAll('(THIRD_PARTY_NOTICES.md)', '(../third-party-notices.txt)'))
