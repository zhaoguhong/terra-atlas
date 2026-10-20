import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'))
const bindings=read('src/data/feature-bindings.json')
const knowledge=read('src/data/knowledge.json')
const rivers=read('public/data/rivers.geojson').features
const lakes=read('public/data/lakes.geojson').features
import {createFeatureCardIndex,createSearchIndex,searchCatalog} from '../src/lib/search.ts'
test('country homonyms remain separate from river names in map and learning data',()=>{
  const countries=read('public/data/countries.geojson').features
  const gazetteer=read('public/data/gazetteer.json')
  const tables=[read('public/data/learning-human.json').religion.countries,read('public/data/learning-country-languages.json').countries,read('public/data/learning-country-indicators.json').countries]
  for(const [id,name,riverName] of [['country-jor','约旦','约旦河'],['country-ner','尼日尔','尼日尔河'],['country-sen','塞内加尔','塞内加尔河'],['country-cog','刚果共和国','刚果河']]){
    for(const p of [countries.find(f=>f.id===id)?.properties,gazetteer.find(p=>p.id===id)]){
      assert.equal(p?.name,name);assert(!p.aliases.includes(riverName))
    }
    for(const rows of tables)for(const row of rows.filter(r=>r.countryId===id))assert.equal(row.name,name)
  }
  for(const [id,name] of [['river-jordan','约旦河'],['river-niger','尼日尔河'],['river-congo-41','刚果河']])assert.equal(rivers.find(f=>f.id===id)?.properties.name,name)
})
test('search uses real feature bindings, preserving shared IDs and empty decisions',()=>{
  const cards=createFeatureCardIndex(knowledge,bindings)
  assert.equal(cards.get('river-yangtze')?.id,'yangtze')
  assert.equal(cards.get('lake-1159114015')?.id,'poyang-lake')
  assert.equal(cards.get('river-pearl'),undefined)
  assert.equal(cards.get('inner-mongolian-plateau'),undefined)
  const shared=createFeatureCardIndex([{id:'first'},{id:'second'},{id:'unbound'}],{first:['shared'],second:['shared'],unbound:[]})
  assert.equal(shared.get('shared').id,'first');assert.equal(shared.size,1)
})
test('indexed search keeps exact Chinese names first and supports English aliases and tags',()=>{
  const curated=createSearchIndex(knowledge,k=>[k.name,k.englishName,...k.aliases,...(k.tags||[])])
  for(const [query,id] of [['青海湖','qinghai-lake'],['  aLpS  ','alps'],['Himalayas','himalayas'],['长江','yangtze']])assert.equal(searchCatalog(query,curated,[],[])[0]?.id,id)
  const values=[{name:'长江流域',aliases:[]},{name:'长江',aliases:['Yangtze (River)']},{name:'其他地点',aliases:['长江观察']}]
  const index=createSearchIndex(values,p=>[p.name,...p.aliases])
  assert.deepEqual(searchCatalog('长江',index,[],[]).map(p=>p.name),['长江','长江流域','其他地点'])
  assert.equal(searchCatalog('ＹＡＮＧＴＺＥ-river',index,[],[])[0]?.name,'长江')
  for(const query of ['', '   ', '- ( )'])assert.deepEqual(searchCatalog(query,index,[],[]),[])
})
test('search preserves group priority and reference deduplication across the full language catalog',()=>{
  const cards=createFeatureCardIndex(knowledge,bindings)
  const curated=createSearchIndex(knowledge,k=>[k.name,k.englishName,...k.aliases,...(k.tags||[])])
  const references=createSearchIndex([{name:'青海湖'},{name:'青海湖观测点'}],p=>[p.name])
  const mapObjects=[...read('public/data/gazetteer.json'),...read('public/data/learning-languages.geojson').features.map(f=>f.properties)].filter(p=>!cards.has(p.id))
  const features=createSearchIndex(mapObjects,p=>[p.name,p.nameEn,...(p.aliases||[])])
  assert.deepEqual(searchCatalog('青海湖',curated,references,features).map(p=>p.name),['青海湖','青海湖观测点'])
  assert.equal(searchCatalog('官话',curated,[],features)[0]?.id,'language-mand1415')
  const broad=searchCatalog('a',curated,[],features)
  assert.equal(broad.length,10);assert(broad.every(p=>knowledge.includes(p)))
  assert.deepEqual(searchCatalog('约旦河',[],[],features).map(p=>p.id),['river-jordan'])
  assert(searchCatalog('约旦',[],[],features).some(p=>p.id==='country-jor'))
})
test('ambiguous names never bind to the wrong geography',()=>{
  assert.deepEqual(bindings['poyang-lake'],['lake-1159114015'])
  assert(!bindings['pearl-river'].some(id=>id.includes('pearl')))
  assert(bindings['pearl-river'].includes('river-xi'))
  assert.deepEqual(bindings['inner-mongolian-plateau'],[])
  assert.deepEqual(bindings['ganges-plain'],[])
})
test('Yangtze trunk retains real upstream source segments',()=>{
  const f=rivers.find(f=>f.properties.id==='river-yangtze')
  assert(f)
  const text=JSON.stringify(f.properties)
  for(const name of ['Tuotuo','Tongtian','Jinsha'])assert(text.includes(name),name)
})
test('five great lakes are five actual lake bodies, Caspian has real shoreline',()=>{
  assert.equal(bindings['great-lakes'].length,5)
  for(const id of bindings['great-lakes'])assert(lakes.some(f=>f.properties.id===id))
  const caspian=lakes.find(f=>f.properties.id==='lake-caspian-sea')
  assert(caspian && caspian.geometry.type==='Polygon')
  assert.equal(caspian.properties.sourceId,'natural-earth-50m-land')
})
test('climate content agrees with a single A–E classification',()=>{
  assert.deepEqual(knowledge.filter(k=>k.category==='climate').map(k=>k.id),['climate-a','climate-b','climate-c','climate-d','climate-e'])
  const codes=read('public/data/climate-legend.json')
  assert.equal(codes.filter(c=>c.presentAtResolution).length,28)
  assert(!codes.some(c=>c.family==='H'))
})

