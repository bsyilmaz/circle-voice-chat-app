const { app, BrowserWindow, ipcMain, Menu, dialog, desktopCapturer } = require('electron');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');
const fs = require('fs');
let mainWindow;
let signalingProcess = null;
const isDev = process.argv.includes('--dev');
function startSignalingServer() {
  console.log('Starting signaling server...');
  if (isDev) {
    try {
      const serverPath = path.join(__dirname, '../signaling/server.js');
      if (fs.existsSync(serverPath)) {
        const nodeExec = process.execPath;
        signalingProcess = spawn(nodeExec, [serverPath], {
          detached: true,
          stdio: 'ignore'
        });
        signalingProcess.unref();
        console.log('Signaling server started with PID:', signalingProcess.pid);
      } else {
        console.error('Signaling server file not found:', serverPath);
      }
    } catch (error) {
      console.error('Failed to start signaling server:', error);
    }
  }
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,           
      contextIsolation: true,          
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../../public/assets/icon.svg'),
    backgroundColor: '#2e2c29',
    title: 'BizXM - Voice Chat & Screen Sharing'
  });
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../../public/index.html'),
    protocol: 'file:',
    slashes: true
  }));
  mainWindow.webContents.openDevTools();
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  createMenu();
}
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Dark/Light Mode',
          click: () => {
            mainWindow.webContents.send('toggle-theme');
          }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About BizXM',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              title: 'About BizXM',
              message: 'BizXM - Voice Chat & Screen Sharing',
              detail: 'Version 1.0.0\n\nA desktop application for voice chat and screen sharing with noise suppression.',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
app.on('ready', () => {
  startSignalingServer();
  createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
app.on('will-quit', () => {
  if (signalingProcess && signalingProcess.pid) {
    try {
      process.kill(signalingProcess.pid);
      console.log('Signaling server stopped');
    } catch (error) {
      console.error('Failed to stop signaling server:', error);
    }
  }
});
ipcMain.on('app-quit', () => {
  app.quit();
});
ipcMain.on('leave-room', () => {
  if (mainWindow) {
    mainWindow.webContents.send('leave-room');
  }
});
ipcMain.on('toggle-theme', () => {
  if (mainWindow) {
    mainWindow.webContents.send('toggle-theme');
  }
});
ipcMain.handle('get-screen-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 150, height: 150 }
    });
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnailURL: source.thumbnail.toDataURL()
    }));
  } catch (error) {
    console.error('Error getting screen sources:', error);
    return [];
  }
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
}); 