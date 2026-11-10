import fs from 'node:fs'
import assert from 'node:assert/strict'

export const readingEditDirectory='data/reading/edited-topics'

// Copy editing may change prose, but must not silently change the evidence,
// geography, illustration links or stable chapter addresses of an article.
export function applyReadingEdits(topics,articles){
  const paths=fs.readdirSync(readingEditDirectory).filter(name=>name.endsWith('.json')).sort().map(name=>`${readingEditDirectory}/${name}`)
  const editedIds=new Set()
  for(const path of paths){
    const edited=JSON.parse(fs.readFileSync(path,'utf8'))
    assert.equal(path,`${readingEditDirectory}/${edited.id}.json`)
    assert(!editedIds.has(edited.id),'Duplicate editorial input')
    const index=articles.findIndex(article=>article.id===edited.id)
    assert(index>=0,'Unknown editorial topic '+edited.id)
    const original=articles[index]
    const articleIdentity=({introduction,sections,parts,questions,presentation,updatedAt,...identity})=>identity
    const sectionIdentity=({title,paragraphs,mediaIds,visuals,...identity})=>identity
    const partIdentity=({description,...identity})=>identity
    assert.deepEqual(articleIdentity(edited),articleIdentity(original),edited.id+' metadata and sources preserved')
    assert.deepEqual(edited.sections.map(sectionIdentity).sort((a,b)=>a.id.localeCompare(b.id)),original.sections.map(sectionIdentity).sort((a,b)=>a.id.localeCompare(b.id)),edited.id+' chapter addresses and map cases preserved')
    assert.deepEqual(edited.parts?.map(partIdentity).sort((a,b)=>a.id.localeCompare(b.id)),original.parts?.map(partIdentity).sort((a,b)=>a.id.localeCompare(b.id)),edited.id+' reading groups preserved')
    assert.equal(edited.questions.length,original.questions.length,edited.id+' review questions preserved')
    assert(edited.introduction.trim()&&edited.sections.every(section=>section.title.trim()&&section.paragraphs.length&&section.paragraphs.every(p=>typeof p==='string'&&p.trim().length>=20)),edited.id+' complete authored prose')
    const placedMedia=edited.sections.flatMap(section=>section.mediaIds||[])
    assert.equal(new Set(placedMedia).size,placedMedia.length,edited.id+' each figure appears once')
    for(const mediaId of new Set(original.sections.flatMap(section=>section.mediaIds||[])))assert(placedMedia.includes(mediaId),edited.id+' existing figure retained '+mediaId)
    assert.equal(edited.presentation,'essay',edited.id+' continuous article presentation')
    const topic=topics.find(topic=>topic.id===edited.id)
    topic.sections=edited.sections.filter(section=>!section.id.startsWith('part-')&&!section.caseIds?.length).slice(0,4).map(section=>({title:section.title,body:section.paragraphs.join('')}))
    topic.question=edited.questions[0].question
    topic.takeaway=edited.questions[0].answer
    for(const module of topic.modules||[]){
      const part=edited.parts?.find(part=>module.id.startsWith(part.id+'-'))
      const sectionId=part?part.id+'-module-'+module.id.slice(part.id.length+1):'module-'+module.id
      const section=edited.sections.find(section=>section.id===sectionId)
      assert(section,edited.id+' authored module '+module.id)
      module.description=section.paragraphs[0]
      module.detail=section.paragraphs.slice(1).join('')||undefined
    }
    articles[index]=edited
    topic.description=edited.introduction
    if(edited.parts)topic.reading.parts=structuredClone(edited.parts)
    topic.reading.minutes=Math.max(4,Math.round(edited.sections.reduce((n,s)=>n+s.paragraphs.join('').length,0)/320))
    topic.reading.highlights=[...edited.sections.slice(0,2).map(s=>s.paragraphs[0].split('。')[0]+'。'),edited.questions[0].answer]
    editedIds.add(edited.id)
  }
  assert.deepEqual(editedIds,new Set(topics.map(t=>t.id)),'Every topic has a reviewed authored article')
  return paths
}
