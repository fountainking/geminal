// Screen Saver System for Geminal
// Uses 8-bit star SVG with different animation modes

const STAR_SVG = `<svg viewBox="0 0 536.3 459.5" xmlns="http://www.w3.org/2000/svg">
  <path fill="#060604" d="M229.8,38.3c0-12.7,0-25.6,0-38.3h76.6c0,12.7,0,25.6,0,38.3,12.7,0,25.6,0,38.3,0v38.3h38.3c.2,12.7-.2,25.6,0,38.3,38.3.2,76.7-.1,114.9,0,0,12.7-.1,25.6,0,38.3,12.7,0,25.6,0,38.3,0v76.6c-12.7.2-25.6-.2-38.3,0,0,12.7,0,25.6,0,38.3-12.7.1-25.6-.2-38.3,0-.2,25.5,0,51.1,0,76.6,12.7.2,25.6-.2,38.3,0v76.6c-12.7,0-25.6,0-38.3,0,.2-25.5,0-51.1,0-76.6-12.7-.2-25.6.2-38.3,0v-76.6c12.7-.2,25.6.2,38.3,0,0-12.7,0-25.6,0-38.3,12.7-.1,25.6.2,38.3,0,.2-25.5.2-51.1,0-76.6-38.3-.3-76.7.2-114.9,0-.1-12.7.2-25.6,0-38.3-25.5-.1-51.1,0-76.6,0-.1-25.5.2-51.1,0-76.6-25.5-.2-51.1-.2-76.6,0-.2,25.5.1,51.1,0,76.6-25.5,0-51.1-.1-76.6,0-.2,12.7.1,25.6,0,38.3-38.3.2-76.7-.3-114.9,0-.2,25.5-.2,51.1,0,76.6,12.7.2,25.6-.1,38.3,0,0,12.7-.1,25.6,0,38.3,12.7.2,25.6-.2,38.3,0v76.6c-12.7.2-25.6-.2-38.3,0,0,25.5-.2,51.1,0,76.6,25.5.2,51.1.1,76.6,0,.2-12.7-.1-25.6,0-38.3,25.5,0,51.1.1,76.6,0,.2-12.7-.2-25.6,0-38.3h76.6c.2,12.7-.2,25.6,0,38.3,25.5.1,51.1,0,76.6,0,.1,12.7-.2,25.6,0,38.3,25.5.1,51.1.2,76.6,0,0,12.7,0,25.6,0,38.3h-76.6c-.2-12.7.2-25.6,0-38.3-25.5-.1-51.1,0-76.6,0-.1-12.7.2-25.6,0-38.3-25.5-.1-51.1-.1-76.6,0-.2,12.7.1,25.6,0,38.3-25.5,0-51.1-.1-76.6,0-.2,12.7.2,25.6,0,38.3h-76.6c0-12.7,0-25.6,0-38.3-12.7,0-25.6,0-38.3,0v-76.6c12.7-.2,25.6.2,38.3,0,0-25.5.2-51.1,0-76.6-12.7-.2-25.6.1-38.3,0,0-12.7.1-25.6,0-38.3-12.7-.2-25.6.2-38.3,0v-76.6c12.7,0,25.6,0,38.3,0,0-12.7,0-25.6,0-38.3,38.3-.1,76.7.2,114.9,0,.2-12.7-.2-25.6,0-38.3h38.3v-38.3c12.7,0,25.6,0,38.3,0Z"/>
  <path fill="COLOR_PLACEHOLDER" d="M306.4,38.3c.2,25.5-.1,51.1,0,76.6,25.5,0,51.1-.1,76.6,0,.2,12.7-.1,25.6,0,38.3,38.3.2,76.7-.3,114.9,0,.2,25.5.2,51.1,0,76.6-12.7.2-25.6-.1-38.3,0,0,12.7.1,25.6,0,38.3-12.7.2-25.6-.2-38.3,0v76.6c12.7.2,25.6-.2,38.3,0,0,25.5.2,51.1,0,76.6-25.5.2-51.1.1-76.6,0-.2-12.7.1-25.6,0-38.3-25.5,0-51.1.1-76.6,0-.2-12.7.2-25.6,0-38.3h-76.6c-.2,12.7.2,25.6,0,38.3-25.5.1-51.1,0-76.6,0-.1,12.7.2,25.6,0,38.3-25.5.1-51.1.2-76.6,0-.2-25.5,0-51.1,0-76.6,12.7-.2,25.6.2,38.3,0v-76.6c-12.7-.2-25.6.2-38.3,0,0-12.7,0-25.6,0-38.3-12.7-.1-25.6.2-38.3,0-.2-25.5-.2-51.1,0-76.6,38.3-.3,76.7.2,114.9,0,.1-12.7-.2-25.6,0-38.3,25.5-.1,51.1,0,76.6,0,.1-25.5-.2-51.1,0-76.6,25.5-.2,51.1-.2,76.6,0Z"/>
</svg>`;

