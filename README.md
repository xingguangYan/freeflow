# 自由发 · Freeflow

### 自媒体多平台分发工具 · 本地运行 · 免费开源

用浏览器自动化操作**你自己的账号**。不破解任何软件，不经过任何第三方服务器，所有登录态、素材和发布记录都保存在本机。已打包为独立 Windows 程序，免安装。
（v1.4 起同时提供 macOS 版，见下方「macOS 版本」。）

![开源工具](https://img.shields.io/badge/-开源工具-3DA639?logo=opensource)
![本地运行](https://img.shields.io/badge/-本地运行-4B5563?logo=localhost)
![自媒体分发](https://img.shields.io/badge/-自媒体分发-FF6B6B?logo=buffer)
![Windows桌面](https://img.shields.io/badge/-Windows桌面-0078D4?logo=windows)
![Node.js](https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs)
![免费开源](https://img.shields.io/badge/-免费开源-22C55E?logo=githubsponsors)
![macOS桌面](https://img.shields.io/badge/-macOS桌面-000000?logo=apple)

---
<img width="1266" height="853" alt="image" src="https://github.com/user-attachments/assets/057c6312-1746-4885-a7d4-bed4d8ef5e21" />
<img width="1266" height="844" alt="v1.4 界面预览：账号页 + 平台数据看板（Windows 与 macOS 界面相同）" src="docs/preview.png" />

## 目录

- [核心特点](#核心特点)
- [平台覆盖](#平台覆盖)
- [下载安装](#下载安装)
- [macOS 版本](#macos-版本apple-silicon--intel)
- [使用流程](#使用流程)
- [功能详解](#功能详解)
- [数据目录与迁移](#数据目录与迁移)
- [开发模式](#开发模式)
- [重新打包](#重新打包)
- [依赖与环境](#依赖与环境)
- [常见问题](#常见问题)
- [许可证](#许可证)
- [合作与联系](#合作与联系)
- [法律与边界](#法律与边界)

---
<img width="1266" height="892" alt="image" src="https://github.com/user-attachments/assets/988bd2d1-21ce-4fa7-bf3e-fe2357bee553" />

## 核心特点

- **纯本地运行**：没有云端后端，不经过任何第三方服务器，登录态和内容只存在你自己的电脑上。
- **操作你自己的账号**：通过本机浏览器自动化访问平台网页编辑页完成发布，不破解任何商业软件。
- **三级容灾**：专属选择器 → 通用启发式规则 → 剪贴板手动模式。平台改版不会让整盘功能失效。
- **53 个平台**：国内图文 24 + 国内视频 13 + 海外 15。
- **免费开源**：MIT 许可证，提示词、选择器、界面全部可改。

---
<img width="1266" height="892" alt="image" src="https://github.com/user-attachments/assets/48107632-04d6-42dc-b1b0-755e19a6b46d" />

## 平台覆盖

国内 38 + 海外 15，共 **53 个平台**。

**国内图文（24）**
微信公众号、头条号、百家号、知乎、小红书、B站专栏、简书、CSDN、微博、搜狐号、网易号、大鱼号、一点资讯、新浪看点、快传号、东方号、凤凰号、美篇、车家号、博客园、掘金、SegmentFault、百度贴吧、雪球、豆瓣

**国内视频（13）**
抖音、快手、B站视频、西瓜视频、好看视频、微信视频号、知乎视频、爱奇艺号、企鹅号（腾讯视频）、搜狐号视频、AcFun、优酷、微博视频

**海外（15）**
Medium、Dev.to、LinkedIn、Reddit、Hashnode、Substack、Tumblr、Pinterest、X (Twitter)、Facebook、YouTube、TikTok、Vimeo、Dailymotion、Instagram

> 新平台会标注「实验性」。这类平台页面结构变动频繁，失败时会自动打开编辑页并降级为手动模式，**内容已复制到剪贴板**，不会丢失。

---
<img width="1266" height="892" alt="image" src="https://github.com/user-attachments/assets/807c6c9e-9f19-4b4c-9533-f4c8d6fa3bc1" />
<img width="1266" height="892" alt="image" src="https://github.com/user-attachments/assets/f00be7de-2f4f-4a56-8a8b-42e85870e8aa" />

## 下载安装

### 方式一：下载预打包版本（推荐）

到 [Releases](https://github.com/xingguangYan/freeflow/releases/latest) 下载 `freeflow-win64.zip`，解压后双击：

```
自由发\自由发.exe
```

免安装。数据保存在程序目录的 `data` 文件夹中，整个目录可以拷贝到别处使用。

### macOS 版本（Apple Silicon / Intel）

到 [Releases](https://github.com/xingguangYan/freeflow/releases/latest) 下载对应芯片的安装包（v1.4 起）：

- `freeflow-mac-arm64.zip` / `freeflow-mac-arm64.dmg` —— M1/M2/M3/M4 等 Apple 芯片
- `freeflow-mac-x64.zip` / `freeflow-mac-x64.dmg` —— Intel 芯片

zip 解压后把「自由发」拖进「应用程序」；dmg 双击后拖拽安装。首次打开若提示「无法验证开发者」，在 app 上右键选「打开」，或在终端执行一次：

```bash
xattr -cr /Applications/自由发.app
```

macOS 版数据存在 `~/Library/Application Support/自由发`。发布建议安装 Google Chrome；若没装 Chrome，在「账号」页点「安装浏览器内核」会自动下载浏览器（约 150MB，只需一次）。

### 方式二：源码运行

需要 **Node.js 20+**。

```bash
git clone https://github.com/xingguangYan/freeflow.git
cd freeflow
npm install
npm run pack
```

打包输出到 `release\自由发-win32-x64`，双击其中的 `自由发.exe` 启动。

---

## 使用流程

1. **登录账号**：进入「账号」页，选择平台 → 添加账号 → 点「登录」扫码，程序自动检测登录态。
2. **编辑内容**：进入「文章」页，切换到「视频」或「图文」，填写标题 / 正文（文案）/ 标签。视频可上传文件，也可直接填本地路径。
3. **一键发布**：勾选目标账号（已按文章类型自动过滤不支持的平台），选择立即发布或定时发布。
4. **半自动平台**：有头浏览器会逐个打开编辑页并自动填充；微信公众号等半自动平台需要你手动点「发表」。

---

## 功能详解

### 多账号管理
每个平台 / 账号使用独立的浏览器配置目录，扫码登录后登录态本地持久化保存，不同账号之间不共享任何浏览器状态。

### 登录态双通道检测
同时检查 URL 特征和登录 cookie，避免“明明登录了却显示未登录”。一键发布撞到登录墙时会自动打开登录页，等你登录完成后**从断点继续**，不会把任务判死。

### 双模式编辑器
富文本 / Markdown 随时切换。一键发布时按各平台实际支持的编辑模式自动转换（Markdown ⇄ 富文本）。

### 正文插图
编辑器工具栏「插入图片」可从素材库选择，图片自动转为 **base64 内联**，平台可直接识别，不依赖外部图床。

### 网页图片直贴
从其他网站复制图片直接粘贴，自动下载进素材库并插入正文。

### 视频一键分发
选择视频文件 → 自动上传 → 填写标题 / 描述 / 标签 → 发布。

### 定时发布与违禁词检测
支持定时任务；违禁词词库位于 `data/sensitive.txt`，可自行扩充。

### 平台数据看板
登录后采集粉丝、阅读 / 播放、点赞等指标，生成趋势图。

### 内容与任务管理
文章搜索 / 复制 / 删除；任务重试 / 删除 / 清空历史；发布日志可清空。

### 6 套界面主题
浅色 / 深色 / 海蓝 / 森绿 / 暖橙 / 玫瑰，右上角一键切换并记住选择。

### 三级容灾
1. 平台专属选择器（第一优先级）
2. 通用启发式规则（猜输入框与按钮）
3. 剪贴板手动模式（自动打开编辑页，内容已复制）

---

## 数据目录与迁移

程序数据默认位于：

```
release\自由发-win32-x64\resources\app\data
```

该目录包含登录态、素材库、文章、任务记录和违禁词库，**可以整个文件夹拷贝到别处**。

> ⚠️ 请放在**可写目录**，不要放在 `Program Files` 等需要管理员权限的位置。

---

## 开发模式

```bash
# Electron 调试模式
npm start

# 仅启动本地服务，浏览器访问 http://127.0.0.1:8917
node server.js

# 纯网页模式启动
start.bat
# 或
启动.vbs
```

---

## 重新打包

```bash
npm run pack
```

输出目录：`release\自由发-win32-x64`

macOS 版需要在 macOS 上执行（Windows 无法创建 .app 内的符号链接）：

```bash
npm run pack:mac          # Apple Silicon（arm64）
npm run pack:mac-intel    # Intel（x64）
```

输出目录分别是 `release/自由发-darwin-arm64` 与 `release/自由发-darwin-x64`。CI（`.github/workflows/release.yml`）会在打 tag 时自动构建两个平台的安装包并发布到 Release。

**注意事项：**

- 打包前请先把 `data` 目录移走，避免把运行数据打进安装包。
- `electron-packager` 的 `--ignore` 参数会按目录名误伤 `node_modules` 中的同名子目录（例如 `content-type/dist`），**不要使用** `--ignore=^/dist` 这类规则。

---

## 依赖与环境

- **Node.js 20+**
- 程序内已含 Chromium 自动化能力，**优先调用系统已安装的 Chrome**
- Windows 10 / 11（预打包版本为 win64）

---

## 常见问题

**Q：Releases 页面打不开或没有 zip？**
A：如果 Releases 暂时为空，请使用「源码运行」方式，按上文执行 `npm install && npm run pack` 自行打包。打包产物在 `release\自由发-win32-x64`。

**Q：发布到一半提示未登录？**
A：这是登录态过期。程序会自动弹出登录页，扫码完成后会从断点继续，不需要重新发布。

**Q：某个平台发布失败？**
A：该平台可能被标记为「实验性」，页面结构变化导致选择器失效。程序会自动降级为手动模式，内容已复制到剪贴板，打开编辑页粘贴即可。

**Q：数据存在哪里？换电脑怎么办？**
A：全部在程序目录的 `data` 文件夹。整个文件夹拷到新电脑的对应位置即可迁移。

**Q：会不会被平台判定为异常？**
A：程序通过本机浏览器模拟正常网页操作，没有内置任何对抗风控的机制，默认按接近真人的节奏使用。请勿高频、机械化批量操作。

---

## 许可证

本项目采用 **MIT License** 开源发布。

```
MIT License

Copyright (c) 2025 xingguangYan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**使用建议：**

- 在仓库根目录新建一个 `LICENSE` 文件，把上面这段文本原样粘贴进去，GitHub 会自动识别为 MIT。
- 如果你希望保留署名但禁止商业闭源分发，可以把许可证换成 **AGPL-3.0**；如果希望完全放开，MIT 是最简单、对使用者最友好的选择。
- 第三方依赖（Electron、Playwright/Puppeteer 等）各自遵循其原有许可证，MIT 不覆盖这些依赖。

---

## 合作与联系

欢迎以下形式的合作与反馈，统一联系邮箱：

**📧 xingguangyan0703@gmail.com**

### 1. 平台适配贡献
发现某个平台发布失败、选择器失效，或希望新增平台支持，欢迎提交 Issue 或 Pull Request。提交时请附上：
- 平台名称与页面 URL
- 失败截图或错误日志
- 复现步骤

### 2. Bug 反馈与功能建议
通过 GitHub Issues 或邮件反馈均可。邮件反馈请尽量附上运行环境（Windows 版本、Node.js 版本）和日志片段。

### 3. 定制开发
如需针对特定平台、特定工作流（例如企业内部内容系统对接、批量素材处理、私有化部署）做定制，可通过邮件说明需求范围、时间预期和预算，我会评估后回复。

### 4. 企业与团队合作
团队版、私有化部署、培训与技术支持等合作，请邮件沟通，注明公司 / 团队名称与使用场景。

### 5. 赞助与打赏
项目完全免费开源。如果它帮你省下了订阅费或时间，欢迎通过程序侧栏右下角的支付宝打赏码请我喝杯咖啡。赞助不影响功能与许可证，纯属自愿。

> 邮件通常会在 1–3 个工作日内回复。Issue 和 PR 的响应会更快一些。

---

## 法律与边界

- 本工具**只应操作你自己拥有或有权操作的账号**。
- 部分平台的服务条款限制自动化操作，使用本工具的风险由使用者自行承担。
- 本工具**不包含、不破解**任何商业软件的代码或授权。
- 素材与文字的版权归原作者所有，请勿用于侵权用途。
- 因违反平台条款或法律法规产生的后果，项目作者不承担责任。

---

## 致谢

感谢所有提交 Issue、PR 和反馈平台适配问题的使用者。这个项目的平台选择器能持续可用，靠的是社区的实际使用反馈。

如果这个工具对你有帮助，欢迎点一个 ⭐ Star。

---

### 需要你做的三件事

1. **确认 `Releases` 已有 `freeflow-win64.zip`**，否则把「下载安装」改成源码为主。
2. **在仓库根目录添加 `LICENSE` 文件**，内容用上面 MIT 全文。
3. **确认许可证选择**：如果你不想让别人拿去做闭源商业产品，告诉我，我帮你换成 AGPL-3.0 并调整 README 措辞。
