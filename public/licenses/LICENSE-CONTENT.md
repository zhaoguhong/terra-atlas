# 许可范围与原创内容授权

山河图 · Terra Atlas 按内容性质分别授权。文件格式、存放目录及打包方式不改变许可范围；根目录 MIT 许可不覆盖全部地图和知识内容。

## 程序代码、脚本与开发文档：MIT

本项目拥有权利的应用代码、样式、脚本、配置、测试及开发文档采用 [MIT License](LICENSE)。第三方软件与数据、引用原文，以及下面单独授权的原创讲解不在此范围内。

## 原创地理讲解：CC BY 4.0

Copyright © 2026 Terra Atlas contributors（山河图贡献者）。

本项目拥有权利的原创地理讲解采用 **Creative Commons Attribution 4.0 International（CC BY 4.0）**。完整协议见 [CC-BY-4.0.txt](CC-BY-4.0.txt)，另有[官方中文摘要](https://creativecommons.org/licenses/by/4.0/deed.zh-hans)。完整协议文本为准。

授权范围包括：

- `src/data/knowledge.json` 中的原创地理概述、解释、关系说明和观察问题。
- `src/data/climate-notes.json` 中的原创季节、景观、生活、区域参考说明和观察问题。
- `src/data/topics.json` 中的原创主题摘要、正文、学习模块、图表解释与观察问题。
- 组件中属于上述讲解的原创教学文字；界面操作文字随程序代码适用 MIT。

允许分享、改编和商业使用。分享时须按协议保留作者、已有版权与免责声明、提供许可链接和可行的原作链接，并注明修改。署名可以根据使用媒介合理安排，不要求固定放在首页。可参考：

> 地理讲解来源：山河图 · Terra Atlas 贡献者，© 2026。原作：https://terraatlas.zhaoguhong.com/ 。采用 CC BY 4.0：https://creativecommons.org/licenses/by/4.0/ 。如有修改，请补充实际修改说明。

本授权只涉及项目有权授权的原创表达，不对地理事实、地名、坐标、数值或公有领域材料本身主张排他权利。整理稿按原样提供，授权不保证事实准确性，也不表示资料提供机构认可使用者的产品。

## 第三方材料与例外

第三方材料不会因为转换、简化、中文整理、截图或打包而自动适用本项目的 MIT 或原创内容许可：

- Natural Earth 保留公有领域属性，Wikidata 结构化数据保留 CC0。
- `public/data/china-reference-regions.geojson` 和 `scripts/china-region-digitization.json` 改编自Jiang等（2023）图2，采用CC BY 4.0；须保留原作者署名、许可与数字化修改说明，不适用MIT。
- Beck 气候、GHS-POP、Glottolog、Glottography、世界银行等资料保留来源清单注明的原许可、署名和修改说明。
- **`public/data/auxiliary-basins.geojson`** 从官方 [BasinATLAS v1.0 固定归档](https://doi.org/10.6084/m9.figshare.9890531.v1) 重新生成，采用 CC BY 4.0。须保留 Linke et al. (2019) 与底层分区来源的署名、许可链接和本项目修改说明；不适用 MIT。所选几何与五个核心字段、版本和输入哈希见[第三方声明](../third-party-notices.txt)与来源清单。未导入的环境属性仍各自授权，原 HydroBASINS 独立产品的许可不因本项目迁移而改变。
- OpenFreeMap、OpenStreetMap、Mapterhorn 和本地高程数据分别保留各自的数据条件与归属；在线瓦片服务未被重新授权。
- 引用网页、书籍、图像及原文保留其权利。来源链接或本地核验缓存不代表获得全文再分发权。
- 界面截图中的第三方地图和文字保留相应许可和归属。

具体版本、引用、处理方式和许可见 [THIRD_PARTY_NOTICES.md](../third-party-notices.txt) 与 `data/research/`、`public/data/` 的来源清单。

软件包元数据中的 `MIT AND CC-BY-4.0` 表示项目自身代码和原创讲解分别适用上述许可，不能任选一种覆盖整个项目，也不能替代第三方数据条件。
