const { ipcRenderer, webFrame } = require('electron');
const { Menu } = require('@electron/remote');
const { Terminal } = require('xterm');
const { FitAddon } = require('xterm-addon-fit');

// Initialize terminal
const term = new Terminal({
  cursorBlink: true,
  cursorStyle: 'underline',
  fontSize: 14,
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  theme: {
    background: 'transparent',
    foreground: '#ffed4e',
    cursor: '#ffed4e',
    cursorAccent: '#ffed4e',
    selectionBackground: 'rgba(255, 237, 78, 0.3)',
  },
  allowTransparency: true,
  scrollback: 1000, // Limit scrollback to prevent memory issues
});

const fitAddon = new FitAddon();
term.loadAddon(fitAddon);

// Mount terminal to DOM
const terminalContainer = document.getElementById('terminal-container');
term.open(terminalContainer);

// Function to fit terminal to container (adjusts cols/rows, not font size)
function resizeTerminal() {
  fitAddon.fit();
}

resizeTerminal();

// Handle terminal input
let inputTimeout = null;
let cursorShown = false; // Track if cursor has been shown
term.onData((data) => {
  // Show cursor on first keypress
  if (!cursorShown) {
    const cursor = document.querySelector('.xterm-cursor');
    const cursorOutline = document.querySelector('.xterm-cursor-outline');
    if (cursor) {
      cursor.classList.add('active');
    }
    if (cursorOutline) {
      cursorOutline.classList.add('active');
    }
    cursorShown = true;
  }

  // Stop all cycling when user types - keep stars yellow and static
  starTopLeft.classList.remove('active', 'color-shift');
  starBottomRight.classList.remove('active', 'color-shift');

  // Reset manual stop flag - allow cycling to resume after typing
  manuallyStoppedCycling = false;

  // Block output-triggered cycling briefly while user is typing
  userInteracting = true;
  clearTimeout(inputTimeout);
  inputTimeout = setTimeout(() => {
    userInteracting = false;
  }, 100); // CRITICAL: 100ms allows fast cycling start on cmatrix. DO NOT INCREASE.

  ipcRenderer.send('terminal-input', data);
});

// Handle terminal output from main process
let activityTimeout = null;
let userInteracting = false; // Track if user is typing or dragging
let manuallyStoppedCycling = false; // Track if user clicked to stop cycling

ipcRenderer.on('terminal-output', (event, data) => {
  // Check if user is scrolled to bottom before writing
  const wasAtBottom = term.buffer.active.viewportY === term.buffer.active.baseY;

  term.write(data);

  // Only auto-scroll if user was already at the bottom
  if (wasAtBottom) {
    term.scrollToBottom();
  }

  // Don't cycle if user is actively interacting or manually stopped cycling
  if (userInteracting || manuallyStoppedCycling) return;

  // Start cycling only on substantial output (avoid single char/line echoes)
  // This catches command output like cmatrix but not typing echoes
  if (data.length > 20) {
    starTopLeft.classList.add('active');
    starBottomRight.classList.add('active');

    // Reset the star cycling timer - keep cycling until silence
    clearTimeout(activityTimeout);
    activityTimeout = setTimeout(() => {
      starTopLeft.classList.remove('active');
      starBottomRight.classList.remove('active');
    }, 5000); // Stop star cycling after 5s of silence
  }
});

// Fit terminal on window resize
window.addEventListener('resize', () => {
  resizeTerminal();
  ipcRenderer.send('terminal-resize', {
    cols: term.cols,
    rows: term.rows,
  });
});

// Initial fit and resize notification
setTimeout(() => {
  resizeTerminal();
  ipcRenderer.send('terminal-resize', {
    cols: term.cols,
    rows: term.rows,
  });
}, 100);

// ===============================================
// DRAGGABLE STARS LOGIC
// ===============================================

const starTopLeft = document.getElementById('star-top-left');
const starBottomRight = document.getElementById('star-bottom-right');

let isDragging = false;
let currentStar = null;
let startX, startY;
let initialWindowBounds = null;
const DRAG_THRESHOLD = 5; // pixels - minimum movement to start drag

