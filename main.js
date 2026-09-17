const { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let win = null;
let tray = null;
const isHidden = process.argv.includes('--hidden');

// Base64 của ảnh logo clipboard xanh dương của người dùng
const iconDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEEAAABBCAYAAACO98lFAAADNklEQVR4AeyZz28SQRTHv0B/UG0hLdSC1HLQgzXxQNR4kJhK0kND9GB689KDiffeOBFP/A0mNTHpUaONniUevMjFJh68eLBGBRqRNiHhN/hA0u7CNtnd2eys9pHvg91l5s2bzz7C7Dz30vKt7mk3N/gFhkBJwBAYAhEgcSYwBCJA4kxgCESAxJnAEIgAiTOBIRABEmcCQyACpH8yEyhuS8UQCCdDYAhEgGRTJoTgOpuAZ1qPxeFyUWQ2ygYIMXhXnmLxXgrn7+qxNBbXt+CdtI+CZRBcvg14L6cwNWIb8IcnjM1oLAr/NS1fKXgja7A6USyB4L60hXDyAeZjCQRH7AoMIugDm4hq+Upg/vYmwiublm6OikOYTGHuehSefuj2vHnCa5hbjlk2mDiECxcxpcjPTr2B1pB1TYTbbY366SgcTYXvmPCq3UUcgsrvHkovk8ir7C2qqjb6Tqofh/0kUdrX19doK4shGB3eGe0ZAt0HGyC8RvlNBj8NWvkrRWeTbIDwBZ1KFm2D1mnZRICGsQECjeJw2QLB4QwsXXg5fa4nxseZQGgcAiGk61HbrVybe2bgHg/RFMQlH4I/jcD9bV2G2oGgYsLBOCLr2wgn0vAolu2KFroP5UJw0WN2Io4zAnsHYwtxLMQf6Z6wVkO5EJZuYtqrFZaxa57IDYi4kQthfFzx91RAyciq8lPhmJTr+NDMkVwIqojrxlaWtfqqt8iJgyCITEOsL0MgfgyBIRABEmcCQyACJIszwXdCASalUZSha+d8FIJ8aUIwFNbBbzSPOsxiZqT4ktAoyAyuRWePope0EcwVOBg2ZcxAeWxwCcqhlH6P4eQ/16mjBZLgQozXwWxfdPBmfmPuRC6MV8mEF5ZxXfXxkv0Px4vorCuwza3Z4j8yYfwiD2bk1egcYxEAYspHwwBMLOEBgCESBxJjAEIkDiTPivINBkzIozgcgxBAB/AAAA///p/PJXAAAABklEQVQDANQEGWIg4UQQAAAAAElFTkSuQmCC';
let appIcon = null;

function createWindow() {
  appIcon = nativeImage.createFromDataURL(iconDataUrl);
  win = new BrowserWindow({
    width: 1200,
    height: 750,
    show: false,
    frame: false,
    icon: appIcon,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Load file index.html
  win.loadFile('index.html').catch(err => {
    console.error('Lỗi load file:', err);
  });


  // Đăng ký sự kiện tắt: thay vì tắt hẳn sẽ ẩn xuống tray
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  win.on('ready-to-show', () => {
    if (!isHidden) {
      win.show();
      win.focus();
    }
  });
}

function createTray() {
  try {
    if (!appIcon) {
      appIcon = nativeImage.createFromDataURL(iconDataUrl);
    }
    tray = new Tray(appIcon);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show ClipboardX', click: () => { if (win) { win.show(); win.focus(); } } },
      { type: 'separator' },
      { label: 'Quit', click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);
    tray.setToolTip('ClipboardX');
    tray.setContextMenu(contextMenu);
    
    // Nhấp đúp vào tray icon để hiển thị cửa sổ
    tray.on('double-click', () => {
      if (win) {
        if (win.isVisible()) {
          win.hide();
        } else {
          win.show();
          win.focus();
        }
      }
    });
  } catch (err) {
    console.error('Lỗi khởi tạo khay hệ thống:', err);
  }
}

// IPC Main listeners for custom window controls
ipcMain.on('window-minimize', (event) => {
  const w = BrowserWindow.fromWebContents(event.sender);
  if (w) w.minimize();
});

// IPC listener to maximize or restore window
ipcMain.on('window-maximize', (event) => {
  const w = BrowserWindow.fromWebContents(event.sender);
  if (w) {
    if (w.isMaximized()) {
      w.unmaximize();
    } else {
      w.maximize();
    }
  }
});

// IPC listener to close window (which hides it to system tray)
ipcMain.on('window-close', (event) => {
  const w = BrowserWindow.fromWebContents(event.sender);
  if (w) w.close(); // Kích hoạt sự kiện 'close' của window (sẽ ẩn đi)
});

// IPC listener to hide window directly
ipcMain.on('window-hide', (event) => {
  const w = BrowserWindow.fromWebContents(event.sender);
  if (w) w.hide();
});

// IPC Main listener to get/set autostart settings
ipcMain.handle('get-autostart', () => {
  try {
    return app.getLoginItemSettings().openAtLogin;
  } catch (err) {
    console.error('Failed to get login item settings:', err);
    return false;
  }
});

ipcMain.handle('set-autostart', (event, enabled) => {
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: app.getPath('exe'),
      args: ['--hidden']
    });
    return app.getLoginItemSettings().openAtLogin;
  } catch (err) {
    console.error('Failed to set login item settings:', err);
    return false;
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();

  // Đăng ký phím tắt toàn cục: Ctrl + Alt + V để ẩn/hiện nhanh ứng dụng
  globalShortcut.register('CommandOrControl+Alt+V', () => {
    if (win) {
      if (win.isVisible() && win.isFocused()) {
        win.hide();
      } else {
        win.show();
        win.focus();
      }
    }
  });
});

app.on('will-quit', () => {
  // Giải phóng phím tắt toàn cục khi thoát ứng dụng
  globalShortcut.unregisterAll();
});

// Thoát app khi đóng tất cả cửa sổ (Windows)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});