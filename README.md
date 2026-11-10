# 自由发 · Freeflow

### Multi-platform publishing tool for content creators · Runs locally · Free & open source

**[中文文档](README_CN.md)** · English
> China mirror: [gitcode.com/qq_31988139/freeflow](https://gitcode.com/qq_31988139/freeflow)

Freeflow drives **your own accounts** through browser automation. It cracks nothing, routes nothing through third-party servers, and keeps all login states, assets, and publish history on your own machine. Ships as a standalone Windows app, no installer needed, with a macOS build available since v1.4 (see [macOS build](#macos-build-apple-silicon--intel)).

![open-source](https://img.shields.io/badge/-open_source-3DA639?logo=opensource)
![local](https://img.shields.io/badge/-runs_locally-4B5563?logo=localhost)
![publishing](https://img.shields.io/badge/-multi_platform_publishing-FF6B6B?logo=buffer)
![Windows](https://img.shields.io/badge/-Windows_desktop-0078D4?logo=windows)
![Node.js](https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs)
![free](https://img.shields.io/badge/-free_&_open_source-22C55E?logo=githubsponsors)
![macOS](https://img.shields.io/badge/-macOS_desktop-000000?logo=apple)

---

## v1.9.2 release (built-in browser · no system Chrome needed)

- **Login & publishing use the built-in browser**: everything now runs on the bundled Chromium core instead of the system Chrome — computers without Chrome installed can log in and publish right away. Fixes the "browserType.launchPersistentContext: Chromium distribution 'chrome' is not found" error some users hit.
- **Out of the box**: the Windows / macOS packages ship the browser core inside — unzip and run, no prerequisite installs (bigger download, zero setup).
- **"Install browser core" button**: for source runs, one click downloads the core into the app's own folder.
- **Friendlier errors**: if the core is ever missing or broken, the app points you to the one-click install instead of dumping a raw English stack trace.

## v1.9.1 release (message center · EN/中文 switch · update check)

- **Unified message center**: the "Messages" tab aggregates DMs, comments, and system notifications from every connected platform, filterable by platform, type, and unread state. Reply right in the app and the reply is sent through the source platform (target platform and account are shown before sending; failures keep a draft for retry; platforms without reliable reply support say so explicitly — nothing is faked).
- **One-click language switch**: the language button in the top bar (EN / 中文) switches the entire UI and remembers your choice; dynamically rendered text is picked up by the translation pipeline automatically.
- **In-app update check**: a "Check for updates" button in the top bar plus an automatic check on every startup against GitHub Releases. When a new version is out, a dialog shows the release notes and "Download" jumps straight to the release page.
- **Stats from creator data centers**: 16 platforms including Zhihu, CSDN, and Bilibili now collect followers, reads, and likes from the official creator dashboards — far more accurate.
- **Per-platform trend charts**: the trends panel can switch between platforms or aggregate all of them, bucketed per day across every account of the chosen platform.
- **LLM result dual view**: generated results support "Preview (rendered HTML) / edit source", with code fences stripped automatically and plain text converted to HTML.

## v1.9 release (my LLMs · multi-vendor API access)

- **"My LLMs" module**: a "My LLMs" item in the sidebar (interaction modeled on Codex++) lets you import your own large language model to help write content.
  - **9 vendor presets**: OpenAI, DeepSeek, Qwen, Zhipu GLM, Kimi, Doubao, Google Gemini, local Ollama, and SiliconFlow — pick a vendor and the endpoint and popular model list are filled in for you, or fully customize any OpenAI-compatible endpoint.
  - **Per-model settings**: temperature, max length, and system prompt (writing persona) are stored per config, so multiple models never pollute each other; the API key stays local and is always masked in the UI.
  - **Connection test / model list fetch**: test connectivity before and after saving, pull the remote model list, and click any fetched model to fill it in.
  - **Local materials as context**: pick local txt / md / json / csv files as writing materials (only files you choose are read, and you can remove any at any time); they are injected as reference content when generating.
  - **Generate → preview → drafts → publish**: edit the generated title and body, save it to the draft box, or jump straight to "Publish all" and pick platforms.
  - **Safety boundaries**: without a configured model, no API is ever called; failures report the HTTP status and reason clearly — never faked.
- **One-click login check**: the publish page has a "Check all logins" button that opens browsers in batch to read each account's cookie login state so logged-out accounts can prompt for a QR scan — no more clicking one by one.
- **Publish now / Schedule split into two buttons**: picking no time no longer errors — "Publish now" just publishes, and "Schedule" requires a valid future time.
- **CSDN fix**: the editor URL now points to the rich-text entry `mp.csdn.net/mp_blog/creation/editor` instead of mistakenly opening the Markdown editor and garbling the body.
- **Baijiahao fix**: the Baijiahao title is an editable region and the generic selector used to write the body into the title; body candidates now skip the title element so title and body each land where they should.
- **Automated tests**: `node tools/test-fill.js` (20 cases) and `node tools/test-exit.js` (6 cases) all pass; the LLM module has an end-to-end verification (config / connectivity / materials / generation / save-to-draft / disable guard).

---
## v1.8 release (fully automated publishing + pre-publish formatting check)

- **Automated publishing everywhere**: the publish step upgraded from "guessing Chinese button labels" to "platform-specific labels/selectors first, generic Chinese/English fallback". CSDN, Xiaohongshu, Weibo, Zhihu, Bilibili Columns, Jianshu, Juejin, CNBlogs, plus Medium / Dev.to / LinkedIn / Reddit / Substack / Tumblr / X / Facebook all publish automatically.
- **CSDN rich-text done right**: CSDN uses the UEditor rich-text editor; filling now goes through the official instance API and immediately reads back to verify, so formatting and images survive intact instead of showing raw Markdown.
- **Pre-publish formatting check**: before clicking "Publish", the rich-text editor is inspected — if the body degraded to plain text with leftover `###`, `**`, `![]()` markers, **the automatic publish is halted and the window stays open** for you to confirm; missing images or lost paragraph structure also raise warnings so garbled content never goes out.
- **Body completeness verification**: after filling, the start, end, and length of the body are verified inside the editor; if a platform swallowed half of it, another strategy is tried automatically, and only total failure falls back to manual mode.
- **No HTML into plain-text editors**: plain-text bodies like Xiaohongshu get plain text — `<p>` and `<strong>` tags are never pasted as content.
- **Success confirmed before exit**: after clicking "Publish", the flow waits for a success notice or a jump to the backend page; without confirmation the **browser window stays open** so you can finish manually or double-check.
- **Title length adaptation**: per-platform title caps (WeChat 64 / Toutiao 30 / Zhihu 100 / Xiaohongshu 20 / Bilibili 40 / CSDN 100 / Weibo 30, etc.) are truncated automatically to avoid fill failures.
- **Regression tests**: `tools/test-fill.js` (20 cases covering rich-text/Markdown/UEditor filling, draft protection, formatting checks, publish-button matching, result detection) can be re-run with one command.

---
## v1.7 release (editor formatting upgrade · Xiaohongshu multi-entry · Bilibili/CSDN fixes)

- **Editor overhaul**: undo / redo (buttons plus Ctrl+Z / Ctrl+Y), font size, text color, highlight, line spacing, alignment, H1–H3, quotes, code blocks, ordered/unordered lists, tables, dividers — formatting on par with the CSDN / WeChat Official Account editors.
- **Xiaohongshu entry auto-selection**: a cover image goes to image notes (cover uploaded first), long-form text goes to "long article", video goes to the video entry; a new "Audio" type — pick a local audio file and publishing opens the Xiaohongshu audio entry, uploads it, then fills title and description.
- **Bilibili Column garbled-text fix**: the Bilibili editor is rich text (Quill); it used to receive raw Markdown and display `###` and `**` literally — now pasted as rich text, formatting intact.
- **CSDN body fill hardened**: after filling, the content is verified to actually land in the editor, with automatic strategy retries (native assignment → full keyboard replacement → plain-text insert) — no more "title filled, body empty".

---
<img width="1266" height="853" alt="image" src="https://github.com/user-attachments/assets/057c6312-1746-4885-a7d4-bed4d8ef5e21" />
<img width="1266" height="844" alt="v1.4 UI preview: accounts page + platform stats dashboard (same UI on Windows and macOS)" src="docs/preview.png" />

## Contents

- [Key features](#key-features)
- [Platform coverage](#platform-coverage)
- [Download & install](#download--install)
- [macOS build](#macos-build-apple-silicon--intel)
- [Android app](#android-app-v15)
- [iOS app](#ios-app-v16)
- [Workflow](#workflow)
- [Feature details](#feature-details)
- [Data directory & migration](#data-directory--migration)
- [Development mode](#development-mode)
- [Repackaging](#repackaging)
- [Dependencies & environment](#dependencies--environment)
- [FAQ](#faq)
- [License](#license)
- [Contact & collaboration](#contact--collaboration)
- [Legal & boundaries](#legal--boundaries)

---
<img width="1266" height="892" alt="image" src="https://github.com/user-attachments/assets/988bd2d1-21ce-4fa7-bf3e-fe2357bee553" />

## Key features

- **Fully local**: no cloud backend, no third-party servers — your login states and content live only on your own computer.
- **Drives your own accounts**: publishing happens by automating each platform's own web editor in a local browser. Nothing is cracked.
- **Three-tier fallback**: platform-specific selectors → generic heuristics → clipboard manual mode. A platform redesign never takes the whole feature down.
- **53 platforms**: 24 Chinese article platforms + 13 Chinese video platforms + 15 overseas platforms.
- **Free & open source**: MIT license — prompts, selectors, and UI are all editable.

---
<img width="1266" height="892" alt="image" src="https://github.com/user-attachments/assets/48107632-04d6-42dc-b1b0-755e19a6b46d" />

## Platform coverage

38 Chinese + 15 overseas = **53 platforms**.

**Chinese article (24)**
WeChat Official Account (微信公众号), Toutiao (头条号), Baijiahao (百家号), Zhihu (知乎), Xiaohongshu (小红书), Bilibili Columns (B站专栏), Jianshu (简书), CSDN, Weibo (微博), Sohu (搜狐号), NetEase (网易号), Dayuhao (大鱼号), Yidian Zixun (一点资讯), Sina Kandian (新浪看点), Kuaichuan (快传号), Dongfang (东方号), Phoenix (凤凰号), Meipian (美篇), Autohome (车家号), CNBlogs (博客园), Juejin (掘金), SegmentFault, Baidu Tieba (百度贴吧), Xueqiu (雪球), Douban (豆瓣)

**Chinese video (13)**
Douyin (抖音), Kuaishou (快手), Bilibili Video (B站视频), Xigua Video (西瓜视频), Haokan Video (好看视频), WeChat Channels (微信视频号), Zhihu Video (知乎视频), iQIYI (爱奇艺号), Penguin (企鹅号/Tencent Video), Sohu Video (搜狐号视频), AcFun, Youku (优酷), Weibo Video (微博视频)

**Overseas (15)**
Medium, Dev.to, LinkedIn, Reddit, Hashnode, Substack, Tumblr, Pinterest, X (Twitter), Facebook, YouTube, TikTok, Vimeo, Dailymotion, Instagram

> New platforms are marked "experimental". Their page structure changes often; on failure the editor page opens automatically and the flow degrades to manual mode — **content is already in your clipboard**, so nothing is lost.

---
<img width="1266" height="892" alt="image" src="https://github.com/user-attachments/assets/807c6c9e-9f19-4b4c-9533-f4c8d6fa3bc1" />
<img width="1266" height="892" alt="image" src="https://github.com/user-attachments/assets/f00be7de-2f4f-4a56-8a8b-42e85870e8aa" />

## Download & install

### Option 1: prebuilt download (recommended)

Get `freeflow-win64.zip` from [Releases](https://github.com/xingguangYan/freeflow/releases/latest), unzip, and double-click:

```
自由发\自由发.exe
```

No installer. Data lives in the `data` folder next to the executable; the whole folder is portable.

### macOS build (Apple Silicon / Intel)

Get the matching package from [Releases](https://github.com/xingguangYan/freeflow/releases/latest) (v1.4+):

- `freeflow-mac-arm64.zip` / `freeflow-mac-arm64.dmg` — Apple Silicon (M1/M2/M3/M4)
- `freeflow-mac-x64.zip` / `freeflow-mac-x64.dmg` — Intel

Unzip and drag 自由发 into Applications, or mount the dmg and drag to install. If the first launch says the developer cannot be verified, right-click the app and choose Open, or run once in a terminal:

```bash
xattr -cr /Applications/自由发.app
```

macOS data lives in `~/Library/Application Support/自由发`. Login and publishing already ship with a bundled browser core; for source runs, "Install browser core" on the Accounts tab downloads one (about 150 MB, once).

### Android app (v1.5)

Get `freeflow-android.apk` from [Releases](https://github.com/xingguangYan/freeflow/releases/latest) and install it after allowing installs from unknown sources.

**Design note**: Android does not allow an app to drive another app's web editor, so the phone build is not "fully automated publishing" — it is a "**pocket editor + remote**":

- A full editor is embedded: write articles and manage assets offline on the phone, same UI as desktop (the sidebar collapses into a drawer on narrow screens).
- On first launch, tap the status pill at the top right and enter the desktop's LAN address (e.g. `192.168.1.10:8917`).
- Once connected, accounts, assets, and one-click publishing all run on the desktop engine: QR login happens on the computer screen; the phone writes content and dispatches tasks.

<img width="320" alt="phone home" src="docs/mobile-home.png" /> <img width="320" alt="drawer menu" src="docs/mobile-drawer.png" /> <img width="320" alt="connect to desktop" src="docs/conn-modal.png" />

> Requires desktop v1.5+; the desktop service listens on port 8917 by default — phone and computer just need to be on the same Wi-Fi.

### iOS app (v1.6)

Get `freeflow-ios.ipa` from [Releases](https://github.com/xingguangYan/freeflow/releases/latest).

**Read this first**: there is no "just install the apk" equivalent in the Apple ecosystem — listing officially requires a $99/year developer account. To stay completely free, the iOS build is an **unsigned IPA** that you sign yourself with free tools:

1. Install [Sideloadly](https://sideloadly.io/) or [AltStore](https://altstore.io/) on your computer (Windows/Mac).
2. Connect the iPhone over USB, drag `freeflow-ios.ipa` in, and sign with your own Apple ID.
3. After installing, trust the developer certificate under Settings → General → VPN & Device Management.

A free Apple ID signature lasts 7 days; re-sign with the computer when it expires. The UI is identical to the Android build (same frontend) — see the Android screenshots above.

### Option 2: run from source

Requires **Node.js 20+**.

```bash
git clone https://github.com/xingguangYan/freeflow.git
cd freeflow
npm install
npm run pack
```

The build output lands in `release\自由发-win32-x64`; double-click `自由发.exe` inside it.

---

## Workflow

1. **Log in**: on the Accounts tab, pick a platform → add an account → click "Log in" and scan the QR code; the app detects the login state automatically.
2. **Write**: on the Articles tab, switch to Video or Article, fill in title / body (description) / tags. Videos can be picked from disk or referenced by local path.
3. **Publish everywhere**: tick the target accounts (unsupported platforms are filtered out automatically), then choose Publish now or Schedule.
4. **Semi-automatic platforms**: a visible browser opens each editor and fills everything; a few platforms (e.g. WeChat Official Account) need you to click the final "Publish" by hand.

---

## Feature details

### Multi-account management
Each platform/account uses its own browser profile directory. After a QR login the state is persisted locally, and accounts never share browser state.

### Dual-channel login detection
Both URL patterns and login cookies are checked, so "logged in but shown as not" does not happen. When one-click publishing hits a login wall, the login page opens and, after you log in, the task **resumes from the checkpoint** instead of being marked failed.

### Dual-mode editor
Rich text / Markdown anytime. During one-click publishing the content is converted automatically to whatever each platform actually supports (Markdown ⇄ rich text).

### Images in the body
"Insert image" in the toolbar picks from the asset library; images are inlined as **base64**, so platforms see them directly — no external image hosting needed.

### Paste web images directly
Copy an image from another site and paste it right in — it is downloaded into the asset library and inserted into the body automatically.

### One-click video publishing
Pick a video file → auto-upload → fill title / description / tags → publish.

### Scheduling & banned-word check
Scheduled tasks are supported; the banned-word list lives in `data/sensitive.txt` and is extendable.

### Platform stats dashboard
Collects followers, reads/plays, likes and other metrics after login and draws trend charts; since v1.9.1 the numbers come from each platform's "creator data center" page and the trends panel can switch between platforms.

### Unified message center (v1.9.1)
The "Messages" tab aggregates DMs, comments, and system notifications from every platform, filterable by platform/type/unread, with direct replies synced back to the source platform; the target platform and account are confirmed before sending, failures keep a retryable draft, and unsupported platforms are flagged clearly.

### Language switch (v1.9.1)
The top-bar language button switches the whole UI between 中文 and English (including dynamically rendered text) and remembers the choice.

### Update check (v1.9.1)
A top-bar "Check for updates" button plus an automatic check on startup; new versions show a dialog with the release notes and a direct download link.

### Content & task management
Article search / duplicate / delete; task retry / delete / clear history; publish logs can be cleared.

### 6 UI themes
Light / Dark / Ocean / Forest / Amber / Rose — one click in the top right, remembered.

### Three-tier fallback
1. Platform-specific selectors (first priority)
2. Generic heuristics (guess inputs and buttons)
3. Clipboard manual mode (the editor page opens with content already copied)

---

## Data directory & migration

App data lives in:

```
release\自由发-win32-x64\resources\app\data
```

It holds login states, the asset library, articles, task history, and the banned-word list — **the whole folder can be copied elsewhere**.

> Keep it in a **writable** location, not somewhere like Program Files that needs admin rights.

---

## Development mode

```bash
# Electron debug mode
npm start

# Local service only, browse to http://127.0.0.1:8917
node server.js

# Plain web mode
start.bat
# or
启动.vbs
```

---

## Repackaging

```bash
npm run pack
```

Output: `release\自由发-win32-x64`

The macOS build must be produced on macOS (Windows cannot create the symlinks inside an .app bundle):

```bash
npm run pack:mac          # Apple Silicon (arm64)
npm run pack:mac-intel    # Intel (x64)
```

Outputs land in `release/自由发-darwin-arm64` and `release/自由发-darwin-x64`. CI (`.github/workflows/release.yml`) builds both platforms and publishes to Releases whenever a tag is pushed.

**Notes:**

- Move the `data` directory away before packaging so runtime data does not end up inside the build.
- electron-packager's `--ignore` matches directory names and can hit `node_modules` subdirectories with the same name (e.g. `content-type/dist`) — **do not** use rules like `--ignore=^/dist`.

---

## Dependencies & environment

- **Node.js 20+**
- A Chromium browser core is bundled and used by default for login / publishing (no system Chrome needed); set `FREEFLOW_BROWSER=chrome` to use the system Chrome instead
- Windows 10 / 11 (the prebuilt package is win64)

---

## FAQ

**Q: The Releases page will not open or has no zip?**
A: If Releases is temporarily empty, use "run from source" above: `npm install && npm run pack`. The build lands in `release\自由发-win32-x64`.

**Q: "Not logged in" in the middle of publishing?**
A: The login state expired. The login page opens automatically; after the QR scan the task resumes from the checkpoint — no need to re-publish.

**Q: A platform failed to publish?**
A: It may be marked "experimental" — a page redesign broke the selectors. The flow degrades to manual mode with the content already in your clipboard; just paste it in the editor page.

**Q: Where is my data? What about a new computer?**
A: Everything is in the `data` folder next to the app. Copy that folder to the same place on the new computer.

**Q: Will platforms flag me as abnormal?**
A: The app drives local browsers as normal web pages and contains no anti-detection mechanism, pacing close to a human by default. Do not run high-frequency, mechanical bulk operations.

---

## License

This project is released under the **MIT License**.

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

---

## Contact & collaboration

Feedback and collaboration are welcome — reach out by email at **xingguangyan0703@gmail.com**.

### 1. Platform adapters
If a platform fails, its selectors break, or you want a new platform, open an Issue or Pull Request with the platform name and page URL, a failure screenshot or log, and reproduction steps.

### 2. Bug reports & feature requests
GitHub Issues or email both work. For email, please include your environment (Windows version, Node.js version) and a log excerpt.

### 3. Custom development
For a specific platform or workflow (internal content systems, batch asset processing, private deployment), email the scope, timeline, and budget and you will get an assessment in reply.

### 4. Teams
Team editions, private deployment, training, and support: please email with your company/team name and use case.

### 5. Sponsor
The project is completely free. If it saved you subscription fees or time, the Alipay QR code at the bottom right of the sidebar buys me a coffee. Sponsorship changes nothing about features or licensing.

> Email is usually answered within 1–3 business days; Issues and PRs get faster responses.

---

## Legal & boundaries

- This tool should only ever operate accounts **you own or are authorized to operate**.
- Some platforms' terms of service restrict automation; the risk of using this tool is yours.
- This tool **contains no cracked code or authorization** from any commercial software.
- The copyright of assets and text belongs to their authors; do not use this for infringement.
- The author is not responsible for consequences of violating platform terms or the law.

---

## Acknowledgements

Thanks to everyone who files Issues, PRs, and platform-adaptation feedback. The platform selectors keep working because of real-world community feedback.

If this tool helps you, a Star is appreciated.
