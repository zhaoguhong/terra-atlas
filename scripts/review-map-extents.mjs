import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'

const read=path=>JSON.parse(fs.readFileSync(path,'utf8'))
const write=(path,value)=>fs.writeFileSync(path,JSON.stringify(value,null,2)+'\n')
const cards=read('src/data/knowledge.json'),bindings=read('src/data/feature-bindings.json'),topics=read('src/data/topics.json')
const features=new Map()
for(const name of fs.readdirSync('public/data').filter(name=>name.endsWith('.geojson'))){
  for(const feature of read('public/data/'+name).features)features.set(feature.properties.id,{...feature,source:name})
}
// These discuss geographic regions, rather than a single observed location.
// An empty binding is an explicit unresolved extent, never a fabricated polygon.
const regionalObjects=new Set(['inner-mongolian-plateau','bering-strait','ganges-plain','yangtze-middle-lower-plain','liaodong-hills','shandong-hills','southeast-hills','southeast-asia','western-europe','middle-east','sub-saharan-africa','oceania-region','arctic-region','namib-sand-sea','amazon-rainforest','serengeti-savanna','okavango-delta','sundarbans-mangroves','canadian-boreal-forest','yangtze-delta','pearl-delta','ruhr-industry','mekong-delta-farming'])
const decisions=cards.map(card=>{
  const featureIds=bindings[card.id]||[],bound=featureIds.map(id=>{assert(features.has(id),card.id+': missing '+id);return features.get(id)})
  const geometryTypes=[...new Set(bound.map(f=>f.geometry.type))]
  const representation=card.mapRole==='concept'?'concept':geometryTypes.some(type=>/Polygon/.test(type))?'area':geometryTypes.some(type=>/LineString/.test(type))?'line':geometryTypes.length?'point':['climate','population','religion','language'].includes(card.category)?'distribution':'point'
  if(representation==='area'&&featureIds.every(id=>id.startsWith('region-'))&&/^定位点/.test(card.geometryNote||'')){
    card.geometryNote='地图色面采用Natural Earth的'+card.name.split('：')[0]+'概化标注参考范围，便于观察位置与展布；自然地理边缘常有过渡，不代表精确地貌界线。'
  }
  assert(card.geometryNote?.length,card.id+': no scope explanation')
  return {cardId:card.id,name:card.name,representation,featureIds,geometryTypes,
    scope:representation==='area'?(bound.some(f=>f.source==='regions.geojson'||f.properties.referenceExtent)?'概化标注参考范围':'有来源的概化区域'):
      representation==='line'?'真实来源线状要素':representation==='point'?(regionalObjects.has(card.id)?'区域定位，尚无范围一致的完整区域':'地点或观察案例定位'):
      representation==='concept'?'概念解读':'统计或分类分布',
    needsExtent:representation==='point'&&regionalObjects.has(card.id),
    geometryNote:card.geometryNote,topics:topics.filter(topic=>topic.stops.includes(card.id)).map(topic=>topic.id)}
})
write('src/data/knowledge.json',cards)
const previous=read('data/research/area-presentation-review.json')
for(const decision of previous.decisions){
  const current=decisions.find(row=>row.cardId===decision.cardId)
  if(JSON.stringify(decision.featureIds)!==JSON.stringify(current.featureIds)){
    decision.changed=true;decision.reason=current.geometryNote
  }
  decision.featureIds=current.featureIds
  decision.decision=current.representation==='concept'?'point':current.representation
}
previous.reviewedAt='2026-11-13'
previous.changedCards=previous.decisions.filter(row=>row.changed).length
for(const prefix of ['data/research','public/data'])write(prefix+'/area-presentation-review.json',previous)
const summary=Object.fromEntries(['area','line','point','concept','distribution'].map(kind=>[kind,decisions.filter(row=>row.representation===kind).length]))
const review={reviewedAt:'2026-11-13',scope:'逐项核对全站精选地点、全部主题成员、显式绑定、实际几何类型和范围说明；不将案例点或概念误计为缺失区域。',
  contentCount:cards.length,topicCount:topics.length,summary,
  inputs:['src/data/knowledge.json','src/data/feature-bindings.json','src/data/topics.json'].map(path=>({path,sha256:createHash('sha256').update(fs.readFileSync(path)).digest('hex')})),
  decisions,topics:topics.map(topic=>({id:topic.id,title:topic.title,members:topic.stops,
    areas:topic.stops.filter(id=>decisions.find(row=>row.cardId===id)?.representation==='area'),
    locationOnly:topic.stops.filter(id=>decisions.find(row=>row.cardId===id)?.representation==='point'),
    unresolvedExtents:topic.stops.filter(id=>decisions.find(row=>row.cardId===id)?.needsExtent)}))}
for(const prefix of ['data/research','public/data'])write(prefix+'/map-extent-review.json',review)
console.log(`Reviewed ${cards.length} places and ${topics.length} topics: ${JSON.stringify(summary)}; ${decisions.filter(row=>row.needsExtent).length} explicitly documented unresolved regional extents.`)
