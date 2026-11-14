import type {TopicArticle} from '../types'
import {knowledge} from './catalog'
import {mediaById} from './reading'

// These passages repeat destinations with dedicated explanations elsewhere
// in the same article. Keep the links beside those explanations. Repetitions
// serving different comparisons (rivers, climate, transport) remain intentional.
const overviewSections:Record<string,string[]>={
  'china-terrain':['china-relief-steps-module-high-plateau','china-relief-steps-module-plateaus-basins','china-relief-steps-module-eastern-lowlands'],
  'world-tectonics':['world-tectonics-module-opening','world-tectonics-module-convergence','world-tectonics-module-other-motion'],
  'map-population':['map-population-module-module-1','map-population-module-module-2','map-population-module-module-3'],
  'earth-map-reading':['earth-image-reading-module-case-earth-scale','earth-image-reading-module-case-earth-contours'],
}
const geographicPlaces=new Set(knowledge.filter(card=>card.mapRole!=='concept').map(card=>card.id))

export function sectionMapLinks(article:TopicArticle):Map<string,string[]>{
  const overviews=new Set(overviewSections[article.id]||[])
  const focused=new Set(article.sections.filter(section=>!overviews.has(section.id)&&section.caseIds?.length===1).flatMap(section=>section.caseIds!))
  return new Map(article.sections.map(section=>{
    // Only illustrations expose direct place links; a photo's collapsed inline
    // map is not a substitute for the chapter's immediately available link.
    const illustrated=new Set((section.mediaIds||[]).flatMap(id=>{
      const item=mediaById.get(id)
      return item?.kind==='illustration'?(item.placeIds||[]).filter(id=>geographicPlaces.has(id)):[]
    }))
    const charted=new Set((section.visuals||[]).flatMap(visual=>visual.kind==='bars'?visual.rows.flatMap(row=>row.place?[row.place]:[]):[]))
    return [section.id,[...new Set(section.caseIds||[])].filter(id=>!illustrated.has(id)&&!charted.has(id)&&!(overviews.has(section.id)&&focused.has(id)))]
  }))
}
