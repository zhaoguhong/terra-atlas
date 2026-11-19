import fs from 'node:fs'
import assert from 'node:assert/strict'

export const worldGeographyInput='data/reading/world-geography-articles.json'
export const worldGeographyGuideInput='data/reading/world-geography-map-guides.json'
export const worldGeographySourceInput='data/reading/world-geography-sources.json'
const read=path=>JSON.parse(fs.readFileSync(path,'utf8'))
const unique=values=>[...new Set(values)]
const revisedOceanIds=new Set(['pacific-ocean','atlantic-ocean','indian-ocean','southern-ocean','arctic-ocean'])
const revisionSourceUrls=new Set([
  'https://iho.int/uploads/user/pubs/misc/M3-E-2024_July.pdf',
  'https://www.ncei.noaa.gov/sites/default/files/2023-01/World%20Ocean%20Volumes.pdf',
])

// knowledge.json is both a published artifact and a subsequent build input.
// Original authored articles have fixed source identities; sources added by
// this later structural revision belong to its new articles and final cards.
// Read the original card-source baseline without mutating the final cards.
export function worldGeographyBaselineSources(card){
  return revisedOceanIds.has(card.id)?card.sources.filter(source=>!revisionSourceUrls.has(source.url)):card.sources
}

// Structural revisions follow copy-editing so the preceding, reviewed article
// stays available as provenance. Explicit routes preserve its chapter addresses.
export function reviseWorldGeography(topics,articles,knowledge){
  const authored=read(worldGeographyInput),guides=read(worldGeographyGuideInput),review=read(worldGeographySourceInput)
  const previous=articles.find(article=>article.id==='world-continents')
  assert(previous,'Existing world land/region article')
  assert.deepEqual(authored.map(article=>article.id),['world-continents','world-oceans','world-regional-comparison'])
  const base=topics.find(topic=>topic.id==='world-continents')
  const continentTargets={
    'part-world-continents':'continents-overview',
    'world-continents-section-1':'continents-boundaries',
    'world-continents-section-2':'continents-overview',
    'world-continents-section-3':'continents-connections',
    'world-continents-section-4':'continents-connections',
    'world-continents-module-eurasia':'asia',
    'world-continents-module-africa':'africa',
    'world-continents-module-americas':'north-america',
    'world-continents-module-ocean-polar':'oceania',
  }
  const redirects=read('src/data/topic-redirects.json')
  const continentRoute={topicId:'world-continents',sectionId:'continents-overview',chapters:{}}
  const regionRoute={topicId:'world-regional-comparison',sectionId:'part-world-regional-comparison',chapters:{}}
  for(const section of previous.sections){
    const region=section.partId==='world-regional-comparison'
    const destination={topicId:region?'world-regional-comparison':'world-continents',sectionId:region?section.id:continentTargets[section.id]}
    assert(destination.sectionId,'Explicit world chapter destination '+section.id)
    continentRoute.chapters[section.id]=destination
    const prefix=region?'world-regional-comparison-':'world-continents-'
    const original=section.id.startsWith(prefix)?section.id.slice(prefix.length):section.id
    ;(region?regionRoute:continentRoute).chapters[original]=destination
    if(region)regionRoute.chapters[section.id]=destination
  }
  continentRoute.chapters.introduction={topicId:'world-continents',sectionId:'introduction'}
  continentRoute.chapters.questions={topicId:'world-continents',sectionId:'questions'}
  regionRoute.chapters.introduction={topicId:'world-regional-comparison',sectionId:'introduction'}
  regionRoute.chapters.questions={topicId:'world-regional-comparison',sectionId:'questions'}
  redirects['world-continents']=continentRoute
  redirects['world-regional-comparison']=regionRoute
  const ids=new Set(authored.map(article=>article.id))
  const replacement=authored.map(article=>{
    const cases=unique(article.sections.flatMap(section=>section.caseIds||[]))
    const guide=guides[article.id]
    assert(guide?.sections.length===3&&guide.cases.length===3,article.id+' authored map guide')
    for(const section of article.sections){
      assert(section.paragraphs.every(p=>p.length>=20),article.id+' authored paragraphs')
      for(const id of section.caseIds||[])assert(knowledge.some(card=>card.id===id),article.id+' known case '+id)
    }
    for(const section of guide.sections)assert(article.sections.some(s=>s.id===section.sectionId),article.id+' guide evidence')
    const keywords=unique([article.title,...article.sections.map(section=>section.title),
      ...(article.id==='world-continents'?['世界海陆与区域比较','世界七大洲','大洲','大陆','岛屿','洲界','面积']:[]),
      ...(article.id==='world-oceans'?['世界海洋','四大洋','五大洋','南大洋','IHO','南纬60°','南纬60度','海陆分布']:[]),
      ...(article.id==='world-regional-comparison'?['世界区域怎样比较','东南亚','中东','西欧','撒哈拉以南非洲','日本','印度','巴西','澳大利亚']:[])])
    const topic={...structuredClone(base),id:article.id,title:article.title,description:article.introduction,
      region:'world',shared:false,group:article.id==='world-oceans'?'water':'regions',kind:'collection',overlay:null,
      stops:cases,layers:['terrain','borders','mountains','rivers','lakes'],
      sections:guide.sections.map(section=>({title:section.title,body:section.body})),
      modules:article.sections.filter(section=>section.caseIds?.length).map(section=>({id:section.id,title:section.title,description:section.paragraphs[0],detail:section.paragraphs.slice(1).join(''),stops:section.caseIds})),
      sources:article.sources,visuals:article.sections.flatMap(section=>section.visuals||[]),
      question:article.questions[0].question,takeaway:article.questions[0].answer,
      geometryNote:article.id==='world-oceans'?'五大洋在交互地图中使用 Natural Earth 概化标注参考范围。面积比较采用正文列明的统计分区，南大洋命名约定与海水性质的自然分界另有依据。':article.id==='world-continents'?'六洲沿用Natural Earth概化标注参考范围，大洋洲保留参考点；这些表示帮助定位，不是精确洲界。大洋洲不等同于澳大利亚国家，洲界也不等同于板块边界。':'宽泛区域使用明确卡片参考点，不以国家边界或父区域代替不一致的自然、历史与文化范围。',
      reading:{coverId:article.id==='world-regional-comparison'?'diagram-region-method':'world-land-ocean-map',keywords,
        chapters:article.sections.map(section=>({id:section.id,title:section.title})),highlights:guide.sections.map(section=>section.body),
        minutes:Math.max(4,Math.ceil(article.sections.reduce((n,s)=>n+s.paragraphs.join('').length,0)/320)),
        relatedTopicIds:unique([...ids,...(article.id==='world-oceans'?['world-ocean-monsoon','world-polar-comparison','transport-trade']:['world-terrain','world-rivers'])]).filter(id=>id!==article.id)}}
    delete topic.mapGuide
    return topic
  })
  const index=topics.findIndex(topic=>topic.id==='world-continents')
  topics.splice(index,1,...replacement)
  articles.splice(articles.indexOf(previous),1,...authored)
  const transport=topics.find(topic=>topic.id==='transport-trade')
  const oceanBackground=transport?.modules.find(module=>module.id==='world-sea-connections-module-1')
  if(oceanBackground)oceanBackground.title='海洋背景：通道所连接的水域'
  if(transport)transport.reading.relatedTopicIds=unique(['world-oceans',...transport.reading.relatedTopicIds])
  // Extra card links referring to a former subtopic must bypass consolidation's
  // original owner, because the regional article now owns its original ID again.
  const publishedTopicId=(originalId,consolidatedId=originalId)=>originalId==='world-regional-comparison'?'world-regional-comparison':consolidatedId
  for(const topic of topics)topic.reading.relatedTopicIds=unique(topic.reading.relatedTopicIds).filter(id=>id!==topic.id&&topics.some(t=>t.id===id))
  for(const record of review.areaInputs.oceans.values){
    const card=knowledge.find(card=>card.id===record.id)
    const value=(record.areaKm2/10000).toLocaleString('zh-CN',{maximumFractionDigits:1})
    const text=`约${value}万平方千米；NOAA NCEI ETOPO1表口径，五洋分区中南大洋北界60°S${record.id==='pacific-ocean'?'，合并原表另列南海':''}`
    const fact=card.facts.find(fact=>fact.label==='面积概述')
    if(fact)fact.value=text
    else card.facts.unshift({label:'面积概述',value:text})
    if(record.id==='arctic-ocean'){
      const convention=card.facts.find(fact=>fact.label==='面积口径')
      if(convention)convention.value='与本站五大洋面积图同用NOAA NCEI ETOPO1表；海冰面积另按季节变化。'
    }
    for(const ref of review.sources.filter(source=>source.url.includes('World%20Ocean%20Volumes')||source.url.includes('M3-E-2024'))){
      const {title,url}=ref
      if(!card.sources.some(source=>source.url===url))card.sources.push({title,url})
    }
    if(record.id==='southern-ocean'){
      card.location='环绕南极洲的海域；IHO在2023年决议中以南纬60°作为北界，保留国家范围意见与其他用途的划分。'
      const note={title:'五大洋的现行约定与保留意见',body:'IHO已于2023年承认南大洋，并以南纬60°为北界；阿根廷等仍保留意见，各国机构也可采用自己的技术界限。该纬线不是海洋锋面或海冰的自然边缘。'}
      const section=card.sections.findIndex(section=>section.title===note.title)
      if(section===-1)card.sections.push(note);else card.sections[section]=note
    }
  }
  fs.writeFileSync('src/data/topic-redirects.json',JSON.stringify(redirects,null,2)+'\n')
  return {authored,guides,review,publishedTopicId}
}
