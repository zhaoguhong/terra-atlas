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
