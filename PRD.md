# SSH Tunnel Manager 桌面应用 PRD v1.0

## 1. 文档信息

**产品暂定名**：Tunnel Deck / Port Link / Switch Tunnel（可后续命名）
**产品形态**：Tauri 单窗口桌面应用
**支持平台**：macOS 首发，后续扩展 Windows / Linux
**产品定位**：一个轻量、单窗口、以卡片列表为核心的 SSH 隧道管理工具
**设计风格**：扁平化、大圆角、轻量边框、低噪音信息层级、自动跟随系统深浅色
**核心关键词**：保存、启动、停止、编辑、复用、可视化、轻量、可信

---

## 2. 产品背景

开发者、运维、内网服务使用者，经常需要使用 SSH 隧道进行以下操作：

* 将远程 `localhost` 服务映射到本地
* 将本地服务暴露到远程机器
* 建立 SOCKS 代理
* 保存多套不同环境的端口转发规则
* 在不同主机、不同认证方式之间快速切换

当前主要痛点有：

1. SSH 命令记忆成本高，容易写错
2. 多个转发规则不便管理
3. 很难直观看到哪些隧道正在运行
4. 中断、失败、端口冲突时反馈不直观
5. 密钥、密码、备注、图标等信息缺少统一管理入口
6. 非 CLI 用户使用门槛较高

因此需要一个 **极简但专业的桌面端 Tunnel Manager**，将 SSH 端口转发从命令行能力，变成一个可保存、可点击、可管理的桌面工具。

---

## 3. 产品目标

### 3.1 核心目标

打造一个单窗口桌面应用，让用户可以：

* 保存 SSH 隧道配置
* 支持 `-L / -R / -D`
* 一键启动 / 停止
* 编辑已有配置
* 管理认证方式（密码 / SSH Key）
* 看到运行状态与错误状态
* 自动保存列表
* 使用统一、好看、低学习成本的 UI

### 3.2 产品原则

这个产品的第一原则不是“功能很多”，而是：

* **简单**
* **直观**
* **可信**
* **可长期常驻使用**

### 3.3 非目标

v1 不做以下内容：

* 不做完整 SSH Terminal
* 不做 SFTP 文件管理
* 不做多窗口复杂工作台
* 不做团队协作 / 云同步
* 不做容器 / Kubernetes 集成
* 不做多条规则批量编排工作区
* 不做脚本执行平台

这些都可以作为后续版本扩展，但不是 v1 核心。

---

## 4. 目标用户

### 4.1 主要用户

* 后端开发者
* 全栈开发者
* 运维 / DevOps
* 需要频繁访问远程内网资源的人
* 需要快速复用 SSH Tunnel 配置的人

### 4.2 用户画像

用户通常具备以下特征：

* 知道 SSH 是什么
* 了解端口、Host、认证方式等基本概念
* 不想每次重新敲命令
* 对界面美观和效率都有要求
* 需要本地持久保存多个规则

---

## 5. 典型使用场景

### 场景 A：访问远程 Web 服务

用户希望将远程服务器的 `localhost:3000` 映射到本地 `8080`，然后直接访问 `http://localhost:8080`。

### 场景 B：连接远程数据库

用户希望将远程 PostgreSQL 的 `localhost:5432` 转发到本地 `5432`，供本地数据库工具使用。

### 场景 C：暴露本地服务给远程

用户将自己机器上的服务通过 `-R` 暴露给远程机器。

### 场景 D：建立 SOCKS 代理

用户使用 `-D` 建立一个本地 SOCKS5 代理，供浏览器或其他工具走代理访问。

### 场景 E：多环境复用

用户保存 dev / staging / prod 三套配置，需要随时启动和停止。

---

## 6. 核心概念定义

### 6.1 Profile

用户在列表中看到的一张卡片，即一个“隧道配置项”。

一个 Profile 对应一条完整的 SSH Tunnel 配置，包含：