// Color palettes for different modes
const RAIN_COLORS = [
  '#0ea5e9', '#38bdf8', '#7dd3fc', '#93c5fd',  // Blues
  '#60a5fa', '#3b82f6', '#06b6d4', '#67e8f9',  // More blues
  '#ffffff', '#e0f2fe', '#bae6fd',              // Whites/light blues
];

const RAIN_YELLOW = '#FFBF00'; // Sporadic yellow accent

const CHERRY_BLOSSOM_COLORS = [
  '#ff69b4', '#ffb6c1', '#ffc0cb', '#ff1493',
  '#ffffff', '#ffe4e1', '#ff69b4'
];

// Starfield colors - complementary light/dark pairs like window handles
const STARFIELD_COLORS = [
  '#3b82f6', '#93c5fd',  // blue, light blue
  '#ec4899', '#f9a8d4',  // pink, light pink
  '#8b5cf6', '#c4b5fd',  // purple, light purple
  '#f59e0b', '#fcd34d',  // amber, light amber
  '#10b981', '#6ee7b7',  // green, light green
  '#ef4444', '#fca5a5',  // red, light red
  '#06b6d4', '#67e8f9',  // cyan, light cyan
  '#f97316', '#fdba74',  // orange, light orange
  '#6366f1', '#a5b4fc',  // indigo, light indigo
  '#14b8a6', '#5eead4',  // teal, light teal
  '#84cc16', '#bef264',  // lime, light lime
  '#FFBF00', '#FFE680',  // yellow, light yellow
];

class ScreenSaver {
  constructor() {
    this.active = false;
    this.mode = null;
    this.container = null;
    this.particles = [];
    this.animationFrame = null;
    this.warpStartTime = null;
    this.lastWarpTime = 0;
    this.startTime = null; // Track when screensaver started
    this.timeScale = 1.0;   // Animation speed multiplier
  }

  init() {
    // Create screen saver container
    this.container = document.createElement('div');
    this.container.id = 'screensaver-container';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10000;
      display: none;
      overflow: hidden;
    `;
    document.body.appendChild(this.container);

    // Add event listeners to stop screensaver on click or keypress (not mouse movement)
    this.stopHandler = () => this.stop();
    document.addEventListener('keydown', this.stopHandler);
    document.addEventListener('mousedown', this.stopHandler);
  }

  start(mode) {
    if (this.active) this.stop();

    this.mode = mode;
    this.active = true;
    this.particles = [];
    this.startTime = Date.now(); // Track start time for slow-mo effect
    this.timeScale = 1.0;
    this.container.style.display = 'block';
    this.container.innerHTML = '';

    // Temporarily remove event listeners to prevent immediate stop from menu click
    document.removeEventListener('keydown', this.stopHandler);
    document.removeEventListener('mousedown', this.stopHandler);

    // Re-add listeners after 500ms grace period
    setTimeout(() => {
      if (this.active) {
        document.addEventListener('keydown', this.stopHandler);
        document.addEventListener('mousedown', this.stopHandler);
      }
    }, 500);

    // Initialize particles based on mode
    switch(mode) {
      case 'rain':
        this.initRain();
        break;
      case 'cherry':
        this.initCherry();
        break;
      case 'lanterns':
        this.initLanterns();
        break;
      case 'starfield':
        this.initStarfield();
        break;
    }

    this.animate();
  }

  stop() {
    if (!this.active) return;

    this.active = false;
    this.particles = [];
    this.container.style.display = 'none';
    this.container.innerHTML = '';

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    // Clear starfield spawn timeout if exists
    if (this.starfieldSpawn) {
      this.starfieldSpawn = null;
    }
  }

  createStar(x, y, color, size = 32) {
    const star = document.createElement('div');
    star.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      width: ${size}px;
      height: ${size}px;
      pointer-events: none;
      transform: translate(${x}px, ${y}px);
      will-change: transform;
    `;
    star.innerHTML = STAR_SVG.replace('COLOR_PLACEHOLDER', color);

    const svg = star.querySelector('svg');
    // Lighter glow reduces GPU load
    svg.style.cssText = `
      width: 100%;
      height: 100%;
      filter: drop-shadow(0 0 4px ${color}88);
    `;

    this.container.appendChild(star);
    return star;
  }