// Double-click detection for left star (close window)
let lastClickTimeLeft = 0;
let lastClickXLeft = 0;
let lastClickYLeft = 0;

const DOUBLE_CLICK_THRESHOLD = 300; // ms
const DOUBLE_CLICK_DISTANCE = 10; // pixels - max distance for double-click

function startDrag(e, star) {
  // Don't set isDragging yet - wait for movement threshold
  currentStar = star;
  startX = e.screenX;
  startY = e.screenY;

  // Stop all color cycling on interaction
  starTopLeft.classList.remove('color-shift', 'active');
  starBottomRight.classList.remove('color-shift', 'active');

  // Block output-triggered cycling while dragging and after
  userInteracting = true;
  manuallyStoppedCycling = true; // Prevent restart until user types

  // Clear any pending timeout
  clearTimeout(activityTimeout);

  // Get current window bounds at drag start
  initialWindowBounds = {
    x: window.screenX,
    y: window.screenY,
    width: window.innerWidth,
    height: window.innerHeight,
  };

  e.preventDefault();
}

function drag(e) {
  if (!currentStar) return;

  const deltaX = e.screenX - startX;
  const deltaY = e.screenY - startY;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  // Only start dragging if we've moved beyond threshold
  if (!isDragging && distance < DRAG_THRESHOLD) {
    return;
  }

  // Mark as dragging once threshold is crossed
  if (!isDragging) {
    isDragging = true;
  }

  if (currentStar === starTopLeft) {
    // Move window
    const newX = initialWindowBounds.x + deltaX;
    const newY = initialWindowBounds.y + deltaY;

    ipcRenderer.send('resize-window', {
      x: newX,
      y: newY,
      width: initialWindowBounds.width,
      height: initialWindowBounds.height,
    });

    // Update text color if auto mode is enabled
    updateTextColorBasedOnBackground();
  } else if (currentStar === starBottomRight) {
    // Resize window - allow shrinking to collapsed star size
    const newWidth = Math.max(80, initialWindowBounds.width + deltaX);
    const newHeight = Math.max(64, initialWindowBounds.height + deltaY);

    ipcRenderer.send('resize-window', {
      x: initialWindowBounds.x,
      y: initialWindowBounds.y,
      width: newWidth,
      height: newHeight,
    });

    // Refit terminal after resize
    setTimeout(() => {
      resizeTerminal();
      ipcRenderer.send('terminal-resize', {
        cols: term.cols,
        rows: term.rows,
      });
      // Update text color after resize settles
      updateTextColorBasedOnBackground();
    }, 10);
  }
}

function stopDrag() {
  isDragging = false;
  currentStar = null;

  // Brief cooldown to settle resize operations
  userInteracting = true;
  setTimeout(() => {
    userInteracting = false;
    // Check background brightness after drag ends
    updateTextColorBasedOnBackground();
  }, 200);
  // manuallyStoppedCycling stays true until user types
}

// Function to change terminal text color
function setTerminalColor(color) {
  term.options.theme.foreground = color;
  term.options.theme.cursor = color;
  term.options.theme.cursorAccent = color;

  // Convert hex to rgba for selection background
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  term.options.theme.selectionBackground = `rgba(${r}, ${g}, ${b}, 0.3)`;

  // Update cursor underline color via CSS
  const existingStyle = document.getElementById('cursor-color-style');
  if (existingStyle) {
    existingStyle.remove();
  }
  const style = document.createElement('style');
  style.id = 'cursor-color-style';
  style.textContent = `.xterm-cursor-outline { border-bottom: 2px solid ${color} !important; }`;
  document.head.appendChild(style);

  term.refresh(0, term.rows - 1);
}

// Auto-detect background brightness and adjust text color
let autoColorEnabled = false;
let lastBrightnessCheck = 0;
const BRIGHTNESS_CHECK_THROTTLE = 200; // ms

