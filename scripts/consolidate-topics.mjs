import plan from '../data/reading/topic-plan.mjs'

const unique=items=>[...new Set(items)]
const sources=items=>[...new Map(items.map(item=>[item.url,item])).values()]

export function consolidateTopics(inputs,articles){
  const byId=new Map(inputs.map(topic=>[topic.id,topic]))
  const articleById=new Map(articles.map(article=>[article.id,article]))
  const owner=new Map()
  for(const group of plan)for(const id of group.from){
    if(owner.has(id)||!byId.has(id))throw new Error('Invalid topic consolidation input '+id)
    owner.set(id,group)
  }
  const topicIdFor=id=>owner.get(id)?.id||id
  const built=new Set(),topics=[],output=[]
  for(const input of inputs){
    const group=owner.get(input.id)
    if(!group){topics.push(structuredClone(input));output.push(structuredClone(articleById.get(input.id)));continue}
    if(built.has(group.id))continue
    built.add(group.id)
    const members=group.from.map(id=>byId.get(id)),first=members[0]
    const parts=members.map(t=>({id:t.id,title:t.title,sectionId:'part-'+t.id,description:t.description,keywords:t.reading.keywords}))
    const sections=members.flatMap(t=>[
      {id:'part-'+t.id,title:t.title,paragraphs:[t.description,t.takeaway,'看图时想一想：'+t.question],mediaIds:[t.reading.coverId],partId:t.id},
      ...articleById.get(t.id).sections.map(section=>({...section,id:t.id+'-'+section.id,partId:t.id})),
    ])
    const topic={...structuredClone(first),id:group.id,title:group.title,description:group.lead,group:group.group||first.group,
      shared:group.shared??first.shared,region:group.shared?'world':first.region,
      stops:unique(members.flatMap(t=>t.stops)),layers:unique(members.flatMap(t=>t.layers)),
      sections:members.flatMap(t=>t.sections.map(s=>({...s,title:t.title+' · '+s.title}))),
      modules:members.flatMap(t=>t.modules.map(m=>({...m,id:t.id+'-'+m.id,partTitle:t.title}))),
      sources:sources(members.flatMap(t=>t.sources)),visuals:members.flatMap(t=>t.visuals||[]),
      geometryNote:unique(members.map(t=>t.geometryNote).filter(Boolean)).join(' '),
      reading:{...first.reading,parts,keywords:unique(members.flatMap(t=>[t.title,...t.reading.keywords])),
        highlights:members.slice(0,3).map(t=>t.description),
        minutes:Math.max(4,Math.round(sections.reduce((sum,s)=>sum+s.paragraphs.join('').length,0)/320)),
        relatedTopicIds:unique(members.flatMap(t=>t.reading.relatedTopicIds))}}
    topics.push(topic)
    output.push({id:topic.id,title:topic.title,introduction:topic.description,updatedAt:articleById.get(first.id).updatedAt,
      parts,sections,questions:members.flatMap(t=>articleById.get(t.id).questions),
      sources:sources(members.flatMap(t=>articleById.get(t.id).sources))})
  }
  for(const topic of topics){
    topic.reading.relatedTopicIds=unique(topic.reading.relatedTopicIds.map(topicIdFor)).filter(id=>id!==topic.id&&topics.some(t=>t.id===id)).slice(0,4)
    // Main-topic prompts describe the whole collection; the original questions stay in the article.
    if(topic.reading.parts){topic.question='选择两个地点，比较它们的位置、形成过程和彼此联系。';topic.takeaway=topic.description}
  }
  return {topics,articles:output,topicIdFor}
}
