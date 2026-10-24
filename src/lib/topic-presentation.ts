import rawKnowledge from '../data/knowledge.json' with { type: 'json' }
import rawBindings from '../data/feature-bindings.json' with { type: 'json' }
import type { Knowledge, Topic } from '../types'

/** A category colour is independent of the shared selected-object colour. */
export const TOPIC_MEMBER_COLOR = '#287c73'
export const TOPIC_SELECTED_COLOR = '#e66c2c'
export type TopicSymbolKind = 'point' | 'line' | 'area' | 'reference' | 'peak' | 'port' | 'city'
export interface TopicMemberPresentation {
  legendId: string
  label: string
  color: string
  symbol: string
  kind: TopicSymbolKind
}
export interface TopicPresentation {
  title: string
  note: string
  caseNote?: string
  memberEntries: TopicMemberPresentation[]
}
interface SemanticClass {
  id: string
  label: string
  color: string
  symbol?: string
  kind?: 'port' | 'city'
}
interface PresentationRule {
  note: string
  caseNote?: string
  named?: string[]
  classes?: { semantic: SemanticClass; members: string[] }[]
  fallback?: SemanticClass
}

const knowledge = new Map((rawKnowledge as Knowledge[]).map(card => [card.id, card]))
const bindings = rawBindings as Record<string, string[]>
const regionColors = ['#358577', '#b98a31', '#8570ae', '#bd6b54', '#4b87b2', '#7d8d42', '#b75c8c']
const river: SemanticClass = { id: 'river', label: '河流与水系', color: '#277da8' }
const lake: SemanticClass = { id: 'lake', label: '湖泊与湖群', color: '#418fb5' }
const landform: SemanticClass = { id: 'landform', label: '地形参考', color: '#a5804a' }
const mountain: SemanticClass = { id: 'mountain', label: '山系概化范围', color: '#9b7550' }
const peak: SemanticClass = { id: 'peak', label: '山峰位置', color: '#845b45', symbol: '▲' }
const region: SemanticClass = { id: 'region', label: '区域参考', color: TOPIC_MEMBER_COLOR }
const city: SemanticClass = { id: 'city', label: '城市与地区案例', color: '#456a9e', symbol: '●', kind: 'city' }
const port: SemanticClass = { id: 'port', label: '港口案例', color: '#276f92', symbol: '◆', kind: 'port' }
const transport: SemanticClass = { id: 'transport', label: '交通工程参考点', color: '#8a6caa', symbol: '■' }
const hub: SemanticClass = { id: 'hub', label: '陆路枢纽案例', color: '#c17838', symbol: '■' }
const strait: SemanticClass = { id: 'strait', label: '海峡参考点', color: '#367b94', symbol: '●' }
const canal: SemanticClass = { id: 'canal', label: '运河参考点', color: '#7864a3', symbol: '■' }
const ocean: SemanticClass = { id: 'ocean', label: '海域参考点', color: '#438eab', symbol: '●' }
const crop: SemanticClass = { id: 'crop', label: '种植农业案例', color: '#438956', symbol: '●' }
const irrigation: SemanticClass = { id: 'irrigation', label: '灌溉农业案例', color: '#3086a0', symbol: '●' }
const pasture: SemanticClass = { id: 'pasture', label: '牧业与草原案例', color: '#a88d32', symbol: '●' }
const coal: SemanticClass = { id: 'coal', label: '煤炭与煤层气案例', color: '#706155', symbol: '◆' }
const oilGas: SemanticClass = { id: 'oil-gas', label: '油气与能源案例', color: '#b67635', symbol: '◆' }
const renewable: SemanticClass = { id: 'renewable', label: '风能与太阳能案例', color: '#b18d26', symbol: '◆' }
const hydro: SemanticClass = { id: 'hydro', label: '水能工程案例', color: '#287fae', symbol: '◆' }
const mineral: SemanticClass = { id: 'mineral', label: '矿产案例', color: '#855a9f', symbol: '◆' }
const industry: SemanticClass = { id: 'industry', label: '产业转型案例', color: '#587595', symbol: '■' }

