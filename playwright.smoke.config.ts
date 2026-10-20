import { defineConfig } from '@playwright/test'

const basePath = process.env.SMOKE_BASE_PATH || '/'
if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(basePath)) {
  throw new Error('SMOKE_BASE_PATH must be an absolute directory path, for example /terra-atlas/')
}
const baseURL = `http://127.0.0.1:4187${basePath}`

export default defineConfig({
  testDir: './tests',
  testMatch: 'smoke.spec.ts',
  timeout: 90000,
  expect: { timeout: 45000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  outputDir: '.local/verification/open-source-smoke/browser',
  reporter: [['list'], ['json', { outputFile: '.local/verification/open-source-smoke/results.json' }]],
  use: { baseURL, browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL === 'chromium' ? undefined : process.env.PLAYWRIGHT_CHANNEL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 950 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: `npm run preview -- --port 4187 --strictPort --base=${basePath}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30000,
  },
})
