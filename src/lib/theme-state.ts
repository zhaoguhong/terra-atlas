import type {LayerState,TopicOverlay} from '../types'

export const topicOverlays: TopicOverlay[] = ['climate','population','religion','language']
export const distributionIds: Record<TopicOverlay,string> = {
  climate:'map-climate',population:'map-population',religion:'map-religion',language:'map-language',
}
export function singleOverlay(layers:LayerState,overlay:TopicOverlay|null):LayerState {
  return {...layers,...Object.fromEntries(topicOverlays.map(key=>[key,key===overlay]))}
}
export function legacyTopic(layers:LayerState):string|null {
  const overlay=topicOverlays.find(key=>layers[key])
  return overlay?distributionIds[overlay]:null
}
export function validTopicReference(value:unknown,layers:LayerState):string|null {
  if(value===null)return null
  if(typeof value==='string'&&/^[a-z][a-z0-9-]{0,79}$/.test(value))return value
  return legacyTopic(layers)
}