* 基础信息
* 连接信息
* 隧道规则
* 认证信息
* 图标与备注
* 启停状态

### 6.2 Tunnel Mode

支持三种模式：

* `Local Forward` 对应 `-L`
* `Remote Forward` 对应 `-R`
* `Dynamic Forward` 对应 `-D`

### 6.3 Runtime Status

Profile 的运行状态：

* Idle：未启动
* Connecting：连接中
* Running：运行中
* Reconnecting：重连中
* Error：启动失败 / 中断异常
* Stopping：停止中

---

## 7. 产品范围

## 7.1 v1 必须支持

1. 创建新 Tunnel Profile
2. 编辑 Tunnel Profile
3. 删除 Tunnel Profile
4. 列表展示所有已保存 Profile
5. 一键启动 / 停止
6. 支持 `-L / -R / -D`
7. 支持密码认证
8. 支持 SSH Key 认证
9. 支持用户自定义图标
10. 支持默认图标生成
11. 自动保存本地配置
12. 自动跟随系统深浅色
13. 展示运行状态与错误信息
14. 端口合法性校验
15. 主机 / 用户名 / 模式等基础字段校验
16. 查看最近一次运行日志
17. 显示“可复制命令预览”

## 7.2 v1 可选增强

1. 自动重连
2. 启动后自动打开 URL
3. 一键复制完整 SSH 命令
4. 列表拖拽排序
5. 按状态筛选 / 搜索
6. 开机启动
7. 菜单栏 / 托盘常驻

## 7.3 后续版本方向

1. 多规则组合启动
2. 工作区 / 项目分组
3. 导入 / 导出配置
4. SSH Config 文件导入
5. 跳板机 / ProxyJump
6. known_hosts 管理
7. Agent 转发
8. 命令模板库
9. 团队共享配置

---

## 8. 信息架构

这个应用采用 **单窗口 + 主列表 + 弹层表单** 的结构。

### 8.1 主界面结构

主界面由以下区域组成：

#### 顶部工具栏

包含：

* App Logo / App 名称
* 设置入口
* 全局状态小图标
* 搜索或筛选入口（可选）
* 新建按钮

#### 主列表区

列表展示所有 Tunnel Profile 卡片。

每张卡片展示：

* 图标
* 名称
* 模式标签（L/R/D）
* 状态标签
* 描述 / 备注
* 目标信息摘要
* 最近运行时间
* 快捷操作按钮

#### 底部或右下角悬浮操作

* 新建
* 可能的全局状态提示

### 8.2 创建 / 编辑界面

采用弹窗或右侧抽屉。
推荐使用 **大尺寸弹窗**，因为字段较多，视觉上更贴近你给的参考图。

---

## 9. 功能需求详述

# 9.1 Profile 列表页

### 9.1.1 列表展示

应用启动后，默认进入 Profile 列表页。

列表中的每一项卡片需展示：

* 图标
* Profile 名称
* 二级描述 / 备注
* 当前状态
* 模式标识：L / R / D
* 连接目标摘要
* 最近启动时间
* 快捷操作按钮

### 9.1.2 状态显示

不同状态要有明显但不过度吵闹的视觉反馈：

* Idle：中性灰
* Connecting：轻微动态状态
* Running：绿色或系统成功色
* Reconnecting：提示色
* Error：红色或错误色

### 9.1.3 快捷操作

每张卡片支持：

* Start / Stop
* Edit
* Duplicate
* Delete
* View Logs
* Copy Command

### 9.1.4 空状态

当没有任何配置时，展示友好的空状态：

* 简洁说明文字
* 一个明显的新建按钮
* 一段示例说明，例如“Create your first SSH tunnel profile”

### 9.1.5 列表排序

v1 默认按以下规则排序：

* 用户手动排序优先（如果支持拖拽）
* 否则最近使用优先
* 新建项插入顶部

---

