# Auto Update 配置说明

这份文档只覆盖“让自动更新真正可用”所需的配置、发布约定和验证步骤。

## 1. 当前实现依赖什么

应用内自动更新已经接好，运行逻辑是：

- 应用启动后可自动检查更新
- Settings 页可手动检查更新
- 稳定版走 `stable` 通道
- 测试版走 `beta` 通道
- 发现新版本后会显示 `arrow_upward` 提示
- 点击“Update and Restart”后会下载并重启安装

更新发现来源：

- GitHub Releases API

更新安装来源：

- release 中上传的 Tauri updater manifest
- release 中上传的安装包和签名

## 2. 必须配置的 GitHub Secrets

GitHub Actions `Release` workflow 依赖以下 secrets：

- `TAURI_SIGNING_PRIVATE_KEY`
  - Tauri updater 的私钥
  - 用于生成安装包签名
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  - 上面私钥对应的密码
- `TAURI_UPDATER_PUBKEY`
  - 和私钥配对的公钥
  - 会在构建时编进应用，用来校验下载的更新包

如果这些 secrets 没配：

- workflow 无法产出可安装的 updater 资产
- 应用内会把 updater 视为未配置状态

## 3. Release 和仓库约定

自动更新依赖公开 GitHub Releases。

要求：

- 仓库 release 必须是公开可访问的
- 正式版发布为普通 release
- Beta 发布为 `prerelease`
- tag/version 使用语义化版本，推荐 `v1.0.1` 这种格式

应用内版本比较会去掉前缀 `v` 再比较，所以：

- `v1.0.1` 可以
- `1.0.1` 也可以
- 不要用非 semver tag

## 4. 版本号必须同步

以下三个版本号必须保持一致：

- [package.json](/Users/a/Documents/GitHub/Tools/tunnel-manager/package.json)
- [src-tauri/Cargo.toml](/Users/a/Documents/GitHub/Tools/tunnel-manager/src-tauri/Cargo.toml)
- [src-tauri/tauri.conf.json](/Users/a/Documents/GitHub/Tools/tunnel-manager/src-tauri/tauri.conf.json)

仓库里已经有校验脚本：

```bash
npm run check:versions
```

版本不一致时，release 前应先修正，再发版。

## 5. Workflow 做了什么

Release workflow 文件在：

- [.github/workflows/release.yml](/Users/a/Documents/GitHub/Tools/tunnel-manager/.github/workflows/release.yml)

它会做这些事：

1. 安装前端依赖
2. 校验版本号同步
3. 构建 Tauri macOS 包
4. 读取生成的安装包和 `.sig`
5. 生成 updater manifest
6. 把安装包、签名、manifest 上传到 GitHub Release

当前首版默认只跑：

- macOS Apple Silicon

但结构已经按后续扩展 Windows / 其他平台预留。

## 6. Release 资产命名约定

当前代码会在 GitHub release 中查找：

- 安装包
- 对应 `.sig`
- 平台 manifest：`updater-<platform>.json`

例如 macOS arm64：

- `updater-darwin-aarch64.json`

manifest 里会指向该平台的安装包下载地址和签名。

## 7. 本地/CI 构建时的环境变量

Rust 侧会在编译时读取这些环境变量：

- `TAURI_UPDATER_REPO_OWNER`
- `TAURI_UPDATER_REPO_NAME`
- `TAURI_UPDATER_PUBKEY`

用途：

- `REPO_OWNER` / `REPO_NAME`
  - 让应用知道去哪个 GitHub Releases 查更新
- `PUBKEY`
  - 安装更新时校验签名

在 CI 里：

- `release.yml` 已经注入了这些值

如果要本地做完整 updater 测试，也要手动导出这些变量再构建。

## 8. 正式发版流程

建议流程：

1. 修改版本号
2. 运行：

```bash
npm run check:versions
npm run build
```

3. 提交代码并推送
4. 创建 tag，例如：

```bash
git tag v1.0.1
git push origin v1.0.1
```

5. 在 GitHub 创建对应 release
6. 对于 Beta 版本，勾选 `This is a pre-release`
7. 发布后等待 workflow 上传安装包、签名和 manifest

## 9. 如何验证自动更新真的可用

最少验证以下场景：

### Stable

1. 安装旧版本 app
2. 发布一个更高版本正式 release
3. 打开 app
4. 确认启动后能检测到更新
5. 确认顶栏出现 `arrow_upward`
6. 确认 Settings 页能看到版本信息和更新时间
7. 点击“Update and Restart”
8. 确认 app 重启后版本已变成新版本

### Beta

1. 在 Settings 切换到 `Beta`
2. 发布一个 prerelease
3. 确认 app 能检测到 prerelease
4. 切回 `Stable`
5. 确认不会再把 prerelease 当作可更新版本

### 失败场景

至少验证：

- 缺少 manifest 时，应用显示错误而不是静默失败
- 缺少签名或签名不匹配时，安装失败且 app 不损坏
- 用户关闭更新弹窗后，顶栏提示仍保留

## 10. 现在还需要你做什么

如果只想让这套功能上线，最少需要完成这些事：

1. 在 GitHub repo 配好 3 个 updater secrets
2. 用真实仓库跑一次 release workflow
3. 确认 release 中确实有安装包、`.sig` 和 `updater-<platform>.json`
4. 用旧版本 app 实机跑一次升级验证

## 11. 已知限制

- 当前 workflow 首版只构建 macOS Apple Silicon
- Windows 还没有在 workflow 中真正启用
- updater manifest 目前按平台分别上传，不是单个聚合 manifest
- Release notes 目前只在应用里做纯文本/外链展示，没有富文本渲染
