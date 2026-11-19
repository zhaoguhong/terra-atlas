# 验证与浏览器测试

[返回项目首页](../README.md)

## 常规检查

```sh
npm ci
npm run data:check
npm test
npm run build
```

数据检查读取随仓库提供的文件及校验记录，不需要原始数据缓存。它能验证清单同步、绑定和输出哈希，不能代替重新核读全部来源或原始几何核验。构建检查源码及随站数据和静态产物各自不超过 100,000,000 字节。

修改国家语言解析逻辑时，另外运行 `python3 -m unittest discover -s scripts -p 'test_country_languages.py'`，检查词源／克里奥尔名称、混合条目、来源顺序与未译名称的保留。`tests/optimization.spec.ts` 覆盖独立的“随便看看”入口、换一批、面板固定、普通地图对象对比、手机对比摘要及国家资料缺失状态。

## 生产冒烟测试

```sh
npx playwright install chromium
npm run test:e2e:smoke
```

先完成生产构建。冒烟配置会在独立端口自动启动预览，不复用未知服务器；桌面和手机均检查真实地图绘制、搜索阅读、收藏与分享恢复、主题图例和许可文件。它使用 Playwright Chromium，不依赖系统 Google Chrome，也不启用外部在线地图服务。

如果当前网络无法下载 Chromium，可在已安装 Google Chrome 的机器上使用 `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e:smoke` 做本地检查。报告应注明实际浏览器；这不代表默认 Chromium 或 GitHub CI 已经运行通过。

可用 `SMOKE_BASE_PATH=/terra-atlas/` 检查相应子目录构建，例如：

```sh
npm run build -- --base=/terra-atlas/
SMOKE_BASE_PATH=/terra-atlas/ npm run test:e2e:smoke
```

完成后如需恢复根路径预览，重新执行默认构建。

## 完整交互回归

另开终端启动预览：

```sh
npm run preview -- --port 4176 --strictPort
```

默认完整回归使用本机 Google Chrome，覆盖桌面、手机竖屏和手机横屏：

```sh
SITE_URL=http://127.0.0.1:4176 npm run test:e2e
```

也可使用已安装的 Playwright Chromium：

```sh
PLAYWRIGHT_CHANNEL=chromium SITE_URL=http://127.0.0.1:4176 npm run test:e2e
```

配置不自动重试失败用例。报告、截图和失败 trace 默认位于忽略的 `.local/verification/`；`EVIDENCE_DIR` 和 `RESULT_FILE` 可另设输出。冒烟用例单独运行，不重复混入完整回归。

在线地图回归中的受控瓦片测试与真实服务连通／绘制检查分别记录。CI、浏览器模拟手机视口或 HTTP 成功响应不代表真机、全部网络或真实外部地图交互已经通过。

语言主题回归：`npm run test:e2e -- tests/theme-legends.spec.ts` 包含广东、海口、三亚的实际国家色面查询、图例汉语筛选，以及切换地方视图后汉语方言合并与粤语单独筛选。

`tests/discovery-navigation.spec.ts` 验证“主题／随便看看”切换保留相机与主题、独立地点阅读、返回主题、浏览器后退，以及范围和分类对推荐与随机跳转同时生效。

`tests/area-presentation.spec.ts` 检查四大地理区实际色面及代表地点命中、搜索定位到地形／大洲完整范围、跨日期线的北美洲，以及“蒙古高原”和“内蒙古高原”不混绑、河流仍为线与山峰仍为点。结合 `tests/exploration.spec.ts`、`tests/dateline-navigation.spec.ts` 和 `tests/theme-legends.spec.ts` 验证搜索、地图点击、视野与图例；新增范围的输入与输出哈希由 `data:check` 核验，数字化分区的配准、有效性、覆盖与互不重叠由 `scripts/build-china-regions.py` 验证。

`tests/review-fixes.spec.ts` 覆盖关闭城市／流域／板块图层后的收藏与视图恢复、真实几何和保存相机、异步恢复被新选择取消、首页退出工具与收藏页、搜索组合框键盘语义、对比筛选、删除撤销，以及新收藏名称和视图要素引用的持久化。首页默认“随便看看”，完整主题库由“主题”入口打开；主题分类需要展开后选择。搜索框使用 `combobox` 角色。

