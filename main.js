const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const pty = require('node-pty');
const os = require('os');

let mainWindow;
let ptyProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Spawn terminal process
  const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : 'bash');
  ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.env.HOME,
    env: process.env,
  });

  // Send terminal output to renderer
  ptyProcess.onData((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.webContents.send('terminal-output', data);
      } catch (err) {
        // Window might be closing, ignore
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (ptyProcess) {
      ptyProcess.kill();
    }
  });
}

// Handle terminal input from renderer
ipcMain.on('terminal-input', (event, data) => {
  if (ptyProcess) {
    ptyProcess.write(data);
  }
});

// Handle window resize from draggable stars
ipcMain.on('resize-window', (event, { x, y, width, height }) => {
  if (mainWindow) {
    mainWindow.setBounds({ x, y, width, height });
  }
});

// Handle window level changes
ipcMain.on('set-window-level', (event, level) => {
  if (mainWindow) {
    if (level === 'desktop') {
      mainWindow.setAlwaysOnTop(false);
      // Set to desktop level (behind all windows)
      mainWindow.setVisibleOnAllWorkspaces(true);
      mainWindow.setLevel(0); // Desktop level
    } else if (level === 'top') {
      mainWindow.setAlwaysOnTop(true);
      mainWindow.setLevel(3); // Floating level
    } else {
      // Normal level
      mainWindow.setAlwaysOnTop(false);
      mainWindow.setLevel(0);
    }
  }
});

// Handle terminal resize (cols/rows)
ipcMain.on('terminal-resize', (event, { cols, rows }) => {
  if (ptyProcess) {
    ptyProcess.resize(cols, rows);
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