  // RAIN MODE: Stars falling from top
  initRain() {
    // Spawn multiple stars initially
    for (let i = 0; i < 15; i++) {
      setTimeout(() => this.spawnRainStar(), i * 50);
    }

    const spawn = () => {
      if (!this.active) return;
      this.spawnRainStar();
      setTimeout(spawn, 30 + Math.random() * 50);
    };

    spawn();
  }

  spawnRainStar() {
    if (!this.active) return;

    // Add 40px margins on both sides
    const margin = 40;
    const x = margin + Math.random() * (window.innerWidth - margin * 2);

    // 5% chance of yellow star, otherwise blue/white
    const color = Math.random() < 0.05
      ? RAIN_YELLOW
      : RAIN_COLORS[Math.floor(Math.random() * RAIN_COLORS.length)];

    const size = 8 + Math.random() * 12;
    const speed = 3 + Math.random() * 5;

    const star = this.createStar(x, -50, color, size);

    this.particles.push({
      element: star,
      x: x,
      y: -50,
      speed: speed,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 3
    });
  }

  updateRain() {
    this.particles.forEach((particle, index) => {
      particle.y += particle.speed * this.timeScale;
      particle.rotation += particle.rotationSpeed * this.timeScale;

      particle.element.style.transform = `translate(${particle.x}px, ${particle.y}px) rotate(${particle.rotation}deg)`;

      // Remove if off screen
      if (particle.y > window.innerHeight + 50) {
        particle.element.remove();
        this.particles.splice(index, 1);
      }
    });
  }

  // CHERRY BLOSSOM MODE: Stars drifting horizontally
  initCherry() {
    // Spawn initial batch
    for (let i = 0; i < 10; i++) {
      setTimeout(() => this.spawnCherryStar(), i * 100);
    }

    const spawn = () => {
      if (!this.active) return;
      this.spawnCherryStar();
      setTimeout(spawn, 80 + Math.random() * 150);
    };

    spawn();
  }

  spawnCherryStar() {
    if (!this.active) return;

    const y = Math.random() * window.innerHeight;
    const color = CHERRY_BLOSSOM_COLORS[Math.floor(Math.random() * CHERRY_BLOSSOM_COLORS.length)];
    const size = 10 + Math.random() * 14;
    const speed = 1 + Math.random() * 2;

    const star = this.createStar(-50, y, color, size);

    this.particles.push({
      element: star,
      x: -50,
      y: y,
      speed: speed,
      drift: (Math.random() - 0.5) * 1.5,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 3,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.02 + Math.random() * 0.03
    });
  }

  updateCherry() {
    this.particles.forEach((particle, index) => {
      particle.x += particle.speed * this.timeScale;
      particle.sway += particle.swaySpeed * this.timeScale;
      particle.y += (Math.sin(particle.sway) * 0.5 + particle.drift) * this.timeScale;
      particle.rotation += particle.rotationSpeed * this.timeScale;

      particle.element.style.transform = `translate(${particle.x}px, ${particle.y}px) rotate(${particle.rotation}deg)`;

      // Remove if off screen
      if (particle.x > window.innerWidth + 50) {
        particle.element.remove();
        this.particles.splice(index, 1);
      }
    });
  }

  // FLOATING LANTERNS MODE: Blue stars rising from bottom
  initLanterns() {
    // Spawn initial batch
    for (let i = 0; i < 8; i++) {
      setTimeout(() => this.spawnLantern(), i * 150);
    }

    const spawn = () => {
      if (!this.active) return;
      this.spawnLantern();
      setTimeout(spawn, 200 + Math.random() * 400);
    };

    spawn();
  }

  spawnLantern() {
    if (!this.active) return;

    const x = Math.random() * window.innerWidth;
    const color = LANTERN_COLORS[Math.floor(Math.random() * LANTERN_COLORS.length)];
    const size = 24 + Math.random() * 20;
    const speed = 0.5 + Math.random() * 1.5;

    const star = this.createStar(x, window.innerHeight + 50, color, size);

    // Add glow effect for lanterns
    const svg = star.querySelector('svg');
    if (svg) {
      svg.style.filter = `drop-shadow(0 0 16px ${color}cc) drop-shadow(0 0 8px ${color})`;
    }

    const opacity = 0.6 + Math.random() * 0.4;
    star.style.opacity = opacity;

    this.particles.push({
      element: star,
      x: x,
      y: window.innerHeight + 50,
      speed: speed,
      drift: (Math.random() - 0.5) * 0.8,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.015 + Math.random() * 0.02,
      swayAmount: 15 + Math.random() * 25,
      opacity: opacity
    });
  }

