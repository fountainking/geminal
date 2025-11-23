const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const pty = require('node-pty');
const os = require('os');

// Color pairs: [base color, lighter version]
const COLOR_PAIRS = [
  ['#3b82f6', '#93c5fd'], // blue, light blue
  ['#ec4899', '#f9a8d4'], // pink, light pink
  ['#8b5cf6', '#c4b5fd'], // purple, light purple
  ['#f59e0b', '#fcd34d'], // amber, light amber
  ['#10b981', '#6ee7b7'], // green, light green
  ['#ef4444', '#fca5a5'], // red, light red
  ['#06b6d4', '#67e8f9'], // cyan, light cyan
  ['#f97316', '#fdba74'], // orange, light orange
  ['#6366f1', '#a5b4fc'], // indigo, light indigo
  ['#14b8a6', '#5eead4'], // teal, light teal
  ['#84cc16', '#bef264'], // lime, light lime
  ['#eab308', '#fde047'], // yellow, light yellow
  ['#f43f5e', '#fda4af'], // rose, light rose
  ['#a855f7', '#d8b4fe'], // violet, light violet
  ['#0ea5e9', '#7dd3fc'], // sky, light sky
  ['#22c55e', '#86efac'], // emerald, light emerald
  ['#fb923c', '#fdba74'], // orange-alt, light orange-alt
  ['#ec4899', '#fbcfe8'], // fuchsia, light fuchsia
  ['#8b5cf6', '#e9d5ff'], // purple-alt, light purple-alt
  ['#06b6d4', '#a5f3fc'], // cyan-alt, light cyan-alt
];

// Track recently used colors to avoid immediate repeats
let recentColors = [];
const RECENT_COLORS_LIMIT = 5;

function getRandomColorPair() {
  // Get available colors (not in recent list)
  let availableColors = COLOR_PAIRS.filter(
    (pair) => !recentColors.some(recent => recent[0] === pair[0] && recent[1] === pair[1])
  );

  // If we've used too many colors, reset to full list
  if (availableColors.length === 0) {
    availableColors = COLOR_PAIRS;
    recentColors = [];
  }

  // Pick a random color from available ones
  const randomPair = availableColors[Math.floor(Math.random() * availableColors.length)];

  // Add to recent colors
  recentColors.push(randomPair);
  if (recentColors.length > RECENT_COLORS_LIMIT) {
    recentColors.shift();
  }

  return randomPair;
}

let windows = [];
let tray;
let isFirstWindow = true;
let dialogWindow = null;
let pendingCloseWindow = null;

