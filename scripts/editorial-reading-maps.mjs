import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'

const read=path=>JSON.parse(fs.readFileSync(path,'utf8'))
const sha=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex')
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
const round=value=>Math.round(value*10)/10
const paper='#f7f4eb',ink='#294840',muted='#65766e',sea='#e4edef',landColor='#d8dfd2'
const neTerms='https://www.naturalearthdata.com/about/terms-of-use/'
const neLand='https://www.naturalearthdata.com/downloads/50m-physical-vectors/50m-land/'
const neRegions='https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-geography-regions/'
const text=(x,y,label,size=22,fill=ink,anchor='start',extra='')=>`<text x="${round(x)}" y="${round(y)}" fill="${fill}" font-size="${size}" text-anchor="${anchor}" ${extra}>${esc(label)}</text>`
const line=(x1,y1,x2,y2,color='#a1b0a6',width=1.5)=>`<path d="M${round(x1)},${round(y1)}L${round(x2)},${round(y2)}" fill="none" stroke="${color}" stroke-width="${width}"/>`
const halo='paint-order="stroke" stroke="#f7f4eb" stroke-width="6" stroke-linejoin="round" font-weight="600"'
const polygonList=geometry=>geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[]
const input=(path,featureIds)=>({path,sha256:sha(path),...(featureIds?{featureIds}:{})})

