import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
function run(script, args = []) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../' + script, import.meta.url)), ...args], {
    cwd: root,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run('scripts/prepare-notices.mjs')
run('scripts/check-size.mjs')
run('node_modules/typescript/bin/tsc', ['-b'])
// Forward npm build flags to Vite, rather than the trailing size check.
run('node_modules/vite/bin/vite.js', ['build', ...process.argv.slice(2)])
run('scripts/check-size.mjs', ['--dist'])
