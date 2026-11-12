# 自由发 · Freeflow

### 自媒体多平台分发工具 · 本地运行 · 免费开源

**[English](README.md)** · 中文

> 国内访问镜像：[gitcode.com/qq_31988139/freeflow](https://gitcode.com/qq_31988139/freeflow)

![Windows](https://img.shields.io/badge/-Windows-0078D4?logo=windows)
![macOS](https://img.shields.io/badge/-macOS-000000?logo=apple)
![Android](https://img.shields.io/badge/-Android-3DDC84?logo=android)
![iOS](https://img.shields.io/badge/-iOS-000000?logo=apple)
![Node.js](https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs)
![MIT](https://img.shields.io/badge/license-MIT-22C55E)

用浏览器自动化操作**你自己的账号**。不破解任何软件，不经过任何第三方服务器，所有登录态、素材和发布记录都只保存在本机。

---

## 最新版本 v1.9.4

- **53 平台发布入口真实审计**：逐平台打开文章/图片/视频编辑入口，记录最终 URL、登录墙、验证码、编辑器特征（ProseMirror / Quill / CodeMirror / TinyMCE / UEditor / iframe / contenteditable）与截图，产出 `tools/platform-audit/audit.json` 和 `PLATFORM_MATRIX.md`
- **商务合作入口**：左侧栏新增「商务合作」，两枚邮箱均为 `mailto:` 直达
- **README / Release 规范**：README 只保留当前版本说明、安装使用与商务合作；历史版本更新说明统一放在 [Releases](https://github.com/xingguangYan/freeflow/releases)
- **稳定性**：沿用 v1.9.3 的消息中心真实接口解析、数据采集接口字段映射、编辑器撤销/空格/保存竞态修复

> 历史版本更新说明见 [GitHub Releases](https://github.com/xingguangYan/freeflow/releases)。

---

## 核心特点

- **纯本地运行**：无云端后端，登录态与内容只存在本机
- **操作自有账号**：通过本机浏览器自动化完成发布，不破解任何商业软件
- **53 个平台**：国内 38 个 + 海外 15 个
- **内置浏览器内核**：不依赖系统 Chrome，解压即用
- **三级容灾**：平台专属选择器 → 通用启发式 → 剪贴板手动模式，失败都有明确提示
- **免费开源**：MIT 许可证

---

## 平台覆盖

- **国内图文（24）**：微信公众号、头条号、百家号、知乎、小红书、B站专栏、简书、CSDN、微博、搜狐号、网易号、大鱼号、一点资讯、新浪看点、快传号、东方号、凤凰号、美篇、车家号、博客园、掘金、SegmentFault、百度贴吧、雪球、豆瓣
- **国内视频（13）**：抖音、快手、B站视频、西瓜视频、好看视频、微信视频号、知乎视频、爱奇艺号、企鹅号、搜狐视频、AcFun、优酷、微博视频
- **海外（15）**：Medium、Dev.to、LinkedIn、Reddit、Hashnode、Substack、Tumblr、Pinterest、X、Facebook、YouTube、TikTok、Vimeo、Dailymotion、Instagram

每个平台的发布入口、登录要求、编辑器特征与验证结果见 [PLATFORM_MATRIX.md](PLATFORM_MATRIX.md)。

---

## 下载安装

### Windows

到 [Releases](https://github.com/xingguangYan/freeflow/releases/latest) 下载 `freeflow-win64.zip`，解压后双击 `自由发\自由发.exe`。免安装，内置浏览器内核。

### macOS

- Apple 芯片：`freeflow-mac-arm64.zip` / `.dmg`
- Intel：`freeflow-mac-x64.zip` / `.dmg`

首次打开若提示无法验证开发者：右键 App → 打开，或执行 `xattr -cr /Applications/自由发.app`。

### Android / iOS

- Android：下载 `freeflow-android.apk`，允许未知来源安装
- iOS：下载 `freeflow-ios.ipa`，用 Sideloadly / AltStore 自签后安装（免费签名 7 天有效）

手机版为「随身编辑器 + 遥控器」：与电脑连同一 WiFi，在状态条填电脑地址（如 `192.168.1.10:8917`），账号与一键发布走电脑引擎。

### 源码运行

```bash
git clone https://github.com/xingguangYan/freeflow.git
cd freeflow
npm install
npm run pack
```

需要 Node.js 20+。

---

## 快速使用

1. **登录账号**：账号页选择平台 → 添加账号 → 点「登录」扫码
2. **编辑内容**：文章页切换图文/视频/音频，富文本或 Markdown 写作
3. **一键发布**：勾选目标账号 → 预览 → 立即发布或定时发布
4. **半自动平台**：少数平台（如微信公众号）需要你最后手动点发表/扫码确认

---

## 数据目录与升级

用户数据（登录态、cookies、草稿、素材、任务记录、配置）全部在程序目录的 `data/` 文件夹。升级时只替换程序文件，**不要删除 `data/`**；整个文件夹可拷贝迁移。

---

## 商务合作

- 📧 [xingguangyan0703@gmail.com](mailto:xingguangyan0703@gmail.com)
- 📧 [346049806@qq.com](mailto:346049806@qq.com)

平台适配贡献、Bug 反馈、定制开发、团队与私有化部署均可邮件沟通。

---

## 法律与边界

- 本工具只应操作你拥有或有权操作的账号
- 部分平台服务条款限制自动化操作，使用风险由使用者自行承担
- 不包含、不破解任何商业软件代码或授权
- 素材与文字版权归原作者所有

---

## 许可证

MIT License · Copyright (c) 2025 xingguangYan
