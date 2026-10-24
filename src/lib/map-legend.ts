import detailedClimate from '../../public/data/climate-legend.json' with {type:'json'}
import familyMetadata from '../../public/data/learning-language-families.json' with {type:'json'}
import {languageOverview,languageCategory,climateGroups,familyColor,languageColor,languageFamilies,majorLanguages,otherLanguageColor,otherLanguageLabel,thematicModes,type LanguageAreaMeta} from './map-presentation.ts'
import {getTopicPresentation,TOPIC_SELECTED_COLOR,type TopicMemberPresentation} from './topic-presentation.ts'
import type {LegendEntry,LegendSection,LegendSymbol} from '../components/MapLegend'
import type {HumanData} from './learning'
import type {LayerState,Selection,ThematicState,Topic} from '../types'

export function memberLegendSymbol(member:Pick<TopicMemberPresentation,'kind'|'symbol'>):LegendSymbol {
  if(member.kind==='reference'||member.kind==='point')return member.symbol==='◆'?'port':member.symbol==='■'?'city':member.symbol==='▲'?'peak':'point'
  return member.kind
}
interface Input {layers:LayerState;thematic:ThematicState;topic:Topic|null;selection:Selection|null;human:HumanData|null;languageMeta:LanguageAreaMeta|null}
export function buildMapLegend({layers,thematic,topic,selection,human,languageMeta}:Input):{title:string;subtitle?:string;sections:LegendSection[]} {
  const sections:LegendSection[]=[],modes=thematicModes(thematic)
  let title=topic?.title||'阅读地图',subtitle:string|undefined
  if(layers.population){
    title=topic?.kind==='distribution'?'人口密度 · 2020 · 人/km²':title
    subtitle='0.5°格网 · 2020 · 人/km²'
    sections.push({id:'population',title:'人口密度 · 2020 · 人/km²',entries:[['0–10','#f7eee1'],['10–50','#f5d4aa'],['50–200','#e9aa70'],['200–500','#d57745'],['500–1,000','#af452d'],['1,000–5,000','#79271f'],['5,000+','#4f1b21']].map(([label,color],index)=>({id:'density-'+index,label,color})),note:'各区间含下限、不含上限，第一档仅显示正值；零值与无资料都透明，点查可区分。密度按完整格网面积计算，包含格网内水域。'})
  }else if(layers.religion){
    const category=human?.religion.categories.find(category=>category.id===thematic.religion)
    const religionTitle=thematic.religion==='largest'?'国家宗教构成 · 已报告比例最高的类别':`国家宗教构成 · ${category?.name||'正在读取类别'}占比`
    title=topic?.kind==='distribution'?religionTitle:title;subtitle='国家资料 · 各条目年份与口径'
    sections.push({id:'religion',title:religionTitle,...(thematic.religion==='largest'?{entries:human?.religion.categories.map(category=>({id:category.id,label:category.name,color:category.color}))||[]}:{scale:{color:`linear-gradient(to right,#f4f1e8,${category?.color||'#786590'})`,stops:[0,.25,.5,.75,1].map(position=>({label:position*100+'%',position}))}}),note:'国家着色概括来源报告；条目时期不同，不能代表其内部每个地区或居民。未报告、无法确定最高类别或口径不可比处不着色。'})
  }else if(layers.climate){
    subtitle=`1991–2020 · 0.5° · ${modes.climateMode==='types'?'详细类型':'A–E五大类'}`
    sections.push({id:'climate',title:'长期气候分布',entries:modes.climateMode==='types'?detailedClimate.filter(category=>category.presentAtResolution).map(category=>({id:'action:climate:'+category.code,label:`${category.code} ${category.name}`,color:category.color})):climateGroups.map(group=>({id:'action:climate:'+group.id,label:group.id+' '+group.name,color:group.color})),note:'长期气候分类；色面与图例同步。C／D以最冷月0°C区分，无单列H类。详细分类共30类，其中Csc、Cwc在此尺度未出现。'})
  }else if(layers.language&&modes.languageMode==='overview'){
    title='世界语言概览';subtitle='国家主要通用语言 · CLDR 48'
    const categories=majorLanguages.filter(category=>languageOverview.countries.some(country=>country.displayId===category.id)&&(modes.languageId==='all'||modes.languageId===category.id))
    sections.push({id:'languages',title:'国家主要通用语言',entries:categories.map(category=>({id:'action:language:'+category.id,label:category.name,color:category.color,active:modes.languageId===category.id})),note:languageOverview.note})
    sections.push({id:'language-missing',entries:[{id:'language-unmapped',label:'未着色：无可匹配国家语言资料或筛选未匹配',symbol:'empty'}]})
  }else if(layers.language){
    const points=modes.languageMode==='points',families=modes.languageMode==='families'||points
    title='语言分布';subtitle=points?'Glottolog 5.3 · 语系着色参考点':`2007图集参考范围 · ${families?'语系概览':'语言区域'}`
    const selectedLanguage=languageMeta?.languages.find(language=>language.id===modes.languageId)
    const selectedFamily=familyMetadata.families.find(family=>family.id===thematic.language)
    let entries:LegendEntry[]
    if(modes.languageId!=='all')entries=[{id:'action:language:'+modes.languageId,label:languageCategory(modes.languageId)?.id===modes.languageId?languageCategory(modes.languageId)!.name:selectedLanguage?.name||modes.languageId,color:languageCategory(modes.languageId)?languageColor(modes.languageId):'#5878b5',symbol:points?'point':'area',active:true}]
    else if(families&&thematic.language!=='all')entries=[{id:'action:family:'+thematic.language,label:selectedFamily?.name||thematic.language,color:languageFamilies.some(family=>family.id===thematic.language)?familyColor(thematic.language):'#5878b5',symbol:points?'point':'area',active:true}]
    else entries=[...(families?languageFamilies:majorLanguages).filter(category=>families||!languageMeta||languageMeta.languages.some(language=>('members' in category?category.members.includes(language.id):language.id===category.id)&&(thematic.language==='all'||language.familyId===thematic.language))).map(category=>({id:`action:${families?'family':'language'}:${category.id}`,label:category.name,color:category.color,symbol:points?'point' as const:'area' as const})),{id:'language-other',label:families?otherLanguageLabel:'其余地方语言（点选可查看名称）',color:otherLanguageColor,symbol:points?'point':'area'}]
    sections.push({id:'languages',title:points?'参考点颜色表示语系':families?'区域颜色表示语系':'区域颜色表示语言',entries,note:points?'一个点是一条语种参考位置，点的密度不表示人数。包含濒危及已消亡语言。':`汉语各方言与阿拉伯语等变体按宏语言统一着色，点开仍显示原始语种。${languageMeta?.note||'依据2007图集的语言参考范围，部分地区和多语言重叠欠表示。'} 未着色地区可能缺少范围资料，不表示无人使用语言。颜色不表示人数、人口占比或官方语言。`})
    if(families)sections.push({id:'family-filter',title:'语系分类 · 点击单独查看',entries:familyMetadata.families.map(family=>({id:'action:family:'+family.id,label:family.name,color:thematic.language===family.id?languageFamilies.some(item=>item.id===family.id)?familyColor(family.id):'#5878b5':familyColor(family.id),symbol:points?'point':'area',active:thematic.language===family.id})),note:'灰色在总览中统一表示“其他语系与分类”；点击分类后单独显示，不为不同分类重复分配相同类别色。'})
    sections.push({id:'language-missing',entries:[{id:'language-unmapped',label:'未着色：范围资料未覆盖或筛选未匹配',symbol:'empty'}]})
  }
  const presentation=getTopicPresentation(topic)
  if(presentation.memberEntries.length)sections.push({id:'members',title:'主题中的地点与范围',entries:presentation.memberEntries.map(member=>({id:member.legendId,label:member.label,color:member.color,symbol:memberLegendSymbol(member)})),note:[presentation.note,presentation.caseNote].filter(Boolean).join(' ')})
  const symbols:LegendEntry[]=[]
  if(topic&&topic.kind!=='distribution'){
    symbols.push({id:'reference',label:'参考点：用于定位',color:'#7b8970',symbol:'point'},{id:'reference-range',label:'虚线：概化标注参考范围',color:'#7b8970',symbol:'dashed'})
  }
  if(selection)symbols.push({id:'selection',label:'橙色轮廓或点：当前选中',color:TOPIC_SELECTED_COLOR,symbol:'line'})
  if(layers.rivers)symbols.push({id:'river',label:'河道',color:'#40849e',symbol:'line'})
  if(layers.lakes)symbols.push({id:'lake',label:'湖面',color:'#669daa',symbol:'area'})
  if(layers.provinces)symbols.push({id:'province',label:'省区边界',color:'#4f7864',symbol:'line'})
  if(layers.borders)symbols.push({id:'border',label:'国家／地区轮廓',color:'#617664',symbol:'line'})
  if(layers.cities)symbols.push({id:'capital',label:'较大深色点：源版本首都',color:'#455c6e',symbol:'point'},{id:'city',label:'其他代表城市',color:'#ad8955',symbol:'point'})
  if(layers.basins)sections.push({id:'basins',title:'汇水分区 · BasinATLAS 第3级',entries:[{id:'basin-edge',label:'概化汇水分界',color:'#6b9290',symbol:'dashed'}],note:'淡色只用于辨认分区，不表示水量。包含沿海汇水分组，单元未必等于完整命名流域；不表示精确山脊。'})
  if(layers.plates)sections.push({id:'plates',title:'板块边界 · USGS',entries:[{id:'convergent',label:'汇聚',color:'#ba664d',symbol:'line'},{id:'divergent',label:'分离',color:'#48859f',symbol:'line'},{id:'transform',label:'转换（水平错动）',color:'#956eaa',symbol:'line'},{id:'plate-other',label:'其他边界',color:'#7c817b',symbol:'line'}],note:'概化模型边界，非地震目录或风险图。源汇聚类别不细分碰撞和俯冲。'})
  if(layers.grid)symbols.push({id:'grid-special',label:'赤道与回归线',color:'#98633f',symbol:'dashed'},{id:'grid',label:'其他经纬线',color:'#83968e',symbol:'dashed'})
  if(symbols.length)sections.push({id:'symbols',title:'地图符号',entries:symbols,note:layers.terrain?'地形底图使用土地覆盖配色与阴影；底色没有统一海拔色阶。':undefined})
  if(!sections.length)sections.push({id:'base',entries:[{id:'terrain',label:'地形与地名参考',color:'#846848',symbol:'point'}],note:'底图用于地理定位；查看具体对象可阅读介绍和来源。'})
  return {title,subtitle,sections}
}