const rules: Record<string, PresentationRule> = {
  'china-plateaus': {
    note: '颜色区分四个高原；已核对的概化范围与同色定位点对应。',
    caseNote: '内蒙古高原目前以参考点定位；自然区色面为概化标注参考范围。',
    named: ['tibetan-plateau', 'loess-plateau', 'inner-mongolian-plateau', 'yunnan-guizhou-plateau'],
  },
  'china-plains': {
    note: '颜色区分主要平原；范围与定位点使用同一颜色。',
    caseNote: '长江中下游平原目前以参考点定位；已有色面为概化标注参考范围。',
    named: ['northeast-china-plain', 'north-china-plain', 'yangtze-middle-lower-plain'],
  },
  'china-basins': {
    note: '颜色区分四个盆地；色面显示已核对的概化标注参考范围。',
    named: ['tarim-basin', 'junggar-basin', 'qaidam-basin', 'sichuan-basin'],
  },
  'china-mountain-ranges': {
    note: '山系使用同一颜色，以名称区分；概化范围帮助观察位置与走向。',
    caseNote: '山系色面是自然区域标注参考范围，不能视为严格山脉边界。',
  },
  'china-rivers': { note: '蓝色线表示真实河道，名称区分各河；一张水系卡可以对应多条支流。' },
  'world-high-peaks': { note: '三角形表示山峰位置；各峰用名称区分，选中后统一突出。' },
  'world-mountain-ranges': {
    note: '山系显示概化范围，山峰使用三角形；同类对象使用同一颜色。',
    caseNote: '山系范围用于概化标注；富士山以真实山峰位置表示。',
  },
  'world-lakes': { note: '蓝色色面表示湖泊数据中的概化水面范围；湖群可以对应多个独立湖体。' },
  'map-climate': { note: '色面表示1991—2020长期气候类型；颜色与下方气候分类一一对应。' },
  'map-population': { note: '人口密度用分级色阶表示，颜色越深，单位面积内人口越多。' },
  'map-religion': { note: '分类颜色表示各国资料中占比最高的宗教类别；比例视图使用深浅色阶。' },
  'map-language': {
    note: '语言区域色面表示资料中的语言使用参考范围，也可切换语系范围或语言参考点；图例随视图切换。',
    caseNote: '语言区域采用2007年地图集参考范围；Glottolog点位是语言记录位置，多语言地区存在重叠。',
  },
  'china-water-journey': {
    note: '河流用线、湖泊用面；地形与行政地区使用各自已核对的范围。',
    caseNote: '河道与地区范围帮助比较沿途联系；河道范围不等于整个流域。',
  },
  'china-dry-water': {
    note: '气候色面作背景；前景用山系、地形、河流、湖泊和地区范围比较水源。',
    classes: [{ semantic: { ...landform, id: 'dry-landform', label: '盆地与沙漠参考' }, members: ['tarim-basin', 'taklamakan'] }],
  },
  'china-north-south': {
    note: '气候色面作背景；山系、平原与省区范围提示比较位置。',
    caseNote: '秦岭范围是概化标注参考，气候与人文差异需要观察连续过渡。',
  },
  'china-city-environment': {
    note: '人口密度作背景，前景显示城市所在行政地区与湖泊，点位帮助定位。',
    caseNote: '北京、上海的色面采用行政范围；广东、四川为地区比较案例。',
  },
  'world-river-contrast': {
    note: '河道用蓝线，平原、自然区与国家用各自范围或参考点。',
    caseNote: '恒河平原目前以参考点定位；河道不表示流域边界。',
  },
  'world-latitude-height': {
    note: '气候色面作背景；自然区与国家范围帮助比较纬度和海拔。',
    caseNote: '这些地区是对照案例，地区内的气候并不处处相同。',
  },
  'china-food-water-cities': {
    note: '人口密度作背景，颜色和符号区分农业、供水与城市地区案例。',
    caseNote: '农业、三角洲与调水点位是学习入口；没有绘制种植区或调水线路。',
    classes: [
      { semantic: crop, members: ['china-grain', 'rice-farming'] },
      { semantic: { id: 'water-supply', label: '跨流域供水参考点', color: '#287fae', symbol: '◆' }, members: ['south-north-water'] },
      { semantic: city, members: ['yangtze-delta', 'pearl-delta', 'hong-kong', 'macao'] },
    ],
  },
  'world-sea-connections': {
    note: '不同符号与颜色区分海域、海峡和人工运河参考点。',
    caseNote: '当前显示海域和通道参考点；点位不表示海域范围或真实航线。',
    classes: [
      { semantic: ocean, members: ['pacific-ocean', 'atlantic-ocean', 'indian-ocean', 'arctic-ocean', 'mediterranean'] },
      { semantic: strait, members: ['malacca-strait', 'gibraltar-strait', 'bering-strait'] },
      { semantic: canal, members: ['suez-canal', 'panama-canal'] },
    ],
  },
  'earth-seasons': {
    note: '圆点表示观察位置，经纬网帮助比较纬度与经度。',
    caseNote: '地图点位是昼夜、季节与地方时的观察入口；底色不表示实时昼夜。',
    fallback: { id: 'observation', label: '概念观察点', color: TOPIC_MEMBER_COLOR, symbol: '●' },
  },
  'earth-map-reading': {
    note: '圆点表示地图阅读的观察位置，经纬网与地形提供比较背景。',
    caseNote: '观察点用于读经纬度、比例尺和坡面，不代表现象分布范围。',
    fallback: { id: 'observation', label: '地图阅读观察点', color: TOPIC_MEMBER_COLOR, symbol: '●' },
  },
  'china-regions': {
    note: '颜色区分北方、南方、西北与青藏四个地理区；选择区域可查看比较。',
    caseNote: '色面依据Jiang等（2023）分区图数字化，虚线为概化分界，区域之间存在过渡；适合全国尺度学习，不是行政区界。',
    named: ['northern-china', 'southern-china', 'northwestern-china', 'qinghai-tibet-region'],
  },
  'china-provinces': {
    note: '省区使用统一色面和边界，名称区分34个行政区；选中省区统一突出。',
    caseNote: '台湾省当前以参考点定位；其他色面使用现有省级行政数据。',
    fallback: { id: 'province', label: '省级行政区', color: TOPIC_MEMBER_COLOR },
  },
  'china-relief-steps': {
    note: '颜色区分高原、盆地、平原与丘陵案例；地形背景用于观察高低变化。',
    caseNote: '显示典型地形范围与参考点，尚未绘制三级阶梯的分界线或分区面。',
    classes: [
      { semantic: { id: 'plateau', label: '高原案例', color: '#8c76a9' }, members: ['tibetan-plateau', 'loess-plateau', 'inner-mongolian-plateau', 'yunnan-guizhou-plateau'] },
      { semantic: { id: 'basin', label: '盆地案例', color: '#ba8f45' }, members: ['qaidam-basin', 'sichuan-basin'] },
      { semantic: { id: 'plain', label: '平原案例', color: '#5d936d' }, members: ['northeast-china-plain', 'north-china-plain', 'yangtze-middle-lower-plain'] },
      { semantic: { id: 'hills', label: '丘陵参考点', color: '#b37c58' }, members: ['liaodong-hills', 'shandong-hills', 'southeast-hills'] },
    ],
  },
  'china-lakes': { note: '蓝色色面表示概化水面范围，名称区分各湖；湖岸来自同一地理数据口径。' },
  'china-agriculture': {
    note: '颜色区分种植、灌溉与牧业案例；平原范围提供地形参照。',
    caseNote: '显示典型农业地点与地形参照，尚未加载完整耕地、作物或牧区分布。',
    classes: [
      { semantic: crop, members: ['northeast-blacksoil', 'rice-farming'] },
      { semantic: irrigation, members: ['hetao-irrigation'] },
      { semantic: pasture, members: ['xilingol-pasture'] },
    ],
  },
  'china-energy-resources': {
    note: '颜色区分煤炭、风光能源、水能工程与矿产案例；菱形表示地点。',
    caseNote: '能源矿产显示典型地点；柴达木盆地色面为地形参照，不表示矿区范围。',
    classes: [
      { semantic: coal, members: ['qinshui-coal'] },
      { semantic: renewable, members: ['hexi-renewables'] },
      { semantic: hydro, members: ['three-gorges-project'] },
      { semantic: mineral, members: ['qarhan-resources'] },
    ],
  },
  'china-transport': {
    note: '不同颜色与符号区分港口、陆路枢纽、工程参考点和行政地区。',
    caseNote: '铁路与运河目前使用参考点，地图未加载这些工程的真实线路。',
    classes: [
      { semantic: hub, members: ['zhengzhou-transport'] },
      { semantic: transport, members: ['qinghai-tibet-railway', 'grand-canal'] },
      { semantic: port, members: ['ningbo-zhoushan-port'] },
      { semantic: city, members: ['chongqing', 'tianjin'] },
    ],
  },
  'world-continents': {
    note: '颜色区分七大洲；范围和同色参考点帮助定位。',
    caseNote: '六大洲显示Natural Earth概化标注范围，主要概括大陆；大洋洲包含分散岛群，暂以参考点定位。',
    named: ['asia-continent', 'europe-continent', 'africa-continent', 'north-america-continent', 'south-america-continent', 'oceania-region', 'antarctica'],
  },
  'world-plateaus-plains': {
    note: '颜色区分高原、平原与流域地形参考，以名称辨认具体地区。',
    caseNote: '当前仅部分地区有概化范围，其余使用参考点定位。亚马孙盆地色面是概化标注参考，不是汇水区边界。',
    classes: [
      { semantic: { id: 'plateau', label: '高原与高地', color: '#a77b4e' }, members: ['tibetan-plateau', 'deccan-plateau', 'ethiopian-highlands', 'brazilian-highlands'] },
      { semantic: { id: 'plain', label: '平原参考', color: '#5a9272' }, members: ['great-plains', 'ganges-plain', 'pampas'] },
      { semantic: { id: 'basin', label: '流域地形参考', color: '#8b78a9' }, members: ['amazon-basin'] },
    ],
  },
  'world-deserts': {
    note: '气候色面作背景；沙漠概化范围和参考点使用同一颜色。',
    caseNote: '沙漠点位是典型景观案例；澳大利亚国家范围不表示整个国家都是沙漠。',
    classes: [{ semantic: { id: 'desert', label: '沙漠与干旱景观', color: '#bd9755' }, members: ['sahara', 'taklamakan', 'gobi-desert', 'atacama-desert', 'namib-sand-sea'] }],
  },
  'world-tectonics': {
    note: '颜色区分张裂、碰撞、俯冲、走滑与热点案例；三角形帮助辨认山峰。',
    caseNote: '构造案例与USGS概化板块边界分别说明；边界类型不能代替局地断层和地震活动资料。',
    classes: [
      { semantic: { id: 'rift', label: '张裂案例', color: '#b17a36', symbol: '◆' }, members: ['iceland-rift', 'east-african-rift'] },
      { semantic: { id: 'collision', label: '大陆碰撞案例', color: '#9b7550' }, members: ['himalayas'] },
      { semantic: { id: 'subduction', label: '俯冲相关案例', color: '#a85555' }, members: ['andes', 'fujisan'] },
      { semantic: { id: 'transform', label: '走滑断层参考点', color: '#76679d', symbol: '◆' }, members: ['san-andreas-fault'] },
      { semantic: { id: 'hotspot', label: '热点火山参考点', color: '#ca7540', symbol: '▲' }, members: ['hawaii-hotspot'] },
    ],
  },
  'world-ecosystems': {
    note: '颜色区分森林、草原、湿地与干旱景观案例；点位帮助查阅地区。',
    caseNote: '当前使用典型地区参考点，尚未加载全球生态区或植被覆盖范围。',
    classes: [
      { semantic: { id: 'forest', label: '森林案例', color: '#39745a' }, members: ['amazon-rainforest', 'canadian-boreal-forest'] },
      { semantic: { id: 'grassland', label: '草原案例', color: '#88954c' }, members: ['serengeti-savanna', 'pampas'] },
      { semantic: { id: 'wetland', label: '湿地案例', color: '#348b9b' }, members: ['okavango-delta', 'sundarbans-mangroves'] },
      { semantic: { id: 'desert', label: '干旱景观案例', color: '#bd9755' }, members: ['namib-sand-sea'] },
    ],
  },
  'world-ocean-monsoon': {
    note: '长期气候作背景；颜色区分暖流、上升流、季风与海陆对照案例。',
    caseNote: '当前使用海区与地区参考点，尚未加载洋流方向、流速或季风矢量。',
    classes: [
      { semantic: { id: 'warm-current', label: '暖流观察点', color: '#bc654e' }, members: ['gulf-stream'] },
      { semantic: { id: 'upwelling', label: '沿岸上升流观察点', color: '#428aae' }, members: ['peru-upwelling'] },
      { semantic: { id: 'monsoon', label: '季风观察点', color: '#4b9277' }, members: ['indian-monsoon'] },
      { semantic: { id: 'comparison', label: '海陆环境对照点', color: '#a3874e' }, members: ['atacama-desert', 'deccan-plateau', 'southern-ocean'] },
    ],
  },
  'world-energy-industry': {
    note: '颜色与符号区分油气、矿产、产业转型和港口案例。',
    caseNote: '当前显示典型地点，不表示全部产地、矿区、工业区或运输网络。',
    classes: [
      { semantic: oilGas, members: ['persian-gulf-energy', 'north-sea-energy'] },
      { semantic: mineral, members: ['atacama-copper'] },
      { semantic: industry, members: ['ruhr-industry'] },
      { semantic: port, members: ['rotterdam-port'] },
    ],
  },
  'world-agriculture-food': {
    note: '颜色区分小麦、稻作、牧业和经济作物案例，名称区分具体地点。',
    caseNote: '当前是典型农业地点，尚未加载全球耕地、作物分布或粮食贸易流量。',
    classes: [
      { semantic: { id: 'wheat', label: '小麦种植案例', color: '#b18c2e' }, members: ['great-plains-wheat'] },
      { semantic: { ...crop, id: 'rice', label: '稻作案例' }, members: ['mekong-delta-farming', 'rice-farming'] },
      { semantic: pasture, members: ['pampas'] },
      { semantic: { id: 'commercial-crop', label: '经济作物案例', color: '#926081' }, members: ['kafa-coffee'] },
      { semantic: { id: 'grain', label: '粮食统计参考点', color: '#4d7c92', symbol: '■' }, members: ['china-grain'] },
    ],
  },
  'world-transport-trade': {
    note: '颜色与符号区分港口、铁路工程、海峡和运河参考点。',
    caseNote: '当前显示交通与贸易节点；尚未加载真实航线、铁路线路或贸易流量。',
    classes: [
      { semantic: port, members: ['rotterdam-port', 'singapore-port'] },
      { semantic: transport, members: ['gotthard-rail'] },
      { semantic: strait, members: ['malacca-strait'] },
      { semantic: canal, members: ['suez-canal', 'panama-canal'] },
    ],
  },
  'world-polar-comparison': {
    note: '颜色区分北极、南极与北方森林对照案例；范围与参考点对应同色。',
    caseNote: '南极洲有概化范围，其余使用参考点；海域点位不表示完整海域边界。',
    classes: [
      { semantic: { id: 'arctic', label: '北极地区与北冰洋', color: '#5794ad' }, members: ['arctic-region', 'arctic-ocean'] },
      { semantic: { id: 'antarctic', label: '南极洲与南大洋', color: '#8b82b4' }, members: ['antarctica', 'southern-ocean'] },
      { semantic: { id: 'boreal-forest', label: '北方森林对照点', color: '#4b8667' }, members: ['canadian-boreal-forest'] },
    ],
  },
  'world-regional-comparison': {
    note: '颜色区分国家范围与宽泛区域参考点；名称帮助辨认具体地区。',
    caseNote: '东南亚、中东、欧洲西部与撒哈拉以南非洲使用参考点，未用国家范围替代区域边界。',
    classes: [
      { semantic: { id: 'broad-region', label: '宽泛区域参考点', color: '#a17b48' }, members: ['southeast-asia', 'middle-east', 'western-europe', 'sub-saharan-africa'] },
      { semantic: { id: 'country', label: '国家范围', color: TOPIC_MEMBER_COLOR }, members: ['japan', 'india', 'brazil', 'australia'] },
    ],
  },
}

