// Electron 主进程：拉起本地服务并装入独立程序窗口。
const { app, BrowserWindow, shell } = require('electron');
const { fork } = require('child_process');
const path = require('path');
const http = require('http');

const PORT = 8917;
let serverProc = null;
let win = null;

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
    env: { ...process.env, FREEFLOW_ELECTRON: '1' },
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
      icon: path.join(__dirname, 'app.ico'),
      webPreferences: { contextIsolation: true }
    });
    win.loadURL('http://127.0.0.1:' + PORT);
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
