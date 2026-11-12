# 自由发 · Freeflow

### Multi-platform publishing tool for creators · Runs locally · Free & open source

**[中文文档](README_CN.md)** · English

> China mirror: [gitcode.com/qq_31988139/freeflow](https://gitcode.com/qq_31988139/freeflow)

![Windows](https://img.shields.io/badge/-Windows-0078D4?logo=windows)
![macOS](https://img.shields.io/badge/-macOS-000000?logo=apple)
![Android](https://img.shields.io/badge/-Android-3DDC84?logo=android)
![iOS](https://img.shields.io/badge/-iOS-000000?logo=apple)
![Node.js](https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs)
![MIT](https://img.shields.io/badge/license-MIT-22C55E)

Freeflow drives **your own accounts** through browser automation. It cracks nothing, routes nothing through third-party servers, and keeps every login state, asset, and publish record on your own machine.

---

## Latest release: v1.9.4

- **Real audit of all 53 publishing entry points**: each platform's article / image / video editor URL was opened and checked for final URL, login wall, captcha, editor fingerprints (ProseMirror / Quill / CodeMirror / TinyMCE / UEditor / iframe / contenteditable) and screenshots — see `tools/platform-audit/audit.json` and `PLATFORM_MATRIX.md`
- **Business inquiries entry**: a "Business inquiries" block in the sidebar with two `mailto:` links
- **README / Release policy**: README keeps only the current release notes, install & usage, and business contact; all older release notes live in [Releases](https://github.com/xingguangYan/freeflow/releases)
- **Stability**: carries the v1.9.3 fixes for message-center API parsing, stats API field mapping, and editor undo/space/save-race issues

> Older release notes: [GitHub Releases](https://github.com/xingguangYan/freeflow/releases).

---

## Key features

- **Fully local**: no cloud backend; login states and content stay on your machine
- **Operates your own accounts**: publishes by automating each platform's own web editor; nothing is cracked
- **53 platforms**: 38 Chinese + 15 overseas
- **Built-in browser core**: no system Chrome required — unzip and run
- **Three-tier fallback**: platform selectors → generic heuristics → clipboard manual mode, always with an explicit failure message
- **Free & open source**: MIT license

---

## Platform coverage

- **Chinese article (24)**: WeChat Official Account, Toutiao, Baijiahao, Zhihu, Xiaohongshu, Bilibili Columns, Jianshu, CSDN, Weibo, Sohu, NetEase, Dayuhao, Yidian, Sina Kandian, Kuaichuan, Dongfang, Phoenix, Meipian, Autohome, CNBlogs, Juejin, SegmentFault, Baidu Tieba, Xueqiu, Douban
- **Chinese video (13)**: Douyin, Kuaishou, Bilibili Video, Xigua, Haokan, WeChat Channels, Zhihu Video, iQIYI, Penguin, Sohu Video, AcFun, Youku, Weibo Video
- **Overseas (15)**: Medium, Dev.to, LinkedIn, Reddit, Hashnode, Substack, Tumblr, Pinterest, X, Facebook, YouTube, TikTok, Vimeo, Dailymotion, Instagram

Per-platform entries, login requirements and verification status: [PLATFORM_MATRIX.md](PLATFORM_MATRIX.md).

---

## Download & install

### Windows

Get `freeflow-win64.zip` from [Releases](https://github.com/xingguangYan/freeflow/releases/latest), unzip and run `自由发\自由发.exe`. Portable, with the browser core bundled.

### macOS

- Apple Silicon: `freeflow-mac-arm64.zip` / `.dmg`
- Intel: `freeflow-mac-x64.zip` / `.dmg`

If macOS blocks the first launch: right-click the app → Open, or run `xattr -cr /Applications/自由发.app`.

### Android / iOS

- Android: `freeflow-android.apk`, allow unknown-source installs
- iOS: `freeflow-ios.ipa`, sign with Sideloadly / AltStore (free signing lasts 7 days)

The phone build is a "pocket editor + remote": join the same Wi-Fi and enter the desktop address (e.g. `192.168.1.10:8917`) in the status pill; accounts and publishing run on the desktop engine.

### Run from source

```bash
git clone https://github.com/xingguangYan/freeflow.git
cd freeflow
npm install
npm run pack
```

Requires Node.js 20+.

---

## Quick start

1. **Log in**: Accounts tab → pick a platform → add account → scan the QR code
2. **Write**: Articles tab, choose article / video / audio, write in rich text or Markdown
3. **Publish**: tick target accounts → preview → publish now or schedule
4. **Semi-automatic platforms**: a few (e.g. WeChat Official Account) need the final click/QR confirm from you

---

## Data directory & upgrades

All user data (login states, cookies, drafts, assets, task history, configs) lives in the `data/` folder next to the app. Upgrading replaces program files only — **never delete `data/`**; the whole folder is portable.

---

## Business inquiries

- [xingguangyan0703@gmail.com](mailto:xingguangyan0703@gmail.com)
- [346049806@qq.com](mailto:346049806@qq.com)

Platform adapters, bug reports, custom development, teams and private deployments are all welcome by email.

---

## Legal & boundaries

- Only operate accounts you own or are authorized to operate
- Some platforms' terms of service restrict automation; you use this tool at your own risk
- No cracked code or authorization from any commercial software
- Assets and text remain the property of their authors

---

## License

MIT License · Copyright (c) 2025 xingguangYan
