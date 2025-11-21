const { ipcRenderer } = require('electron');
const { Terminal } = require('xterm');
const { FitAddon } = require('xterm-addon-fit');

// Initialize terminal
const term = new Terminal({
  cursorBlink: false,
  fontSize: 14,
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  theme: {
    background: 'transparent',
    foreground: '#00ff00',
    cursor: 'transparent',
    cursorAccent: 'transparent',
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
let inputTimeout = null;
term.onData((data) => {
  // Stop all cycling when user types - keep stars yellow and static
  starTopLeft.classList.remove('active', 'color-shift');
  starBottomRight.classList.remove('active', 'color-shift');

  // Block output-triggered cycling briefly while user is typing
  userInteracting = true;
  clearTimeout(inputTimeout);
  inputTimeout = setTimeout(() => {
    userInteracting = false;
  }, 500); // Allow output cycling 500ms after last keystroke

  ipcRenderer.send('terminal-input', data);
});

// Handle terminal output from main process
let activityTimeout = null;
let userInteracting = false; // Track if user is typing or dragging

ipcRenderer.on('terminal-output', (event, data) => {
  term.write(data);

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

  // Keep stars static for a moment after drag ends
  userInteracting = true;
  setTimeout(() => {
    userInteracting = false;
  }, 1000);
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
