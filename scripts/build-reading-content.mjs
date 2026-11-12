import fs from 'node:fs'
import {createHash} from 'node:crypto'
import landforms from '../data/reading/existing-landforms.mjs'
import waterClimate from '../data/reading/water-climate.mjs'
import peopleResources from '../data/reading/people-resources.mjs'
import earthRegions from '../data/reading/earth-regions.mjs'
import newLandforms from '../data/reading/landform-lessons.mjs'
import foundations from '../data/reading/foundations.mjs'
import newPlaces from '../data/reading/new-places.mjs'
import climateLessons from '../data/reading/climate-lessons.mjs'
import atmosphere from '../data/reading/atmosphere-lessons.mjs'
import mapGuides from '../data/reading/map-guides.mjs'
import {consolidateTopics} from './consolidate-topics.mjs'
import {readingDiagram} from './reading-diagrams.mjs'
import {languageReadingFigures} from './language-reading-figures.mjs'
import {editorialReadingMaps} from './editorial-reading-maps.mjs'
import {languageSources} from '../data/reading/language-lesson.mjs'
import {applyReadingEdits} from './apply-reading-edits.mjs'
import {reviseLandformTopics,landformInput,landformGuideInput} from './revise-landform-topics.mjs'
import {reviseWorldGeography,worldGeographyBaselineSources,worldGeographyInput,worldGeographyGuideInput,worldGeographySourceInput} from './revise-world-geography.mjs'