### 外观模式回归

`tests/appearance.spec.ts` 覆盖跟随系统、实时系统外观变化、手动日间／夜间覆盖、重载持久化、旧收藏与笔记迁移，以及本地存储不可用时的降级。三个视口检查夜间搜索、阅读面板、资料弹窗和手机更多菜单；切换前后核对相机、选中几何、专题配色与日间底图恢复。在线详细底图使用受控瓦片夹具，确认异步加载后采用当前外观，外观切换不重新请求元数据。

外观只修改界面、底图和文字对比度；气候、人口、语言、宗教等专题图层与图例继续使用原来的数据颜色。分享链接和保存的地图视图不会覆盖接收浏览器的外观偏好。浏览器测试中的手机视口是触摸模拟，不能替代实体设备验收。

## 完整专题阅读

`npm run test:e2e -- tests/reading.spec.ts` 在桌面、手机竖屏和横屏检查：地图不提前请求完整正文、30 个主专题检索、真实图片与许可、大图键盘关闭、案例地图往返、浏览器前进后退、章节恢复、收藏与导出导入、冷启动分享链接、网络失败重试和日夜布局。

`npm run data:check` 另检查全部文章、章节 ID、地点链接、媒体来源与文件哈希，保证每张精选卡片都有完整阅读入口。专题来源为 `data/reading/`；修改后运行 `npm run reading:build`，同步公开正文与来源清单，再运行检查。照片下载与原始查询缓存不参与构建，日常构建无需外部图片服务。

初始32份校订稿保存在 `data/reading/edited-topics/`，作为后续修订的基线输入；`language-lesson.mjs` 保留语言篇原始结构与来源。生成阶段先核对基线章节地址、分组、案例与来源，再应用地貌与世界地理新稿，允许重排章节和配图，检查篇内图片不重复。数据检查要求公开文章与实际采用的校订稿或 `*-articles.json` 一致，简版与 `data/reading/map-essays.json` 或对应的 `*-map-guides.json` 一致，且每段指向支持它的完整章节。比较表检查列数和内容，数值图保留原有来源。写作方向见 `docs/writing.md`；文字编辑不代表重新核验了全部外部资料。

`tests/editorial-reading.spec.ts` 从目录逐篇打开30个主题，核对每篇真实图片加载，并遍历所有插图与数据地图；另检查两极篇的介绍顺序、图片放大、非分组文章手机选章及刷新恢复，以及日夜正文的横向溢出。`tests/china-terrain-reading.spec.ts` 保留中国地形四幅位置插图的真实地图入口与阅读往返检查。手机与横屏仍是浏览器模拟。

`tests/topic-consolidation.spec.ts` 验证30个主主题、旧标题搜索到具体章节、同一主主题内连续跳转、手机分组目录、丹霞与14座高峰地图入口、新天气与气候变化正文，以及新收藏与分享章节。单元测试逐项核对59份原始正文、模块、问题、来源和地点仍可抵达对应主主题。

`tests/map-topic-list.spec.ts` 检查地图侧栏的“主题地图”标签：打开30主题列表时保持地图与视野，卡片主操作直接切换地图主题，当前主题标记、返回列表及独立图文阅读入口均可用。

`tests/map-guides.spec.ts` 验证地图侧栏导读默认展开、说明与案例入口先于全文按钮、真实案例定位与返回、配图及完整文章按需进入；数据校验逐项核对30个主题的导读出处与案例ID。

`tests/reading-reload.spec.ts` 在桌面、手机竖屏和横屏检查刷新恢复：主题目录的范围／分类／搜索、专题章节与段内位置、刚滚动就刷新、地图案例与返回阅读、浏览器前进后退、旧版已打开页面，以及多个标签页的阅读位置互不覆盖。新打开的分享链接优先进入指定章节，刷新同一链接则延续后续学习状态。

地貌两篇修订阶段，目录数量由32减至28，随后经世界地理拆分更新为当前30篇；原32份校订输入保留作溯源。`tests/landform-reading.spec.ts` 专门验证旧主题／章节分享、旧收藏和进度迁移、5／9节目录、长文插图位置与地图往返。既有阅读、刷新和地图导读测试同步改用新篇及大章节，其他主题的测试继续保留。