# 9.2 新建 / 编辑 Profile

创建和编辑共用同一套表单。

## 9.2.1 基础信息区

字段包括：

### 名称

* 必填
* 用于列表展示
* 最大长度建议 50

### 备注

* 选填
* 用于描述用途，例如“公司内网 Grafana”

### 网站 URL

* 选填
* 用于启动后快速打开某个页面
* 例如 `http://localhost:8080`
* 若填写，提供“Open”快捷动作

### 图标

支持两种方式：

#### 自定义图标

* 用户上传本地图像
* 支持 png / jpg / webp / svg
* 用于列表卡片左侧展示

#### 默认图标

若未上传，则自动生成：

* 一个圆角矩形底色
* 中央展示名称首字母大写
* 颜色根据名称 hash 稳定生成
* 例如 `Grafana` → `G`

---

## 9.2.2 SSH 连接区

### SSH Host

* 必填
* 支持域名 / IP

### SSH Port

* 默认 22
* 必填
* 必须为合法端口范围

### Username

* 必填

### Authentication Type

单选：

* Password
* SSH Key

### Password 模式字段

* Password
* 可选 “Remember in system keychain”

说明：

* 默认不建议明文存储
* 若用户勾选记住，则保存到系统 Keychain
* 若未勾选，则每次启动时提示输入

### SSH Key 模式字段

* Private Key Path
* Passphrase（可选）
* 可选 “Remember passphrase in system keychain”

### 可选高级项

v1 可隐藏在折叠区域：

* ServerAliveInterval
* ServerAliveCountMax
* Connect Timeout
* StrictHostKeyChecking 策略
* Identity File 自定义参数
* Bind Address

---

## 9.2.3 Tunnel 模式区

### 模式选择

单选：

* Local Forward (`-L`)
* Remote Forward (`-R`)
* Dynamic Forward (`-D`)

---

### A. Local Forward (`-L`)

字段：

* Local Bind Host，默认 `127.0.0.1`
* Local Port，必填
* Remote Host，必填，默认 `localhost`
* Remote Port，必填

命令含义：

`本地端口 -> SSH 主机视角下的远程目标`

---

### B. Remote Forward (`-R`)

字段：

* Remote Bind Host，默认空或 `127.0.0.1`
* Remote Port，必填
* Local Target Host，必填，默认 `localhost`
* Local Target Port，必填

命令含义：

`远程端口 -> 本地目标服务`

---

### C. Dynamic Forward (`-D`)

字段：

* Local Bind Host，默认 `127.0.0.1`
* Local Port，必填

说明：

* `-D` 为 SOCKS 代理，不需要 target host / target port

---

## 9.2.4 命令预览区

表单底部展示一段只读的命令预览，例如：

```bash
ssh -N -L 8080:localhost:3000 user@example.com -p 22
```

要求：

* 实时随表单变化更新
* 可一键复制
* 仅作预览，不要求用户手写命令

---

## 9.2.5 测试与保存

表单底部操作包括：

* Test Connection
* Save
* Cancel

### Test Connection

用于校验：

* SSH 主机可连接
* 认证方式可用
* 必要字段合法
* 端口没有明显冲突
* 目标参数结构正确

### Save

成功后回到列表页，并自动保存本地配置。

---

# 9.3 启动 / 停止 Profile

## 9.3.1 启动逻辑

点击卡片上的 Start 后：

1. 校验 Profile 配置完整性
2. 如认证信息缺失且未存储，则提示用户输入
3. 检查本地端口占用情况
4. 生成 SSH 参数
5. 启动后台进程
6. 更新状态为 Connecting
7. 成功后更新为 Running

## 9.3.2 停止逻辑

点击 Stop 后：

1. 向对应进程发送退出信号
2. 等待进程终止
3. 状态切换为 Stopping
4. 最终变为 Idle

## 9.3.3 异常处理

启动失败时，需提供明确错误反馈，例如：

