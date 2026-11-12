import raw from '../data/topic-redirects.json' with {type:'json'}
import type {ReadingProgress} from '../types'
type Destination={topicId:string;sectionId?:string}
const redirects=raw as Record<string,Destination&{chapters:Record<string,Destination>}>
export function resolveTopicReference(topicId:string,sectionId?:string):Destination{
  const entry=Object.hasOwn(redirects,topicId)?redirects[topicId]:undefined
  // The retired review block has no article content of its own. Old shares and
  // saved progress open the overview instead of an absent chapter.
  const readable=(target:Destination):Destination=>target.sectionId==='questions'?{...target,sectionId:'introduction'}:target
  if(!entry)return readable({topicId,sectionId})
  const chapter=sectionId&&Object.hasOwn(entry.chapters,sectionId)?entry.chapters[sectionId]:undefined
  if(chapter)return readable(chapter)
  // New chapters of the retained foundations ID already have canonical IDs.
  return readable({topicId:entry.topicId,sectionId:sectionId||entry.sectionId})
}
export function migrateReadingProgress(progress:Record<string,ReadingProgress>){
  const result:Record<string,ReadingProgress>={}
  for(const [id,value] of Object.entries(progress)){
    const target=resolveTopicReference(id,value.sectionId)
    if(!result[target.topicId]||result[target.topicId].updatedAt<value.updatedAt)
      result[target.topicId]={...value,sectionId:target.sectionId||value.sectionId,offset:target.sectionId===value.sectionId?value.offset:0}
  }
  return result
}
