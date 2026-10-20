# Project

山河图（Terra Atlas）用于个人学习中国与世界地理。首页突出自由探索地图，不要求严格按教材或固定学习顺序组织内容。

# Implementation

- 使用 React、TypeScript、Vite、MapLibre GL JS 和普通 CSS；保持 `dist/` 为纯静态站点。
- 核心地图与知识数据随站点提供。收藏、偏好和保存视图使用当前浏览器的本地存储。
- 地理数据原始缓存、验证记录与部署配置分别位于 Git 忽略的 `data/raw/` 和 `.local/`；不得进入公开构建产物。

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
- 开源准备期间仅整理本地文件；用户确认拟公开／过滤文件清单前，不初始化 Git、不抽取最终发布仓库、不创建远程仓库、不推送或部署。审核清单与原始备份保存在忽略的 `.local/open-source-preparation/`。

# Git Commit Messages

All Git commit messages must be written in English.