* Auth failed
* Port already in use
* Host unreachable
* SSH binary not found
* Invalid key path
* Connection closed unexpectedly

错误反馈应同时出现在：

* 卡片状态
* 日志面板
* 全局 toast 提示

---

# 9.4 日志查看

每个 Profile 支持打开日志面板或弹窗。

日志内容包括：

* 启动时间
* 退出时间
* 退出码
* stderr 输出
* 连接失败原因
* 最近一次成功运行记录

v1 要求：

* 至少保留最近一次运行日志
* 建议保留最近 20 次记录

---

# 9.5 编辑 / 复制 / 删除

## 编辑

允许用户修改除运行态临时信息外的所有字段。

若 Profile 正在运行：

* 可允许编辑
* 但保存后提示“需重启后生效”
* 或直接提供 “Save & Restart”

## 复制

用户可基于当前配置快速生成新 Profile：

* 名称默认加 “Copy”
* 认证信息默认沿用引用，不重复展示明文

## 删除

删除前需确认。
若 Profile 正在运行，需先停止，或询问是否“停止并删除”。

---

# 9.6 深浅色模式

应用必须默认跟随系统深浅色模式。

要求：

* 首次启动自动读取系统主题
* 系统主题变化时自动切换
* 不需要用户手动切换
* 整体视觉在深色模式下依然保持轻量、柔和、低对比刺眼感

后续版本可增加“跟随系统 / 浅色 / 深色”三态设置。

---

# 9.7 数据持久化

## 9.7.1 本地保存内容

应保存以下信息：

* Profile 基础配置
* 图标路径或缓存引用
* 排序信息
* 最近运行时间
* 最近运行状态摘要
* 界面相关偏好

## 9.7.2 敏感信息存储原则

### 可放本地配置文件

* 名称
* Host
* Port
* Username
* Tunnel 参数
* 备注
* URL
* 图标引用

### 不应明文存配置文件

* Password
* SSH Key Passphrase

### 应优先进入系统安全存储

* macOS Keychain
* Windows Credential Manager
* Linux Secret Service / Keyring

---

## 10. 交互设计要求

# 10.1 整体风格

参考你给出的图，产品风格定义如下：

* 扁平化
* 大圆角
* 卡片式
* 大留白
* 低装饰
* 图标克制
* 强调“轻专业工具感”
* 类似现代 macOS / 轻 SaaS / 原生桌面工具的混合风格

### 视觉关键词

* Clean
* Calm
* Rounded
* Breathable
* Minimal but warm

---

# 10.2 主列表卡片规范

每张卡片建议包含：

左侧：

* 拖拽柄或排序提示
* 图标

中间：

* 名称
* 备注
* 模式标签
* 状态标签

右侧：

* 最近运行时间
* Start / Stop
* Edit
* More

卡片样式建议：

* 大圆角，建议 20~28px
* 浅边框
* hover 微弱背景变化
* selected 状态轻微高亮
* 运行中卡片可加轻微状态描边

---

# 10.3 新建弹窗规范

弹窗需具备：

* 大标题
* 左上角返回或关闭
* 表单分组明确
* 底部固定操作栏
* 主按钮突出
* 表单字段圆角统一
* 高级设置折叠

表单体验要求：

* 输入项间距充分
* 字段对齐统一
* 占位文案友好
* 即时校验但不过度打扰
* 错误提示贴近字段

---

# 10.4 动效要求

动效需克制，不能花哨。

需要的动效类型：

* 状态切换淡入淡出
* 列表项 hover / pressed 反馈
* 弹窗出现 / 消失
* Connecting 轻量加载态
* Toast 淡入淡出

不建议：

* 夸张缩放
* 复杂粒子
* 高频闪烁

---

## 11. 数据模型建议

## 11.1 TunnelProfile

