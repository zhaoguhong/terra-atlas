import {dataCard,knowledge} from './catalog'
import regionalCities from '../data/china-regional-cities.json'
import type {GeoProperties,Selection} from '../types'

const currentCards=new Map(knowledge.map(card=>[card.id,card]))
const currentRegionalCities=new Map((regionalCities as unknown as GeoProperties[]).map(city=>[city.id,city]))
// Only display metadata is needed before the lazily loaded country geometry.
// Source feature IDs and statistical scopes stay distinct from national bounds.
const chinaRecords:Record<string,GeoProperties>={
  'country-chn':{id:'country-chn',name:'中华人民共和国',nameEn:"People's Republic of China",kind:'country',center:[106.337289,32.498178],
    statisticsScopeNote:'本条沿用来源的中国大陆统计口径；台湾、香港、澳门资料按原来源分列，不将局部统计冒充全国合计。',
    geometryNote:'中国参考轮廓合并Natural Earth原有中国大陆、台湾、香港、澳门几何；原始地区ID保留用于分列资料，概化海岸与小岛覆盖不作为法定界线。'},
  'country-twn':{id:'country-twn',name:'中国台湾',nameEn:'Taiwan, China',kind:'region',center:[120.868204,23.652408],
    statisticsScopeNote:'中国台湾地区资料，沿用来源的统计范围与年份；地区分列不表示国家归属。',
    geometryNote:'中国地区资料的概化参考范围，沿用来源中的统计单元；台湾省、台湾岛与台湾地区统计范围分别说明，地区单独记录不表示独立国家。'},
  'country-hkg':{id:'country-hkg',name:'中国香港',nameEn:'Hong Kong, China',kind:'region',center:[114.097769,22.448829],
    statisticsScopeNote:'中国香港特别行政区资料，沿用来源的统计范围与年份。',
    geometryNote:'中国特别行政区的概化参考范围；地区资料按原来源分列，不表示独立国家。'},
  'country-mac':{id:'country-mac',name:'中国澳门',nameEn:'Macao, China',kind:'region',center:[113.556038,22.129735],
    statisticsScopeNote:'中国澳门特别行政区资料，沿用来源的统计范围与年份。',
    geometryNote:'中国特别行政区的概化参考范围；地区资料按原来源分列，不表示独立国家。'},
}

function coordinates(value:unknown):[number,number]|undefined {
  return Array.isArray(value)&&value.length===2&&value.every(v=>typeof v==='number'&&Number.isFinite(v))&&Math.abs(value[0])<=180&&Math.abs(value[1])<=90?[value[0],value[1]]:undefined
}

/** History stores navigation identity, never a permanent copy of lesson prose. */
export function rehydrateSelection(saved:Selection|null|undefined):Selection|null {
  if(!saved?.card||typeof saved.card.id!=='string')return null
  const current=currentCards.get(saved.card.id)
  if(current)return {...saved,card:{...current,coordinates:coordinates(saved.card.coordinates)||current.coordinates}}
  const city=currentRegionalCities.get(saved.card.id)
  if(city)return {...saved,card:dataCard({...city,geometryType:'Point'},coordinates(saved.card.coordinates)||city.center!,'cities')}
  const record=Object.hasOwn(chinaRecords,saved.card.id)?chinaRecords[saved.card.id]:undefined
  if(record)return {...saved,card:dataCard({...record,geometryType:'MultiPolygon',parentCountryId:'country-chn',parentCountryName:'中国'},coordinates(saved.card.coordinates)||record.center!,'countries')}
  return saved
}

export function rehydrateSelectionTrail(trail:Selection[]|undefined):Selection[] {
  return Array.isArray(trail)?trail.flatMap(saved=>{const current=rehydrateSelection(saved);return current?[current]:[]}):[]
}