function showDialog(parentWindow) {
  // Don't show multiple dialogs
  if (dialogWindow && !dialogWindow.isDestroyed()) {
    dialogWindow.focus();
    return;
  }

  pendingCloseWindow = parentWindow;

  dialogWindow = new BrowserWindow({
    width: 322,
    height: 105,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  dialogWindow.setBackgroundColor('#00000000');

  // Center dialog on parent window
  if (parentWindow && !parentWindow.isDestroyed()) {
    const parentBounds = parentWindow.getBounds();
    const x = Math.round(parentBounds.x + (parentBounds.width - 322) / 2);
    const y = Math.round(parentBounds.y + (parentBounds.height - 105) / 2);
    dialogWindow.setPosition(x, y);
  }

  dialogWindow.loadFile('dialog.html');

  dialogWindow.on('closed', () => {
    dialogWindow = null;
    // Don't clear pendingCloseWindow here - it's needed in dialog-response handler
  });
}

function createWindow(colors) {
  // Only use colors for non-first windows
  const colorPair = isFirstWindow ? null : (colors || getRandomColorPair());

  const win = new BrowserWindow({
    width: 80,
    height: 64,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.setBackgroundColor('#00000000');

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  // Spawn terminal process for this window
  const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : 'bash');
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 64,
    cwd: process.env.HOME,
    env: process.env,
  });

  // Store window and pty reference
  windows.push({ win, ptyProcess, colors: colorPair });

  // Send color data to renderer after content loads (only for non-first windows)
  if (colorPair) {
    win.webContents.on('did-finish-load', () => {
      win.webContents.send('set-colors', colorPair);
    });
  }

  win.loadFile('index.html');

  // Mark that first window has been created
  if (isFirstWindow) {
    isFirstWindow = false;
  }

  // Send terminal output to renderer
  ptyProcess.onData((data) => {
    if (win && !win.isDestroyed()) {
      try {
        win.webContents.send('terminal-output', data);
      } catch (err) {
        // Window might be closing, ignore
      }
    }
  });

  win.on('closed', () => {
    if (ptyProcess) {
      ptyProcess.kill();
    }
    // Remove from windows array
    windows = windows.filter(w => w.win !== win);
  });

  return win;
}

// Helper function to find window data by webContents
function findWindowData(webContents) {
  return windows.find(w => w.win.webContents === webContents);
}

// Handle terminal input from renderer
ipcMain.on('terminal-input', (event, data) => {
  const windowData = findWindowData(event.sender);
  if (windowData && windowData.ptyProcess) {
    windowData.ptyProcess.write(data);
  }
});

// Handle window resize from draggable stars
ipcMain.on('resize-window', (event, { x, y, width, height }) => {
  const windowData = findWindowData(event.sender);
  if (windowData) {
    windowData.win.setBounds({ x, y, width, height });
  }
});

// Handle terminal resize (cols/rows)
ipcMain.on('terminal-resize', (event, { cols, rows }) => {
  const windowData = findWindowData(event.sender);
  if (windowData && windowData.ptyProcess) {
    windowData.ptyProcess.resize(cols, rows);
  }
});

// Handle new window creation
ipcMain.on('create-new-window', () => {
  createWindow();
});

// Handle show close dialog request
ipcMain.on('show-close-dialog', (event) => {
  const windowData = findWindowData(event.sender);
  if (windowData) {
    showDialog(windowData.win);
  }
});

// Handle dialog response
ipcMain.on('dialog-response', (event, shouldClose) => {
  // Close the dialog
  if (dialogWindow && !dialogWindow.isDestroyed()) {
    dialogWindow.destroy();
  }

  // If user clicked Yes, close the pending window
  if (shouldClose && pendingCloseWindow && !pendingCloseWindow.isDestroyed()) {
    // Remove the close listener to avoid showing dialog again
    pendingCloseWindow.removeAllListeners('close');
    pendingCloseWindow.close();
  }

  pendingCloseWindow = null;
});

// Handle show all windows
ipcMain.on('show-all-windows', () => {
  windows.forEach(w => {
    if (w.win && !w.win.isDestroyed()) {
      w.win.show();
    }
  });
});

// Handle hide all windows
ipcMain.on('hide-all-windows', () => {
  windows.forEach(w => {
    if (w.win && !w.win.isDestroyed()) {
      w.win.hide();
    }
  });
});

// Handle window level changes
ipcMain.on('set-window-level', (event, level) => {
  const windowData = findWindowData(event.sender);
  if (windowData && windowData.win) {
    switch(level) {
      case 'desktop':
        windowData.win.setAlwaysOnTop(true, 'floating');
        windowData.win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        break;
      case 'normal':
        windowData.win.setAlwaysOnTop(false);
        windowData.win.setVisibleOnAllWorkspaces(false);
        break;
      case 'top':
        windowData.win.setAlwaysOnTop(true, 'screen-saver');
        windowData.win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        break;
    }
  }
});

function createTray() {
  const iconPath = path.join(__dirname, 'tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true);

  tray = new Tray(icon);
  tray.setToolTip('Geminal');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'New Window',
      click: () => {
        createWindow();
      }
    },
    {
      label: 'Show All Windows',
      click: () => {
        windows.forEach(w => w.win.show());
      }
    },
    {
      label: 'Hide All Windows',
      click: () => {
        windows.forEach(w => w.win.hide());
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

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