  updateLanterns() {
    this.particles.forEach((particle, index) => {
      particle.y -= particle.speed * this.timeScale;
      particle.sway += particle.swaySpeed * this.timeScale;
      particle.x += (Math.sin(particle.sway) * 0.3 + particle.drift * 0.1) * this.timeScale;

      const swayX = Math.sin(particle.sway) * particle.swayAmount;

      particle.element.style.transform = `translate(${particle.x + swayX}px, ${particle.y}px)`;

      // Remove if off screen
      if (particle.y < -50) {
        particle.element.remove();
        this.particles.splice(index, 1);
      }
    });
  }

  // STARFIELD MODE: Stars moving toward viewer like Windows screensaver
  initStarfield() {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const maxParticles = 50; // Limit total particles

    // Continuously spawn stars from center point
    this.starfieldSpawn = () => {
      if (!this.active) return;

      // Only spawn if under particle limit
      if (this.particles.length < maxParticles) {
        const angle = Math.random() * Math.PI * 2;
        // Start at center, no offset
        const x = centerX;
        const y = centerY;

        // Use complementary color pairs from window handles
        const color = STARFIELD_COLORS[Math.floor(Math.random() * STARFIELD_COLORS.length)];
        const size = 1 + Math.random() * 2;

        const star = this.createStar(x, y, color, size);

        this.particles.push({
          element: star,
          x: x,
          y: y,
          angle: angle,
          speed: 0.5 + Math.random() * 1,
          size: size,
          maxSize: 10 + Math.random() * 6
        });
      }

      setTimeout(this.starfieldSpawn, 80);
    };

    this.starfieldSpawn();
  }

  updateStarfield() {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const margin = 100;
    const widthMax = window.innerWidth + margin;
    const heightMax = window.innerHeight + margin;

    // Use reverse loop for safe deletion while iterating
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];

      // Apply time scale to movement
      const scaledSpeed = particle.speed * this.timeScale;

      // Move star away from center - cache trig values
      if (!particle.dx) {
        particle.dx = Math.cos(particle.angle);
        particle.dy = Math.sin(particle.angle);
      }

      particle.x += particle.dx * scaledSpeed;
      particle.y += particle.dy * scaledSpeed;
      particle.speed *= 1.01; // Accelerate slower

      // Remove if off screen (with larger margin for earlier cleanup)
      if (particle.x < -margin || particle.x > widthMax ||
          particle.y < -margin || particle.y > heightMax) {
        particle.element.remove();
        this.particles.splice(i, 1);
        continue;
      }

      // Optimized distance calculation - approximate is fine for visual effect
      const dx = particle.x - centerX;
      const dy = particle.y - centerY;
      const distFromCenterSq = dx * dx + dy * dy; // Skip sqrt, use squared distance
      const growthFactor = Math.min(distFromCenterSq / 40000, 1); // 40000 = 200^2
      const currentSize = particle.size + (particle.maxSize - particle.size) * growthFactor;

      // Cache last values to avoid unnecessary DOM writes
      const x = Math.round(particle.x);
      const y = Math.round(particle.y);
      const size = Math.round(currentSize);

      if (particle.lastX !== x || particle.lastY !== y || particle.lastSize !== size) {
        particle.element.style.transform = `translate(${x}px, ${y}px)`;
        particle.element.style.width = size + 'px';
        particle.element.style.height = size + 'px';
        particle.lastX = x;
        particle.lastY = y;
        particle.lastSize = size;
      }
    }
  }

  animate() {
    if (!this.active) return;

    // Calculate smooth slow-motion effect
    // After 3 seconds, gradually slow down to 30% speed over 3 seconds
    const elapsedTime = (Date.now() - this.startTime) / 1000;
    if (elapsedTime > 3) {
      // Ease into slow motion over 3 seconds
      const slowMoProgress = Math.min((elapsedTime - 3) / 3, 1);
      // Use smooth easing function (cubic ease-out)
      const eased = 1 - Math.pow(1 - slowMoProgress, 3);
      this.timeScale = 1.0 - (eased * 0.7); // Go from 1.0 to 0.3
    } else {
      this.timeScale = 1.0;
    }

    switch(this.mode) {
      case 'rain':
        this.updateRain();
        break;
      case 'cherry':
        this.updateCherry();
        break;
      case 'lanterns':
        this.updateLanterns();
        break;
      case 'starfield':
        this.updateStarfield();
        break;
    }

    this.animationFrame = requestAnimationFrame(() => this.animate());
  }
}

// Create global instance
window.screenSaver = new ScreenSaver();