const read=path=>JSON.parse(fs.readFileSync(path,'utf8'))
const write=(path,data)=>fs.writeFileSync(path,JSON.stringify(data,null,2)+'\n')
const sha=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex')
const date='2026-11-06',version='topics-2026-11-06-v3'
const lessons={...landforms,...waterClimate,...peopleResources,...earthRegions,...Object.fromEntries([...newLandforms,...foundations,...atmosphere].map(item=>[item.id,item]))}
// A photo of Namibia or Rotterdam must not stand in for a Chinese case.
delete lessons['china-dry-water'].photo
delete lessons['china-transport'].photo
lessons['landform-danxia'].photo='danxia-photo'
lessons['landform-volcanoes'].photo='volcano-photo'
lessons['landform-dunes'].photo='dunes-photo'
const oldModuleIntros=read('data/reading/module-introductions.json')
const knowledge=read('src/data/knowledge.json'),bindings=read('src/data/feature-bindings.json')
for(const place of newPlaces){
  const {source,sections,...fields}=place
  const card={...fields,category:'terrain',region:'china',mapRole:'place',mapZoom:8,
    sections:sections.map(([title,body])=>({title,body})),
    connections:sections.map(([,body])=>body.split('。')[0]+'。'),
    facts:[{label:'观察主题',value:source.includes('1248')?'喀斯特地貌':'丹霞地貌'},{label:'定位依据',value:'UNESCO 世界遗产组成地参考坐标'}],
    tags:source.includes('1248')?['岩溶','碳酸盐岩','地下水']:['红层','丹霞','流水侵蚀'],
    geometryNote:'仅显示有出处的地点坐标，不以景区点推测地貌、洞穴或世界遗产地范围。',
    sources:[{title:source.includes('1248')?'UNESCO · South China Karst':'UNESCO · China Danxia',url:source},{title:'UNESCO · 组成地地图与参考坐标',url:source+'maps/'}]}
  const index=knowledge.findIndex(k=>k.id===place.id)
  if(index===-1)knowledge.push(card);else knowledge[index]=card
  bindings[place.id]=[]
}
const byId=new Map(knowledge.map(k=>[k.id,k]))
let topics=read('data/reading/topic-inputs.json')
const sourceIndex=new Map([...knowledge.flatMap(worldGeographyBaselineSources),...topics.flatMap(topic=>topic.sources)].map(s=>[s.url,s]))
const atmosphereSourceReview=read('data/reading/atmosphere-sources.json')
for(const {title,url} of atmosphereSourceReview.sources)sourceIndex.set(url,{title,url})
for(const {title,url} of languageSources)sourceIndex.set(url,{title,url})
function source(url){
  if(sourceIndex.has(url))return sourceIndex.get(url)
  const parsed=new URL(url),name=parsed.pathname.split('/').filter(Boolean).at(-1)?.replace(/\.html?$/,'').replaceAll('-',' ')||'地理资料'
  return {title:`${parsed.hostname.replace('www.','')} · ${name}`,url}
}
const uniqueSources=refs=>[...new Map(refs.map(s=>[s.url,s])).values()]
for(const lesson of [...newLandforms,...foundations,...atmosphere]){
  const value={id:lesson.id,title:lesson.title,region:'world',shared:true,group:lesson.group,kind:'connections',overlay:null,
    description:lesson.lead,question:lesson.question[0],takeaway:lesson.question[1],stops:lesson.stops,
    layers:['terrain','borders',...(['water'].includes(lesson.group)||['river-erosion','river-deposition','karst'].includes(lesson.diagram)?['rivers']:[])],
    sections:lesson.sections.slice(0,2).map(([title,body])=>({title,body:body.split('\n\n')[0]})),
    modules:lesson.stops.map(id=>{const card=byId.get(id);if(!card)throw new Error('Missing case '+id);return {id:'case-'+id,title:card.name,description:card.summary,detail:card.formation+' '+card.sections[0].body,stops:[id]}}),
    sources:uniqueSources([...lesson.sources.map(source),...lesson.stops.flatMap(id=>worldGeographyBaselineSources(byId.get(id)))]),
    geometryNote:'本专题用已有地理对象和有来源的案例点辅助定位；过程示意图不表示真实分布范围，未推测地貌边界。',visuals:[]}
  const index=topics.findIndex(t=>t.id===lesson.id)
  if(index===-1)topics.push(value);else topics[index]=value
}
const photos=read('data/reading/photos.json')
const captions={
  'guilin-photo':['桂林漓江岩溶景观','广西阳朔漓江沿岸的山峰与河谷。观察峰体之间的连接和低地空间，再与喀斯特剖面图对照。',['guilin-karst']],
  'danxia-photo':['丹霞山红层崖壁','广东丹霞山的红层峰体与陡崖。照片帮助看形态，岩性与成因还需结合地质资料。',['danxiashan']],
  'glacier-photo':['优胜美地谷地','美国优胜美地，从 Glacier Point 观察谷地。宽阔谷底与陡峭谷壁是讨论过去冰川作用的线索。',[]],
  'coast-photo':['澳大利亚十二使徒岩岸','澳大利亚坎贝尔港国家公园的海蚀柱与崖壁，摄于 2007 年。岩柱形态会随侵蚀继续变化。',[]],
  'dunes-photo':['纳米布沙丘','纳米比亚纳米布—诺克卢福公园的沙丘，摄于 2011 年。明暗坡面显示沙脊与坡度差别。',['namib-sand-sea']],
  'river-photo':['长江三峡河谷','长江三峡的水面与两侧山坡。照片显示局部河谷，不能据此推断整条长江的断面。',['yangtze']],
  'volcano-photo':['河口湖望富士山','日本河口湖附近所见富士山。对称外形提供火山景观的观察入口，内部结构需要地质资料解释。',['fujisan']],
  'terraces-photo':['广西龙脊梯田','广西龙胜龙脊梯田。台阶状农田使坡地利用和水的管理变得可见，具体灌排仍需现场资料。',[]],
  'port-photo':['鹿特丹港航拍','荷兰鹿特丹港，摄于 2017 年。港池、码头与陆上设施说明港口如何衔接海陆运输。',['rotterdam-port']],
}
const media=photos.map(photo=>{const [title,caption,placeIds]=captions[photo.id];return {id:photo.id,path:photo.path,kind:'photo',title,alt:title+'。'+caption,caption,author:photo.author,license:photo.license,licenseUrl:photo.licenseUrl,sourceUrl:photo.page,width:photo.width,height:photo.height,placeIds}})
// Generated illustrations are reviewed, versioned assets, never map geometry.
// Ordinary reading builds reuse them without calling a generation service.
const illustrations=read('data/reading/ai-illustrations.json')
media.push(...illustrations.figures.map(({generation,...figure})=>figure))
const diagramIds=[...new Set([...Object.values(lessons).map(l=>l.diagram),'upwelling'])]
for(const id of diagramIds){
  const {svg,...info}=readingDiagram(id),path=`media/reading/${id}.svg`
  fs.writeFileSync('public/'+path,svg)
  const refs=id==='upwelling'?[{title:'NOAA · What is upwelling?',url:'https://oceanservice.noaa.gov/facts/upwelling.html'}]:uniqueSources(topics.filter(t=>lessons[t.id].diagram===id).flatMap(t=>t.sources))
  media.push({id:'diagram-'+id,path,kind:'diagram',...info,author:'山河图',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',sourceUrl:refs[0].url,sourceUrls:refs.map(s=>s.url)})
}
for(const {svg,...info} of languageReadingFigures()){
  fs.writeFileSync('public/'+info.path,svg)
  media.push(info)
}
const editorialMaps=editorialReadingMaps()
for(const {svg,...info} of editorialMaps){
  fs.writeFileSync('public/'+info.path,svg)
  media.push(info)
}
const mediaById=new Map(media.map(m=>[m.id,m]))
const relatedOverride={
 'landform-karst':['landform-danxia','water-cycle','china-plateaus'],
 'landform-danxia':['landform-karst','earth-rocks','landform-processes'],
 'landform-processes':['earth-rocks','landform-river-erosion','landform-karst'],
 'earth-rocks':['landform-processes','landform-karst','landform-volcanoes'],
 'earth-map-reading':['earth-image-reading','china-relief-steps','earth-seasons'],
 'map-climate':['climate-causes','world-latitude-height','world-ocean-monsoon'],
 'soil-land':['landform-loess','china-agriculture','water-cycle'],
 'people-migration':['map-population','china-city-environment','world-transport-trade'],
}
let articles=[]
for(const topic of topics){
  const lesson=lessons[topic.id]
  if(!lesson)throw new Error('Missing authored lesson '+topic.id)
  const core=lesson.articleSections?structuredClone(lesson.articleSections):lesson.sections.map(([title,body],i)=>({id:'section-'+(i+1),title,paragraphs:body.split('\n\n'),...(i===1?{mediaIds:['diagram-'+lesson.diagram]}:{})}))
  if(lesson.introduction)topic.description=lesson.introduction
  for(const module of topic.modules){
    const original=oldModuleIntros[topic.id]?.[module.id]
    const cases=module.stops.map(id=>byId.get(id))
    if(original){
      // Keep the module's specific comparison and add evidence from its own named case.
      const first=cases[0]
      const addition=first.sections[0].body
      module.detail=original+' '+first.name+'：'+addition
    }
    if(!lesson.articleSections)core.push({id:'module-'+module.id,title:module.title,paragraphs:[original||module.description,...cases.map(card=>card.name+'：'+card.formation+' '+card.sections[0].body)],caseIds:module.stops})
  }
  const coverId=lesson.articleSections?.flatMap(s=>s.mediaIds||[]).find(id=>mediaById.get(id)?.kind==='map')||lesson.photo||'diagram-'+lesson.diagram
  if(!mediaById.has(coverId))throw new Error('Missing cover '+coverId)
  const related=relatedOverride[topic.id]||topics.filter(t=>t.id!==topic.id).map(t=>({id:t.id,score:t.stops.filter(id=>topic.stops.includes(id)).length*3+(t.group===topic.group?2:0)})).sort((a,b)=>b.score-a.score).filter(t=>t.score>0).slice(0,3).map(t=>t.id)
  const article={id:topic.id,title:topic.title,introduction:topic.description,updatedAt:lesson.updatedAt||date,sections:core,
    ...(lesson.presentation?{presentation:lesson.presentation}:{}),
    questions:[{question:lesson.question[0],answer:lesson.question[1]}],
    sources:uniqueSources([...topic.sources,...(lesson.sources||[]).map(source),...topic.stops.flatMap(id=>worldGeographyBaselineSources(byId.get(id)))])}
  const size=core.reduce((n,s)=>n+s.paragraphs.join('').length,0)
  topic.reading={coverId,keywords:[...new Set([...(lesson.keywords||[]),...topic.stops.flatMap(id=>byId.get(id).tags||[])])],highlights:[lesson.sections[0][1].split('。')[0]+'。',lesson.sections[1][1].split('。')[0]+'。',lesson.question[1]],minutes:Math.max(4,Math.round(size/320)),relatedTopicIds:related}
  articles.push(article)
}
const consolidated=consolidateTopics(topics,articles)
topics=consolidated.topics;articles=consolidated.articles
const editorialInputs=applyReadingEdits(topics,articles)
const landformRevision=reviseLandformTopics(topics,articles)
const worldGeographyRevision=reviseWorldGeography(topics,articles,knowledge)
const landformGuides=read(landformGuideInput)
// The catalogue uses a figure actually placed in the article; it is not repeated
// as a decorative hero in continuous reading.
for(const topic of topics){
  const placed=articles.find(article=>article.id===topic.id).sections.flatMap(section=>section.mediaIds||[])
  const preferred=topic.id==='china-terrain'?'china-plateaus-illustration':placed.find(id=>['illustration','map'].includes(mediaById.get(id)?.kind))
  if(preferred)topic.reading.coverId=preferred
}
const mapEssays=read('data/reading/map-essays.json')
for(const topic of topics){
  const guide=worldGeographyRevision.guides[topic.id]||landformGuides[topic.id]||mapGuides[topic.id],article=articles.find(item=>item.id===topic.id)
  if(!guide)throw new Error('Missing map guide '+topic.id)
  const essay=worldGeographyRevision.guides[topic.id]||landformGuides[topic.id]||mapEssays[topic.id]
  for(const section of essay.sections)if(!article.sections.some(s=>s.id===section.sectionId))throw new Error(topic.id+' missing short-essay evidence '+section.sectionId)
  topic.mapGuide={summary:essay.summary,sections:essay.sections,cases:guide.cases}
  for(const item of guide.cases)if(!topic.stops.includes(item.id)||!byId.has(item.id))throw new Error(topic.id+' invalid guide case '+item.id)
}
for(const file of fs.readdirSync('public/reading/topics'))if(file.endsWith('.json')&&!topics.some(t=>file===t.id+'.json'))fs.unlinkSync('public/reading/topics/'+file)
for(const article of articles)write(`public/reading/topics/${article.id}.json`,article)
// Every curated place gets a route into full reading, including the seven original orphan cards.
const extraLinks={rhine:['world-river-contrast','world-transport-trade'],danube:['world-river-contrast','world-regional-comparison'],'china-country':['china-regions','china-relief-steps'],russia:['world-continents','world-polar-comparison'],indonesia:['world-regional-comparison','world-tectonics'],germany:['world-energy-industry','world-regional-comparison'],'taiwan-region':['china-provinces','landform-structures']}
const categoryDiagrams={mountains:'structures',rivers:'river-system',lakes:'lake-balance',climate:'climate-reading',population:'population',religion:'culture-statistics',language:'language'}
for(const card of knowledge){
  card.readingTopicIds=[...new Set([...(extraLinks[card.id]||[]).map(id=>worldGeographyRevision.publishedTopicId(id,landformRevision.mapTopic(consolidated.topicIdFor(id)))),...topics.filter(t=>t.stops.includes(card.id)).map(t=>t.id)])]
  if(worldGeographyRevision.review.areaInputs.oceans.values.some(item=>item.id===card.id))card.readingTopicIds=['world-oceans',...card.readingTopicIds.filter(id=>id!=='world-oceans')]
  const directPhoto=media.find(m=>m.kind==='photo'&&m.placeIds?.includes(card.id))
  if(directPhoto)card.mediaIds=[directPhoto.id,...(card.mediaIds||[]).filter(id=>id!==directPhoto.id)]
  else if(!card.mediaIds?.length){
    const diagram=categoryDiagrams[card.category]
    if(diagram)card.mediaIds=['diagram-'+diagram]
  }
}
const notes=read('src/data/climate-notes.json')
for(const note of notes){
  const [curve,comparison]=climateLessons[note.code]
  note.sections=[{title:'怎样读月气候图',body:curve},{title:'和相近类型比较',body:comparison}]
  note.mediaIds=['diagram-climate-reading']
  note.readingTopicIds=['map-climate']
}
write('src/data/knowledge.json',knowledge);write('src/data/feature-bindings.json',bindings)
// Knowledge now has its final reading links. Re-evaluate map provenance against
// this final input, rather than recording the pre-migration knowledge hash.
for(const {svg,...info} of editorialReadingMaps()){
  fs.writeFileSync('public/'+info.path,svg)
  Object.assign(mediaById.get(info.id),info)
}
write('src/data/topics.json',topics);write('src/data/climate-notes.json',notes);write('src/data/reading-media.json',media)
const area=read('data/research/area-presentation-review.json')
for(const place of newPlaces){
  const decision={cardId:place.id,name:place.name,decision:'point',featureIds:[],changed:true,reason:'UNESCO 组成地参考坐标；无范围一致的地貌数据，明确保留点位，不推测面积。'}
  const index=area.decisions.findIndex(d=>d.cardId===place.id)
  if(index===-1)area.decisions.push(decision);else area.decisions[index]=decision
}
area.readingAddition={reviewedAt:date,placeIds:newPlaces.map(p=>p.id),coordinateSources:[...new Set(newPlaces.map(p=>p.source+'maps/'))]}
for(const path of ['data/research/area-presentation-review.json','public/data/area-presentation-review.json'])write(path,area)
const intro=read('data/research/topic-intro-review.json')
intro.readingRevision={reviewedAt:date,version,scope:`先前59个原专题整合并补充为32篇；六篇地貌重写为两篇，世界海陆与区域比较再拆为七大洲、五大洋与世界区域比较，当前${topics.length}篇。保留旧链接转向与地图案例，按同类对象比较补充相关主题。非外部独立审核。`}
intro.outputSha256=sha('src/data/topics.json')
intro.editorialRevision={reviewedAt:'2026-11-12',topicIds:articles.map(a=>a.id),scope:'按科普文章逐篇编辑32篇主题、独立地图简版与模块解读；调整材料顺序、比较与配图，保留章节地址、案例及来源。文字编辑与一致性自查，不声称重新核验全部外部资料。'}
intro.landformRevision=read('data/reading/landform-sources.json')
intro.worldGeographyRevision=worldGeographyRevision.review
intro.topics=topics.map(t=>({id:t.id,title:t.title,summaryReviewed:true,sectionsReviewed:t.sections.length,modulesReviewed:t.modules.map(m=>m.id),visuals:(t.visuals||[]).map(v=>v.kind),decision:'地图保留独立简版；完整文章含整体介绍、机制解释、图文比较和具体案例，配图可联动真实地图。',sourceUrls:t.sources.map(s=>s.url)}))
for(const path of ['data/research/topic-intro-review.json','public/data/topic-intro-review.json'])write(path,intro)
const inputs=['data/reading/topic-inputs.json','data/reading/topic-plan.mjs','data/reading/atmosphere-lessons.mjs','data/reading/atmosphere-sources.json','data/reading/map-guides.mjs']
inputs.push('data/reading/ai-illustrations.json',...illustrations.figures.map(figure=>'public/'+figure.path))
inputs.push('data/reading/language-lesson.mjs','scripts/language-reading-figures.mjs','public/data/land.geojson','public/data/language-areas.geojson','public/data/learning-languages.geojson','public/data/language-overview.json')
inputs.push('scripts/apply-reading-edits.mjs','scripts/reading-diagrams.mjs','data/reading/map-essays.json','docs/writing.md',...editorialInputs)
inputs.push('scripts/editorial-reading-maps.mjs',...new Set(editorialMaps.flatMap(item=>item.inputs.map(input=>input.path)).filter(path=>!inputs.includes(path))))
const outputs=[...articles.map(a=>`public/reading/topics/${a.id}.json`),...media.map(m=>'public/'+m.path),'src/data/reading-media.json']
inputs.push(landformInput,landformGuideInput,'data/reading/landform-sources.json','scripts/revise-landform-topics.mjs')
inputs.push(worldGeographyInput,worldGeographyGuideInput,worldGeographySourceInput,'scripts/revise-world-geography.mjs')
outputs.push('src/data/topic-redirects.json')
const manifest={version:'illustrated-science-articles-2026-11-12',reviewedAt:'2026-11-12',atmosphereSourceReview,inputs:inputs.map(path=>({path,sha256:sha(path)})),license:'原创正文与 SVG 为 CC BY 4.0；第三方照片按各自许可，见 media。',processing:'正文按专题编写，案例引用已有精选卡片的原创解读；图片下载到本地，保留原图来源和署名。概念 SVG 标注非实测；语言地图另由既有真实使用区及语言参考点直接投影，各自记录版本和处理；不生成或推测地理边界。',
  editorialRevision:{version:'illustrated-science-articles-2026-11-12',reviewedAt:'2026-11-12',topicIds:articles.map(a=>a.id),processing:'32篇主题与地图简版逐篇通读，重整对象介绍、机制与案例的衔接；新增10张概念插图，保留中国地形4张插图及原有照片、机制图，调整图文位置。保留旧章节地址、地图入口及引用；重建读取全部独立校订稿。',scope:'文字、结构、配图和阅读布局编辑；新增图示按NSIDC、USGS、NPS、NASA、EPA、FAO及香港天文台资料核对，不声称重新核验全部外部来源。'},
  mapGuides:{method:'逐主题独立编写简版科普短文，每段链接支持该解释的完整章节；地图案例观察入口沿用真实对象。不新增地理范围或实测数据。',topics:topics.map(t=>({id:t.id,sectionIds:t.mapGuide.sections.map(s=>s.sectionId),characters:t.mapGuide.sections.reduce((n,s)=>n+s.body.length,0),caseIds:t.mapGuide.cases.map(c=>c.id)}))},
  topicCount:topics.length,cardCount:knowledge.length,moduleCount:topics.reduce((n,t)=>n+t.modules.length,0),climateNoteCount:notes.length,
  reviewLimits:['本次为编写过程中的来源与一致性自查，不声称外部专家审定。','原有来源保留其原始时期；没有把旧统计更新为实时数据。','照片是特定地点与拍摄时刻的景观记录，不能代替地貌完整范围。'],
  articles:articles.map(a=>({id:a.id,path:`public/reading/topics/${a.id}.json`,sections:a.sections.length,characters:a.sections.reduce((n,s)=>n+s.paragraphs.join('').length,0),sourceUrls:a.sources.map(s=>s.url)})),
  media:media.map(m=>({...m,sha256:sha('public/'+m.path),accessedAt:date,processing:m.kind==='photo'?'Wikimedia Commons 提供的缩略图或原文件；未修改画面，照片不合并授予项目原创内容许可。':'项目内 SVG 代码绘制的概念示意；没有地理坐标或实测数值。'})),
  languageRevision:{version:'language-essay-2026-11-08',reviewedAt:'2026-11-08',topicId:'map-language',sources:languageSources,dataInputs:[{id:'glottography-asher2007-v2',version:'2.0',period:'2007年图集contemporary使用区',license:'CC BY 4.0'},{id:'glottolog-5.3',version:'5.3',license:'CC BY 4.0'},{id:'natural-earth-50m-land',version:'ca96624a56bd078437bca8184e78163e5039ad19',license:'Public domain'}],sourceAccessNote:'UNESCO口头传统页与联合国语言教学页全文访问受限，采用搜索服务可核对的页面摘录；其余新增来源已读取页面或公开摘要。',processing:'仅重写语言分布一篇；原创正文配一幅亲缘示意及两幅真实数据地图。沿用原有语言ID、使用区和参考点，不新增或推测语言范围。',validation:'生成时逐项选择既有Glottocode；输入、输出和媒体文件保留SHA-256。浏览器与自动检查结果另存本地验证目录。'},
  outputs:outputs.map(path=>({path,sha256:sha(path)}))}
manifest.processing+=' 中国地形格局沿用4张位置插图，另增10张跨主题概念插图，类型为 illustration；图像不是实测地图，不进入交互地图几何。生成说明与本次核对范围见 illustrationRevision。'
manifest.landformRevision=read('data/reading/landform-sources.json')
manifest.worldGeographyRevision=worldGeographyRevision.review
manifest.editorialRevision.processing+=` 地貌六篇随后整合为两篇；世界海陆与区域比较拆为七大洲、五大洋、世界区域比较，前两篇面积图前置，逐洲逐洋介绍并注明口径与分歧。其他相关主题补充整体比较，当前目录${topics.length}篇。阅读界面移除思考题，旧问题数据保留追溯。`
manifest.license='原创正文、SVG 与项目 AI 辅助插图按 CC BY 4.0 提供；第三方照片与地图输入保留各自许可，见 media。'
manifest.illustrationRevision={version:illustrations.version,reviewedAt:illustrations.reviewedAt,topicIds:articles.filter(article=>article.sections.some(section=>section.mediaIds?.some(id=>mediaById.get(id)?.kind==='illustration'))).map(article=>article.id),sourceReview:illustrations.sourceReview,additionalSourceReviews:illustrations.additionalSourceReviews,mediaIds:illustrations.figures.map(figure=>figure.id)}
manifest.mapRevision={reviewedAt:'2026-11-12',mediaIds:editorialMaps.map(item=>item.id),processing:'复用本站真实陆地、明确绑定的山系标注参考范围和经核验的四区分区；直接投影，保留输入版本、许可、要素ID和SHA-256，不推测新边界。'}
for(const item of manifest.media)if(item.kind==='illustration'){
  item.accessedAt=illustrations.sourceReview.accessedAt
  item.processing=mediaById.get(item.id).processing
  item.generation=illustrations.figures.find(figure=>figure.id===item.id).generation
}else if(editorialMaps.some(map=>map.id===item.id)){
  item.accessedAt='2026-11-12'
  item.processing=mediaById.get(item.id).processing
}else if(item.id==='diagram-upwelling'){
  item.accessedAt='2026-11-10'
  item.processing='原创SVG海岸横剖面，依据NOAA上升流说明绘制；标注概念示意、非实测，不表示风速、流速或真实地理范围。'
}else if(item.kind==='map'||item.id==='language-family-tree'){
  item.accessedAt='2026-11-08'
  item.processing=mediaById.get(item.id).processing||'原创亲缘概念示意；依据Glottolog 5.3选择分支与语言，不显示年代，省略中间层级。'
}
for(const path of ['data/research/reading-sources.json','public/data/reading-sources.json'])write(path,manifest)
console.log(`Built ${articles.length} full articles, ${media.length} figures (${photos.length} photos / ${media.filter(m=>m.kind==='diagram').length} diagrams / ${media.filter(m=>m.kind==='map').length} maps / ${illustrations.figures.length} illustrations), ${knowledge.length} linked cards and ${notes.length} expanded climate notes.`)
