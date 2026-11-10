// Curated excerpts from the existing sourced articles, paired with map observation prompts.
// Section references remain stable when article order changes; no full article is loaded by the map.
const guide=(sections,cases)=>({sections:sections.split(' ').map(ref=>ref.includes(':')?ref.replace(':','-section-'):'section-'+ref),cases:cases.map(([id,prompt])=>({id,prompt}))})
export default {
  'china-terrain':guide('china-relief-steps:1 china-relief-steps:3 china-basins:1 china-plains:1',[
    ['tibetan-plateau','先找西部高地，再沿河流观察向东的高低变化。'],['qaidam-basin','把盆底与周围山地比较，区分相对低地和绝对海拔。'],['yangtze-middle-lower-plain','对照河道、湖泊与平原，思考低地怎样接收上游来水。']]),
  'china-rivers':guide('china-rivers:1 china-rivers:2 china-lakes:3',[
    ['yangtze','沿干流看上游高地、中游湖泊与下游河口的联系。'],['tarim-river','观察山地、沙漠与河流的位置，比较它与入海河流的去向。'],['poyang-lake','把湖泊放回长江水系，结合解读认识季节性的江湖联系。']]),
  'world-terrain':guide('world-mountain-ranges:1 world-mountain-ranges:2 world-plateaus-plains:1 world-high-peaks:1',[
    ['andes','沿南美洲西侧辨认山地带，再比较它与海岸和低地的位置。'],['amazon-basin','从盆地向周围高地看，联系河流汇集的方向。'],['summit-everest','放大看一座山峰，再缩小看它所属的山脉与高原边缘。']]),
  'world-rivers':guide('world-river-contrast:1 world-river-contrast:2 world-lakes:2',[
    ['nile','沿河向上寻找水源地区，比较上游与下游的环境。'],['amazon-river','与尼罗河对照，用相同问题看降水背景、支流与河口。'],['caspian','先看湖泊有没有通海出口，再阅读水量与盐分的关系。']]),
  'map-climate':guide('map-climate:1 map-climate:2 climate-causes:2 world-latitude-height:1',[
    ['tibetan-plateau','将高原与同纬度低地对照，分开理解纬度和海拔。'],['atacama-desert','观察海岸、山地与干旱区的相邻关系，再阅读干旱成因。'],['indian-monsoon','结合海陆位置阅读雨季与风向，留意长期分类和季节变化的区别。']]),
  'map-population':guide('map-population:1 map-population:2 people-migration:1',[
    ['population-density','先确认图例表示密度，再比较人口集中的地区。'],['china-population','核对国家总量的年份与范围，避免把总量当作密度。'],['shanghai','把城市放回沿海、河口与周边地区，思考人口聚集的条件。']]),
  'map-religion':guide('1 2 4',[
    ['religious-diversity','先读统计年份和分类口径，再解释地图上的颜色。'],['christianity','比较同一类别在不同国家的比例，留意各国内部差异。'],['unaffiliated','核对这一统计类别的定义，避免混用不同调查的口径。']]),
  'map-language':guide('1 2 3',[
    ['language-diversity','切换国家概览、地方使用区与参考点，辨别各自表达的范围。'],['official-vs-mother-tongue','读清官方语言和母语的区别，再理解国家概览。'],['arabic-language','结合语言使用区与国家边界，观察两种范围怎样交错。']]),
  'drylands':guide('world-deserts:1 world-deserts:3 china-dry-water:1',[
    ['tian-shan','从山地向两侧盆地观察，寻找绿洲来水的地形背景。'],['tarim-river','沿河看山地来水如何联系干旱低地，再读内流水量收支。'],['namib-sand-sea','对照沿海位置与沙丘景观，阅读雾、水分和沙源的联系。']]),
  'china-regions':guide('china-regions:1 china-regions:2 china-north-south:1',[
    ['northern-china','先看北方地区的位置，再比较区内平原、高原与山地。'],['southern-china','用热量、水分和地形这组相同问题，与北方对照。'],['qinling','沿山脉观察两侧环境，理解自然差异中的连续过渡。']]),
  'china-city-environment':guide('1 2 3',[
    ['beijing','结合山前和平原的位置，阅读城市用水与土地利用。'],['shanghai','观察城市与长江河口的联系，分清城区、行政区和自然地形。'],['taihu','把湖泊与周边城市一起看，思考用地、来水和水质的联系。']]),
  'agriculture-food':guide('china-agriculture:1 world-agriculture-food:2 china-food-water-cities:1',[
    ['northeast-blacksoil','从生长季、土壤与地形入手，理解农业条件怎样配合。'],['hetao-irrigation','沿黄河观察灌溉地区，阅读供水与排水为何要一起考虑。'],['mekong-delta-farming','把三角洲农业与水网、季节来水联系起来，再与内陆地区比较。']]),
  'transport-trade':guide('china-transport:1 china-transport:2 world-sea-connections:2 world-transport-trade:3',[
    ['qinghai-tibet-railway','从高原地形理解工程条件，阅读线路参考点的说明。'],['malacca-strait','辨认两侧海域与沿岸位置，思考海峡在海运网络中的作用。'],['rotterdam-port','把港口向海上和内陆两侧展开看，理解转运与腹地联系。']]),
  'earth-seasons':guide('1 2 4',[
    ['earth-rotation','结合自转示意认识昼夜，分清时刻变化与季节变化。'],['earth-season-contrast','使用观察工具改变季节和纬度，比较昼长。'],['earth-longitude-time','调整经度比较地方时，再阅读它与民用时区的区别。']]),
  'earth-map-reading':guide('earth-map-reading:2 earth-map-reading:3 earth-image-reading:1',[
    ['earth-coordinates','先用经纬度定位，留意南北纬和东西经的方向。'],['earth-contours','结合等高线示意理解山脊、山谷和坡度，核对图例与尺度。'],['yangtze-delta','在不同尺度下观察同一地区，分清自然三角洲与城市区域。']]),
  'china-provinces':guide('1 2 3',[
    ['hebei','把省区与邻省、山地和平原放在一起看，建立相邻位置关系。'],['sichuan','观察同一省区内部的高原与盆地，比较行政范围与自然范围。'],['gansu','沿省区辨认不同环境，并联系跨省的河流与交通。']]),
  'energy-industry':guide('china-energy-resources:1 china-energy-resources:3 world-energy-industry:1',[
    ['qinshui-coal','从资源地出发，阅读开采条件与运输、用水等联系。'],['hexi-renewables','结合走廊与干旱环境，认识能源利用所需的自然和工程条件。'],['ruhr-industry','比较资源、工业与运输的位置，再阅读工业地区的转型。']]),
  'world-continents':guide('world-continents:1 world-continents:3 world-regional-comparison:1',[
    ['asia-continent','先建立洲与洋的位置框架，再进入亚洲内部辨认地区差异。'],['africa-continent','用纬度、海陆和地形这组问题比较不同地区。'],['southeast-asia','把大陆、半岛与岛屿联系起来，观察区域与海洋的关系。']]),
  'world-tectonics':guide('world-tectonics:1 world-tectonics:2 landform-structures:2 landform-volcanoes:4',[
    ['himalayas','从碰撞山系观察高山与高原的联系。'],['east-african-rift','与碰撞地区对照，阅读张裂怎样留下地表线索。'],['hawaii-hotspot','把热点火山与板块边界附近的火山比较，避免只按位置套一种成因。']]),
  'world-ecosystems':guide('soil-land:1 soil-land:2 world-ecosystems:2',[
    ['northeast-blacksoil','联系植被、气候和土地利用，阅读土壤形成与保护。'],['amazon-rainforest','把森林放回流域和水热背景，观察不同条件怎样共同作用。'],['okavango-delta','沿内陆水系寻找来水方向，理解湿地为何不只受当地降雨影响。']]),
  'world-ocean-monsoon':guide('1 2 3',[
    ['gulf-stream','结合海洋位置阅读热量输送，注意参考点不表示完整流路。'],['peru-upwelling','从沿岸位置认识上升流，再与水平海流的作用比较。'],['indian-monsoon','对照海陆与山地，使用季节变化的线索阅读风和降水。']]),
  'world-polar-comparison':guide('1 2 3',[
    ['arctic-region','先认北极中心的海洋与周缘陆地，区分海冰和陆地环境。'],['antarctica','与北极对照，观察大陆冰盖、周围海洋和纬度背景。'],['southern-ocean','把南极放回相连海洋中，阅读海洋、冰与生态的联系。']]),
  'landform-processes':guide('landform-processes:2 landform-processes:3 earth-rocks:1 landform-danxia:2',[
    ['himalayas','从高大山地追问构造抬升与地表改造如何共同作用。'],['loess-plateau','把黄土堆积与沟谷侵蚀分开理解，再看它们怎样叠加。'],['danxiashan','结合照片与解读观察岩层、裂隙和陡崖，避免仅凭颜色判断成因。']]),
  'landform-karst':guide('1 2 3',[
    ['guilin-karst','对照照片与河谷位置，辨认峰体和低地的组合。'],['shilin-karst','与桂林的峰林比较，阅读石柱与溶沟形成的条件。'],['wulong-karst','把峡谷、天生桥和地下水联系起来，理解地上与地下的过程。']]),
  'landform-rivers':guide('landform-river-erosion:1 landform-river-deposition:1 landform-river-deposition:3',[
    ['yangtze','从高地河谷向下游观察，比较侵蚀与堆积的环境。'],['north-china-plain','把低平地形与汇入河流一起看，阅读泥沙的搬运和沉积。'],['yangtze-delta','到河口继续追踪泥沙，辨别自然三角洲与城市区域的范围。']]),
  'landform-wind':guide('landform-yardang:1 landform-dunes:2 landform-loess:1 landform-loess:3',[
    ['gobi-desert','先看地表类型的解读，分清戈壁、沙丘和风蚀地貌。'],['namib-sand-sea','结合沙丘照片读坡面与沙源，注意照片只代表局部景观。'],['loess-plateau','联系细颗粒堆积与雨水侵蚀，认识塬、梁、峁和沟壑。']]),
  'landform-glaciers':guide('1 2 4',[
    ['alps','结合山地位置与示意图，认识冰川谷地的形态线索。'],['himalayas','与阿尔卑斯比较高度与环境，区分现代冰川和过去留下的地貌。'],['great-lakes','阅读低地湖盆的形成历史，思考没有现代冰川的地方怎样保留冰川痕迹。']]),
  'landform-coasts':guide('1 2 3',[
    ['shandong-hills','结合半岛与沿海位置，阅读岩岸和邻近低地的差别。'],['yangtze-delta','把河口来沙与海洋作用放在一起，认识堆积海岸。'],['sundarbans-mangroves','沿海陆交界阅读潮汐、水网与红树林，比较不同海岸环境。']]),
  'water-cycle':guide('1 2 3',[
    ['yangtze','沿流域阅读降水、径流和储水之间的联系。'],['qinghai-lake','观察湖泊与周围山地，阅读封闭湖盆的水量收支。'],['guilin-karst','从地表河流继续想到地下，阅读孔隙、裂隙与岩溶水路。']]),
  'earth-hazards':guide('1 2 3',[
    ['himalayas','结合坡地阅读重力过程，区分自然过程与人员、设施的暴露。'],['yangtze-delta','把低平地形和上游流域联系起来，认识洪水风险需要哪些资料。'],['san-andreas-fault','阅读断层运动与风险的区别，地图定位不代表实时危险程度。']]),
  'weather-systems':guide('2 3 4',[
    ['beijing','观察山地和平原的位置，把天气图上的风雨放回地形背景。'],['hong-kong','对照海岸与山坡，思考水汽来源和空气抬升的条件。'],['indian-monsoon','把每日天气与季节风场分开看；本站案例不是实时天气。']]),
  'climate-change':guide('1 2 4 5',[
    ['arctic-region','区分海冰、陆冰与海洋，阅读它们在变化中的不同作用。'],['tibetan-plateau','结合高海拔与水源背景，区分冰川面积、质量和河流流量。'],['yangtze-delta','观察低平河口与城市的位置，阅读海平面、沉降和防护条件；这里不显示淹没预测。']]),
}
