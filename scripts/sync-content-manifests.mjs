import fs from 'node:fs'
import {createHash} from 'node:crypto'
const read=path=>JSON.parse(fs.readFileSync(path,'utf8'))
const write=(path,data)=>fs.writeFileSync(path,JSON.stringify(data,null,2)+'\n')
const knowledge=read('src/data/knowledge.json'),topics=read('src/data/topics.json'),notes=read('src/data/climate-notes.json'),bindings=read('src/data/feature-bindings.json')
const manifest=read('data/research/content-sources.json')
const previous=new Map(manifest.sources.map(source=>[source.url,source])),sources=new Map()
for(const [usedBy,refs] of [...knowledge.map(k=>[k.id,k.sources]),...topics.map(t=>['topic:'+t.id,t.sources]),...notes.map(n=>['climate-note:'+n.code,n.sources])])for(const ref of refs){
 const source=sources.get(ref.url)||{...previous.get(ref.url),...ref,usedBy:[]}
 if(!source.usedBy.includes(usedBy))source.usedBy.push(usedBy)
 sources.set(ref.url,source)
}
manifest.sources=[...sources.values()];manifest.sourceCount=sources.size
manifest.contentCount=knowledge.length;manifest.topicCount=topics.length;manifest.climateNoteCount=notes.length
manifest.scope=`个人自由探索：中国与世界${knowledge.length}张精选自然及人文地理卡片、${notes.length}种气候笔记、${topics.length}个单选主题；按区域、地形、水系、气候、人口文化、资源交通及地球地图七类组织。`
Object.assign(manifest.featureBindingReview,{nonClimateCards:knowledge.filter(k=>k.category!=='climate').length,naturalCards:knowledge.filter(k=>['mountains','terrain','rivers','lakes'].includes(k.category)).length,boundCards:knowledge.filter(k=>bindings[k.id]?.length).length,pointOnlyCards:knowledge.filter(k=>k.category!=='climate'&&!bindings[k.id]?.length).map(k=>k.id)})
const theme=read('data/research/theme-sources.json')
Object.assign(theme.validation,{collectionTopics:topics.filter(t=>t.kind==='collection').length,distributionTopics:topics.filter(t=>t.kind==='distribution').length,connectionTopics:topics.filter(t=>t.kind==='connections').length})
for(const output of theme.outputs)output.sha256=createHash('sha256').update(fs.readFileSync(output.path)).digest('hex')
for(const [name,value] of [['content-sources',manifest],['theme-sources',theme]]){write('data/research/'+name+'.json',value);write('public/data/'+name+'.json',value)}
const coverage=read('data/research/curriculum-coverage.json')
coverage.contentCount=knowledge.length;coverage.topicCount=topics.length;coverage.climateNoteCount=notes.length
coverage.scopeNote=`${knowledge.length}张精选卡片、${notes.length}种气候笔记与${topics.length}个自由主题；只记录实际实现的精选内容，不声称全部教材或课标已覆盖。`
const aliases={'world-mountains':'world-mountain-ranges','world-lake-origins':'world-lakes','world-population-scales':'map-population','world-culture-evidence':'map-religion'}
for(const item of coverage.coverage)item.topicIds=[...new Set(item.topicIds.map(id=>aliases[id]||id))].filter(id=>topics.some(t=>t.id===id))
write('data/research/curriculum-coverage.json',coverage)
console.log(`Synced ${knowledge.length} cards, ${topics.length} themes, ${sources.size} sources; research and public manifests match.`)
