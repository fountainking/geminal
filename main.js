const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, desktopCapturer } = require('electron');
const remoteMain = require('@electron/remote/main');
const path = require('path');
const pty = require('node-pty');
const os = require('os');
const sharp = require('sharp');

// Initialize remote module
remoteMain.initialize();

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

// Detect if background behind window is light or dark
async function detectBackgroundBrightness(windowBounds) {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(windowBounds.width * 2), // Capture at 2x for better sampling
        height: Math.round(windowBounds.height * 2)
      }
    });

    if (sources.length === 0) return null;

    // Get the primary screen source
    const primarySource = sources[0];
    const thumbnail = primarySource.thumbnail;

    // Get the display to calculate the crop area
    const display = screen.getDisplayNearestPoint({ x: windowBounds.x, y: windowBounds.y });
    const scaleFactor = display.scaleFactor || 2;

    // Calculate crop coordinates relative to the screen
    const cropX = Math.round((windowBounds.x - display.bounds.x) * scaleFactor);
    const cropY = Math.round((windowBounds.y - display.bounds.y) * scaleFactor);
    const cropWidth = Math.round(windowBounds.width * scaleFactor);
    const cropHeight = Math.round(windowBounds.height * scaleFactor);

    // Convert nativeImage to PNG buffer
    const pngBuffer = thumbnail.toPNG();

    // Use sharp to crop and analyze the specific window area
    const image = sharp(pngBuffer);
    const metadata = await image.metadata();

    // Ensure crop is within bounds
    const safeX = Math.max(0, Math.min(cropX, metadata.width - 1));
    const safeY = Math.max(0, Math.min(cropY, metadata.height - 1));
    const safeWidth = Math.min(cropWidth, metadata.width - safeX);
    const safeHeight = Math.min(cropHeight, metadata.height - safeY);

    if (safeWidth <= 0 || safeHeight <= 0) return null;

    // Sample a grid of points instead of every pixel for performance
    const sampleSize = 32; // 32x32 grid sample
    const croppedImage = await image
      .extract({ left: safeX, top: safeY, width: safeWidth, height: safeHeight })
      .resize(sampleSize, sampleSize, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data, info } = croppedImage;
    const pixelCount = sampleSize * sampleSize;

    // Calculate average brightness using perceived luminance formula
    let totalBrightness = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Perceived luminance: https://en.wikipedia.org/wiki/Relative_luminance
      const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
      totalBrightness += brightness;
    }

    const avgBrightness = totalBrightness / pixelCount;

    // Return brightness value (0-255) and whether it's light (>128 is light)
    return {
      brightness: avgBrightness,
      isLight: avgBrightness > 128
    };
  } catch (error) {
    console.error('Error detecting background brightness:', error);
    return null;
  }
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

  // Enable remote module for dialog
  remoteMain.enable(dialogWindow.webContents);

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

  // Enable remote module for this window
  remoteMain.enable(win.webContents);

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

  // Store window ID early before window can be destroyed
  const windowId = win.webContents.id;

  // Store window and pty reference
  windows.push({ win, ptyProcess, colors: colorPair, windowId });

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
    // Get the display where the window is (or will be)
    const display = screen.getDisplayNearestPoint({ x: Math.round(x), y: Math.round(y) });
    const screenBounds = display.workArea;

    // Constrain window position to screen bounds
    // Don't let the window go completely off-screen, keep at least 80px visible
    const minVisibleWidth = 80;
    const minVisibleHeight = 64;

    const constrainedX = Math.max(
      screenBounds.x - (width - minVisibleWidth),
      Math.min(x, screenBounds.x + screenBounds.width - minVisibleWidth)
    );

    const constrainedY = Math.max(
      screenBounds.y,
      Math.min(y, screenBounds.y + screenBounds.height - minVisibleHeight)
    );

    windowData.win.setBounds({
      x: Math.round(constrainedX),
      y: Math.round(constrainedY),
      width: Math.round(width),
      height: Math.round(height)
    });
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

// Handle background brightness detection request
ipcMain.handle('detect-background-brightness', async (event) => {
  const windowData = findWindowData(event.sender);
  if (!windowData || !windowData.win || windowData.win.isDestroyed()) {
    return null;
  }

  const bounds = windowData.win.getBounds();
  const result = await detectBackgroundBrightness(bounds);
  return result;
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