```ts
type TunnelMode = "LOCAL" | "REMOTE" | "DYNAMIC";
type AuthType = "PASSWORD" | "SSH_KEY";
type RuntimeStatus = "IDLE" | "CONNECTING" | "RUNNING" | "RECONNECTING" | "STOPPING" | "ERROR";

interface TunnelProfile {
  id: string;
  name: string;
  notes?: string;
  websiteUrl?: string;

  iconType: "custom" | "generated";
  iconPath?: string;
  generatedIconSeed?: string;

  sshHost: string;
  sshPort: number;
  username: string;
  authType: AuthType;

  passwordRef?: string;
  privateKeyPath?: string;
  passphraseRef?: string;

  mode: TunnelMode;

  localBindHost?: string;
  localPort?: number;

  remoteHost?: string;
  remotePort?: number;
  remoteBindHost?: string;

  localTargetHost?: string;
  localTargetPort?: number;

  autoReconnect?: boolean;
  openUrlAfterStart?: boolean;

  createdAt: string;
  updatedAt: string;
  lastStartedAt?: string;
  lastStoppedAt?: string;
  sortOrder: number;
}
```

## 11.2 RuntimeState

```ts
interface RuntimeState {
  profileId: string;
  status: RuntimeStatus;
  pid?: number;
  startedAt?: string;
  errorMessage?: string;
  lastExitCode?: number;
}
```

## 11.3 LogRecord

```ts
interface LogRecord {
  id: string;
  profileId: string;
  startedAt: string;
  endedAt?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  summary?: string;
}
```

---

## 12. 业务规则

### 12.1 字段校验规则

* 端口范围必须在 1~65535
* 名称不能为空
* Host 不能为空
* Username 不能为空
* `-L / -R` 模式下目标字段必须完整
* `-D` 模式下不应展示无关字段
* URL 若填写，必须为合法 URL

### 12.2 端口冲突规则

本地需要监听的端口被占用时：

* 不允许启动
* 提示明确错误
* 可在错误提示中展示占用端口号

### 12.3 运行态行为规则

同一个 Profile 不允许重复启动。
点击已运行项的 Start 不应重复生成进程。

### 12.4 删除规则

删除配置不应删除系统 Keychain 中无关条目。
但与该 Profile 强绑定的密码引用可提示是否一并清理。

---

## 13. 安全与隐私要求

这是一个会处理 SSH 认证信息的工具，安全是产品基本要求。

### 13.1 基本要求

* 不在日志中打印明文密码
* 不在 UI 中回显完整敏感内容
* 配置导出时默认不包含敏感数据
* 所有敏感字段优先存系统安全存储
* 应支持手动清除保存的认证信息

### 13.2 SSH 主机可信性

v1 可先采用系统 SSH 的默认 known_hosts 机制。
首次连接如遇主机指纹确认，需提供可理解的交互，不要静默跳过。

### 13.3 错误信息

错误信息要清楚，但不能泄漏敏感内容。

---

## 14. 技术实现建议

虽然这是 PRD，但为了确保可落地，这里给出推荐实现方向。

### 14.1 技术栈

* 桌面壳：Tauri
* 前端：React + TypeScript
* UI：Tailwind 或 CSS Variables + 自定义组件
* 状态管理：Zustand / Jotai
* 表单管理：React Hook Form + Zod
* 后端能力：Rust
* 本地存储：Tauri Store / JSON 文件
* 敏感信息：系统 Keychain / Credential Store
* 进程管理：Rust 调起系统 `ssh`

### 14.2 SSH 执行策略

v1 推荐直接调用系统 OpenSSH，而不是自己完整实现 SSH 协议。

原因：

* 兼容性最好
* 行为符合用户预期
* 更容易支持现有 SSH 环境
* 更容易处理 `-L/-R/-D` 等标准参数

### 14.3 为什么不建议 v1 自研 SSH 协议层

* 复杂度高
* 认证、密钥格式、host key、代理链等问题多
* 与“简单、可用、尽快上线”的目标不匹配

