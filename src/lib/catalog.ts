import raw from '../data/knowledge.json'
import bindings from '../data/feature-bindings.json'
import type { Category, Knowledge, GeoProperties } from '../types'
import {createFeatureCardIndex,createSearchIndex} from './search'
export const knowledge = raw as Knowledge[]
const featureCards = createFeatureCardIndex(knowledge, bindings)
export const curatedSearchIndex = createSearchIndex(knowledge, k => [k.name.split('：')[0], k.name, k.englishName, ...k.aliases, ...(k.tags || [])])
export const categoryInfo: Record<Category, { name: string; color: string; description: string }> = {
  mountains: { name: '山脉', color: '#846848', description: '观察山脉的走向与地形分界' },
  terrain: { name: '地形', color: '#63816b', description: '认识高原、平原、盆地与沙漠' },
  rivers: { name: '河流', color: '#387f9e', description: '沿水系寻找源头、支流与入海口' },
  lakes: { name: '湖泊', color: '#508b9b', description: '探索水域及其不同的形成过程' },
  climate: { name: '气候', color: '#b28a48', description: 'Köppen–Geiger · 1991–2020' },
  population: { name: '人口', color: '#aa6643', description: '人口分布、迁移与聚落' },
  religion: { name: '宗教', color: '#9070a3', description: '宗教文化与国家统计概览' },
  language: { name: '语言', color: '#597ba5', description: '语种、语系与语言多样性' },
  regions: { name: '区域', color: '#688768', description: '中国省区与世界国家、区域' },
  human: { name: '人文', color: '#a08057', description: '聚落、农业、工业与交通' },
}
export function matchCard(p: GeoProperties): Knowledge | undefined {
  return featureCards.get(p.id)
}
export function dataCard(p: GeoProperties, coordinates: [number, number], source: string): Knowledge {
  if(['cities','basins','plates'].includes(source)){
    const descriptions={cities:'代表城市定位点；较大深色点表示源版本记录的首都。',basins:'BasinATLAS第3级汇水分区数据概览，含沿海汇水分组；未逐一编写命名河流解读。',plates:'USGS公开资料中的概化板块边界数据概览。'}
    const geometryNotes={cities:'来自Natural Earth固定版本，首都标记并非实时迁都状态；点位不表示城区或行政辖区范围。',basins:'概化的汇水分区边界，不能视为精确山脊。部分单元为沿海分组，未必等于一条命名河流的完整流域；北纬60°以北资料较粗，南极未覆盖。',plates:'全球尺度边界，不表示局地精确断层、实时地震活动或风险。汇聚类别没有进一步划分碰撞与俯冲。'}
    const key=source as keyof typeof descriptions
    const facts=source==='cities'?[{label:'所在国家／地区（源记录）',value:String(p.country)},{label:'首都标记（源版本）',value:p.capital?'是':'否'}]:source==='basins'?[{label:'HYBAS_ID',value:String(p.hybasId)},{label:'分级',value:'第3级'},{label:'源分区面积',value:Number(p.areaKm2).toLocaleString('zh-CN')+' km²'},{label:'Pfafstetter编码',value:String(p.pfafId)}]:[{label:'边界类型',value:p.name},{label:'资料模型',value:'USGS · Bird (2003) PB2002'}]
    const sources=source==='cities'?[{title:'Natural Earth · 代表聚落',url:'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/'}]:source==='basins'?[{title:'HydroATLAS · BasinATLAS v1.0',url:'https://www.hydrosheds.org/hydroatlas'}]:[{title:'USGS · 板块边界数据与归属',url:'https://earthquake.usgs.gov/arcgis/rest/services/eq/map_plateboundaries/MapServer'}]
    return {id:p.id,name:p.name,englishName:p.nameEn,aliases:[],category:source==='cities'?'human':'terrain',coordinates,summary:descriptions[key],location:'定位参考：'+coordinates[1].toFixed(2)+'°，'+coordinates[0].toFixed(2)+'°。',formation:geometryNotes[key],connections:source==='cities'?['结合河流与地形，观察聚落的位置。']:source==='basins'?['叠加河流，看分区中的干支流连接。']:['结合山脉和火山案例，比较不同边界类型。'],facts,geometryNote:geometryNotes[key],sources}
  }
  const languageArea=source==='language-areas'
  const category: Category = languageArea || source === 'languages' || source === 'learning-languages' ? 'language' : source === 'countries' || source === 'provinces' ? 'regions' : source === 'rivers' ? 'rivers' : source === 'lakes' ? 'lakes' : source === 'peaks' || p.kind === 'peak' || p.kind === 'mountain' || p.subkind?.toLowerCase().includes('mountain') ? 'mountains' : 'terrain'
  const explanations: Record<string, string> = {
    rivers: '河流在重力作用下沿地表低处流动。流域内的降水、融雪和地下水补给，经过支流汇集，形成水系；水系的具体形态还受到地形和岩性影响。',
    lakes: '湖泊是陆地洼地中积聚的水体。不同湖泊可由构造、冰川、河流或火山等过程形成；仅凭轮廓不能判断这个湖泊的具体成因。',
    terrain: '这里显示的是 Natural Earth 的自然地理标注。地形是地质构造与风化、流水、冰川等外力长期共同作用的结果；具体地区的成因需要结合当地地质资料。',
    peaks: '山峰是山地中的局部高点。山峰形态通常与地质构造、岩性及流水、冰川、风化等长期作用有关；仅凭定位点不能判定这座山峰的具体形成过程。',
    countries: '国家轮廓用于辅助定位。自然地理过程往往跨越行政边界；可以叠加地形、水系与气候图层，观察这个地区与周围环境的联系。',
    provinces: '省级范围帮助建立中国的区域位置感。行政区与山系、流域、气候区的范围并不相同，可以叠加图层比较这些界线。',
    languages: '这是 Glottolog 记录的一种语言的地理参考点。语言会随迁移、交流与社会变化传播；一个点不能表示它的精确使用范围、使用人数或所有使用者的位置。',
  }
  const card:Knowledge={
    id: String(p.id), name: p.name || p.nameEn || (source === 'lakes' ? '未命名湖泊' : '未命名地理对象'), englishName: p.nameEn || 'Natural Earth geographic feature', aliases: [], category, coordinates,
    summary: category==='language' ? `${String(p.family||p.familyEn||'未分类')}语系的语言参考点。探索附近语言，观察语言多样性与国家范围的区别。` : category==='regions' ? '区域数据概览。可以结合人口密度、宗教构成与语言参考点，认识自然环境和人文地理的联系。' : source === 'peaks' ? '山峰定位点概览。你可以观察它所在的山地，以及周围水系和气候的空间关系。' : '自然地理数据概览。你可以观察它与周围地形、水系及气候的空间关系。',
    location: `${source === 'peaks' ? '山峰' : ''}定位参考点：${coordinates[1].toFixed(2)}°，${coordinates[0].toFixed(2)}°。${category==='language'?'名称与位置来自 Glottolog 5.3。':'名称与几何来自 Natural Earth。'}`,
    formation: explanations[source] || (category==='language'?explanations.languages:explanations.terrain),
    connections: ['打开地形与河流图层，观察地势和水系的关系。', '叠加气候图层，比较周围地区的长期温度与降水类型。'],
    facts: category==='language'?[{label:'语系',value:String(p.family||p.familyEn||'未分类')},{label:'Glottocode',value:String(p.glottocode||p.id)},{label:'ISO 639-3',value:String(p.iso6393||'未列出')}]:[{label: '内容类型', value: '数据概览 · 尚无专门地区解读'}],
    geometryNote: category==='language'?'语言地理参考点，不能视为使用人口或连续分布边界。':source === 'peaks' ? '山峰以 Natural Earth 定位点表示，不代表山体范围或实地测量精度。' : source === 'regions' ? '自然区域图形是制图标注参考范围，不代表严格的地貌边界。' : '全球尺度的概化地理数据，放大后不代表实地测量精度。',
    sources: category==='language'?[{title:'Glottolog · 语言参考点与语系',url:'https://glottolog.org/meta/downloads'}]:[{title: source === 'peaks' ? 'Natural Earth · 山峰定位点' : source==='countries'||source==='provinces'?'Natural Earth · 区域参考范围':'Natural Earth · 自然地理矢量数据', url: source==='countries'?'https://www.naturalearthdata.com/downloads/50m-cultural-vectors/':source==='provinces'?'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/':'https://www.naturalearthdata.com/downloads/10m-physical-vectors/'}],
  }
  if(languageArea)return {...card,
    summary:`${p.name||p.nameEn}的语言区域数据概览。范围依据2007年《世界语言地图集》，归属${String(p.family||p.familyEn||'未分类')}；区域可以重叠，也有资料未覆盖的地区。`,
    location:`Glottography按2007年图集数字化的语言参考范围。定位坐标来自Glottolog 5.3：${coordinates[1].toFixed(2)}°，${coordinates[0].toFixed(2)}°。`,
    formation:'语言范围受历史迁移、交流与社会变化影响。图集所绘范围是区域尺度的语言使用参考，部分地区的多语言共存欠表示；色块无法说明每位居民的母语、第二语言或人数比例。',
    facts:[{label:'语系',value:String(p.family||p.familyEn||'未分类')},{label:'Glottocode',value:String(p.glottocode)},{label:'资料时期',value:'2007图集参考范围'}],
    geometryNote:'概化的语言使用参考范围，不是最新人口调查或精确边界。未着色不代表没有语言，单色不代表当地只使用一种语言。',
    sources:[{title:'Glottography · 2007图集语言使用范围',url:'https://doi.org/10.5281/zenodo.18613195'},{title:'语言区域数字化与验证方法',url:'https://www.nature.com/articles/s41597-025-05828-6'},{title:'Glottolog · 语言名称与语系',url:'https://glottolog.org/meta/downloads'}],
  }
  return card
}
