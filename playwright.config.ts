import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests', testIgnore: '**/smoke.spec.ts', timeout: process.env.SITE_URL?.startsWith('https:')?90000:45000, expect: {timeout:10000}, fullyParallel:false, workers:1,
  outputDir: process.env.EVIDENCE_DIR || '.local/verification/browser',
  reporter:[['list'],['json',{outputFile: process.env.RESULT_FILE || '.local/verification/results.json'}]],
  use:{baseURL:process.env.SITE_URL || 'http://127.0.0.1:4176',channel:process.env.PLAYWRIGHT_CHANNEL==='chromium'?undefined:process.env.PLAYWRIGHT_CHANNEL||'chrome',trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[{name:'desktop',use:{viewport:{width:1440,height:950}}},{name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}},{name:'mobile-landscape',use:{viewport:{width:844,height:390},isMobile:true,hasTouch:true}}],
})
