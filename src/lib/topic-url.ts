import type {MouseEvent} from 'react'
import {topics} from './topics'

export const homePath=import.meta.env.BASE_URL
export const topicsPath=homePath+'topics/'
export const topicPath=(id:string)=>topicsPath+id.replace(/^map-/,'')+'/'
export function topicRoute(pathname:string){
  const path=pathname.replace(/index\.html$/,'').replace(/\/?$/,'/')
  if(path===topicsPath)return {screen:'library' as const,topic:null}
  const topic=topics.find(topic=>topicPath(topic.id)===path)
  return topic?{screen:'article' as const,topic}:null
}
/** Preserve open-in-new-tab and browser link actions. */
export function followTopicLink(event:MouseEvent<HTMLAnchorElement>,action:()=>void){
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return
  event.preventDefault();action()
}