七大洲、五大洋与世界区域比较拆分后，当前目录为30篇。对应新稿、地图简版和来源分别在 `data/reading/world-geography-{articles,map-guides,sources}.json`，旧32份校订输入仍作溯源。`data:check` 核对七洲／五洋面积图与记录的原始数值及单位，单元测试另核对逐洲逐洋介绍与旧问题进度迁移。

`tests/world-oceans-reading.spec.ts` 在三个视口验证旧主题和章节分享、刷新、拆分后的收藏及进度、七洲／五洋面积图与真实地图往返；`tests/reading-inline-map.spec.ts` 验证配图地图按需创建、真实点面、主地图句柄独立、一次一个实例、收起释放、夜间模式、完整地图往返及几何请求失败重试；`reading-inline-map-loading.spec.ts` 拦住真实几何请求，检查初始化前控制不可选、加载完成后地点选择与定位一致。全部主题的图片与正文检查继续由 `editorial-reading.spec.ts` 遍历。手机与横屏仍为浏览器模拟。

同时运行多个Playwright命令时，应分别设置 `EVIDENCE_DIR` 与 `RESULT_FILE`，避免一个运行清理另一个运行的trace或截图目录。

## 目录布局与区域表达

`tests/study-layouts.spec.ts` 检查“学主题”的分类默认展开、不再出现基础推荐入口，以及图文卡片／紧凑列表／分类目录的切换、搜索筛选保持、刷新、多标签页和本地存储不可用。三个视口同时检查阅读与地图入口及横向溢出。

`tests/area-presentation.spec.ts` 和配图地图测试检查四大高原都有实际色面，内蒙古高原按新来源范围绘制；区域搜索仍区分内蒙古高原与更大的蒙古高原，并核对锡林郭勒、呼伦贝尔命中，北京、鄂尔多斯和乌兰巴托不命中。`tests/map-extent-clarity.spec.ts` 另检查五大洋、地中海与两个海峡的真实面绘制、默认可见的范围说明及仍只定位的区域说明。

`tests/china-presentation.spec.ts` 检查中国范围实际覆盖台湾、台湾省面、中文搜索与点击归属，以及宗教、语言的分列统计仍使用原始统计范围。`scripts/check-china-presentation.py` 对照固定原始输入核验中国几何合并、台湾省与福建省的金门分配，并把独立记录写入私有验证目录。`data:check` 核对全216张卡片和30主题的范围审核、来源副本、明确ID、地名校订和输入输出哈希；不把程序通过等同于精确地貌测绘。

`tests/selection-restoration.spec.ts` 检查旧浏览记录中的地点名称、范围说明和台北国家首都标记会从当前资料恢复；保留原来的坐标、真实要素ID、气候子类、视野与阅读位置，并检查地点浏览轨迹和前进后退。台港澳城市恢复只使用生成的明确ID元数据，不按近似名称或坐标猜测归属。

`tests/reading-map-links.spec.ts` 遍历全部30篇专题，核对原有案例地点仍可通过章节、配图或图表进入地图，同节不重复展示相同地点，正文不横向溢出；另检查34个省级行政区的简短地名、至少44×44像素点击区域、键盘操作、地图往返、刷新与日夜截图。桌面、手机竖屏和横屏均运行。章节入口的展示取舍集中在 `src/lib/reading-map-links.ts`：概览中重复的地点保留在专门解释它的章节，同节已有直接入口的插图或图表不再追加相同链接；案例数据和正文保持完整。

## 专题 SEO 与体积优化

`tests/topic-seo.spec.ts` 核对全部 30 篇 HTML 正文、目录链接、逐页 canonical 和站点地图，以及桌面／手机的独立网址、明确继续阅读、冷启动不请求地图几何、多标签页章节优先级、刷新和地图往返。阅读冷启动不创建主地图；阅读回归使用 `studyReady` 检查实际页面，地图操作仍使用 `baseReady`、真实绘制与要素断言。

生产几何以 `.geojson.gz` 无损提供，故网络拦截同时接受开发 `.geojson` 与发布 `.geojson.gz`。构建时逐文件解压比较与双哈希校验不能替代地图交互回归。容量、缓存边界和压缩约定见 [加载与体积](performance.md)。
