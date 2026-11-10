// Electron 主进程：拉起本地服务并装入独立程序窗口。
const { app, BrowserWindow, shell } = require('electron');
const { ipcMain } = require('electron');
const { fork } = require('child_process');
const path = require('path');
const http = require('http');

const PORT = 8917;
let serverProc = null;
let win = null;
let quitting = false, asking = false, askTimer = null;

// 退出确认：渲染进程 5 秒没回应（页面没加载好/卡死）直接放行，避免卡死无法退出
function forceQuit() {
  if (askTimer) { clearTimeout(askTimer); askTimer = null; }
  asking = false; quitting = true;
  if (win && !win.isDestroyed()) win.destroy();
  app.quit();
}
function askExit() {
  if (asking || !win || win.isDestroyed()) return;
  asking = true;
  try { win.webContents.send('ff-ask-exit'); } catch { /* 页面未加载好 */ }
  if (askTimer) clearTimeout(askTimer);
  // 页面没加载好（渲染进程不可能应答）4 秒就放行；正常弹窗给 60 秒决定，只做兜底防卡死
  const loaded = /127\.0\.0\.1/.test(win.webContents.getURL() || '');
  askTimer = setTimeout(forceQuit, loaded ? 60000 : 4000);
}
ipcMain.on('ff-exit-reply', (e, ok) => {
  if (!asking) return; // 迟到的回复一律忽略
  if (askTimer) { clearTimeout(askTimer); askTimer = null; }
  asking = false;
  if (ok) forceQuit(); // 确认退出：销毁窗口并退出；取消则什么都不做
});

// macOS 的 .app 包内目录不应写入（App Translocation/签名一致性），数据放 ~/Library/Application Support；
// Windows 版继续用程序目录下的 data（老用户数据不迁移、不丢失）。
function serverEnv() {
  const env = { ...process.env, FREEFLOW_ELECTRON: '1' };
  if (process.platform === 'darwin') {
    const userData = app.getPath('userData');
    env.FREEFLOW_DATA = userData;
    // 首次运行：把打包进 .app 的旧数据（若有）拷到可写目录，保留直接解压升级的用户数据
    try {
      const fs = require('fs');
      const src = path.join(__dirname, 'data');
      if (fs.existsSync(src) && !fs.readdirSync(userData).length) {
        fs.cpSync(src, userData, { recursive: true });
      }
    } catch { /* 拷失败不阻塞启动 */ }
  }
  return env;
}

function waitForServer(maxTries = 60) {
  return new Promise(resolve => {
    let tries = 0;
    const timer = setInterval(() => {
      http.get({ host: '127.0.0.1', port: PORT, path: '/api/platforms' }, r => {
        if (r.statusCode === 200) { clearInterval(timer); resolve(true); }
      }).on('error', () => {
        if (++tries > maxTries) { clearInterval(timer); resolve(false); }
      });
    }, 300);
  });
}

function boot() {
  const fs = require('fs');
  const logF = path.join(__dirname, 'data', 'electron-boot.log');
  try { fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true }); } catch { /* */ }
  serverProc = fork(path.join(__dirname, 'server.js'), [], {
    env: serverEnv(),
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });
  serverProc.stdout.on('data', d => fs.appendFileSync(logF, '[out] ' + d));
  serverProc.stderr.on('data', d => fs.appendFileSync(logF, '[err] ' + d));
  serverProc.on('exit', code => {
    fs.appendFileSync(logF, '[exit] code=' + code + '\n');
    serverProc = null;
  });
  waitForServer().then(() => {
    win = new BrowserWindow({
      width: 1280, height: 860, minWidth: 1000, minHeight: 680,
      title: '自由发 · 自媒体多平台分发',
      icon: path.join(__dirname, process.platform === 'darwin' ? 'app.icns' : 'app.ico'),
     webPreferences: { contextIsolation: true, preload: path.join(__dirname, 'preload.js') }
    });
    win.loadURL('http://127.0.0.1:' + PORT);
    // 关闭窗口（点 X / Alt+F4 / Cmd+Q）先问一次，确认才退出
    win.on('close', e => {
      if (quitting) return;
      e.preventDefault();
      askExit();
    });
    // macOS 关闭窗口后点 Dock 图标应重新打开窗口
    app.on('activate', () => {
      if (!win) boot();
    });
    // 平台登录页等外部地址交给系统浏览器，不在程序内打开
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//.test(url) && !url.startsWith('http://127.0.0.1')) {
        shell.openExternal(url);
        return { action: 'deny' };
      }
      return { action: 'allow' };
    });
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.whenReady().then(boot);
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
  const killServer = () => { if (serverProc) { serverProc.kill(); serverProc = null; } };
  app.on('window-all-closed', () => { killServer(); app.quit(); });
  app.on('before-quit', killServer);
}
