import { readdirSync, statSync } from 'node:fs'
import { resolve, relative, join } from 'node:path'

// 100 MB means 100,000,000 bytes. Dependencies, build outputs and private
// research caches are not part of the distributable source package.
const limit = 100_000_000
const root = resolve(import.meta.dirname, '..')
const excluded = new Set(['node_modules', '.git', '.local', 'dist', 'test-results', 'playwright-report'])
function size(directory, sourcePackage = false) {
  let bytes = 0
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (sourcePackage && (excluded.has(entry.name) || relative(root, path) === 'data/raw' || entry.name.endsWith('.tsbuildinfo') || entry.name === '.DS_Store')) continue
    if (entry.isSymbolicLink()) throw new Error(`Package size cannot verify a symbolic link: ${relative(root, path)}`)
    if (entry.isDirectory()) bytes += size(path, sourcePackage)
    else if (entry.isFile()) bytes += statSync(path).size
  }
  return bytes
}
function check(label, bytes) {
  console.log(`${label}: ${(bytes / 1_000_000).toFixed(2)} MB (${(bytes / 1_048_576).toFixed(2)} MiB), limit 100 MB`)
  if (bytes > limit) throw new Error(`${label} exceeds 100 MB. Keep large map and elevation datasets on their online tile services.`)
}
check('Source and bundled data', size(root, true))
if (process.argv.includes('--dist')) check('Static build', size(join(root, 'dist')))
