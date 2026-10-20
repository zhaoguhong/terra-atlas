// Rebuild versioned summit points without overwriting hand-authored learning content.
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
const read=path=>JSON.parse(fs.readFileSync(path,'utf8'))
const write=(path,value)=>fs.writeFileSync(path,JSON.stringify(value,null,2)+'\n')
const sha=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex')
const records=read('data/raw/themes/summits.json')
const expectedIds=['Q513','Q43512','Q82019','Q168702','Q169986','Q170089','Q165440','Q170070','Q130736','Q16466024','Q187138','Q180996','Q186853','Q105124']
const knowledge=read('src/data/knowledge.json'),bindings=read('src/data/feature-bindings.json')
assert.deepEqual(records.map(record=>record.id),expectedIds)
const features=records.map(record=>{
  assert.equal(sha('data/raw/themes/'+record.id+'.json'),record.sha256,record.id+' input checksum')
  assert(record.coordinates.length===2&&record.coordinates.every(Number.isFinite))
  assert(record.coordinates[0]>73&&record.coordinates[0]<89&&record.coordinates[1]>27&&record.coordinates[1]<37)
  const id='peak-wikidata-'+record.id.toLowerCase()
  const card=knowledge.find(card=>bindings[card.id]?.includes(id))
  assert(card,record.id+' must have an explicitly bound authored card')
  const coordinates=record.coordinates.map(value=>Math.round(value*1e6)/1e6)
  card.coordinates=coordinates
  return {type:'Feature',id,geometry:{type:'Point',coordinates},properties:{id,name:card.name,nameEn:card.englishName,aliases:[record.label],kind:'peak',subkind:'summit',center:coordinates,bbox:[...coordinates,...coordinates],rank:1,minZoom:3,sourceId:'wikidata-classic-8000m-summits',wikidataId:record.id,inputRevision:record.revision,coordinatePrecisionDegrees:record.precisionDegrees,geometryNote:'开放数据库峰顶参考点，不表示山体范围或正式测量精度。'}}
})
write('public/data/theme-peaks.geojson',{type:'FeatureCollection',features})
write('src/data/knowledge.json',knowledge)
const manifest=read('data/research/theme-sources.json')
manifest.inputs=records.map(record=>({name:record.searchName,entityId:record.id,version:'Wikidata revision '+record.revision,url:record.inputUrl,sha256:record.sha256,license:'CC0 1.0',coordinatePrecisionDegrees:record.precisionDegrees}))
manifest.outputs=[{path:'public/data/theme-peaks.geojson',sha256:sha('public/data/theme-peaks.geojson')}]
write('data/research/theme-sources.json',manifest)
await import('./sync-content-manifests.mjs')
console.log('Rebuilt 14 checked summit points; authored cards, theme modules and introductions preserved.')