// The bundled Natural Earth land polygons are already cut at ±180°. Keep
// those real coastlines: reject unsplit cross-date-line edges instead of
// joining them across the map. Antarctica's closing edge at the South Pole
// is intentional in this rectangular projection and stays on the frame.
function validateDateLine(features){
  for(const feature of features)for(const polygon of polygonList(feature.geometry))for(const ring of polygon){
    for(let i=1;i<ring.length;i++)assert(Math.abs(ring[i][0]-ring[i-1][0])<=180||(ring[i][1]<-89.9&&ring[i-1][1]<-89.9),feature.properties.id+' must be split at the date line')
  }
}
function projection(bounds,x,y,width){
  const [west,south,east,north]=bounds,scale=width/(east-west),height=(north-south)*scale
  return {bounds,x,y,width,height,xy:([lon,lat])=>[round(x+(lon-west)*scale),round(y+(north-lat)*scale)]}
}
function geometryPath(geometry,map){
  const [west,south,east,north]=map.bounds
  return polygonList(geometry).filter(polygon=>{
    const xs=polygon[0].map(p=>p[0]),ys=polygon[0].map(p=>p[1])
    return Math.max(...xs)>=west&&Math.min(...xs)<=east&&Math.max(...ys)>=south&&Math.min(...ys)<=north
  }).map(polygon=>polygon.map(ring=>ring.map((p,i)=>(i?'L':'M')+map.xy(p).join(',')).join('')+'Z').join('')).join('')
}
function baseMap(id,land,map,{longitudes=[-120,-60,0,60,120],latitudes=[-60,-30,0,30,60]}={}){
  const {x,y,width,height,xy,bounds}=map,[west,south,east,north]=bounds
  const grid=latitudes.filter(lat=>lat>=south&&lat<=north).map(lat=>{const [px,py]=xy([west,lat]);return line(px,py,x+width,py,lat===0?'#bbcbcd':'#cfdbdc',lat===0?1.5:1)}).join('')+longitudes.filter(lon=>lon>=west&&lon<=east).map(lon=>{const [px,py]=xy([lon,north]);return line(px,py,px,y+height,'#cfdbdc',1)}).join('')
  const shapes=land.features.map(f=>geometryPath(f.geometry,map)).filter(Boolean).map(d=>`<path d="${d}"/>`).join('')
  return `<defs><clipPath id="${id}-clip"><rect x="${x}" y="${y}" width="${width}" height="${round(height)}" rx="8"/></clipPath></defs><rect x="${x}" y="${y}" width="${width}" height="${round(height)}" rx="8" fill="${sea}"/><g clip-path="url(#${id}-clip)">${grid}<g fill="${landColor}" stroke="#c4cfc4" stroke-width="0.5" fill-rule="evenodd">${shapes}</g></g>`
}
const wrap=(id,title,caption,height,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}" role="img" aria-labelledby="${id}-title ${id}-desc"><title id="${id}-title">${esc(title)}</title><desc id="${id}-desc">${esc(caption)}</desc><rect width="1200" height="${height}" rx="16" fill="${paper}"/><g font-family="system-ui,-apple-system,'PingFang SC','Noto Sans CJK SC',sans-serif">${body}</g></svg>`
const heading=(title,subtitle)=>text(42,54,title,32,ink,'start','font-weight="650"')+text(42,88,subtitle,19,muted)
const figure=(id,title,caption,height,body,extra)=>({id,kind:'map',title,caption,alt:caption,path:`media/reading/${id}.svg`,author:'山河图制图；Natural Earth',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',width:1200,height,...extra,svg:wrap(id,title,caption,height,body)})

function middleYangtzeMap(bindings){
  const provincesPath='public/data/learning-provinces.geojson', lakesPath='public/data/lakes.geojson', riverPath='public/data/rivers.geojson'
  const provinceIds=['province-cn-42','province-cn-43','province-cn-36']
  const lakes=read(lakesPath).features.filter(f=>[...bindings['dongting-lake'],...bindings['poyang-lake']].includes(f.properties.id))
  const river=read(riverPath).features.find(f=>f.properties.id===bindings.yangtze[0])
  const provinces=read(provincesPath).features.filter(f=>provinceIds.includes(f.properties.id))
  assert(provinces.length===3&&lakes.length===2&&river.geometry.type==='MultiLineString','Known middle Yangtze features')
  const map=projection([108,24.3,119.3,33.45],45,102,1110)
  const colors=['#d9dfc1','#e9d6ae','#dbccc4']
  const areas=provinces.map(f=>`<path d="${geometryPath(f.geometry,map)}" fill="${colors[provinceIds.indexOf(f.properties.id)]}" stroke="#857c6d" stroke-width="2" fill-rule="evenodd"/>`).join('')
  const lakeShapes=lakes.map(f=>`<path d="${geometryPath(f.geometry,map)}" fill="#80b7c9" stroke="#317a8e" stroke-width="2"/>`).join('')
  const riverLine=river.geometry.coordinates.map(segment=>segment.map((coord,i)=>(i?'L':'M')+map.xy(coord).join(',')).join('')).join('')
  const labels=[[111.7,31.65,'湖北'],[111.3,27.25,'湖南'],[115.65,26.4,'江西']].map(([lon,lat,name])=>text(...map.xy([lon,lat]),name,54,ink,'middle',halo)).join('')
  // Attach each leader to the published river or shoreline itself. The
  // approximate label position only selects the nearby part of that geometry.
  const anchors=[['yangtze',114.1,30.45,114.8,31.45,'长江'],['dongting-lake',112.83,29.25,111.4,29.5,'洞庭湖'],['poyang-lake',116.27,29.14,117.93,29.55,'鄱阳湖']]
  const namedWater=anchors.map(([id,lon,lat,tx,ty,name])=>{
    const lines=id==='yangtze'?river.geometry.coordinates:polygonList(lakes.find(f=>bindings[id].includes(f.properties.id)).geometry).flat()
    const distance=([x,y])=>(x-lon)**2+(y-lat)**2
    const nearest=lines.flat().reduce((best,point)=>distance(point)<distance(best)?point:best)
    const [ax,ay]=map.xy(nearest),[x,y]=map.xy([tx,ty])
    return line(ax,ay,x,y+7,'#297388',3)+`<circle cx="${ax}" cy="${ay}" r="5" fill="#1e596d"/>`+text(x,y,name,44,'#1e596d','middle',halo)
  }).join('')
  const admin=read('public/data/learning-data-sources.json').sources.find(s=>s.id==='natural-earth-10m-admin1-learning')
  const water=read('public/data/sources.json').sources.filter(s=>['natural-earth-10m-rivers','natural-earth-10m-lakes'].includes(s.id))
  const height=Math.ceil(map.y+map.height+24)
  const caption='湖南的洞庭湖和江西的鄱阳湖分别与长江相通。沿蓝线从西向东，可以看到长江怎样穿过湖北，又经过几个省相邻的地带。图中只着色这三个省，省界和水体均为概化范围。'
  return figure('china-middle-yangtze-map','长江中游的三省与两湖',caption,height,
    text(45,65,'长江中游的三省与两湖',52)+`<defs><clipPath id="region"><rect x="${map.x}" y="${map.y}" width="${map.width}" height="${map.height}"/></clipPath></defs><g clip-path="url(#region)">${areas}${lakeShapes}<path d="${riverLine}" fill="none" stroke="#317a8e" stroke-width="5"/>${labels}${namedWater}</g>`,{
      sourceUrl:admin.url,sourceUrls:[admin.url,...water.map(s=>s.url),neTerms],
      placeIds:['hubei','hunan','jiangxi','yangtze','dongting-lake','poyang-lake'],
      featureIds:[...provinceIds,river.properties.id,...lakes.map(f=>f.properties.id)],
      inputs:[input(provincesPath,provinceIds),input(lakesPath,lakes.map(f=>f.properties.id)),input(riverPath,[river.properties.id]),input('src/data/feature-bindings.json'),input('public/data/learning-data-sources.json'),input('public/data/sources.json')],
      inputVersions:[admin,...water].map(s=>({id:s.id,version:admin.version,license:'Public domain'})),
      processing:'复用站内 Natural Earth 1:1000万省级、长江与湖泊几何，以相同等距圆柱投影裁切长江中游。省界使用现有省级学习层，未新增水系或推定流域范围。',
    })
}

export function editorialReadingMaps(){
  const land=read('public/data/land.geojson'),regions=read('public/data/regions.geojson'),china=read('public/data/china-reference-regions.geojson'),knowledge=read('src/data/knowledge.json'),bindings=read('src/data/feature-bindings.json'),chinaSource=read('public/data/china-reference-region-sources.json')
  validateDateLine(land.features)
  const card=id=>{const row=knowledge.find(k=>k.id===id);assert(row,'Known geography card '+id);return row}
  const landIds=land.features.map(f=>f.properties.id)
  const world=projection([-180,-90,180,90],40,115,1120)
  const continentLabels=[['asia-continent','亚洲'],['africa-continent','非洲'],['europe-continent','欧洲'],['north-america-continent','北美洲'],['south-america-continent','南美洲'],['oceania-region','大洋洲'],['antarctica','南极洲']]
  const oceanLabels=[['pacific-ocean','太平洋'],['atlantic-ocean','大西洋'],['indian-ocean','印度洋'],['arctic-ocean','北冰洋'],['southern-ocean','南大洋']]
  const continentNames=continentLabels.map(([id,name])=>{const [x,y]=world.xy(card(id).coordinates);return text(x,y+9,name,29,ink,'middle',halo)}).join('')
  const oceanNames=oceanLabels.map(([id,name])=>{const [x,y]=world.xy(card(id).coordinates);return text(x,y+7,name,23,'#517c87','middle','letter-spacing="3"')}).join('')
  const worldCaption='七大洲与五大洋的位置概览。陆地海岸取自本站 Natural Earth 数据，名称依据既有地理条目参考点标注；不绘制大洲分界或海洋边界。太平洋在图幅两侧相接，大洋洲包括澳大利亚及太平洋岛屿，不只指一块大陆。'
  const continents=figure('world-land-ocean-map','七大洲与五大洋',worldCaption,790,
    heading('七大洲与五大洋','先认海陆位置，再理解区域之间的联系')+baseMap('world-land-ocean-map',land,world)+continentNames+oceanNames+
    text(44,716,'陆地海岸：Natural Earth · 名称为位置标注，不表示区域边界。',19,muted)+
    text(44,751,'太平洋在图幅两侧相接；本图不用于比较高纬地区的面积。',19,muted),{
      sourceUrl:neLand,sourceUrls:[neLand,neTerms],featureIds:landIds,placeIds:[...continentLabels,...oceanLabels].map(([id])=>id),
      inputs:[input('public/data/land.geojson',landIds),input('src/data/knowledge.json',[...continentLabels,...oceanLabels].map(([id])=>id))],
      inputVersions:[{id:'natural-earth-50m-land',version:'ca96624a56bd078437bca8184e78163e5039ad19',license:'Public domain'}],
      processing:'将本站Natural Earth 50m陆地原有多边形直接作等距圆柱投影（中央经线0°、标准纬线0°），保留日期线切分和南极闭合边；不绘制国界、大洲分界或洋界。大洲、大洋名称使用src/data/knowledge.json既有参考坐标标注，名称表示相对位置，不以点扩面。SVG坐标保留0.1像素，未改变输入几何。',
    })

  const mountainMap=projection([-180,-60,180,85],40,120,1120)
  const chosen=[['rockies','落基山脉','#bb7d49',200,195],['andes','安第斯山脉','#a26954',490,460],['alps','阿尔卑斯山脉','#7c8961',560,298],['urals','乌拉尔山脉','#8b7b99',790,170],['himalayas','喜马拉雅山脉','#9b7451',946,361]]
  const mountainIds=[]
  const mountainAreas=chosen.map(([id,,color])=>{
    const ids=bindings[id];assert(ids?.length,id+' has explicit geometry binding')
    return ids.map(featureId=>{const f=regions.features.find(f=>f.properties.id===featureId);assert(f,'Known region '+featureId);assert(f.properties.sourceId==='natural-earth-10m-regions');mountainIds.push(featureId);return `<path d="${geometryPath(f.geometry,mountainMap)}" fill="${color}" fill-opacity="0.8" stroke="${color}" stroke-width="1" fill-rule="evenodd"/>`}).join('')
  }).join('')
  const mountainLabels=chosen.map(([id,name,color,x,y])=>{const [px,py]=mountainMap.xy(card(id).coordinates);return line(px,py,x,y-8,color,1.5)+`<circle cx="${px}" cy="${py}" r="4" fill="${color}" stroke="${paper}" stroke-width="1.5"/>`+text(x,y,name,25,ink,'middle',halo)}).join('')
  const mountainsCaption='喜马拉雅、安第斯、落基、阿尔卑斯与乌拉尔在大陆上的相对位置。色面严格取自本站明确绑定的 Natural Earth 1:1000万自然地理标注参考范围，不是精确地貌边界；圆点为既有地点条目的导航参考位置，不表示峰顶。'
  const mountains=figure('world-mountain-map','大陆上的五组主要山系',mountainsCaption,745,
    heading('大陆上的五组主要山系','比较它们位于大陆内部，还是靠近大陆边缘')+baseMap('world-mountain-map',land,mountainMap)+`<g clip-path="url(#world-mountain-map-clip)">${mountainAreas}</g>`+mountainLabels+
    `<rect x="44" y="610" width="24" height="16" rx="3" fill="#bb7d49" fill-opacity="0.8"/>`+text(80,626,'色面：Natural Earth 山系标注参考范围',19,muted)+
    `<circle cx="686" cy="618" r="4" fill="#9b7451"/>`+text(702,626,'圆点：地点导航参考位置',19,muted)+
    text(44,671,'五组山系只是本文选例，不代表世界山地的完整分布。',19,muted)+
    text(44,706,'概化范围用于辨认相对位置，不代表精确边界、山脊线或实测高程。',19,muted),{
      sourceUrl:neRegions,sourceUrls:[neRegions,neLand,neTerms],featureIds:mountainIds,placeIds:chosen.map(([id])=>id),
      inputs:[input('public/data/land.geojson',landIds),input('public/data/regions.geojson',mountainIds),input('src/data/feature-bindings.json',chosen.map(([id])=>id)),input('src/data/knowledge.json',chosen.map(([id])=>id))],
      inputVersions:[{id:'natural-earth-10m-regions',version:'ca96624a56bd078437bca8184e78163e5039ad19',license:'Public domain'},{id:'natural-earth-50m-land',version:'ca96624a56bd078437bca8184e78163e5039ad19',license:'Public domain'}],
      processing:'按feature-bindings.json的明确要素ID选择五组Natural Earth 10m山系标注参考范围，未经名称模糊匹配、外扩或人工描线，直接等距圆柱投影。底图使用本站Natural Earth 50m陆地；裁去南纬60°以南以突出本文山系。引线终点和圆点使用knowledge.json既有地点导航坐标，非山峰坐标；只作位置教学，不作精确范围或面积分析。',
    })

  const chinaMap=projection([70,17,136,55],64,120,1072)
  const regionColors={'northern-china':'#c9aa72','southern-china':'#8fad8d','northwestern-china':'#d5bd92','qinghai-tibet-region':'#afa6c3'}
  // Keys are explicit card IDs from the verified digitized layer, not names.
  const supported=['northern-china','southern-china','northwestern-china','qinghai-tibet-region']
  assert.deepEqual(china.features.map(f=>f.properties.cardId).sort(),supported.slice().sort(),'Exactly the four verified reference regions')
  const colored=china.features.map(f=>`<path d="${geometryPath(f.geometry,chinaMap)}" fill="${regionColors[f.properties.cardId]}" stroke="${paper}" stroke-width="2" fill-rule="evenodd"/>`).join('')
  const chinaLabels=china.features.map(f=>{const [x,y]=chinaMap.xy(f.properties.center);return text(x,y+9,f.properties.name,31,ink,'middle',halo)}).join('')
  const chinaCaption='中国四大地理区的位置与相邻关系。色面直接使用本站依据 Jiang 等（2023）图2数字化并核验的概化参考分区，保留既有四区共同边界；分界表示过渡带参考，不是行政区界、精确气候线或实测边界。'
  const chinaRegions=figure('china-regions-map','中国四大地理区',chinaCaption,865,
    heading('中国四大地理区','北方、南方、西北与青藏：在同一幅图上认识相邻关系')+baseMap('china-regions-map',land,chinaMap,{longitudes:[80,90,100,110,120,130],latitudes:[20,30,40,50]})+`<g clip-path="url(#china-regions-map-clip)">${colored}${chinaLabels}</g>`+
    text(66,773,'分区：Jiang 等（2023）图2数字化参考范围 · 外围陆地：Natural Earth',18,muted)+
    text(66,812,'分界是过渡带参考；本图不用于行政划界、地方归属或面积统计。',18,muted),{
      author:'山河图制图；改编自 Jiang 等（2023）图2；Natural Earth',sourceUrl:chinaSource.sourcePage,sourceUrls:[chinaSource.sourcePage,chinaSource.source.url,neLand,neTerms],featureIds:china.features.map(f=>f.properties.id),placeIds:supported,
      inputs:[input('public/data/land.geojson',landIds),input('public/data/china-reference-regions.geojson',china.features.map(f=>f.properties.id)),input('public/data/china-reference-region-sources.json')],
      inputVersions:[{id:chinaSource.id,version:chinaSource.version,license:'CC BY 4.0'},{id:'natural-earth-50m-land',version:'ca96624a56bd078437bca8184e78163e5039ad19',license:'Public domain'}],
      processing:'直接投影public/data/china-reference-regions.geojson的四个已验证多边形，不新增分界、不按行政省界补面。沿用Jiang等（2023）图2数字化分区的CC BY 4.0署名、配准与局限说明；背景Natural Earth 50m陆地为公有领域。等距圆柱投影（中央经线0°、标准纬线0°）裁剪为70–136°E、17–55°N，坐标四舍五入到0.1像素；分区名称位于该层已记录的参考中心。',
    })
  return [continents,mountains,chinaRegions,middleYangtzeMap(bindings)]
}

// Optional standalone regeneration; the main reading build imports the function.
if(process.argv[1]&&fileURLToPath(import.meta.url)===fs.realpathSync(process.argv[1])){
  for(const {svg,...media} of editorialReadingMaps()){
    fs.writeFileSync('public/'+media.path,svg)
    console.log(`${media.id}: ${Buffer.byteLength(svg)} bytes`)
  }
}
