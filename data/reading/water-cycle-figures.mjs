const scienceSchool = 'https://www.usgs.gov/water-science-school/science/'
const cycle = 'https://www.usgs.gov/special-topics/water-science-school/water-cycle'
const groundwater = scienceSchool + 'groundwater-what-groundwater'
const infiltration = scienceSchool + 'infiltration-and-water-cycle'
const rivers = scienceSchool + 'rivers-contain-groundwater'

export const waterCycleReview = {
  version: 'water-cycle-2026-11-18',
  reviewedAt: '2026-11-18',
  topicId: 'water-cycle',
  sources: [
    {title: '美国地质调查局 · 水循环', url: cycle},
    {title: '美国地质调查局 · 地下水是什么', url: groundwater},
    {title: '美国地质调查局 · 下渗与水循环', url: infiltration},
    {title: '美国地质调查局 · 河流与地下水的交换', url: rivers},
  ],
  processing: '依据 USGS 水科学学校的说明改写正文并原创绘制三幅 SVG。箭头表示水的去向，剖面用于解释理想条件下的过程。原创文字与图示按 CC BY 4.0 提供。',
}

// Design at reading size. At 358 CSS pixels wide, 24 drawing units give a 16 px label.
const width = 540
const ink = '#233e39'
const water = '#196581'
const sky = '#f0f5ef'
const soil = '#e7d1a6'
const saturated = '#bededc'
const plant = '#637c50'

function label(x, y, content, size = 24, anchor = 'start') {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="${ink}">${content}</text>`
}

function arrow(d) {
  return `<path d="${d}" fill="none" stroke="${water}" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#tip)"/>`
}

function sectionPath(d, fill, stroke = 'none', thickness = 2) {
  return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${thickness}" stroke-linejoin="round" stroke-linecap="round"/>`
}

function rainfall(x, y) {
  return `<g transform="translate(${x} ${y})" fill="none" stroke="#5892a4" stroke-width="3" stroke-linecap="round">
    <path d="M0 0l-4 9m24-9l-4 9m24-9l-4 9"/>
  </g>`
}

