# 静态部署

[返回项目首页](../README.md)

## 构建与发布

```sh
npm ci
npm run build
npm run preview -- --port 4176 --strictPort
```

通过浏览器访问预览地址，确认地图绘制和关键操作后，将完整 `dist/` 交给静态托管服务。不能只复制 HTML 或 JavaScript：地图数据、瓦片、字体样式和许可文件都属于发布内容。不要直接双击 HTML 打开。

地图继续用 URL hash 保存状态；学主题使用 `/topics/` 及 `/topics/<slug>/`，构建生成对应目录的 `index.html`。静态服务器不需要业务后端、数据库或应用路由重写，未知路径应返回 404。目录地址省略末尾斜杠时，托管服务应在公开域名和 HTTPS 下补齐斜杠，避免泄漏内部端口。服务器应按扩展名返回正确的 HTML、JavaScript、JSON、CSS、WebP 和图片类型。生产几何为 `.geojson.gz`，应用可处理原始 gzip 字节或已被服务器解压的响应；打包与核验见 [加载与体积](performance.md)。WebGL 是地图绘制的必要条件；可选详细底图和三维地形还需要浏览器能够访问对应在线服务。

## 子目录与自有域名

部署到 `/terra-atlas/` 时：

```sh
npm run build -- --base=/terra-atlas/
npm run preview -- --port 4176 --strictPort --base=/terra-atlas/
```

访问 `http://127.0.0.1:4176/terra-atlas/`。构建参数会传递给 Vite；数据和瓦片使用同一 base 路径。部署到域名根目录时使用默认构建。

使用自有域名时，执行例如 `SITE_ORIGIN=https://atlas.example.org npm run build`，构建会为首页、专题和站点地图生成该域名下的地址。子目录仍通过 `--base` 指定。部署时保留已有作者、许可和来源署名。

## 许可与公开范围

完整保留 `third-party-notices.txt` 和 `licenses/`。本项目代码与原创讲解分别授权，第三方数据按各自条件提供，见[许可说明](../LICENSE-CONTENT.md)。BasinATLAS 流域派生数据采用 CC BY 4.0，发布时保留来源、许可和修改说明；其他第三方材料分别遵守各自条件。

`data/raw/`、`.local/`、环境文件和凭据不属于静态站点。维护者的生产发布、原子切换、核验与回退沿用私有部署流程；本文不包含生产主机信息。GitHub CI 只做检查，不连接生产服务器。

发布时先保留上一版本，再切换到完整新产物；失败时回退到保留的版本。上线后分别核对静态文件和真实地图交互，健康文件可访问不能代替浏览器验收。
