import rawTopics from '../data/topics.json'
import bindings from '../data/feature-bindings.json'
import {knowledge} from './catalog'
import {singleOverlay} from './theme-state'
import type {LayerState,Topic,TopicGroup,TopicScope} from '../types'

export const topics=rawTopics as Topic[]
export const topicGroups: {id:TopicGroup;name:string;description:string}[]=[
  {id:'regions',name:'区域认识',description:'中国地理分区、省区与世界各洲'},
  {id:'landforms',name:'地形地貌',description:'高原、平原、盆地与山峰'},
  {id:'water',name:'河流湖海',description:'水系、湖泊与海洋通道'},
  {id:'climate',name:'气候环境',description:'气候类型与自然环境'},
  {id:'people',name:'人口文化',description:'人口、宗教与语言资料'},
  {id:'resources',name:'资源与交通',description:'农业、能源、产业与交通联系'},
  {id:'earth',name:'地球与地图',description:'昼夜季节、经纬位置与地图阅读'},
]
export const topicKindNames={collection:'认识一组地方',distribution:'观察一种分布',connections:'理解地理联系'}
export function topicsForScope(scope:TopicScope,group:TopicGroup|'all'='all') {
  return topics.filter(topic=>(scope==='all'||topic.shared||topic.region===scope)&&(group==='all'||topic.group===group))
}
export function topicLayers(layers:LayerState,topic:Topic|null):LayerState {
  const next=singleOverlay(layers,topic?.overlay||null)
  if(topic)for(const key of topic.layers)if(key in next&&!['climate','population','religion','language'].includes(key))next[key as keyof LayerState]=true
  return next
}
export function topicMapMembers(topic:Topic):string[] {
  if(topic.kind==='distribution')return []
  return topic.stops.filter(id=>{
    const card=knowledge.find(card=>card.id===id)
    return !!card&&card.mapRole!=='concept'&&(!['climate','population','religion','language'].includes(card.category)||(bindings as Record<string,string[]>)[id]?.length>0)
  })
}
export function topicForSelection(id:string|null|undefined) {
  const aliases:Record<string,string>={'world-mountains':'world-mountain-ranges','world-lake-origins':'world-lakes','world-population-scales':'map-population','world-culture-evidence':'map-religion'}
  return topics.find(topic=>topic.id===(id&&aliases[id]||id))||null
}