async function updateTextColorBasedOnBackground() {
  if (!autoColorEnabled) return;

  // Throttle brightness checks
  const now = Date.now();
  if (now - lastBrightnessCheck < BRIGHTNESS_CHECK_THROTTLE) {
    return;
  }
  lastBrightnessCheck = now;

  try {
    const result = await ipcRenderer.invoke('detect-background-brightness');
    if (result) {
      // If background is light, use dark text; if dark, use light text
      const textColor = result.isLight ? '#1a1a1a' : '#ffed4e';
      setTerminalColor(textColor);
    }
  } catch (error) {
    console.error('Error detecting background:', error);
  }
}

// Enable/disable auto color detection
function setAutoColor(enabled) {
  autoColorEnabled = enabled;
  if (enabled) {
    updateTextColorBasedOnBackground();
  } else {
    // Reset to default yellow
    setTerminalColor('#ffed4e');
  }
}

// Function to show the window menu
function showWindowMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: 'New Window',
      click: () => ipcRenderer.send('create-new-window')
    },
    {
      label: 'Close Window',
      click: () => ipcRenderer.send('show-close-dialog')
    },
    { type: 'separator' },
    {
      label: 'Text Color',
      submenu: [
        {
          label: 'Auto (Adapt to Background)',
          type: 'checkbox',
          checked: autoColorEnabled,
          click: () => setAutoColor(!autoColorEnabled)
        },
        { type: 'separator' },
        {
          label: 'Yellow (Default)',
          click: () => {
            setAutoColor(false);
            setTerminalColor('#ffed4e');
          }
        },
        {
          label: 'Green',
          click: () => {
            setAutoColor(false);
            setTerminalColor('#00ff00');
          }
        },
        {
          label: 'Cyan',
          click: () => {
            setAutoColor(false);
            setTerminalColor('#00ffff');
          }
        },
        {
          label: 'White',
          click: () => {
            setAutoColor(false);
            setTerminalColor('#ffffff');
          }
        },
        {
          label: 'Orange',
          click: () => {
            setAutoColor(false);
            setTerminalColor('#ff8800');
          }
        },
        {
          label: 'Pink',
          click: () => {
            setAutoColor(false);
            setTerminalColor('#ff69b4');
          }
        },
        {
          label: 'Purple',
          click: () => {
            setAutoColor(false);
            setTerminalColor('#bb88ff');
          }
        }
      ]
    },
    { type: 'separator' },
    {
      label: 'Show All Windows',
      click: () => ipcRenderer.send('show-all-windows')
    },
    {
      label: 'Hide All Windows',
      click: () => ipcRenderer.send('hide-all-windows')
    }
  ]);

  menu.popup();
}

// Star drag event listeners
starTopLeft.addEventListener('mousedown', (e) => {
  const currentTime = Date.now();
  const currentX = e.clientX;
  const currentY = e.clientY;
  const timeSinceLastClick = currentTime - lastClickTimeLeft;
  const distanceFromLastClick = Math.sqrt(
    Math.pow(currentX - lastClickXLeft, 2) + Math.pow(currentY - lastClickYLeft, 2)
  );

  // Check if this is a double-click (quick succession, same location)
  if (timeSinceLastClick < DOUBLE_CLICK_THRESHOLD &&
      distanceFromLastClick < DOUBLE_CLICK_DISTANCE) {
    // Double-click detected! Show close confirmation dialog
    ipcRenderer.send('show-close-dialog');
    lastClickTimeLeft = 0;
    lastClickXLeft = 0;
    lastClickYLeft = 0;
    e.preventDefault();
    return;
  }

  // Single click - track for double-click detection and prepare for potential drag
  lastClickTimeLeft = currentTime;
  lastClickXLeft = currentX;
  lastClickYLeft = currentY;

  // Start drag immediately - threshold will prevent accidental drags
  startDrag(e, starTopLeft);

  term.focus();
});

