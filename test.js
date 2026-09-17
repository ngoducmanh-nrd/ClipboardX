console.log('Hello Electron');
const { app, BrowserWindow } = require('electron');
app.whenReady().then(() => {
  console.log('App ready');
  const win = new BrowserWindow({ width: 800, height: 600 });
  win.loadURL('about:blank');
});