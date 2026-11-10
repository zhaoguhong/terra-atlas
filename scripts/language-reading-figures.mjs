import fs from 'node:fs'

const read=path=>JSON.parse(fs.readFileSync(path,'utf8'))
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
const ink='#294840',muted='#66766e',paper='#f7f4eb',sea='#e5eef0',landColor='#d9dfd1'
const text=(x,y,label,size=22,fill=ink,anchor='start')=>`<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" text-anchor="${anchor}">${esc(label)}</text>`
const line=(x1,y1,x2,y2,color='#a0ada0')=>`<path d="M${x1},${y1}L${x2},${y2}" fill="none" stroke="${color}" stroke-width="2"/>`
const wrap=(id,title,description,height,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${height}" viewBox="0 0 1000 ${height}" role="img" aria-labelledby="${id}-title ${id}-desc"><title id="${id}-title">${esc(title)}</title><desc id="${id}-desc">${esc(description)}</desc><rect width="1000" height="${height}" rx="14" fill="${paper}"/><g font-family="system-ui,-apple-system,'PingFang SC','Noto Sans CJK SC',sans-serif">${body}</g></svg>`

// Direct equirectangular projection of the supplied coordinates. No country
// polygons, point buffers or invented geographic extents fill language gaps.
const xy=([lon,lat])=>[+(30+(lon+180)*940/360).toFixed(2),+(105+(85-lat)*2.6).toFixed(2)]
const ringPath=ring=>ring.map((p,i)=>(i?'L':'M')+xy(p).join(',')).join('')+'Z'
const geometryPath=geometry=>{
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[]
  return polygons.map(polygon=>polygon.map(ringPath).join('')).join('')
}
function baseMap(land){
  const grid=[-60,-30,0,30,60].map(lat=>{const [,y]=xy([0,lat]);return line(30,y,970,y,'#d2dfe0')}).join('')
  return `<defs><clipPath id="map-clip"><rect x="30" y="105" width="940" height="390" rx="6"/></clipPath></defs><rect x="30" y="105" width="940" height="390" rx="6" fill="${sea}"/><g clip-path="url(#map-clip)">${grid}<g fill="${landColor}" fill-rule="evenodd">${land.features.map(f=>`<path d="${geometryPath(f.geometry)}"/>`).join('')}</g></g>`
}

export function languageReadingFigures(){
  const land=read('public/data/land.geojson')
  const areas=read('public/data/language-areas.geojson')
  const points=read('public/data/learning-languages.geojson')
  const overview=read('public/data/language-overview.json')
  const common={author:'山河图',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',width:1000}
  const make=(id,kind,title,caption,height,body,sourceUrl,extra={})=>({...common,id,kind,title,caption,alt:caption,height,path:`media/reading/${id}.svg`,sourceUrl,...extra,svg:wrap(id,title,caption,height,body)})
  const branches=[['日耳曼语族','英语 · 德语',170],['罗曼语族','西班牙语 · 葡萄牙语 · 法语',270],['斯拉夫语族','俄语 · 波兰语',370],['印度—伊朗语族','印地语 · 孟加拉语 · 波斯语',470]]
  const familyBody=text(42,56,'语言的亲缘：印欧语系的一部分',30)+text(42,92,'从共同祖语逐渐分化，形成远近不同的语言支系',19,muted)+
    `<rect x="42" y="273" width="185" height="78" rx="8" fill="#dde5d6"/>`+text(134,322,'印欧语系',28,ink,'middle')+
    line(227,312,275,312)+line(275,170,275,470)+branches.map(([branch,languages,y])=>line(275,y,316,y)+`<rect x="316" y="${y-32}" width="250" height="64" rx="7" fill="#e7eadd"/>`+text(441,y+8,branch,24,ink,'middle')+line(566,y,605,y)+text(625,y+8,languages,22)).join('')+
    text(42,552,'概念示意 · 只列部分分支与语言，省略中间层级；线长不表示年代。',18,muted)
  const family=make('language-family-tree','diagram','语言的亲缘：印欧语系的一部分','英语与德语是较近的亲属，西班牙语、葡萄牙语与法语属于另一支；印地语与波斯语也在这个大家族中。只列部分成员，不表示分化年代。',580,familyBody,'https://glottolog.org/resource/languoid/id/indo1319')

  const chosen=[['zh','#527ab1'],['en','#b7802e'],['es','#b96650'],['pt','#5a9565'],['fr','#8d70a5'],['ar','#399895'],['ru','#7b8e9d'],['hi','#b46f92'],['bn','#77963d']].map(([id,color])=>({...overview.categories.find(c=>c.id==='group:'+id),color}))
  const plotted=[]
  const colored=chosen.map(category=>{
    const features=areas.features.filter(f=>category.areaMembers.includes(f.properties.glottocode))
    plotted.push(...features.map(f=>f.properties.glottocode))
    return `<g fill="${category.color}" fill-rule="evenodd" fill-opacity="0.86">${features.map(f=>`<path d="${geometryPath(f.geometry)}"/>`).join('')}</g>`
  }).join('')
  const legend=chosen.map((c,i)=>{const x=45+(i%3)*315,y=540+Math.floor(i/3)*35;return `<rect x="${x}" y="${y-17}" width="22" height="18" rx="3" fill="${c.color}"/>`+text(x+34,y,c.name,22)}).join('')
  const world=make('language-world-areas','map','几种主要语言，分布在哪里','九组常见语言的使用参考区。色面取自2007年《世界语言地图集》，并非今天的实时分布；汉语和阿拉伯语合并展示其已收录变体。多语地区可能重叠，灰色陆地还使用许多未在本图着色的语言。',680,
    text(42,56,'几种主要语言，分布在哪里',30)+text(42,88,'2007 年图集使用区 · 九组语言举例',19,muted)+baseMap(land)+`<g clip-path="url(#map-clip)">${colored}</g>`+legend+text(42,653,'灰色陆地：未在本图着色的区域。颜色不表示人口或官方地位。',18,muted),
    'https://doi.org/10.5281/zenodo.18613195',{
      author:'山河图制图；Glottography / Asher & Moseley；Natural Earth',
      sourceUrls:['https://doi.org/10.5281/zenodo.18613195','https://glottolog.org/glottolog/glottologinformation','https://www.naturalearthdata.com/about/terms-of-use/'],
      processing:'直接投影本站Glottography v2.0的2007图集概化多边形；按language-overview.json明确列出的Glottocode合并九组语言着色，未按国界补面。Natural Earth 50m陆地为公有领域背景；裁去南极，不作面积比较。',
      featureIds:plotted,
    })

  const austronesian=points.features.filter(f=>f.properties.familyId==='aust1307')
  const dots=austronesian.map(f=>{const [x,y]=xy(f.geometry.coordinates);return `<circle cx="${x}" cy="${y}" r="2.5" fill="#258b83" fill-opacity="0.65"/>`}).join('')
  // Place names orient the reader; only the actual Glottolog points carry data.
  const labels=[['马达加斯加',[47,-20],555,440],['台湾',[121,24],800,217],['菲律宾',[123,11],890,270],['印度尼西亚',[118,-5],735,405],['夏威夷',[-155,20],60,220],['新西兰',[174,-41],850,478],['拉帕努伊岛',[-109,-27],155,440]]
  const callouts=labels.map(([name,coord,x,y])=>{const [px,py]=xy(coord);return line(px,py,x,y-8,'#71867e')+text(x,y,name,21,ink)}).join('')
  const ocean=make('language-austronesian-points','map','远隔重洋的南岛语系','绿色圆点是Glottolog 5.3所收录南岛语系语言的参考位置。马达加斯加、东南亚岛屿和太平洋上的语言，在这里显出跨海的亲缘联系。一个点代表一条语言记录，不表示人口、完整使用区或迁徙航线。',580,
    text(42,56,'远隔重洋的南岛语系',30)+text(42,88,'从印度洋到太平洋 · 语言参考位置',19,muted)+baseMap(land)+`<g clip-path="url(#map-clip)">${dots}</g>`+callouts+
    `<circle cx="52" cy="535" r="5" fill="#258b83"/>`+text(68,542,'语言参考点 · Glottolog 5.3',21)+text(600,542,'位置不代表人数或分布边界',19,muted),
    'https://glottolog.org/resource/languoid/id/aust1307',{
      author:'山河图制图；Glottolog 5.3；Natural Earth',
      sourceUrls:['https://glottolog.org/resource/languoid/id/aust1307','https://www.naturalearthdata.com/about/terms-of-use/'],
      processing:'只选择本站Glottolog 5.3中familyId=aust1307的真实语言级参考点，直接投影，未扩散成面；背景为公有领域Natural Earth 50m陆地。地名引线只帮助定位，不表示语言联系或航线。',
      featureIds:austronesian.map(f=>f.properties.glottocode),
    })
  return [family,world,ocean]
}
