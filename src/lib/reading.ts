import rawMedia from '../data/reading-media.json' with {type:'json'}
import type {ReadingMedia, ReadingProgress} from '../types'

export const readingMedia=rawMedia as ReadingMedia[]
export const mediaById=new Map(readingMedia.map(item=>[item.id,item]))
export const readingId=(value:unknown):value is string=>typeof value==='string'&&/^[a-z][a-z0-9-]{0,79}$/.test(value)
// Browsers may snapshot history.state before pagehide during a reload. Keep the
// final scroll capture in tab-local storage, tied to that exact history entry.
export function saveReadingResume(entryId:unknown,topicId:string,progress:ReadingProgress){
  if(typeof entryId!=='string')return
  try{sessionStorage.setItem('terra-atlas-reading-resume-v1',JSON.stringify({entryId,topicId,progress}))}catch{/* History and saved preferences remain available. */}
}
export function loadReadingResume(entryId:unknown,topicId:string|null|undefined):ReadingProgress|undefined{
  if(typeof entryId!=='string'||!topicId)return
  try{
    const saved=JSON.parse(sessionStorage.getItem('terra-atlas-reading-resume-v1')||'null')
    if(saved?.entryId===entryId&&saved?.topicId===topicId)return parseReadingProgress({[topicId]:saved.progress})[topicId]
  }catch{/* Storage may be unavailable or contain an older record. */}
}
export function parseReadingProgress(value:unknown):Record<string,ReadingProgress>{
  if(!value||typeof value!=='object'||Array.isArray(value))return {}
  return Object.fromEntries(Object.entries(value).filter(([id,p])=>readingId(id)&&p&&typeof p==='object'&&readingId((p as ReadingProgress).sectionId)&&Number.isFinite((p as ReadingProgress).offset)&&Number.isFinite((p as ReadingProgress).updatedAt)).slice(-200).map(([id,p])=>{
    const item=p as ReadingProgress
    return [id,{sectionId:item.sectionId,offset:Math.max(0,Math.min(1,item.offset)),updatedAt:Math.max(0,item.updatedAt)}]
  }))
}
