const { ipcRenderer } = require('electron');
const { Terminal } = require('xterm');
const { FitAddon } = require('xterm-addon-fit');

// Initialize terminal
const term = new Terminal({
  cursorBlink: true,
  fontSize: 14,
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  theme: {
    background: 'transparent',
    foreground: '#00ff00',
    cursor: '#00ff00',
    cursorAccent: '#000000',
    selectionBackground: 'rgba(255, 255, 255, 0.3)',
  },
  allowTransparency: true,
  scrollback: 1000, // Limit scrollback to prevent memory issues
});

const fitAddon = new FitAddon();
term.loadAddon(fitAddon);

// Mount terminal to DOM
const terminalContainer = document.getElementById('terminal-container');
term.open(terminalContainer);
fitAddon.fit();

// Handle terminal input
term.onData((data) => {
  ipcRenderer.send('terminal-input', data);
});

// Handle terminal output from main process
ipcRenderer.on('terminal-output', (event, data) => {
  term.write(data);
});

// Fit terminal on window resize
window.addEventListener('resize', () => {
  fitAddon.fit();
  ipcRenderer.send('terminal-resize', {
    cols: term.cols,
    rows: term.rows,
  });
});

// Initial fit and resize notification
setTimeout(() => {
  fitAddon.fit();
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

function startDrag(e, star) {
  isDragging = true;
  currentStar = star;
  startX = e.screenX;
  startY = e.screenY;

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
      fitAddon.fit();
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
}

// Star drag event listeners
starTopLeft.addEventListener('mousedown', (e) => startDrag(e, starTopLeft));
starBottomRight.addEventListener('mousedown', (e) => startDrag(e, starBottomRight));

document.addEventListener('mousemove', drag);
document.addEventListener('mouseup', stopDrag);

// ===============================================
// WINDOW LEVEL CONTROLS
// ===============================================

const controls = document.getElementById('controls');
const btnDesktop = document.getElementById('btn-desktop');
const btnTop = document.getElementById('btn-top');
const btnNormal = document.getElementById('btn-normal');

// Toggle controls with Cmd+Shift+L (or Ctrl+Shift+L on Windows/Linux)
document.addEventListener('keydown', (e) => {
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