export const allTopicPresentationIds = Object.keys(rules)

/** Geometry follows curated bindings; a subject's name never creates a line or area. */
function memberKind(card: Knowledge, semantic: SemanticClass): TopicSymbolKind {
  const ids = bindings[card.id] || []
  if (ids.some(id => id.startsWith('river-'))) return 'line'
  if (ids.some(id => id.startsWith('peak-'))) return 'peak'
  if (ids.some(id => /^(lake|region|country|province)-/.test(id))) return 'area'
  if (semantic.kind) return semantic.kind
  return 'reference'
}

function fallbackClass(card: Knowledge): SemanticClass {
  const ids = bindings[card.id] || []
  if (ids.some(id => id.startsWith('peak-')) || card.id.startsWith('summit-')) return peak
  if (card.category === 'rivers') return river
  if (card.category === 'lakes') return lake
  if (card.category === 'mountains') return mountain
  if (card.category === 'terrain') return landform
  if (card.category === 'regions') return region
  return { id: 'reference', label: '学习参考点', color: TOPIC_MEMBER_COLOR }
}

export function presentationForMember(topic: Topic | null, card: Knowledge): TopicMemberPresentation {
  const rule = topic ? rules[topic.id] : undefined
  const namedIndex = rule?.named?.indexOf(card.id) ?? -1
  const semantic: SemanticClass = namedIndex >= 0
    ? { id: `member-${card.id}`, label: card.name.split('：')[0], color: regionColors[namedIndex] }
    : rule?.classes?.find(group => group.members.includes(card.id))?.semantic || rule?.fallback || fallbackClass(card)
  const kind = memberKind(card, semantic)
  return {
    legendId: `${semantic.id}-${kind}`,
    label: semantic.label,
    color: semantic.color,
    symbol: kind === 'line' ? '━' : kind === 'area' ? '▰' : kind === 'peak' ? '▲' : semantic.symbol || '●',
    kind,
  }
}

