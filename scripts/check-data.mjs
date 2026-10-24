import fs from 'node:fs'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'))
const knowledge=read('src/data/knowledge.json')
const bindings=read('src/data/feature-bindings.json')
const sources=read('public/data/sources.json')
const ids=new Set(), features=new Map()
for(const name of ['land','countries','regions','china-reference-regions','rivers','lakes','peaks','theme-peaks','climate','learning-provinces','learning-languages','language-areas']){
  const data=read(`public/data/${name}.geojson`)
  assert.equal(data.type,'FeatureCollection')
  for(const f of data.features){
    assert(f.geometry && f.geometry.coordinates.length,`${name}: empty geometry`)
    assert(!ids.has(f.properties.id),`Duplicate geometry ID ${f.properties.id}`)
    ids.add(f.properties.id);features.set(f.properties.id,f)
  }
}
for(const artifact of sources.artifacts){
  const buffer=fs.readFileSync(`public${artifact.path}`)
  assert.equal(createHash('sha256').update(buffer).digest('hex'),artifact.sha256,artifact.path)
}
const cardIds=new Set(knowledge.map(k=>k.id))
assert.equal(cardIds.size,knowledge.length)
for(const k of knowledge){
  for(const key of ['name','englishName','summary','location','formation'])assert(k[key]?.trim(),`${k.id}: missing ${key}`)
  assert(k.coordinates.length===2 && k.coordinates.every(Number.isFinite))
  assert(Math.abs(k.coordinates[0])<=180 && Math.abs(k.coordinates[1])<=90)
  if(k.mapZoom!==undefined)assert(Number.isFinite(k.mapZoom)&&k.mapZoom>=0&&k.mapZoom<=11.5,k.id+' map zoom')
  if(k.mapRole!==undefined)assert(['place','concept'].includes(k.mapRole),k.id+' map role')
  assert(k.sources.length && k.sources.every(s=>/^https:\/\//.test(s.url)),`${k.id}: sources`)
  assert(k.sections?.length>=2&&k.sections.every(section=>section.title&&section.body.length>=35),k.id+' substantive member explanations')
  assert(k.questions?.length>=2,k.id+' observation questions')
  assert(k.sections.every(section=>section.body!==k.summary&&!k.connections.includes(section.body)),k.id+' explanation must add to summary and connections')
  for(const id of k.relatedIds||[])assert(cardIds.has(id),`Dangling relation ${id}`)
  if(k.category!=='climate')assert(Array.isArray(bindings[k.id]),`${k.id}: explicit geometry decision missing`)
}
for(const [id,values] of Object.entries(bindings))for(const feature of values)assert(features.has(feature),`${id}: missing geometry ${feature}`)
const gazetteer=read('public/data/gazetteer.json')
for(const name of ['china-reference-region-sources','area-presentation-review'])assert.equal(fs.readFileSync(`data/research/${name}.json`,'utf8'),fs.readFileSync(`public/data/${name}.json`,'utf8'),name+' provenance copies')
const regionSources=read('data/research/china-reference-region-sources.json')
for(const row of [...regionSources.inputs,regionSources.output])assert.equal(createHash('sha256').update(fs.readFileSync(row.path)).digest('hex'),row.sha256,row.path+' reference region hash')
assert.equal(regionSources.license,'CC-BY-4.0')
assert(regionSources.georeferencing.rmsPixels<1&&regionSources.georeferencing.maxPixels<2)
const areaReview=read('data/research/area-presentation-review.json')
assert.equal(areaReview.decisions.length,knowledge.length)
for(const decision of areaReview.decisions)assert.deepEqual(decision.featureIds,bindings[decision.cardId]||[],decision.cardId+' reviewed geometry')
for(const id of ['northern-china','southern-china','northwestern-china','qinghai-tibet-region']){
  assert.equal(bindings[id].length,1)
  assert(bindings[id][0].startsWith('region-cn-jiang2023-'))
  assert.match(features.get(bindings[id][0]).geometry.type,/Polygon/)
}
console.log('Verified four digitized reference regions and 211 explicit area/line/point decisions.')
const expectedCountryNames={'country-jor':'约旦','country-ner':'尼日尔','country-sen':'塞内加尔','country-cog':'刚果共和国'}
for(const [id,name] of Object.entries(expectedCountryNames)){
  for(const p of [features.get(id)?.properties,gazetteer.find(p=>p.id===id)]){
    assert.equal(p?.name,name,id+' country name')
    assert(!p.aliases.includes(name.replace('共和国','')+'河'),id+' river alias on country')
  }
}
for(const rows of [read('public/data/learning-human.json').religion.countries,read('public/data/learning-country-languages.json').countries,read('public/data/learning-country-indicators.json').countries]){
  for(const row of rows)assert.equal(row.name,features.get(row.countryId)?.properties.name,row.countryId+' derived country name')
}
for(const row of read('public/data/learning-country-languages.json').countries){
  assert(row.languages.length+row.untranslatedEntries.length>0,row.countryId+' empty language overview')
  assert(row.sourceEntries.length>0,row.countryId+' missing source order')
  for(const entry of [...row.languages.map(language=>language.sourceLabel),...row.untranslatedEntries]){
    assert(row.sourceEntries.includes(entry)&&row.sourceText.includes(entry),row.countryId+' language entry absent from source')
  }
}
const legend=read('public/data/climate-legend.json')
assert.equal(legend.length,30)
assert.deepEqual(new Set(legend.map(c=>c.family)),new Set(['A','B','C','D','E']))
assert.equal(read('public/data/validation.json').status,'passed')
assert.equal(fs.readFileSync('public/data/content-sources.json','utf8'),fs.readFileSync('data/research/content-sources.json','utf8'))
let tiles=0
for(let z=0;z<=4;z++)for(let x=0;x<2**z;x++)for(let y=0;y<2**z;y++){assert(fs.statSync(`public/terrain/${z}/${x}/${y}.jpg`).size>100);tiles++}
console.log(`Verified ${knowledge.length} sourced cards, ${ids.size} geometries, ${sources.artifacts.length} artifact hashes, 30 climate classes and ${tiles} terrain tiles.`)

const learningSources=read('public/data/learning-data-sources.json')
const contextSources=read('public/data/country-context-sources.json')
let learningHashes=0
for(const manifest of ['learning-data-sources','country-context-sources']){
  assert.equal(fs.readFileSync('public/data/'+manifest+'.json','utf8'),fs.readFileSync('data/research/'+manifest+'.json','utf8'),manifest+' copies diverge')
}
for(const source of learningSources.sources){
  assert(source.version && source.license && source.processing,source.id+' provenance')
  for(const output of source.outputs||[]){
    const buffer=fs.readFileSync(output.path)
    assert.equal(createHash('sha256').update(buffer).digest('hex'),output.sha256,output.path)
    learningHashes++
  }
}
for(const artifact of contextSources.artifacts){
  assert.equal(createHash('sha256').update(fs.readFileSync('public'+artifact.path)).digest('hex'),artifact.sha256,artifact.path)
  learningHashes++
}
const population=read('public/data/learning-population.json')
assert.equal(population.values.length,population.height)
assert(population.values.every(row=>row.length===population.width))
const densityValues=population.values.flat()
assert.equal(population.resolutionDegrees,.5)
assert.equal(population.year,2020)
assert(densityValues.some(v=>v===null)&&densityValues.some(v=>v===0))
assert(densityValues.every(v=>v===null||Number.isFinite(v)&&v>=0))
const populationVectorsPath='data/research/learning-population.geojson'
assert(!fs.existsSync('public/data/learning-population.geojson'),'Validation-only population vectors must not be published')
const populationVectors=read(populationVectorsPath)
const populationOutput=learningSources.sources.find(s=>s.id==='ghs-pop-2020').outputs.find(o=>o.path===populationVectorsPath)
assert(populationOutput?.published===false,'Population vectors must be marked as unpublished in both manifests')
const populationIds=new Set()
for(const feature of populationVectors.features){
  const {id,row,col,density}=feature.properties
  assert(Number.isInteger(row)&&row>=0&&row<population.height&&Number.isInteger(col)&&col>=0&&col<population.width)
  assert.equal(id,`pop-r${row}-c${col}`);assert(!populationIds.has(id));populationIds.add(id)
  assert.equal(density,population.values[row][col],id+' vector/grid density')
  const west=population.west+col*population.resolutionDegrees,north=population.north-row*population.resolutionDegrees,step=population.resolutionDegrees
  assert.equal(feature.geometry.type,'Polygon')
  assert.deepEqual(feature.geometry.coordinates,[[[west,north],[west+step,north],[west+step,north-step],[west,north-step],[west,north]]],id+' real grid-cell footprint')
}
assert.equal(populationVectors.features.length,densityValues.filter(v=>v!==null).length)
const populationValidation=read('data/research/learning-independent-validation.json')['learning-population.geojson']
assert.equal(populationValidation.path,populationVectorsPath)
assert.equal(populationValidation.sha256,populationOutput.sha256)
assert.equal(populationValidation.features,populationVectors.features.length)
const monthly=read('public/data/learning-climate.json')
assert.equal(monthly.places.length,60)
assert.equal(monthly.resolutionDegrees,.5)
assert.equal(monthly.period,'1991–2020')
for(const p of monthly.places){
  assert.equal(p.temperature.length,12);assert.equal(p.precipitation.length,12)
  assert(p.temperature.every(Number.isFinite)&&p.precipitation.every(v=>Number.isFinite(v)&&v>=0))
  assert(Array.isArray(p.sampleCoordinates)&&typeof p.sampling==='string')
}
const human=read('public/data/learning-human.json')
assert.equal(human.religion.countries.length,228)
for(const country of human.religion.countries){
  assert(country.countryId&&['population','affiliated','practicing','mixed','citizens','age-limited'].includes(country.scope))
  assert(Object.values(country.shares).every(v=>v===null||Number.isFinite(v)&&v>=0&&v<=100))
}
const notes=read('src/data/climate-notes.json')
assert.equal(notes.length,30)
assert.deepEqual(new Set(notes.map(n=>n.code)),new Set(legend.map(n=>n.code)))
for(const n of notes)for(const field of ['description','seasons','landscape'])assert(n[field]?.length>40,n.code+' '+field)
for(const topic of read('src/data/topics.json')){
  assert(topic.stops.length>1)
  assert(['regions','landforms','water','climate','people','resources','earth'].includes(topic.group),topic.id+' group')
  assert(['collection','distribution','connections'].includes(topic.kind),topic.id+' kind')
  assert(topic.overlay===null||['climate','population','religion','language'].includes(topic.overlay),topic.id+' exclusive overlay')
  assert(topic.layers.every(layer=>!['climate','population','religion','language'].includes(layer)),topic.id+' overlay must use single selection')
  // Two focused explanations plus the summary/visual comparison replace three repetitive paragraphs.
  assert(topic.sections.length>=2&&topic.sections.every(section=>section.title&&section.body.length>=40)&&topic.sources.length&&topic.geometryNote,topic.id+' authored explanation')
  for(const id of topic.stops)assert(cardIds.has(id),topic.id+' missing '+id)
  assert(topic.modules?.length,topic.id+' explicit learning modules')
  const members=topic.modules.flatMap(module=>{
    assert(module.id&&module.title&&module.description&&module.stops.length,topic.id+' complete module')
    assert(module.detail?.length>=30&&module.detail!==module.description,topic.id+' module explanation adds detail')
    assert(!module.description.includes('先定位各个对象'),topic.id+' placeholder module introduction')
    return module.stops
  })
  assert.equal(new Set(members).size,members.length,topic.id+' duplicate module member')
  assert.deepEqual(new Set(members),new Set(topic.stops),topic.id+' all members reachable in modules')
  assert.equal(new Set(topic.modules.map(module=>module.id)).size,topic.modules.length,topic.id+' duplicate module id')
  for(const visual of topic.visuals||[]){
    assert(visual.title,topic.id+' visual title')
    if(visual.kind==='bars'){
      assert(visual.unit&&visual.note&&visual.sources.length,topic.id+' chart provenance')
      assert(visual.rows.every(row=>Number.isFinite(row.value)&&row.value>=0&&row.label&&(!row.place||cardIds.has(row.place))),topic.id+' chart rows')
    }else if(visual.kind==='comparison')assert(visual.columns.length>=2&&visual.rows.every(row=>row.length===visual.columns.length&&row.every(Boolean)),topic.id+' comparison dimensions')
    else assert(visual.kind==='plates'&&visual.note,topic.id+' process diagram')
  }
}
const elevation=read('public/elevation/source.json')
let elevationHashes=0
for(const region of elevation.regions){
  for(const tile of region.tiles){
    assert.equal(createHash('sha256').update(fs.readFileSync('public/elevation/'+tile.path)).digest('hex'),tile.sha256,tile.path);elevationHashes++
  }
  assert.equal(createHash('sha256').update(fs.readFileSync('public/elevation/'+region.grid.path)).digest('hex'),region.grid.sha256,region.grid.path);elevationHashes++
}
assert.equal(elevationHashes,87)
console.log('Verified '+learningHashes+' learning artifact hashes, 60 monthly series, 228 religion records, 30 detailed climate notes and '+elevationHashes+' elevation artifacts.')

const content=read('public/data/content-sources.json')
assert.equal(content.contentCount,knowledge.length)
assert.equal(content.climateNoteCount,notes.length)
assert.equal(content.topicCount,read('src/data/topics.json').length)
const sourceUrls=new Set(content.sources.map(s=>s.url))
assert.equal(sourceUrls.size,content.sourceCount)
for(const source of content.sources.filter(source=>source.review)){
  for(const field of ['accessedAt','version','license','processing'])assert(source.review[field],source.url+' review '+field)
  assert(source.review.claims?.length,source.url+' reviewed claims')
}
for(const card of knowledge)for(const source of card.sources)assert(sourceUrls.has(source.url),card.id+' missing source manifest URL')
for(const note of notes)for(const source of note.sources)assert(sourceUrls.has(source.url),note.code+' missing source manifest URL')
for(const topic of read('src/data/topics.json'))for(const source of topic.sources)assert(sourceUrls.has(source.url),topic.id+' missing source manifest URL')
const coverage=read('data/research/curriculum-coverage.json')
assert.equal(coverage.contentCount,knowledge.length)
for(const topic of coverage.coverage){
  for(const id of topic.cardIds)assert(cardIds.has(id),topic.id+' coverage card '+id)
  for(const id of topic.topicIds)assert(read('src/data/topics.json').some(t=>t.id===id),topic.id+' coverage topic '+id)
  assert(['selected','partial','future'].includes(topic.status))
}
console.log('Verified '+sourceUrls.size+' unique content sources and '+coverage.coverage.length+' curriculum coverage records with explicit remaining gaps.')

const onlineSources=read('public/data/online-map-sources.json')
assert.equal(content.onlineMapSourceManifest,'/data/online-map-sources.json')
assert.equal(fs.readFileSync('public/data/online-map-sources.json','utf8'),fs.readFileSync('data/research/online-map-sources.json','utf8'),'Online source manifest copies diverge')
assert(onlineSources.versionPolicy && onlineSources.validation.method && onlineSources.validation.limitations)
const onlineCode=fs.readFileSync('src/lib/online-map.ts','utf8')
assert.deepEqual(onlineSources.services.map(s=>s.id),['openfreemap-detail','mapterhorn-terrain'])
for(const source of onlineSources.services){
  assert(source.version && source.license && source.processing && source.quality,source.id+' provenance')
  for(const key of ['metadataUrl','documentationUrl','attributionUrl'])assert(/^https:\/\//.test(source[key]),source.id+' '+key)
  assert(onlineCode.includes(source.metadataUrl),source.id+' runtime endpoint diverges')
}
assert.equal(onlineSources.services[0].maximumSourceZoom,14)
assert.equal(onlineSources.services[1].encoding,'terrarium')
assert.equal(onlineSources.services[1].tileSize,512)
assert.equal(onlineSources.services[1].maximumSourceZoom,12)
assert.equal(onlineSources.services[1].exaggeration,1)
assert.equal(onlineSources.validation.packageLimitBytes,100_000_000)
console.log('Verified 2 optional online map sources with matching public/research provenance manifests.')

const auxiliary=read('public/data/auxiliary-sources.json')
assert.equal(content.auxiliarySourceManifest,'/data/auxiliary-sources.json')
assert.equal(fs.readFileSync('public/data/auxiliary-sources.json','utf8'),fs.readFileSync('data/research/auxiliary-sources.json','utf8'))
assert(auxiliary.versionPolicy&&auxiliary.validation.method&&auxiliary.validation.limitations)
assert(!auxiliary.sources.some(source=>source.id==='hydrobasins-l3'),'Legacy HydroBASINS source must not be bundled')
const basinSource=auxiliary.sources.find(source=>source.id==='basinatlas-l3')
assert(basinSource&&basinSource.license==='CC BY 4.0'&&basinSource.licenseUrl==='https://creativecommons.org/licenses/by/4.0/','BasinATLAS original licence')
assert.deepEqual(basinSource.selectedFields,['HYBAS_ID','PFAF_ID','NEXT_DOWN','SUB_AREA','ENDO'])
assert.equal(content.basinDataSource.id,basinSource.id)
assert.equal(content.basinDataSource.dataset,basinSource.version.split(';')[0])
assert.equal(content.basinDataSource.doi,basinSource.doi)
assert.equal(content.basinDataSource.license,basinSource.license)
const basinLock=read('scripts/basin-atlas-inputs.lock.json')
assert.deepEqual(basinSource.archive,basinLock.archive,'BasinATLAS pinned official archive')
assert.deepEqual(basinSource.licenseReview,basinLock.licenseReview,'BasinATLAS reviewed licence evidence')
assert.equal(basinSource.inputs.length,4)
for(const input of basinSource.inputs)assert(basinLock.members.some(member=>member.path===input.path&&member.sha256===input.sha256&&member.crc32===input.crc32),'BasinATLAS fixed member')
const auxiliaryIds=new Set()
for(const source of auxiliary.sources){
  assert(source.version&&source.license&&source.processing&&source.documentationUrl,source.id+' provenance')
  assert(source.inputs.length&&source.inputs.every(input=>/^[a-f0-9]{64}$/.test(input.sha256)&&input.path.startsWith('data/raw/')),source.id+' fixed input hashes')
  for(const output of source.outputs){
    const path='public'+output.path,buffer=fs.readFileSync(path)
    assert.equal(createHash('sha256').update(buffer).digest('hex'),output.sha256,path)
    const rows=JSON.parse(buffer).features;assert.equal(rows.length,output.features)
    for(const feature of rows){
      assert(!auxiliaryIds.has(feature.properties.id));auxiliaryIds.add(feature.properties.id)
      assert(feature.geometry.coordinates.length&&feature.properties.sourceId===source.id)
      if(source.id==='natural-earth-cities')assert(feature.geometry.type==='Point'&&typeof feature.properties.capital==='boolean')
      if(source.id==='basinatlas-l3'){
        assert(feature.properties.level===3&&feature.properties.areaKm2>0&&/^basin-hybas-\d+$/.test(feature.properties.id))
        assert.deepEqual(Object.keys(feature.properties).sort(),['id','name','nameEn','kind','hybasId','pfafId','level','areaKm2','endorheic','nextDown','center','color','sourceId'].sort(),'Only reviewed basin fields and presentation properties may be published')
      }
      if(source.id==='usgs-plates')assert(['convergent','divergent','transform','other'].includes(feature.properties.boundaryType))
    }
  }
}
const introReview=read('public/data/topic-intro-review.json'),introTopics=read('src/data/topics.json')
assert.equal(fs.readFileSync('public/data/topic-intro-review.json','utf8'),fs.readFileSync('data/research/topic-intro-review.json','utf8'))
assert.equal(introReview.outputSha256,createHash('sha256').update(fs.readFileSync('src/data/topics.json')).digest('hex'))
assert.deepEqual(introReview.topics.map(entry=>entry.id),introTopics.map(topic=>topic.id))
for(const entry of introReview.topics)assert.deepEqual(entry.modulesReviewed,introTopics.find(t=>t.id===entry.id).modules.map(m=>m.id))
console.log('Verified 3 versioned auxiliary layers, '+auxiliaryIds.size+' real features, and review coverage for all 40 themes / 122 modules.')

const themeSources=read('public/data/theme-sources.json')
assert.equal(content.themeSourceManifest,'/data/theme-sources.json')
assert.equal(fs.readFileSync('public/data/theme-sources.json','utf8'),fs.readFileSync('data/research/theme-sources.json','utf8'),'Theme source manifests diverge')
assert(themeSources.version&&themeSources.license&&themeSources.processing&&themeSources.validation.method&&themeSources.validation.limitations)
const summits=read('public/data/theme-peaks.geojson').features
const expectedEntities=['Q513','Q43512','Q82019','Q168702','Q169986','Q170089','Q165440','Q170070','Q130736','Q16466024','Q187138','Q180996','Q186853','Q105124']
assert.deepEqual(themeSources.inputs.map(input=>input.entityId),expectedEntities)
assert.equal(summits.length,14)
for(const input of themeSources.inputs){
  assert(input.version&&input.license&&/^[a-f0-9]{64}$/.test(input.sha256)&&input.coordinatePrecisionDegrees>0,input.entityId+' versioned input')
  const feature=summits.find(feature=>feature.properties.id==='peak-wikidata-'+input.entityId.toLowerCase())
  assert(feature&&feature.geometry.type==='Point',input.entityId+' explicit reference point')
  const [lng,lat]=feature.geometry.coordinates
  assert(Number.isFinite(lng)&&Number.isFinite(lat)&&lng>=74&&lng<=89&&lat>=27&&lat<=37,input.entityId+' coordinates')
  const card=knowledge.find(card=>bindings[card.id]?.includes(feature.properties.id))
  assert(card&&card.coordinates.every((value,index)=>Math.abs(value-feature.geometry.coordinates[index])<.000001),input.entityId+' card agrees with bound point')
}
for(const output of themeSources.outputs)assert.equal(createHash('sha256').update(fs.readFileSync(output.path)).digest('hex'),output.sha256,output.path)
assert.deepEqual(bindings['yangtze-middle-lower-plain'],[])
console.log('Verified '+read('src/data/topics.json').length+' single-selection themes and 14 explicitly bound summit points with versioned source metadata and artifact hash.')

const languageAreaSources=read('public/data/language-area-sources.json')
assert.equal(fs.readFileSync('public/data/language-area-sources.json','utf8'),fs.readFileSync('data/research/language-area-sources.json','utf8'),'Language area source manifests diverge')
assert.equal(content.languageAreaSourceManifest,'/data/language-area-sources.json')
for(const artifact of languageAreaSources.artifacts){
  const buffer=fs.readFileSync('public'+artifact.path)
  assert.equal(createHash('sha256').update(buffer).digest('hex'),artifact.sha256,artifact.path)
}
const languageAreas=read('public/data/language-areas.geojson'),languageAreaMeta=read('public/data/language-areas-meta.json')
const languagePoints=new Map(read('public/data/learning-languages.geojson').features.map(feature=>[feature.properties.glottocode,feature]))
assert.equal(languageAreas.features.length,4033)
assert.equal(languageAreaMeta.languageCount,languageAreas.features.length)
assert.equal(languageAreaMeta.languageLevelOnly,true)
assert.equal(languageAreaMeta.fromReferencePoints,false)
assert.equal(languageAreaMeta.period,'2007')
const familyCounts=new Map(),areaIds=new Set()
for(const feature of languageAreas.features){
  const p=feature.properties,reference=languagePoints.get(p.glottocode)
  assert(['Polygon','MultiPolygon'].includes(feature.geometry.type),p.id+' language area geometry')
  assert(reference,p.id+' no exact Glottocode join')
  assert.equal(p.id,'language-area-'+p.glottocode)
  assert.equal(p.languageId,reference.properties.id)
  assert.equal(p.familyId,reference.properties.familyId)
  assert.deepEqual(p.center,reference.geometry.coordinates)
  assert.equal(p.centerSourceId,'glottolog-5.3')
  assert(!areaIds.has(p.id));areaIds.add(p.id)
  familyCounts.set(p.familyId,(familyCounts.get(p.familyId)||0)+1)
}
assert.equal(languageAreaMeta.familyCount,familyCounts.size)
for(const family of languageAreaMeta.families)assert.equal(family.count,familyCounts.get(family.id),family.id+' area family count')
for(const path of ['data/research/language-area-validation.json','data/research/language-area-independent-validation.json'])assert.equal(read(path).valid,true,path)
assert.equal(read('data/research/language-area-independent-validation.json').sha256,languageAreaMeta.sha256)
assert(languageAreaMeta.note.includes('2007')&&languageAreaMeta.note.includes('重叠')&&languageAreaMeta.note.includes('空白'))
console.log(`Verified ${languageAreas.features.length} language areas, ${familyCounts.size} families, exact point joins, versioned hashes and independent geometry validation.`)

const languageOverview=read('public/data/language-overview.json'),overviewSources=read('public/data/language-overview-sources.json')
assert.deepEqual(overviewSources,read('data/research/language-overview-sources.json'))
assert.equal(content.languageOverviewSourceManifest,'/data/language-overview-sources.json')
for(const artifact of overviewSources.artifacts)assert.equal(createHash('sha256').update(fs.readFileSync('public'+artifact.path)).digest('hex'),artifact.sha256)
for(const input of overviewSources.localInputs)assert.equal(createHash('sha256').update(fs.readFileSync(input.path)).digest('hex'),input.sha256)
const overviewCategories=new Map(languageOverview.categories.map(category=>[category.id,category]))
const overviewCountryIds=new Set(read('public/data/countries.geojson').features.map(feature=>feature.properties.id))
assert.equal(new Set(languageOverview.countries.map(country=>country.countryId)).size,overviewCountryIds.size)
for(const country of languageOverview.countries){
  assert(overviewCountryIds.has(country.countryId))
  if(!country.displayId){assert.equal(country.selectionBasis,'missing');continue}
  assert(overviewCategories.has(country.displayId))
  const official=country.languages.filter(language=>['official','de_facto_official'].includes(language.status))
  const candidates=official.length?official:country.languages
  const highest=Math.max(...candidates.map(language=>language.populationPercent))
  assert(candidates.some(language=>language.displayId===country.displayId&&language.populationPercent===highest))
}
for(const category of languageOverview.categories)for(const code of category.members)assert(languagePoints.has(code),code+' exact overview join')
assert.equal(languageOverview.countries.find(country=>country.countryId==='country-chn').displayId,'group:zh')
for(const code of ['mand1415','yuec1235','hain1238','minn1241'])assert(overviewCategories.get('group:zh').members.includes(code))
for(const code of ['hlai1239','tibe1272','uigh1240'])assert(!overviewCategories.get('group:zh').members.includes(code))
assert(fs.readFileSync('public/licenses/Unicode-3.0.txt','utf8').includes('UNICODE LICENSE V3'))
console.log(`Verified CLDR country overview: ${languageOverview.countries.filter(country=>country.displayId).length} mapped countries, exact language groups, provenance and license.`)