starBottomRight.addEventListener('mousedown', (e) => {
  // If window is collapsed, auto-expand to default size instead of dragging
  if (window.innerWidth <= 100 && window.innerHeight <= 100) {
    const defaultWidth = 600;
    const defaultHeight = 400;

    ipcRenderer.send('resize-window', {
      x: window.screenX,
      y: window.screenY,
      width: defaultWidth,
      height: defaultHeight,
    });

    // Refit terminal after auto-expand
    setTimeout(() => {
      resizeTerminal();
      ipcRenderer.send('terminal-resize', {
        cols: term.cols,
        rows: term.rows,
      });
    }, 10);

    e.preventDefault();
    return; // Don't start drag on expansion click
  }

  startDrag(e, starBottomRight);
  term.focus();
});

document.addEventListener('mousemove', drag);
document.addEventListener('mouseup', stopDrag);

// Global right-click context menu
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  showWindowMenu();
});

// ===============================================
// KEYBOARD SHORTCUTS
// ===============================================

document.addEventListener('keydown', (e) => {
  // Create new window with Cmd+N (or Ctrl+N on Windows/Linux)
  if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
    ipcRenderer.send('create-new-window');
    e.preventDefault();
  }
});

// ===============================================
// INITIAL SETUP
// ===============================================

console.log('geminal terminal ready');

// ===============================================
// COLOR MANAGEMENT
// ===============================================

// Listen for color data from main process
ipcRenderer.on('set-colors', (event, colorPair) => {
  const [baseColor, lightColor] = colorPair;

  // Update star SVG colors
  const starTopLeftPaths = starTopLeft.querySelectorAll('path[fill="#ffdd15"]');
  const starBottomRightPaths = starBottomRight.querySelectorAll('path[fill="#ffdd15"]');

  starTopLeftPaths.forEach(path => path.setAttribute('fill', baseColor));
  starBottomRightPaths.forEach(path => path.setAttribute('fill', lightColor));

  // Update terminal theme colors
  term.options.theme.foreground = baseColor;
  term.options.theme.cursor = baseColor;
  term.options.theme.cursorAccent = baseColor;

  // Convert hex to rgba for selection background
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  term.options.theme.selectionBackground = hexToRgba(baseColor, 0.3);

  // Update cursor underline color via CSS
  const style = document.createElement('style');
  style.textContent = `.xterm-cursor-outline { border-bottom: 2px solid ${baseColor} !important; }`;
  document.head.appendChild(style);
});

// ===============================================
// LAUNCH ANIMATIONS
// ===============================================

function launchStars() {
  // Stagger the star launches - cycle until first interaction
  setTimeout(() => {
    starTopLeft.classList.add('launched', 'color-shift');
  }, 100);

  setTimeout(() => {
    starBottomRight.classList.add('launched', 'color-shift');
  }, 250);
}

// Trigger launch animation on load
window.addEventListener('DOMContentLoaded', () => {
  launchStars();
});

// ===============================================
// ZOOM COMPENSATION FOR STARS
// ===============================================

function updateStarScale() {
  const zoomFactor = webFrame.getZoomFactor();
  const inverseScale = 1 / zoomFactor;

  // Apply inverse scale via CSS variable to keep stars at fixed size
  starTopLeft.style.setProperty('--zoom-scale', inverseScale);
  starBottomRight.style.setProperty('--zoom-scale', inverseScale);

  // Adjust positions to compensate for scale transform origin
  starTopLeft.style.transformOrigin = 'top left';
  starBottomRight.style.transformOrigin = 'bottom right';
}

// Update star scale on initial load
updateStarScale();

// Listen for zoom changes
let lastZoomFactor = webFrame.getZoomFactor();
setInterval(() => {
  const currentZoomFactor = webFrame.getZoomFactor();
  if (currentZoomFactor !== lastZoomFactor) {
    lastZoomFactor = currentZoomFactor;
    updateStarScale();
  }
}, 100);

// ===============================================
// AUTO BACKGROUND BRIGHTNESS DETECTION
// ===============================================

// Periodically check background brightness when auto mode is enabled
setInterval(() => {
  if (autoColorEnabled) {
    updateTextColorBasedOnBackground();
  }
}, 1000); // Check every second when auto mode is on

