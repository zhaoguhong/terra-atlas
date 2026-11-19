// Teaching diagrams in a 540-unit frame. The primary labels remain legible
// when the reader is 358 CSS pixels wide on a portrait phone.
const paper='#f7f5ec', ink='#233e39', blue='#236b81', water='#b9dbe2', earth='#dbc398', green='#68845c', rust='#aa583b'
const label=(x,y,s,size=23,anchor='start',fill=ink)=>`<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${s}</text>`
const shape=(d,fill='none',stroke='none',width=2)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
const rect=(x,y,w,h,fill,r=0)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`
const dot=(x,y,r,fill)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`
const arrow=(d,warm=false)=>`<path d="${d}" fill="none" stroke="${warm?rust:blue}" stroke-width="3.5" stroke-linecap="round" marker-end="url(#${warm?'warm':'cool'})"/>`
function figure(title,caption,height,content){
  return {title,caption,alt:title+'。'+caption,width:540,height,svg:`<svg xmlns="http://www.w3.org/2000/svg" width="540" height="${height}" viewBox="0 0 540 ${height}" role="img" aria-labelledby="title desc">
<title id="title">${title}</title><desc id="desc">${caption}</desc>
<defs>${[['warm',rust],['cool',blue]].map(([id,color])=>`<marker id="${id}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="3.5" markerHeight="3.5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="${color}"/></marker>`).join('')}</defs>
${rect(0,0,540,height,paper,10)}<g font-family="system-ui,-apple-system,'PingFang SC',sans-serif">${label(20,39,title,29)}${content.join('\n')}${label(520,height-12,'概念示意 · 非实测',16,'end','#53675f')}</g></svg>\n`}
}

function lockScene(top,level,boat,leftOpen,rightOpen){
  const gate=(x,open)=>open?'':rect(x-3,12,6,65,'#586762')
  return `<g transform="translate(198 ${top})">
    ${rect(0,53,65,24,water)}${rect(65,level,142,77-level,water)}${rect(207,22,115,55,water)}
    ${shape('M0 77H322','none','#a29b81',5)}${gate(65,leftOpen)}${gate(207,rightOpen)}
    ${shape(`M${boat-18} ${level-5}h39l-8 9h-25z`,rust)}${rect(boat-10,level-13,13,8,'#70564b')}
  </g>`
}
function plateRow(y,title,description,mode){
  const boundary=mode==='slide'?'M115 5v63':'M114 6l8 16-9 17 5 25'
  const directions=mode==='slide'?['M90 53V14','M144 17V54']:mode==='in'?['M54 35h48','M177 35h-48']:['M100 35H53','M129 35h47']
  return `<g transform="translate(14 ${y})">${rect(10,5,208,60,'#d4dfcb',7)}${shape(boundary,'none','#625f55',3)}${directions.map(d=>arrow(d)).join('')}${label(248,30,title,26)}${label(248,58,description,21)}</g>`
}
const polarCaption='左侧的海冰由海水冻结形成，漂在北冰洋上。右侧的南极冰盖来自陆上多年积雪，压实成冰后缓慢向海岸流动。两极都有海冰。'
function pairedLake(x,name,outlet){
  return `<g transform="translate(${x} 0)">${label(125,93,name,23,'middle')}
    ${shape(outlet?'M12 204L53 140 82 195Q122 229 164 193L172 187 234 194V241H12Z':'M12 204L53 140 82 195Q122 229 164 193L194 144 234 204V241H12Z',earth)}
    ${shape('M72 187Q120 246 171 187Z',water)}
    ${arrow('M31 158l50 39')}${arrow('M128 182v-60')}${outlet?arrow('M149 185q29-1 71 5'):''}
    ${label(125,268,outlet?'水可经河流流出':'水可经蒸发离开',20,'middle')}</g>`
}
function rows(items){
  return items.map(([name,body],i)=>{
    const y=63+i*69
    return rect(17,y,506,58,i%2?'#ede6d7':'#e2eadc',6)+label(34,y+36,name,24)+label(176,y+36,body,21)
  })
}

