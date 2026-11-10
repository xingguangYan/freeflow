// 预加载脚本：在渲染进程暴露受控的退出确认 IPC（contextIsolation 下唯一的通信通道）
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('freeflow', {
  isElectron: true,
  onAskExit: cb => {
    const handler = () => { try { cb(); } catch { /* 渲染进程异常由主进程兜底 */ } };
    ipcRenderer.on('ff-ask-exit', handler);
    return () => ipcRenderer.removeListener('ff-ask-exit', handler);
  },
  exitReply: confirm => ipcRenderer.send('ff-exit-reply', !!confirm)
});
