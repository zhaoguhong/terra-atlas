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