export const processFigures={
  'canal-lock':figure('船怎样通过一级船闸','上行时，船先从低水位一侧进入。关闸后，水经输水通道进入闸室，船随水面浮高。待闸内水面与上游齐平，才打开上游闸门。图中深色竖线表示关闭的闸门。',370,[
    label(199,77,'低水位',20),label(422,77,'高水位',20),
    label(20,124,'开下游闸',24),label(20,150,'船驶进闸室',20),lockScene(78,53,106,true,false),
    label(20,214,'关闸充水',24),label(20,240,'船随水升高',20),lockScene(168,38,130,false,false),
    label(20,304,'开上游闸',24),label(20,330,'船驶出闸室',20),lockScene(258,22,249,false,true),
  ]),
  'lake-balance':figure('湖水从哪里来，又怎样离开','两类湖泊都能接收河水和降水，也会蒸发。外流湖还可经出湖河排水，封闭湖盆缺少这一河流出口。地下水也可能与湖泊交换。',308,[
    pairedLake(7,'有出湖河的湖',true),pairedLake(272,'封闭湖盆',false),
  ]),
  'climate-energy':figure('地面放出的热量去了哪里','太阳辐射使地面增温。地面向上发出红外辐射，一部分穿过大气到达太空，另一部分被温室气体吸收。大气也向各方向发出红外辐射，包括向下回到地面。',324,[
    dot(53,80,20,'#e1b36e'),rect(18,138,505,44,'#dee8dc',7),rect(18,248,505,22,earth),
    arrow('M77 103l71 136'),arrow('M223 243V72',true),arrow('M334 242V183',true),arrow('M390 136V82',true),arrow('M432 184v55',true),
    label(25,215,'阳光',22),label(175,66,'太空',21),label(274,169,'温室气体',24),label(21,295,'地面',23),label(280,295,'棕色箭头为红外辐射',20),
  ]),
  'food-water':figure('粮食离开农田以后', '作物长成后，收获、储存、加工和运输仍会影响城市能够得到的粮食。沿着来路看，城里吃的粮食也联系着产地的土地和水源。',314,rows([
    ['在田里','土壤、水和热量影响生长'],['收获后','干燥和储存减少损耗'],['到市场','运输把粮食送到消费地'],
  ])),
  energy:figure('装机容量与实际发电量','装机容量给出额定功率，发电量还取决于实际运行功率和持续时间。图中使用相同设备的两个假设时段，便于比较。',304,[
    label(25,88,'同一台额定功率 1 千瓦的设备',24),
    rect(20,109,504,56,'#e2eadc',6),label(35,146,'满功率 1 小时',23),label(324,146,'1 千瓦时',25),
    rect(20,178,504,56,'#ede6d7',6),label(35,215,'满功率 3 小时',23),label(324,215,'3 千瓦时',25),
    label(25,261,'满功率运行时，发电量随时间增加。',21),
  ]),
  'region-method':figure('怎样把两个地区放在一起比较','先明确所比较的地区范围，再看水、地形等条件怎样影响土地使用，沿河流或交通线追踪两个地区如何联系。两地都用同一组问题，差异才有明确含义。',314,rows([
    ['比范围','各自包含哪些地方？'],['比条件','水从哪里来，地势怎样？'],['比联系','人和货物沿哪些路往来？'],
  ])),
  soil:figure('地面以下的土层','表层可见根系与有机物。水向下渗时，也能把一些溶解物和细颗粒带入下层。更深处的母质为土壤发育提供矿物材料。不同地点土层的厚度、颜色和分层会变化。',314,[
    rect(20,88,217,55,'#745941'),rect(20,143,217,66,'#b39464'),rect(20,209,217,58,'#d4c099'),shape('M20 88h217','none',green,7),
    ...[55,111,185].map(x=>shape(`M${x} 89l-7 35 9 29m-9-29-17 14`,'none','#e6d7b9',3)),
    label(265,116,'表层',24),label(265,141,'根系和有机物',19),
    label(265,177,'下部土层',24),label(265,202,'物质可在这里积累',19),
    label(265,235,'母质',24),label(265,260,'成土的起始材料',19),
  ]),
  'culture-statistics':figure('同一地区可以包含多种归属','每个方块代表同样的人数，三个颜色表示三组示例。若只按人数最多的一组给整个地区着色，其余两组仍生活在这里。图中没有采用真实地区的宗教统计。',273,[
    ...Array.from({length:12},(_,i)=>rect(48+(i%6)*74,69+Math.floor(i/6)*64,47,47,i<6?'#67866d':i<10?'#c29861':'#86a8b6',5)),
    label(270,229,'每一格代表相同人数',23,'middle'),
  ]),
  'river-system':figure('河网怎样汇向同一个出口','细线表示支流，较粗的线表示干流。分水岭分隔相邻流域，流域内地表径流汇向共同的出口。虚线为概念范围。',319,[
    '<path d="M35 182Q51 69 159 75Q268 47 374 94Q442 133 451 197L467 227Q375 265 283 264Q127 274 35 182Z" fill="#e3ebda" stroke="#72886c" stroke-width="2" stroke-dasharray="7 6"/>',
    shape('M87 109Q120 145 189 159T296 196L467 227','none',blue,6),shape('M87 209Q133 191 189 159M267 93Q263 143 232 171M356 121Q365 157 345 204','none',blue,3),
    label(80,231,'支流',22),label(255,173,'干流',23),label(310,90,'分水岭',22),label(445,266,'出口',23),arrow('M398 214l61 11'),
  ]),
  upwelling:figure('海岸边的冷水从哪里来','在合适的沿岸风和地球自转条件下，表层海水可向离岸方向移动。较深处的水随之上升，常把低温、富含营养物质的海水带到近海面。',302,[
    rect(18,123,504,134,water),shape('M18 99L105 99Q130 157 161 207L193 257H18Z',earth),
    arrow('M162 137H460'),arrow('M335 235Q220 225 207 159'),
    label(24,86,'陆地',23),label(225,95,'表层海水离岸',24),label(290,203,'深处的冷水上升',22),
  ]),
  plates:figure('板块边界的三种运动','俯视同一条边界两侧的地块。汇聚时，两侧相互靠近。张裂时，两侧相互远离。沿转换边界，两侧平行于边界反向滑动。',340,[
    plateRow(59,'汇聚','两侧相向靠近','in'),plateRow(148,'张裂','两侧相互远离','out'),plateRow(237,'转换','沿边界水平错动','slide'),
  ]),
  seasons:figure('同一根倾斜的地轴','两幅地球的北极都指向右上方。左边北半球朝向太阳，北半球白昼长。半年后地球绕到右边，北半球背向太阳，白昼变短。地球、太阳的大小和距离均为示意。',300,[
    dot(270,152,29,'#e3b55e'),label(270,212,'太阳',22,'middle'),
    ...[103,437].map((x,i)=>`<g transform="translate(${x} 151)">${dot(0,0,54,water)}${shape(i?'M0 -54A54 54 0 0 1 0 54Z':'M0 -54A54 54 0 0 0 0 54Z','#829da5')}${shape('M-27 72L28 -73','none',ink,3)}${shape('M-49 -18L49 18','none',green,2)}${label(36,-63,'北',19)}</g>`),
    arrow('M229 152h-51',true),arrow('M311 152h51',true),label(103,258,'北半球夏季',24,'middle'),label(437,258,'北半球冬季',24,'middle'),
  ]),
  polar:figure('海冰浮在水上，冰盖覆在陆上',polarCaption,305,[
    label(137,89,'北冰洋',25,'middle'),label(403,89,'南极大陆',25,'middle'),
    rect(20,166,234,70,water),shape('M29 164l48-2 4 9 50-7 6 8 45-7 3 9 60-8-3 13-51 6-9-5-54 6-6-5-55 1-4-5-36 2z','#fcffff','#53828c',2),
    rect(286,187,234,49,water),shape('M288 234L319 189Q411 171 482 185L519 233Z',earth,'#958564'),shape('M319 189Q356 102 420 122Q455 128 482 185Q408 172 319 189Z','#fcffff','#53828c'),
    label(137,270,'海水结冰',22,'middle'),label(405,270,'积雪压实成冰',22,'middle'),
  ]),
  'rain-shadow':figure('湿空气越过一座山','空气沿迎风坡上升，膨胀、冷却。水汽充足时会成云降雨。越过山脊后，空气沿背风坡下沉并变暖，相对湿度可能下降。',300,[
    shape('M12 237L94 224 248 114 278 134 319 169 431 229 528 238V258H12Z',earth),
    arrow('M37 205Q151 194 236 97'),arrow('M275 99Q365 190 487 207',true),
    dot(183,115,11,'#c4d9de'),dot(197,110,17,'#c4d9de'),dot(215,115,12,'#c4d9de'),
    shape('M184 131l-7 14m19-13-7 15m19-15-7 13','none',blue,3),
    label(27,88,'抬升、冷却'),label(338,92,'下沉、变暖'),label(60,251,'迎风坡'),label(409,251,'背风坡'),
  ]),
  'weather-fronts':figure('冷空气怎样抬起暖空气','冷锋推进时，较密的冷空气贴近地面向前伸展，暖空气沿着倾斜的交界面上升。上升有利于冷却成云，能否降雨还取决于水汽等条件。',295,[
    rect(15,247,510,13,'#99ac82'),shape('M15 125Q165 127 340 247H15Z',water),shape('M16 125Q166 127 340 247','none',blue,3),
    arrow('M58 218H224'),arrow('M345 219Q278 160 199 126',true),label(43,191,'冷空气推进'),label(326,136,'暖空气上升'),
    dot(175,100,15,'#ccdbdb'),dot(194,94,22,'#ccdbdb'),dot(217,101,15,'#ccdbdb'),
  ]),
  steps:figure('从西部高地到东部低地','从西向东看，我国地势大体降低。每一级内部仍有山地和谷地。示意线概括区域高低，没有指定实测剖面路线。',288,[
    shape('M18 132L40 107 65 129 84 109 114 138 143 113 174 138 182 171 210 161 240 179 262 159 291 174 325 162 337 204 370 199 411 214 454 204 482 214 521 211V235H18Z',earth,'#75694c'),
    label(25,86,'第一阶梯'),label(197,145,'第二阶梯'),label(366,184,'第三阶梯'),label(23,262,'西'),label(494,262,'东'),arrow('M67 255H473'),
  ]),
  'climate-reading':figure('把雨季和热季放在一起看','逐月比较。这个示例里，年中几个月的降水柱更高，气温曲线也在这段时间达到高位。两种符号分别表示降水和温度，图中没有实测数值。',304,[
    rect(34,68,18,18,'#74aabc'),label(62,85,'月降水量',22),shape('M275 78h35','none',rust,4),label(319,85,'月平均气温',22),
    ...[18,21,25,39,63,80,99,89,65,48,29,22].map((h,i)=>rect(36+40*i,238-h,24,h,'#82b2bd',2)),
    shape('M47 208Q140 211 210 160Q292 99 355 149Q428 205 489 204','none',rust,4),
    shape('M26 239H516','none','#83958d'),label(31,269,'1月',22),label(227,269,'6月',22),label(461,269,'12月',22),
  ]),
  population:figure('同样的人数，不同的密度','两个区域各有十二个点。右边覆盖的面积较大，平均每单位面积的人数就较少。点数是示例，不对应实际地区。',296,[
    rect(25,106,170,108,'#d5dfc8',6),rect(238,74,275,158,'#d5dfc8',6),
    ...Array.from({length:12},(_,i)=>dot(58+i%4*34,132+Math.floor(i/4)*30,5,ink)+dot(269+i%4*69,99+Math.floor(i/4)*53,5,ink)),
    label(111,259,'面积小，较密',22,'middle'),label(377,259,'面积大，较疏',22,'middle'),
  ]),
  migration:figure('迁入与迁出要分开数','从乙地看，甲到乙是迁入，乙到甲是迁出。同期迁入人数减去迁出人数，得到乙地的净迁移人数。两个方向都很活跃时，净值仍可能接近零。',281,[
    rect(25,109,95,80,'#d7e4d0',9),rect(420,109,95,80,'#e7d4b6',9),label(72,158,'甲地',25,'middle'),label(467,158,'乙地',25,'middle'),
    arrow('M140 125H397'),label(268,105,'乙地的迁入',23,'middle'),arrow('M397 174H140',true),label(268,210,'乙地的迁出',23,'middle'),
    label(270,248,'净迁移人数 ＝ 迁入人数 − 迁出人数',21,'middle'),
  ]),
}
