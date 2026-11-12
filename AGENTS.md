# Project

山河图（Terra Atlas）用于个人学习中国与世界地理，兼顾整体认识与自由探索。首页突出自由探索地图，不要求严格按教材或固定学习顺序组织内容。

# Implementation

- 使用 React、TypeScript、Vite、MapLibre GL JS 和普通 CSS；保持 `dist/` 为纯静态站点。
- 核心地图与知识数据随站点提供。收藏、偏好和保存视图使用当前浏览器的本地存储。
- 地理数据原始缓存、验证记录与部署配置分别位于 Git 忽略的 `data/raw/` 和 `.local/`；不得进入公开构建产物。
- 专题正文与地图导读先修改 `data/reading/` 中的对应输入，再运行 `npm run reading:build`，同步公开正文、来源清单与哈希；不要只改生成结果。输入与生成流程见 `docs/data.md`、`docs/testing.md`。

# Writing and topic organization

- 修改主题介绍与科普正文前阅读 `docs/writing.md`，并使用 `chinese-writing` 技能；具体文章分工、比较、配图与地图联动约定以该文档为准。
- 从科普角度把概念、成因和联系讲细、讲清，不以阅读时长限制必要篇幅。按各主题内容组织连续叙述，使用有实质分工的大章节，避免零碎小标题和统一模板。
- 地图简版是可独立读懂的短文，不能缩成一句提示或地图操作说明；「学主题」详细版充分展开。两版使用同一套事实与来源，分别组织表达。
- 介绍一组对象时先建立整体认识，再具体展开和比较；有可靠且口径一致的数据时，用图表比较关键维度。比较表不能代替正文，不为套结构强配数字。
- 合并主题时重新组织解释与案例，保留有独特价值的内容、图片和地图入口；细分知识仍应能通过搜索或章节直达，不能只把旧文拼接起来。
- 完整专题不再设置「看图与思考」栏目。图片按解释需要放在相关段落附近；有明确地点关联的配图可联动本站真实交互地图，并保留完整地图入口。

# Navigation and reading state

- 「看地图」中的「主题地图」在侧栏展示主题列表，选择后更新地图与导读；「学主题」用于完整图文阅读，地图侧栏保留全文入口。
- 刷新后保留当前地图／主题目录／专题页面及阅读位置，PC 和手机都要支持；调整恢复逻辑时检查目录筛选、章节、浏览器前进后退和多标签页。新打开的分享链接优先进入指定内容，刷新同一页面则延续后续阅读状态。
- 地图侧栏不重复展示「随便看看／主题地图／收藏」等当前页签名称的大标题，收紧重复标题留下的间距，保留具体主题和地点的标题。

# Geography and sources

- 知识卡片使用原创中文概述，并附可核对的权威来源；未精选编写的地图对象只展示数据概览。
- `src/data/feature-bindings.json` 使用明确的真实要素 ID。无法准确对应范围的对象保留空数组与定位点，不依赖模糊名称将其绑定到父区域。
- 不绘制虚构的山脉、河湖或气候范围。Natural Earth 自然区域是概化的标注参考范围，保持相应说明。
- 气候统一使用 Beck 等（2023）V3 的 1991–2020、0.5° Köppen–Geiger 数据与 A–E 分类；不要混入其他分类阈值或单列 H 类。
- 修改来源清单后同步 `data/research/content-sources.json` 与 `public/data/content-sources.json`，并保留输入版本、许可、处理说明及校验记录。

# Verification and deployment

根据变更运行适当验证，现有入口为 `npm run data:check`、`npm test`、`npm run build`、`npm run test:e2e:smoke` 和 `npm run test:e2e`。地理数据重建流程见 `docs/data.md`，浏览器配置见 `docs/testing.md`。只报告实际完成的检查，不将健康文件可达等同于地图交互通过。

部署与回退遵循私密 `.local/deployment/README.md` 的现有流程。保持其他站点的配置与服务完整，不公开主机凭据或密钥信息。

# Licensing and public source scope

- 项目代码、脚本与开发文档采用 MIT，项目有权授权的原创地理讲解采用 CC BY 4.0，具体边界见 `LICENSE-CONTENT.md`；第三方数据与依赖保留各自条件。
- 流域输入锁定官方 BasinATLAS v1.0 的第 3 级几何及五个核心字段，按其 CC BY 4.0 来源保留署名和修改说明；输入锁见 `scripts/basin-atlas-inputs.lock.json`。不得将旧 HydroBASINS 缓存混入重建或仅改标签重新授权。
- 首次开源准备期间仅整理本地文件；用户确认拟公开／过滤文件清单前，不初始化 Git、不抽取最终发布仓库、不创建远程仓库、不推送或部署。这是首次公开的阶段约束，后续维护按当前任务授权执行。审核清单与原始备份保存在忽略的 `.local/open-source-preparation/`。

# Git Commit Messages

All Git commit messages must be written in English.

公开 Git 提交使用 GitHub noreply 邮箱，避免在提交元数据中暴露个人邮箱。
