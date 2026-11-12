import fs from 'node:fs'
import assert from 'node:assert/strict'

export const landformInput='data/reading/landform-articles.json'
export const landformGuideInput='data/reading/landform-map-guides.json'
export const revisedLandformIds=['landform-processes','landform-karst','landform-rivers','landform-wind','landform-glaciers','landform-coasts']
const unique=values=>[...new Set(values)]
const landscape='landform-landscapes'
const defaults={'landform-karst':'karst','landform-rivers':'rivers','landform-wind':'wind','landform-glaciers':'glaciers','landform-coasts':'coasts'}

// Keep the previous editorial inputs as provenance. Only these six published
// articles are replaced; every old address has an explicit destination.
export function reviseLandformTopics(topics,articles){
  const authored=JSON.parse(fs.readFileSync(landformInput,'utf8'))
  const redirects={}
  function target(topicId,sectionId){
    if(topicId!=='landform-processes')return {topicId:landscape,sectionId:sectionId.includes('loess')?'loess':defaults[topicId]}
    if(sectionId.includes('danxia'))return {topicId:landscape,sectionId:'redbeds-sandstone'}
    if(sectionId.startsWith('earth-rocks')||sectionId==='part-earth-rocks')return {topicId,sectionId:sectionId.includes('section-4')?'weathering':'rocks'}
    if(sectionId.includes('himalayas')||sectionId.endsWith('section-2'))return {topicId,sectionId:'uplift'}
    if(sectionId.includes('yangtze')||sectionId.includes('loess')||sectionId.endsWith('section-3'))return {topicId,sectionId:'transport'}
    return {topicId,sectionId:'history'}
  }
  for(const id of revisedLandformIds){
    const old=articles.find(article=>article.id===id)
    redirects[id]={topicId:id==='landform-processes'?id:landscape,sectionId:defaults[id]||'rocks',chapters:{}}
    for(const section of old.sections){
      const next=target(id,section.id)
      redirects[id].chapters[section.id]=next
      if(section.partId){
        const part=section.partId
        redirects[part]??={...next,chapters:{}}
        redirects[part].chapters[section.id.replace(part+'-','')]=next
      }
    }
    redirects[id].chapters.introduction={topicId:redirects[id].topicId,sectionId:id==='landform-processes'?'introduction':redirects[id].sectionId}
    redirects[id].chapters.questions={topicId:redirects[id].topicId,sectionId:'questions'}
  }
  // The two previous aggregate IDs were not individual inputs in the first consolidation.
  for(const id of ['landform-river-erosion','landform-river-deposition','landform-yardang','landform-dunes','landform-loess','landform-danxia','earth-rocks'])assert(redirects[id],id+' legacy address')
  const mapTopic=id=>redirects[id]?.topicId||id
  const base=topics.find(topic=>topic.id==='landform-processes')
  const replacement=authored.map(article=>{
    const cases=unique(article.sections.flatMap(section=>section.caseIds||[]))
    const topic={...structuredClone(base),id:article.id,title:article.title,description:article.introduction,shared:true,region:'world',group:'landforms',stops:cases,
      layers:['terrain','borders','mountains','rivers','lakes'],sections:article.sections.slice(0,4).map(s=>({title:s.title,body:s.paragraphs[0]})),
      modules:article.sections.filter(s=>s.caseIds?.length).map(s=>({id:s.id,title:s.title,description:s.paragraphs[0],detail:s.paragraphs[1],stops:s.caseIds})),
      sources:article.sources,visuals:[],question:article.questions[0].question,takeaway:article.questions[0].answer,
      geometryNote:'山系与自然区为概化标注参考范围，河流使用真实河道；地貌案例点仅用于定位，不表示岩性、冰川或具体地貌的完整分布。',
      reading:{coverId:article.id===landscape?'karst-landscape-illustration':'diagram-rocks',keywords:unique([article.title,...article.sections.map(s=>s.title),'地貌','岩石','丹霞','喀斯特','流水','风沙','黄土','冰川','海岸','张家界','嶂石岩','花岗岩','黄山','五大连池']),
        chapters:article.sections.map(s=>({id:s.id,title:s.title})),highlights:article.sections.slice(0,3).map(s=>s.paragraphs[0]),minutes:Math.ceil(article.sections.reduce((n,s)=>n+s.paragraphs.join('').length,0)/320),relatedTopicIds:[article.id===landscape?'landform-processes':landscape,'china-terrain','world-terrain','world-tectonics']}}
    assert.equal(new Set(article.sections.flatMap(s=>s.mediaIds||[])).size,article.sections.flatMap(s=>s.mediaIds||[]).length)
    return topic
  })
  const index=topics.findIndex(t=>t.id==='landform-processes')
  topics.splice(index,0,...replacement)
  for(let i=topics.length-1;i>=0;i--)if(revisedLandformIds.includes(topics[i].id)&&!replacement.includes(topics[i]))topics.splice(i,1)
  for(let i=articles.length-1;i>=0;i--)if(revisedLandformIds.includes(articles[i].id))articles.splice(i,1)
  articles.push(...authored)
  for(const topic of topics)topic.reading.relatedTopicIds=unique(topic.reading.relatedTopicIds.map(mapTopic)).filter(id=>id!==topic.id)
  fs.writeFileSync('src/data/topic-redirects.json',JSON.stringify(redirects,null,2)+'\n')
  return {mapTopic,redirects,authored}
}