import {geometryBounds} from '../src/lib/geo.ts'
import {greatCircleDistance,greatCircleRoute,routeDistance} from '../src/lib/measure.ts'
import {gridIndex,numberText} from '../src/lib/learning.ts'
import {defaultLayers,parsePreferences,validCamera} from '../src/lib/storage.ts'
import {legacyTopic,singleOverlay,topicOverlays} from '../src/lib/theme-state.ts'
test('theme overlays are exclusive including language and preserve auxiliary layers',()=>{
  const base={...defaultLayers,grid:true,provinces:true}
  for(const overlay of [...topicOverlays,null]){
    const next=singleOverlay({...base,climate:true,population:true,religion:true,language:true},overlay)
    assert.deepEqual(topicOverlays.filter(key=>next[key]),overlay?[overlay]:[])
    for(const key of ['terrain','mountains','rivers','lakes','borders','grid','provinces'])assert.equal(next[key],base[key])
    assert.equal(legacyTopic(next),overlay?'map-'+overlay:null)
  }
})
test('legacy overlapping thematic layers migrate to one theme without losing records or cameras',()=>{
  const camera={center:[111,30],zoom:4.6}
  const layers={...defaultLayers,religion:true,language:true}
  const migrated=parsePreferences({favorites:['yangtze'],notes:{yangtze:'保留笔记'},camera,layers,savedViews:[{id:'legacy',name:'宗教和语言',camera,layers,view:'china'}]})
  assert.equal(migrated.topicId,'map-religion')
  assert.equal(migrated.layers.religion,true);assert.equal(migrated.layers.language,false)
  assert.equal(migrated.savedViews[0].topicId,'map-religion')
  assert.equal(migrated.savedViews[0].layers.language,false)
  assert.deepEqual(migrated.favorites,['yangtze']);assert.equal(migrated.notes.yangtze,'保留笔记')
  assert.deepEqual(migrated.camera.center,camera.center);assert.equal(migrated.camera.zoom,camera.zoom)
})
test('collection themes and an explicit exit persist in saved and exported preferences',()=>{
  const camera={center:[86,29],zoom:5.4}
  const value={topicId:'world-high-peaks',layers:defaultLayers,savedViews:[{id:'summits',name:'世界高峰',topicId:'world-high-peaks',layers:defaultLayers,camera,view:'world'}]}
  const migrated=parsePreferences(JSON.parse(JSON.stringify(value)))
  assert.equal(migrated.topicId,'world-high-peaks');assert.equal(migrated.savedViews[0].topicId,'world-high-peaks')
  assert.equal(parsePreferences({...value,topicId:null}).topicId,null)
  assert.equal(parsePreferences({...value,topicId:[],layers:{...defaultLayers,language:true}}).topicId,'map-language')
})
test('real geometry bounds follow the small interval across the antimeridian',()=>{
  const b=geometryBounds([{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[[178,12],[-179,16]]}}])
  assert.deepEqual(b,[178,12,181,16])
  assert.equal(geometryBounds([]),null)
})
test('distance and visible route agree including crossing and antipodal cases',()=>{
  assert(Math.abs(greatCircleDistance([0,0],[1,0])-111.195)<.001)
  assert(Math.abs(routeDistance([[0,0],[1,0],[2,0]])-222.390)<.002)
  const lines=greatCircleRoute([[179,0],[-179,0]])
  assert.equal(lines.length,2)
  for(const line of lines)for(let i=1;i<line.length;i++)assert(Math.abs(line[i][0]-line[i-1][0])<2)
  assert(greatCircleRoute([[0,0],[180,0]]).flat().every(p=>p.every(Number.isFinite)))
})
test('grid edge selection preserves missing versus zero and bounds',()=>{
  const grid={width:720,height:360,west:-180,north:90,resolutionDegrees:.5}
  assert.equal(gridIndex(grid,[-180,90]),0)
  assert.equal(gridIndex(grid,[180,90]),719)
  assert.equal(gridIndex(grid,[0,-90]),null)
  assert.equal(gridIndex(grid,[181,0]),null)
  assert.equal(numberText(null),'暂无资料')
  assert.equal(numberText(0),'0')
})
test('old preferences migrate without losing favorites or saved views',()=>{
  const migrated=parsePreferences({favorites:['yangtze'],layers:{terrain:true,rivers:true},camera:{center:[104,35],zoom:4},savedViews:[{id:'old',name:'旧视图',view:'china',camera:{center:[104,35],zoom:4},layers:{terrain:true,climate:true}}]})
  assert.deepEqual(migrated.favorites,['yangtze'])
  assert.equal(migrated.layers.population,false)
  assert.equal(migrated.savedViews[0].layers.climate,true)
  assert.equal(migrated.savedViews[0].layers.language,false)
  assert.deepEqual(migrated.notes,{})
  assert.deepEqual(migrated.display,{basemap:'natural',terrain3d:false})
  assert.deepEqual(migrated.savedViews[0].display,{basemap:'natural',terrain3d:false})
  assert.equal(migrated.camera.pitch,0)
})
test('saved online modes retain camera tilt and reject invalid camera values',()=>{
  const camera={center:[104,35],zoom:5.2,pitch:35,bearing:18}
  const display={basemap:'detail',terrain3d:true}
  const preferences=parsePreferences({camera,display,savedViews:[{id:'3d',name:'三维视图',camera,display,layers:{},view:'china'}]})
  assert.deepEqual(preferences.display,display)
  assert.deepEqual(preferences.camera,camera)
  assert.deepEqual(preferences.savedViews[0].display,display)
  assert.deepEqual(preferences.savedViews[0].camera,camera)
  assert.equal(parsePreferences({camera,display:{basemap:'unknown',terrain3d:'true'}}).camera.pitch,0)
  assert(validCamera({...camera,pitch:0}))
  assert(validCamera({...camera,pitch:60}))
  for(const invalid of [NaN,Infinity,-1,61])assert(!validCamera({...camera,pitch:invalid}))
  assert(!validCamera({...camera,bearing:NaN}))
})
test('religion records retain different denominators and language points are language-level',()=>{
  const data=read('public/data/learning-human.json').religion.countries
  assert(data.some(c=>c.year===null))
  assert(data.some(c=>c.scope!=='population'))
  assert(data.some(c=>Object.values(c.shares).includes(null)))
  const langs=read('public/data/learning-languages.geojson').features
  assert.equal(langs.length,8070)
  assert(langs.every(f=>f.geometry.type==='Point'&&f.properties.level==='language'))
})

