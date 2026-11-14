import {MapPin} from 'lucide-react'
import {knowledge} from '../lib/catalog'
import './ReadingMapLinks.css'

const cards=new Map(knowledge.map(card=>[card.id,card]))

export default function ReadingMapLinks({ids,labels,onPick,title='本节地图',prefix='在地图上看 · '}:{
  ids:string[];labels?:Record<string,string>;onPick:(id:string)=>void;title?:string;prefix?:string;
}){
  const places=[...new Set(ids)].flatMap(id=>{const card=cards.get(id);return card?[card]:[]})
  if(!places.length)return null
  return <div className="reading-place-links" role="group" aria-label={title}>
    <span className="reading-place-label"><MapPin size={14}/>{title}</span>
    <div className="reading-place-items">{places.map(card=><button key={card.id} type="button" data-place-id={card.id} aria-label={labels?.[card.id]||prefix+card.name} title={card.name} onClick={()=>onPick(card.id)}>{labels?.[card.id]||card.name.split('：')[0]}</button>)}</div>
  </div>
}