---

## 15. 非功能性要求

### 15.1 性能

* 冷启动时间尽量控制在 2 秒内
* 主列表滚动流畅
* 启停状态更新要及时
* 运行少量配置时不应造成明显资源占用

### 15.2 稳定性

* SSH 进程退出后状态必须及时同步
* 应用异常关闭后，重新打开能恢复正确的历史配置
* 不应因为某个 Profile 启动失败导致整个应用卡死

### 15.3 可维护性

* UI 层与 SSH Runtime 层分离
* Profile 数据模型与运行态数据模型分离
* 日志、配置、认证存储分层清晰

---

## 16. MVP 页面清单

v1 最少包含以下页面 / 弹层：

### 页面 1：主列表页

展示所有已保存的 Profile

### 页面 2：新建 / 编辑弹窗

用于创建和编辑 Tunnel Profile

### 页面 3：日志弹窗

查看当前或最近一次运行日志

### 页面 4：设置页

建议非常轻量，仅包含：

* 关于
* 数据存储位置
* SSH 可执行文件路径检测
* 清理本地缓存
* 清理认证信息

---

## 17. 验收标准

以下条件全部满足，视为 v1 可交付。

### 17.1 创建与保存

* 用户可创建一个 `-L` Profile 并成功保存
* 用户可创建一个 `-R` Profile 并成功保存
* 用户可创建一个 `-D` Profile 并成功保存

### 17.2 启停

* 已保存 Profile 可一键启动
* 运行中的 Profile 可一键停止
* 状态在 UI 中可正确反映

### 17.3 编辑

* 用户可编辑已有 Profile
* 编辑后保存成功
* 如 Profile 正在运行，系统提示“需重启生效”或提供“保存并重启”

### 17.4 认证

* 支持密码认证
* 支持 SSH Key 认证
* 敏感信息可进入系统 Keychain
* 未保存密码时可在启动时输入

### 17.5 状态与错误

* 端口冲突可被识别
* 认证失败可被识别
* Host 不可达可被识别
* 错误信息可在卡片或日志中查看

### 17.6 UI

* 主界面符合扁平、大圆角、低噪音风格
* 深浅色可随系统自动切换
* 支持自定义图标与默认字母图标

### 17.7 持久化

* 应用重启后，配置仍存在
* 列表顺序与基础信息不丢失

---

## 18. 版本规划建议

### v1.0

* 单 Profile 单规则
* 支持 `-L/-R/-D`
* 支持密码 / SSH Key
* 启停 / 编辑 / 删除 / 日志
* 自动深浅色
* 图标支持

### v1.1

* 自动重连
* 菜单栏 / 托盘模式
* 启动后自动打开 URL
* 拖拽排序
* 搜索 / 过滤
* 导入 / 导出配置

### v1.2

* 多规则组合启动
* 工作区 / 分组
* ProxyJump
* SSH Config 导入
* known_hosts 管理
* 开机自动恢复上次运行项

---

## 19. 一句话产品定义

这是一个 **以卡片列表为核心、支持 SSH `-L/-R/-D`、支持密码与密钥认证、强调极简与美感的单窗口桌面 Tunnel Manager**。

---

## 20. 给工程实现的最终拍板建议

如果按你的想法直接开工，我建议这样定：

### 产品范围

先做 **单窗口 + 列表 + 新建弹窗 + 启停 + 编辑 + 日志**。

### 交互策略

不要做复杂导航。
整个产品就围绕两个动作：

* 管理配置
* 管理运行态

### 技术策略

v1 直接基于 **Tauri + React + Rust + 系统 OpenSSH**。
不要一开始自研 SSH 协议层。

### 视觉策略

严格走你给图的那种方向：

* 扁平
* 大圆角
* 浅描边
* 大留白
* 状态信息弱化但清晰
* 卡片式列表
* 弹窗式表单