test('etymology and creole names never become country language tags',()=>{
  const countries=read('public/data/learning-country-languages.json').countries
  const aruba=countries.find(c=>c.countryId==='country-abw').languages.map(l=>l.id)
  assert(aruba.includes('pap'));assert(!aruba.includes('por'));assert(!aruba.includes('fra'))
  const dominica=countries.find(c=>c.countryId==='country-dma').languages.map(l=>l.id)
  assert(!dominica.includes('fra'))
})

import {daylightHours,solarTimeOffsetMinutes,scaleDistanceKm} from '../src/lib/earth.ts'
test('daylight teaching model handles equinoxes, hemisphere reversal and polar limits',()=>{
  for(const latitude of [-80,-40,0,40,80])assert(Math.abs(daylightHours(latitude,0)-12)<1e-10)
  assert(daylightHours(40,23.44)>14&&daylightHours(40,23.44)<16)
  assert(Math.abs(daylightHours(40,23.44)+daylightHours(-40,23.44)-24)<1e-10)
  assert.equal(daylightHours(80,23.44),24);assert.equal(daylightHours(80,-23.44),0)
  assert.equal(solarTimeOffsetMinutes(120),480);assert.equal(solarTimeOffsetMinutes(-30),-120)
  assert.equal(scaleDistanceKm(4,50000),2);assert.equal(scaleDistanceKm(4,1000000),40)
})
test('every theme member is reachable exactly once through an explicit learning module',()=>{
  const topics=read('src/data/topics.json')
  assert.equal(new Set(topics.map(t=>t.id)).size,topics.length)
  for(const topic of topics){
    const modules=topic.modules||[],members=modules.flatMap(module=>module.stops)
    assert(modules.length,topic.id)
    assert.equal(members.length,new Set(members).size,topic.id+' duplicate member')
    assert.deepEqual(new Set(members),new Set(topic.stops),topic.id+' incomplete module coverage')
    for(const id of members)assert(knowledge.some(card=>card.id===id),topic.id+' unknown member '+id)
  }
})