function figure({title, caption, alt, height, sourceUrls, drawing}) {
  return {
    title, caption, alt, width, height, sourceUrls,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="title desc">
  <title id="title">${title}</title>
  <desc id="desc">${alt}</desc>
  <defs>
    <marker id="tip" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="3" markerHeight="3" orient="auto"><path d="M0 0L10 5L0 10Z" fill="${water}"/></marker>
    <pattern id="grains" patternUnits="userSpaceOnUse" width="22" height="16"><ellipse cx="5" cy="5" rx="2.5" ry="1.6" fill="#8e7958" opacity=".38"/><circle cx="16" cy="12" r="1.5" fill="#8e7958" opacity=".38"/></pattern>
  </defs>
  <rect width="100%" height="100%" rx="10" fill="#f7f5ec"/>
  <g font-family="system-ui, -apple-system, 'PingFang SC', 'Noto Sans CJK SC', sans-serif">
    ${label(22, 42, title, 28)}
    ${drawing}
    ${label(518, height - 15, '概念示意 · 非实测', 17, 'end')}
  </g>
</svg>\n`,
  }
}

export const waterCycleFigures = {
  'water-cycle': figure({
    title: '从海面到陆地',
    caption: '海面蒸发的水汽可随风到达陆地。落到山坡上的雨，一部分沿地表流入河海，另一部分渗进土里。陆地上的水也会经蒸发和植物蒸腾回到空气中。',
    alt: '海面上方的箭头向上，再随风指向山地上空的云。雨从云中落下，山坡上的两支箭头分别顺坡流向海面和向下进入土层。',
    height: 335, sourceUrls: [cycle],
    drawing: [
      '<rect x="16" y="60" width="508" height="232" rx="7" fill="'+sky+'"/>',
      sectionPath('M16 231H180L202 292H16Z', '#afd5da'),
      sectionPath('M157 292Q183 238 226 223Q277 208 310 178Q349 143 380 152Q431 165 465 139L524 115V292Z', soil, '#84744f'),
      '<path d="M256 211Q294 194 311 178Q349 143 380 152" fill="none" stroke="#869269" stroke-width="4"/>',
      sectionPath('M339 102Q330 92 342 85Q345 70 360 74Q373 59 386 74Q404 71 407 86Q424 93 412 102Z', '#c8dce0'),
      rainfall(357, 110),
      arrow('M75 222V126'), label(25, 178, '蒸发'),
      arrow('M120 100Q206 69 312 91'), label(183, 130, '水汽随风移动', 22),
      label(419, 124, '降雨'),
      arrow('M320 177Q269 213 222 227T146 250'), label(193, 280, '地表径流'),
      arrow('M368 158Q371 203 380 232'), label(398, 211, '下渗'),
      label(26, 274, '海洋'),
    ].join('\n'),
  }),
  'rain-infiltration': figure({
    title: '同一场雨，两种地面',
    caption: '左侧的柏油路很难透水，水顺路面流走。右侧的雨水能渗进疏松的土里。大雨时，草地上也会有水沿地面流走。',
    alt: '相同的雨落在左右两块缓坡上。左边的地面有连续的柏油层，箭头沿路面向低处走。右边长着草，箭头穿过地表，进入有孔隙的土层。',
    height: 325, sourceUrls: [infiltration],
    drawing: [
      '<rect x="14" y="61" width="246" height="222" rx="8" fill="'+sky+'"/><rect x="280" y="61" width="246" height="222" rx="8" fill="'+sky+'"/>',
      label(137, 96, '柏油路', 26, 'middle'), label(403, 96, '草地', 26, 'middle'),
      rainfall(66, 115), rainfall(158, 115), rainfall(332, 115), rainfall(424, 115),
      sectionPath('M14 164L260 192V283H14Z', soil),
      sectionPath('M14 164L260 192V283H14Z', 'url(#grains)'),
      sectionPath('M14 151L260 179V193L14 165Z', '#738184'),
      sectionPath('M280 152L526 180V283H280Z', soil),
      sectionPath('M280 152L526 180V283H280Z', 'url(#grains)'),
      sectionPath('M280 152L526 180', 'none', plant, 5),
      sectionPath('M294 154l-4-10m4 10 5-14m25 17-2-13m2 13 6-8m123 20-4-12m4 12 5-11m34 15-2-10m2 10 6-7', 'none', plant, 2.4),
      arrow('M57 150L224 169'), label(136, 235, '沿路面流走', 24, 'middle'),
      arrow('M356 151Q356 181 344 205'), arrow('M421 158Q421 186 414 213'),
      label(403, 258, '渗进土里', 24, 'middle'),
    ].join('\n'),
  }),
  'groundwater-river': figure({
    title: '地下水怎样补给河流',
    caption: '河岸的砂砾层与河床相通，地下水面向河边倾斜，水便可从饱水层渗入河道。蓝色区域表示孔隙中充满水的地层。',
    alt: '河谷横剖面中，两岸的地下水面向中间降低，与河面相接。地下水面下方仍有砂砾，两支箭头从这些饱水砂砾指向较低的河床。',
    height: 335, sourceUrls: [rivers, groundwater],
    drawing: [
      '<rect x="16" y="62" width="508" height="233" rx="7" fill="'+sky+'"/>',
      sectionPath('M16 103Q129 119 201 169Q229 195 251 204Q271 217 292 200Q314 175 343 157Q430 105 524 96V295H16Z', soil),
      sectionPath('M16 146Q131 153 210 180L330 180Q411 150 524 142V295H16Z', saturated),
      sectionPath('M16 103Q129 119 201 169Q229 195 251 204Q271 217 292 200Q314 175 343 157Q430 105 524 96V295H16Z', 'url(#grains)'),
      sectionPath('M16 146Q135 153 213 180M321 180Q415 150 524 142', 'none', water, 2.8),
      sectionPath('M213 180H321Q303 189 292 200Q271 217 251 204Q228 194 213 180Z', '#70b5c8', water, 1.6),
      sectionPath('M16 103Q129 119 201 169L213 180M321 180Q391 117 524 96', 'none', '#84744f', 2),
      label(268, 158, '河流', 25, 'middle'), label(35, 96, '地下水面', 22),
      sectionPath('M85 103L85 150', 'none', '#53696a', 1.5),
      arrow('M93 196Q178 226 243 199'), arrow('M457 192Q390 221 301 199'),
      label(270, 273, '孔隙里充满水的砂砾层', 24, 'middle'),
    ].join('\n'),
  }),
}
