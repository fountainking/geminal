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
    foreground: '#ffdd15',
    cursor: '#ffdd15',
    cursorAccent: '#ffdd15',
    selectionBackground: 'rgba(255, 221, 21, 0.3)',
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
    if (cursor) {
      cursor.classList.add('active');
      cursorShown = true;
    }
  }

  // Stop all cycling when user types - keep stars yellow and static
  starTopLeft.classList.remove('active', 'color-shift');
  starBottomRight.classList.remove('active', 'color-shift');

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

ipcRenderer.on('terminal-output', (event, data) => {
  term.write(data);
  term.scrollToBottom(); // Keep terminal scrolled to bottom

  // Don't cycle if user is actively interacting
  if (userInteracting) return;

  // Start cycling only on substantial output (avoid single char/line echoes)
  // This catches command output like cmatrix but not typing echoes
  if (data.length > 20) {
    starTopLeft.classList.add('active');
    starBottomRight.classList.add('active');

    // Reset the inactivity timer - keep cycling until silence
    clearTimeout(activityTimeout);
    activityTimeout = setTimeout(() => {
      starTopLeft.classList.remove('active');
      starBottomRight.classList.remove('active');
    }, 5000); // Stop after 5s of silence
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
let dragPending = false;
let currentStar = null;
let startX, startY;
let initialWindowBounds = null;

// Double-click detection for left star (close window)
let lastClickTimeLeft = 0;
let lastClickXLeft = 0;
let lastClickYLeft = 0;

const DOUBLE_CLICK_THRESHOLD = 300; // ms
const DOUBLE_CLICK_DISTANCE = 10; // pixels - max distance for double-click

function startDrag(e, star) {
  isDragging = true;
  currentStar = star;
  startX = e.screenX;
  startY = e.screenY;

  // Stop all color cycling on interaction
  starTopLeft.classList.remove('color-shift', 'active');
  starBottomRight.classList.remove('color-shift', 'active');

  // Block output-triggered cycling while dragging
  userInteracting = true;

  // Clear any pending timeout
  clearTimeout(activityTimeout);

  // Get current window bounds
  const bounds = window.electron?.screen?.getCursorScreenPoint() || { x: 0, y: 0 };
  initialWindowBounds = {
    x: window.screenX,
    y: window.screenY,
    width: window.innerWidth,
    height: window.innerHeight,
  };

  e.preventDefault();
}

function drag(e) {
  // If drag is pending, check if we've moved enough to start dragging
  if (dragPending && !isDragging) {
    const deltaX = e.screenX - startX;
    const deltaY = e.screenY - startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance > DRAG_THRESHOLD) {
      // Start actual drag
      isDragging = true;
      dragPending = false;
    } else {
      return; // Not enough movement yet
    }
  }

  if (!isDragging || !currentStar) return;

  const deltaX = e.screenX - startX;
  const deltaY = e.screenY - startY;

  if (currentStar === starTopLeft) {
    // Move entire window
    const newX = initialWindowBounds.x + deltaX;
    const newY = initialWindowBounds.y + deltaY;

    ipcRenderer.send('resize-window', {
      x: newX,
      y: newY,
      width: initialWindowBounds.width,
      height: initialWindowBounds.height,
    });
  } else if (currentStar === starBottomRight) {
    // Resize window
    const newWidth = Math.max(300, initialWindowBounds.width + deltaX);
    const newHeight = Math.max(200, initialWindowBounds.height + deltaY);

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
    }, 10);
  }
}

function stopDrag() {
  isDragging = false;
  currentStar = null;

  // CRITICAL: 500ms cooldown blocks resize output cycling. DO NOT INCREASE or cmatrix breaks.
  userInteracting = true;
  setTimeout(() => {
    userInteracting = false;
  }, 500);
}

// Function to show the window menu
function showWindowMenu() {
  console.log('showWindowMenu called');
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
      label: 'Show All Windows',
      click: () => ipcRenderer.send('show-all-windows')
    },
    {
      label: 'Hide All Windows',
      click: () => ipcRenderer.send('hide-all-windows')
    },
    { type: 'separator' },
    {
      label: 'Window Level: Desktop',
      click: () => ipcRenderer.send('set-window-level', 'desktop')
    },
    {
      label: 'Window Level: Normal',
      click: () => ipcRenderer.send('set-window-level', 'normal')
    },
    {
      label: 'Window Level: Top',
      click: () => ipcRenderer.send('set-window-level', 'top')
    }
  ]);

  console.log('Menu created, calling popup');
  menu.popup();
  console.log('popup() called');
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

  // Single click - start dragging
  lastClickTimeLeft = currentTime;
  lastClickXLeft = currentX;
  lastClickYLeft = currentY;
  startDrag(e, starTopLeft);
  term.focus();
});

starBottomRight.addEventListener('mousedown', (e) => {
  startDrag(e, starBottomRight);
  term.focus();
});

document.addEventListener('mousemove', drag);
document.addEventListener('mouseup', stopDrag);

// Global right-click context menu
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  console.log('Right-click detected, showing menu');
  showWindowMenu();
});

// ===============================================
// WINDOW LEVEL CONTROLS
// ===============================================

const controls = document.getElementById('controls');
const btnDesktop = document.getElementById('btn-desktop');
const btnTop = document.getElementById('btn-top');
const btnNormal = document.getElementById('btn-normal');

// Toggle controls with Cmd+Shift+L (or Ctrl+Shift+L on Windows/Linux)
document.addEventListener('keydown', (e) => {
  // Create new window with Cmd+N (or Ctrl+N on Windows/Linux)
  if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
    ipcRenderer.send('create-new-window');
    e.preventDefault();
  }

  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'L') {
    controls.classList.toggle('hidden');
    e.preventDefault();
  }

  // Close controls with Escape
  if (e.key === 'Escape' && !controls.classList.contains('hidden')) {
    controls.classList.add('hidden');
    e.preventDefault();
  }
});

btnDesktop.addEventListener('click', () => {
  ipcRenderer.send('set-window-level', 'desktop');
  controls.classList.add('hidden');
});

btnTop.addEventListener('click', () => {
  ipcRenderer.send('set-window-level', 'top');
  controls.classList.add('hidden');
});

btnNormal.addEventListener('click', () => {
  ipcRenderer.send('set-window-level', 'normal');
  controls.classList.add('hidden');
});

// ===============================================
// INITIAL SETUP
// ===============================================

// Set initial window level to desktop (behind everything)
setTimeout(() => {
  ipcRenderer.send('set-window-level', 'desktop');
}, 500);

console.log('geminal terminal ready');
console.log('Press Cmd+Shift+L (or Ctrl+Shift+L) to toggle window level controls');

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

console.log('=== RENDERER.JS LOADED ===');
console.log('Context menu listener added:', document.hasOwnProperty('contextmenu'));
