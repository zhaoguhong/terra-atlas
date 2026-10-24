# 数据、内容与重建

[返回项目首页](../README.md)

## 架构与内容

React + TypeScript + Vite，MapLibre GL JS 渲染地图，Lucide 提供图标，界面使用普通 CSS。`dist/` 是纯静态产物，可由 Nginx 或其他静态服务器托管；无业务后端、数据库或地图 API 密钥。核心地图、分类网格、地名索引和知识内容从本站加载，收藏与偏好存于当前浏览器的 localStorage。可选的详细底图和三维地形由浏览器直接从在线瓦片服务按当前视野请求，不将全球数据包下载进项目或服务器。

### 在线地图与体积预算

- 默认“自然地理”使用现有本地地图，首次打开不请求第三方地图服务。
- 选择“详细地图”后，按需访问 [OpenFreeMap](https://openfreemap.org/quick_start/) 的 OpenMapTiles 矢量瓦片。道路、聚落和水体作定位背景；知识卡、国家／省区参考范围及真实要素 ID 仍使用本站数据。中文优先，缺失时显示英文或当地名称；文字使用浏览器本地字体。
- 开启“三维地形”后，按需访问 [Mapterhorn](https://mapterhorn.com/data-access/) 的 Terrarium 高程瓦片，原生读取上限12级，地形高度倍率1。主要全球基础源为 Copernicus GLO-30（名义30米地表模型），各地区源数据精度不同。点查的既有珠峰／富士山采样仍使用本地 Mapzen 数据，不将两个来源混作同一测量。
- 关闭在线功能时移除相应图层和数据源、取消未完成的请求；不预取全球地图，不将瓦片写进 localStorage。MapLibre 每源缓存最多64张瓦片、3个缩放级别，限制额外缓存；该限制不是浏览器总内存上限。
- 在线服务的元数据请求超时或瓦片加载失败时，保留本地基础地图与知识功能，并提供重试。在线细节需要网络，公共服务没有可依赖的可用性承诺；接入成功不代表已验证所有国内网络。
- 源码及随站数据、生产构建各自限制为 **100 MB（100,000,000字节）**。`npm run build` 自动检查；单独检查源码使用 `npm run size:check`。源码包不计 `node_modules/`、`dist/`、`.local/`、`data/raw/` 和测试运行产物。

服务版本、许可、处理说明和验证方式见 `data/research/online-map-sources.json` 及其公开副本 `public/data/online-map-sources.json`。在线服务会更新，不将其动态瓦片声称为固定校验过的本地数据。

### 主题与辅助图层

“主题”位于“图层／主题／收藏”面板，手机也可从地图上的“主题探索”直接进入。主题库默认展示全部主题，可在库内选择“全部主题／中国地理／世界地理”，再按地理内容筛选；人口、宗教、语言与长期气候分布在两种范围均可阅读。顶部“定位中国／全球视野”只调整地图视野，保留主题、成员和阅读位置，不改变主题库筛选。返回主题库或切换面板后保留地域、分类和搜索，浏览器后退／前进也恢复这些条件。每次仅一个主题生效，切换同步替换地图展示、图例和介绍。地形、水系、城市与首都、流域分区、板块边界、国家／省区轮廓和经纬网仍可叠加。

40个主题与122个模块的介绍逐项重写：先显示摘要与核心对比，正文和模块细节按需展开；39个主题带条形图、对照表或运动示意。七洲面积使用同一2019研究的2015±2年遥感岸线统计，单位百万平方千米，数值与常见教材约数的口径不同。每个数值图保留来源、单位和说明。审查记录见 `data/research/topic-intro-review.json`。探索笔记界面已移除，旧本地记录中的笔记字段仅作兼容保留。

40个主题按资料与阅读任务选择色面、线或点：分布资料用色面，河道用线，山峰与交通案例使用可辨识符号；只有范围一致的真实几何才画区域。缺少范围的成员保留参考点，并在介绍与图例明确说明。地图下方始终显示当前颜色和符号；展开后可查看全部项目、资料口径与辅助图层，项目较多时可搜索。人口使用七档分级颜色，气候默认A–E五大类，也可切换详细分类，实际绘制颜色与图例保持一致。

“语言分布”默认显示地图集参考区域，提供“语言区域／语系概览／语种参考点”三种方式。总览用十个主要类别的独立颜色和明确标注的灰色“其他”类别；其他语言或语系可以搜索、筛选后单独查看。地图、图例、保存视图及分享均记录当前展示方式与筛选。

主题库按区域认识、地形地貌、河流湖海、气候环境、人口文化、资源与交通、地球与地图七类组织，可同时搜索主题名、模块和成员地名。进入主题先看介绍和观察问题，再从学习模块打开成员；每个成员保留自己的位置、成因、关联解释、问题和来源。

地方集合选中后全览所有成员，点击成员在同一侧栏阅读并定位，保留其他成员的主题高亮。顶部始终提供主题库、主题全览和成员翻页；进入相关地点可返回上一地点。浏览器后退／前进恢复主题、成员、地图视野与分布筛选。分布主题保持当前地图视野。桌面左侧阅读、右侧地图。手机竖屏使用可上下拖动的底部面板，支持标题条、半屏、全屏三个位置；展开后优先滚动正文，正文位于顶部时向下拖动可收起。手机横屏采用左侧地图、右侧全高资料栏；右侧栏可左右拖动，或通过按钮切换资料入口、地图与资料、全文阅读三种布局，正文独立上下滚动。横竖屏切换及资料宽度改变时保留当前阅读段落，当前地点保持；拖动取消会恢复原布局。拖动条也支持点击及键盘方向键、Home／End。全屏阅读覆盖地图区域，收起后图例与地图工具恢复；“看地图”或地点“定位”可收起阅读区并重新定位。保存视图、分享和刷新记住主题；旧浏览器记录中的人文图层迁移为一个分布主题，保留收藏与旧记录兼容性。

山地形成、湖泊成因、人口尺度与文化资料口径已经合并到对应主题，旧分享链接仍会打开合并后的入口。地球与地图主题附昼长、经度地方时与比例尺实验，明确理想球面模型、地方时和民用时区、纸图距离和屏幕距离的区别。

中国平原使用常见的“三大平原”概括，入口为“中国主要平原”；不增造第四个平原。世界高峰使用UIAA经典十四座8000米主峰口径。没有匹配真实范围的对象使用代表点，不将更大地理区域替代为边界。

### 新增辅助图层

- 城市与首都：Natural Earth固定提交的代表聚落，源`NE_ID`作为稳定标识；按缩放显示，首都符号仅表示来源版本中的记录。
- 流域与分水岭：BasinATLAS v1.0 第 3 级汇水分区，含沿海及内流分组；并非全部是命名大河的完整流域，概化分界也不是精确山脊。北纬60°以北资料较粗，南极未覆盖。
- 板块边界：USGS公开服务完整ID目录分批读取，保留汇聚、分离、转换与其他类别；不把案例点连成边界。
- 三层默认关闭、开启后按需读取本地GeoJSON，收藏、保存视图与分享保留开关。城市和板块原始缓存留在`data/raw/auxiliary/`，流域输入留在`data/raw/basin-atlas/`；版本、许可与输入输出SHA-256见`data/research/auxiliary-sources.json`及公开副本。
- 重建：在独立 Python 环境安装 `scripts/requirements.txt` 中的依赖后执行 `python scripts/build-auxiliary-data.py`；通过 HTTP 范围请求只读取第 3 级 ZIP 成员，缓存哈希不符即停止。随后执行 `python scripts/check-auxiliary-data.py`，逐要素对照原始 ID、属性、点位和边界，检查概化误差及几何有效性。独立几何核验记录位于忽略的 `.local/basin-atlas-migration/auxiliary-independent-validation.json`。

### BasinATLAS 流域单独重建

```sh
python scripts/build-basin-atlas.py
python scripts/check-auxiliary-data.py
npm run data:check
```

使用前面说明的 Python 数据环境。`scripts/basin-atlas-inputs.lock.json` 固定官方 Figshare 9890531.v1、文件 20087237、第 3 级四个成员的长度、CRC32 和 SHA-256。下载器只提取所需 ZIP 成员，拒绝忽略 HTTP 范围的响应，不下载约 4.28 GB 的完整归档。归档 MD5 仅作官方标识，没有声称通过完整归档校验；实际成员分别通过 CRC32 和 SHA-256 验证。

仅使用真实几何及 HYBAS_ID、PFAF_ID、NEXT_DOWN、SUB_AREA、ENDO 五个核心字段；不导入 281 列环境属性。旧链接中的 `basin-hybas-` 真实 ID 保持兼容。来源清单保留原作者、许可与概化修改说明；旧 HydroBASINS 缓存不会参与重建。完整辅助层重建脚本也调用此流程。独立核验记录默认写入忽略的 `.local/basin-atlas-migration/`。

### 随站内容与数据

- `src/data/knowledge.json`：211 张精选中文知识卡片，包括中国与世界自然区域、代表国家、海洋海峡，以及人口、宗教、语言、农业与交通。每张卡片附原创区域解释、关系、观察问题和可核对来源。
- `src/data/climate-notes.json`：30种Köppen–Geiger气候的专属季节、景观、生活、区域参考与观察问题。
- `src/data/topics.json`：40个单选主题、122个学习模块，按中国／世界范围及七类地理内容组织。中国与世界各有23个入口，其中6个基础主题共享；集合、分布和地理联系统一入口；覆盖审查与后续缺口见 `data/research/curriculum-coverage.json`。
- `public/data/theme-peaks.geojson`：十四座8000米主峰的真实参考点，明确绑定Wikidata实体；版本、精度、许可和输入输出校验见 `data/research/theme-sources.json` 及公开副本。
- `src/data/feature-bindings.json`：知识卡片到真实地图要素 ID 的明确对应。缺少范围一致的图形时使用定位点，不将更宽区域当作该对象。
- `public/data/`：可点击、可搜索的地图要素和来源清单。未精选编写的对象展示**数据概览**，不自动补写未经核验的成因。
- `public/population/`：85张本地0–3级人口密度PNG瓦片；首次开启不下载近十万个网格面。网格点查保留二维格网的零值与缺失值。
- `data/research/learning-population.geojson`：保留用于独立核验的人口格网面，SHA-256与来源清单同步；不进入`public/`或`dist/`。地图使用人口瓦片，点查使用`public/data/learning-population.json`。研究目录仍计入源码包体积预算。
- `public/elevation/`：珠峰与富士山局部真实数字高程瓦片与采样格网；来源Mapzen/Tilezen，主要使用USGS SRTM/GMTED与NOAA ETOPO1，不是全球高精度数据。
- `public/terrain/`：341 张本地 JPG 地形瓦片，原生缩放级别 0–4、每张 512 像素；更高缩放为放大显示。

知识解释为核对资料后的原创中文摘编，不是教材原文，也未复制所参考开源项目的代码。地形层次和图层交互参考 [PhysicalEarth](https://github.com/jorgemelis/physicalearth)，工作区和信息面板参考 [TerriaJS](https://github.com/TerriaJS/terriajs)。依赖许可及数据归属见 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)。

以已读取的教育部2022年版地理课标公开原文检查中国与世界地理主题缺口。已确认2025年日常修订版本的权威出版与官方使用证据，但未完成2025修订全文逐项核对。地球运动、资源与交通、省区详卡等实现范围及剩余缺口记录在 `data/research/curriculum-coverage.json`；现有精选内容不代表全部课标或全部教材已经覆盖。

## 数据与精度

Natural Earth 的陆地和国家轮廓采用 1:5000 万数据；自然区域、河湖和山峰采用 1:1000 万数据，均为公共领域。山脉及其他自然区域多是**制图标注参考范围**，不能视为精确地貌边界。河流线与湖面来自真实源数据并经过概化；珠江卡片表示水系，图中主干线不表示完整流域。自然地理图层适合全球与区域尺度学习。

气候采用 **Beck 等（2023）Köppen–Geiger V3、1991–2020、官方原生 0.5° 网格**，赤道附近约 55 公里；许可为 CC BY 4.0。按分类值矢量化，并保留原始分类网格供点查；完整图例为 30 类，该分辨率实际出现 28 类，Csc／Cwc 未出现。C／D 组按最冷月 0°C 区分，没有单列 H“高山气候”。这是一段时期的长期气候分类，不是实时天气。

地点卡片按定位坐标读取同一分类格网，并提供对应的详细分类解释。该值仅代表定位点所在格网，不能概括整个山脉、流域或行政区；海洋或缺失格不作推断。月气温与降水图仍只在150公里内有真实参考点时展示，不将分类格网当作月曲线。

新增资料包含60处月气候参考点、8,070个Glottolog 5.3语言参考点、228条带时期与口径的宗教资料，以及34个中国省级参考范围。国家人口与城镇人口占比采用世界银行WDI 2024；219条国家语言概览来自固定历史资料，按资料原有顺序展示已核对的中文名称，未译名称与混合说明保留原文，同时保留处理后的完整来源片段。译名匹配完整条目，不从词源或克里奥尔语说明中推导其他语言；这些概览不表示当前法定地位、使用比例或完整语言名录。

语言色面采用Glottography v2.0对2007年《世界语言地图集》contemporary资料的数字化结果，固定输入提交`20102238acf12a2b82bd4d752356687ee2acfd6d`，CC BY 4.0。按Glottocode与本站Glottolog 5.3连接，排除bookkeeping条目，共展示4,033种语言的参考范围、180个语系与分类。它不是2026年实时分布；原图不同地区资料时期不统一，多语言交错与重叠欠表示，语组范围不冒充单一语言面。空白不表示没有使用者，色面不表示使用人数、官方地位或区域内人人只使用一种语言。边界经概化，不作为人口普查或精确行政界线。

人口采用GHS-POP R2023A、2020，真实人口求和聚合到0.5°。密度除以完整格网面积，包含格网内水域；不是街区或城市密度。宗教按国家范围展示已报告类别与比例，统计年份不同；公民、年龄限定、有归属者等口径不参与全体人口比例着色。语言点不代表使用人数、法定地位或连续使用范围，包含濒危及已消亡语种。

月气温与降水采用Beck V3同一1991–2020、0.5°资料的2026年1月修正归档。参考坐标、取样网格及沿海最近陆地取样均明确说明，图表不是站点实测或天气预报。局部DEM点查显示像元高程，像元间距约62–68米、主要源资料约90米，不能视为正式山峰海拔。

地形底图来自 Natural Earth I 50m shaded relief，使用土地覆盖配色和地形阴影，**不是精确高程色标**。输入 URL、版本、处理说明及 SHA-256 见 `public/data/sources.json`、`public/terrain/source.json`；知识来源见 `data/research/content-sources.json`，其公开副本为 `public/data/content-sources.json`。

## 再生成地图数据

以下是维护者的数据重建流程，不由 CI 自动执行；不是声称全部远程输入已在本轮重新下载。推荐 Python 3.12，依赖范围见 `scripts/requirements.txt`。输入版本与校验固定在来源清单中，Python 依赖范围本身不保证跨版本逐字节一致；重建后必须核验输出及独立记录。

仅修改前端或知识卡片时无需重建地理数据。完整重建使用独立 Python 环境；矢量与气候输入固定在 `scripts/data-sources.lock.json`，下载器验证 SHA-256 后才接受文件。原始数据缓存于 Git 忽略的 `data/raw/`。

```sh
python3 -m venv .local/data-venv
source .local/data-venv/bin/activate
python -m pip install -r scripts/requirements.txt
python scripts/data-download.py
python scripts/data-build.py
python scripts/build-learning-data.py --only religion
python scripts/build-country-context.py
python scripts/data-verify.py
cp data/research/content-sources.json public/data/content-sources.json
npm run data:check
```

`data-build.py` 生成 GeoJSON、地名索引、气候网格／图例及处理清单；`data-verify.py` 检查几何有效性、来源哈希，并将气候面重新栅格化与官方网格逐格比较。知识卡片和绑定表单独维护，不由这些脚本生成。

国家中文名沿用 Natural Earth 原始译名转简体，自然要素的通用译名覆盖不用于国家。重建国家数据后需同步宗教、国家语言与人口指标中的名称，上述两个学习数据步骤复用固定原始缓存。

高峰参考点再生成（保留手工编写的知识卡片、主题介绍和模块）：

```sh
python3 scripts/fetch-theme-research.py
node scripts/build-theme-content.mjs
npm run data:check
```

下载器按明确实体名录保存Wikidata原始快照到私有 `data/raw/themes/`；生成器核对14个固定实体ID与原始SHA-256，保留版本及精度，生成独立主题高峰GeoJSON并更新已明确绑定的卡片坐标，不重写精选介绍、主题或模块。缓存存在时复用该版本；主动更新输入后需要重新核验。原始JSON不会进入构建。

手工编辑 `knowledge.json`、`topics.json` 和绑定表后，运行 `node scripts/sync-content-manifests.mjs` 同步来源索引、主题数量及输出校验；随后运行数据验证。新增参考资料仍需人工核读，并在研究来源清单中保留版本、许可、处理说明与核查记录，脚本不代替事实核对。

语言区域再生成（需要上述Shapely环境，复用或下载固定SHA-256的原始输入）：

```sh
python scripts/build-language-areas.py
cp data/research/language-area-sources.json public/data/language-area-sources.json
node scripts/sync-content-manifests.mjs
npm run data:check
```

脚本先在忽略的`data/raw/language-areas/`校验输入、语言ID、语系、几何、岛屿与洞、概化误差及输出体积，再原子写入`public/data/language-areas.geojson`与元数据。版本、许可、处理和逐文件哈希保留于`data/research/language-area-sources.json`及公开副本；生成验证与独立复核分别保留于`language-area-validation.json`和`language-area-independent-validation.json`。修改输出后需重新核验独立记录并同步`learning-data-sources.json`中的输出哈希；旧独立记录不能代替新输出验收。

地形瓦片单独再生成：

```sh
mkdir -p data/raw
curl --fail --location https://naciscdn.org/naturalearth/50m/raster/NE1_50M_SR.zip --output data/raw/NE1_50M_SR.zip
unzip -o data/raw/NE1_50M_SR.zip -d data/raw
python scripts/build-terrain.py
npm run data:check
```

地形脚本重投影到 EPSG:3857，生成 0–4 级瓦片并记录原始 TIF 的 SHA-256。地形源独立于矢量／气候下载锁文件，复核记录见 `public/terrain/source.json`。

新增学习数据再生成（需要上述环境额外安装 `pyproj`，月气候使用归档NetCDF，脚本按固定输入SHA-256复核）：

```sh
python -m pip install pyproj
python scripts/build-learning-data.py
python scripts/build-country-context.py
python scripts/build-elevation.py
npm run data:check
```

新增来源与逐文件校验见 `public/data/learning-data-sources.json`、`public/data/country-context-sources.json`、`public/population/source.json`、`public/elevation/source.json`。原始输入留在忽略的 `data/raw/`，独立验证记录在 `data/research/`；不得将原始缓存或部署配置打入`dist/`。


## 许可范围

项目代码和原创讲解分别授权，详见[许可说明](../LICENSE-CONTENT.md)。`public/data/auxiliary-basins.geojson` 从官方 BasinATLAS v1.0 重新生成，采用 CC BY 4.0，并单独保留原作者署名、输入哈希与修改说明；未使用旧 HydroBASINS 独立产品的原始缓存。

### 世界语言概览与方言分类

默认国家视图使用 Unicode CLDR 48 国家语言资料，在全国官方／事实官方语言中选来源使用比例最高者；若无此类记录，则选已报告比例最高者。中文名称来自同版本 CLDR。分类合并按 IANA 2026-09-17 注册表的宏语言字段与真实 ISO 代码连接：汉语包括官话、粤语、闽语等，阿拉伯语也统一显示。国家轮廓只用于国家概览，不改写或补绘地方使用区。多语国家可点开查来源列出的其他语言。

运行 `python3 scripts/build-language-overview.py` 可从锁定 SHA-256 的输入重建 `public/data/language-overview.json`、来源清单与 Unicode 许可，并同步两份 content-sources。原始输入仍在忽略的 `data/raw/language-areas/`。新增版本必须先核对输入差异再改哈希；注册表更新导致校验失败时不自动接受。

国家视图没有“其他语言”汇总类别，已匹配语言逐项列名。未匹配地区仍明确显示缺资料；国家着色不表示当地每个居民的母语、语言人口比例或精确方言边界。地方视图仍使用2007年图集，不能把其空白解读为无人说某种语言。

### 区域优先的地图表达

搜索和主题共用明确的要素绑定。区域对象优先显示已核验色面，河流沿真实河道显示，峰顶、城市或工程观察案例使用定位点；名称近似不作为绑定依据。搜索列表说明“区域范围／线状要素／定位点／概念解读”，精确地名优先于相关名称的模糊匹配。211张卡片的逐项决定与15项新增面绑定见 `data/research/area-presentation-review.json`。

四大地理区采用Jiang等（2023，CC BY 4.0）图2中的北方／南方／西北／青藏分区，逐线数字化并以经纬网配准；外轮廓沿用本站既有国家数据，共同分界共用，保持四区不重叠、覆盖原有陆地掩膜。是论文图示的全国尺度参考分区，不是原作者GIS矢量文件、行政边界或精确气候界线。原始PDF留在忽略的 `data/raw/area-review/`，可复现的线迹与控制点位于 `scripts/china-region-digitization.json`，来源、许可、处理、哈希和验证在研究／公开 `china-reference-region-sources.json` 中。

```sh
python scripts/build-china-regions.py
node scripts/sync-content-manifests.mjs
npm run data:check
```

巴西高原采用原始 `NAME=BRAZILIAN HIGHLANDS`、`NE_ID=1159104225` 的参考面，不采用同译名但原始为 `PLANALTO CENTRAL` 的范围。内蒙古高原仍保留点：现有蒙古高原标注范围、自治区范围和湖区研究范围均不等同其地貌范围；未用这些候选或手绘外接框代替。其他缺少可靠区域的生态、海流与人文案例也保留说明和参考点。
