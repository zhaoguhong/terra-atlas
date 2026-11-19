import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createServer} from 'vite'

// Vite's SSR loader uses exactly the same article renderer and assets as the app.
// No second copy of the prose or separate editorial template is maintained.
const outputRoot=process.argv[2]||'dist'
const template=await readFile(resolve(outputRoot,'index.html'),'utf8')
const base=template.match(/src="([^"]*)assets\/[^"/]+\.js"/)?.[1]||'/'
const server=await createServer({base,server:{middlewareMode:true,watch:null},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'})
try {
  const {renderArticle}=await server.ssrLoadModule('/scripts/render-topics.tsx')
  const topics=JSON.parse(await readFile('src/data/topics.json','utf8'))
  const canonicalTag = /(<link rel="canonical" href=")([^"]+)/
  const origin = process.env.SITE_ORIGIN || template.match(canonicalTag)[2]
  const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
  const path=topic=>base+'topics/'+topic.id.replace(/^map-/,'')+'/'
  const absolute=value=>new URL(value,origin).href
  const withCanonical = route => template.replace(canonicalTag, (_, prefix) => prefix + escape(absolute(route)))
  const links=`<nav class="static-navigation"><a href="${base}">山河图首页</a><a href="${base}topics/">学主题</a></nav>`
  const urls=[base,base+'topics/']
  const paths=topics.filter(t=>t.reading).map(path)
  if(new Set(paths).size!==paths.length)throw new Error('Duplicate topic URL')
  async function page(route,title,description,body,article){
    const schema=article?{'@context':'https://schema.org','@type':'Article',headline:article.title,description,inLanguage:'zh-CN',dateModified:article.updatedAt,mainEntityOfPage:absolute(route),author:{'@type':'Organization',name:'山河图'}}:null
    let html=withCanonical(route).replace(/<title>.*?<\/title>/,`<title>${escape(title)} · 山河图</title>`).replace(/(<meta name="description" content=")[^"]*/,`$1${escape(description)}`)
    html=html.replace('</head>',`${schema?`<script id="topic-structured-data" type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>`:''}</head>`).replace('<div id="root"></div>',`<div id="root">${links}${body}</div>`)
    // Reuse this response for the first interactive render; no duplicate JSON request.
    if(article)html=html.replace('</body>',`<script id="initial-article" type="application/json">${JSON.stringify(article).replace(/</g,'\\u003c')}</script></body>`)
    const output=resolve(outputRoot,route.slice(base.length),'index.html')
    await mkdir(resolve(output,'..'),{recursive:true});await writeFile(output,html)
  }
  for(const topic of topics){
    if(!topic.reading)continue
    const article=JSON.parse(await readFile(`public/reading/topics/${topic.id}.json`,'utf8'))
    await page(path(topic),topic.title,topic.description,renderArticle(topic.id,article),article);urls.push(path(topic))
  }
  await page(base+'topics/','学主题','从山川的形态，到气候与生活。沿着图文认识一个主题，再到地图中寻找它的位置。',`<main class="static-directory"><h1>学主题</h1><ul>${topics.filter(t=>t.reading).map(t=>`<li><a href="${path(t)}">${escape(t.title)}</a><p>${escape(t.description)}</p></li>`).join('')}</ul></main>`)
  // Expose the directory even when JavaScript is unavailable on the map homepage.
  await writeFile(resolve(outputRoot,'index.html'),withCanonical(base).replace('<div id="root"></div>',`<div id="root">${links}</div>`))
  await writeFile(resolve(outputRoot,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url=>`<url><loc>${absolute(url)}</loc></url>`).join('')}</urlset>`)
  await writeFile(resolve(outputRoot,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${absolute(base+'sitemap.xml')}\n`)
  console.log(`Generated ${urls.length-1} topic pages with complete HTML, metadata and sitemap`)
} finally {await server.close()}