import {allTopicPresentationIds,getTopicPresentation,presentationForMember} from '../src/lib/topic-presentation.ts'
import {buildMapLegend} from '../src/lib/map-legend.ts'
import {climateGroups,languageFamilies,majorLanguages,familyColor,languageColor,otherLanguageColor} from '../src/lib/map-presentation.ts'
import {validThematic} from '../src/lib/storage.ts'
test('all themes explain every actual member geometry and colour without inventing ranges',()=>{
  const topics=read('src/data/topics.json')
  assert.deepEqual(new Set(allTopicPresentationIds),new Set(topics.map(topic=>topic.id)))
  for(const topic of topics){
    const presentation=getTopicPresentation(topic)
    const mapped=topic.kind==='distribution'?[]:topic.stops.map(id=>knowledge.find(card=>card.id===id)).filter(card=>card.mapRole!=='concept'&&(!['climate','population','religion','language'].includes(card.category)||bindings[card.id]?.length))
    for(const card of mapped){
      const member=presentationForMember(topic,card),entry=presentation.memberEntries.find(entry=>entry.legendId===member.legendId)
      assert(entry,topic.id+' missing legend '+card.id)
      assert.equal(entry.color,member.color);assert.equal(entry.kind,member.kind);assert.equal(entry.symbol,member.symbol)
      if(!bindings[card.id]?.length)assert(!['area','line','peak'].includes(member.kind),card.id+' invented geometry')
    }
    assert(presentation.memberEntries.length<=8,topic.id+' excessive categorical colours')
  }
})
test('language category colours have an explicit other category instead of recycled meanings',()=>{
  for(const categories of [languageFamilies,majorLanguages])assert.equal(new Set(categories.map(category=>category.color)).size,categories.length)
  assert.equal(familyColor('unlisted-family'),otherLanguageColor)
  assert.equal(languageColor('unlisted-language'),otherLanguageColor)
})
test('language legends describe the filtered language and family views',()=>{
  const languageMeta=read('public/data/language-areas-meta.json')
  const input={layers:{...defaultLayers,language:true},thematic:validThematic({language:'sino1245',languageMode:'areas'}),topic:null,selection:null,human:null,languageMeta}
  const entries=buildMapLegend(input).sections[0].entries
  assert(entries.some(entry=>entry.id==='action:language:mand1415'))
  assert(!entries.some(entry=>entry.id==='action:language:stan1293'))
  assert.equal(entries.find(entry=>entry.id==='language-other').color,otherLanguageColor)
  const selected=buildMapLegend({...input,thematic:validThematic({languageMode:'points',languageId:'nucl1643'})}).sections[0].entries
  assert.equal(selected.length,1);assert.equal(selected[0].symbol,'point');assert.equal(selected[0].color,languageColor('nucl1643'))
})
test('climate legends reflect the selected displayed classification and keep foreground symbols',()=>{
  const topic=read('src/data/topics.json').find(topic=>topic.id==='china-dry-water')
  const input={layers:{...defaultLayers,climate:true},thematic:validThematic({climateMode:'groups'}),topic,selection:null,human:null,languageMeta:null}
  const overview=buildMapLegend(input)
  assert.deepEqual(overview.sections[0].entries.map(entry=>entry.color),climateGroups.map(group=>group.color))
  const detailed=buildMapLegend({...input,thematic:validThematic({climateMode:'types'})})
  assert.equal(detailed.sections[0].entries.length,28)
  assert(detailed.sections.some(section=>section.id==='members'))
  assert(detailed.sections.some(section=>section.id==='symbols'))
})
test('thematic modes validate old records and persist explicit language and climate views',()=>{
  const old=validThematic({religion:'muslim',language:'sino1245',opacity:.5})
  assert.equal(old.languageMode,'areas');assert.equal(old.climateMode,'groups');assert.equal(old.languageId,'all')
  const explicit=validThematic({languageMode:'points',languageId:'mand1415',climateMode:'types',opacity:.3})
  assert.equal(explicit.languageMode,'points');assert.equal(explicit.climateMode,'types');assert.equal(explicit.languageId,'mand1415')
  assert.equal(validThematic({languageMode:'invalid',climateMode:'invalid',opacity:NaN}).opacity,.72)
})