/** Match topicMapMembers' concept filtering without importing UI/catalog modules. */
function hasMapMember(topic: Topic, card: Knowledge): boolean {
  return topic.kind !== 'distribution' && card.mapRole !== 'concept'
    && (!['climate', 'population', 'religion', 'language'].includes(card.category) || (bindings[card.id] || []).length > 0)
}

export function getTopicPresentation(topic: Topic | null): TopicPresentation {
  if (!topic) return { title: '地图图例', note: '点表示位置，线表示河道，面表示已有范围。', memberEntries: [] }
  const rule = rules[topic.id]
  const entries = new Map<string, TopicMemberPresentation>()
  for (const id of topic.stops) {
    const card = knowledge.get(id)
    if (!card || !hasMapMember(topic, card)) continue
    const entry = presentationForMember(topic, card)
    // A class can include both bound areas and unbound points. Show both symbols
    // so users never have to infer that its coloured point is also a range.
    if (!entries.has(entry.legendId)) entries.set(entry.legendId, entry)
  }
  const memberEntries = [...entries.values()].map(entry => {
    const sharedClass = [...entries.values()].some(other => other.legendId !== entry.legendId && other.color === entry.color && other.label === entry.label)
    if (!sharedClass) return entry
    const suffix = entry.kind === 'area' ? '（范围）' : entry.kind === 'line' ? '（河道）' : entry.kind === 'peak' ? '（山峰）' : '（参考点）'
    return { ...entry, label: entry.label + suffix }
  })
  return { title: topic.title, note: rule?.note || '点、线、面分别显示位置、河道和已有范围；同类对象使用相同颜色。', caseNote: rule?.caseNote, memberEntries }
}
