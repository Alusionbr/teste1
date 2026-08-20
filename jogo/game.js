const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');

const keys = new Set();
const virtualKeys = new Set();

const state = {
  running: false,
  score: 0,
  best: Number(localStorage.getItem('teste1-game-best') || 0),
  lastTime: 0,
  player: { x: 160, y: 270, r: 18, speed: 270 },
  crystal: { x: 720, y: 270, r: 13 },
  particles: []
};

bestEl.textContent = state.best;

function randomCrystalPosition() {
  const margin = 55;
  state.crystal.x = margin + Math.random() * (canvas.width - margin * 2);
  state.crystal.y = margin + Math.random() * (canvas.height - margin * 2);
}

function resetGame() {
  state.score = 0;
  scoreEl.textContent = '0';
  state.player.x = canvas.width * 0.22;
  state.player.y = canvas.height * 0.5;
  state.particles = [];
  randomCrystalPosition();
}

function startGame() {
  resetGame();
  state.running = true;
  overlay.classList.add('hidden');
  state.lastTime = performance.now();
  requestAnimationFrame(loop);
}

function spawnParticles(x, y) {
  for (let i = 0; i < 18; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 55 + Math.random() * 150;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.7 + Math.random() * 0.5,
      size: 2 + Math.random() * 4
    });
  }
}

function collectCrystal() {
  state.score += 1;
  scoreEl.textContent = state.score;
  spawnParticles(state.crystal.x, state.crystal.y);
  randomCrystalPosition();

  if (state.score > state.best) {
    state.best = state.score;
    bestEl.textContent = state.best;
    localStorage.setItem('teste1-game-best', String(state.best));
  }
}

function update(dt) {
  let dx = 0;
  let dy = 0;
  const active = new Set([...keys, ...virtualKeys]);

  if (active.has('ArrowLeft') || active.has('a')) dx -= 1;
  if (active.has('ArrowRight') || active.has('d')) dx += 1;
  if (active.has('ArrowUp') || active.has('w')) dy -= 1;
  if (active.has('ArrowDown') || active.has('s')) dy += 1;

  if (dx || dy) {
    const length = Math.hypot(dx, dy);
    dx /= length;
    dy /= length;
    state.player.x += dx * state.player.speed * dt;
    state.player.y += dy * state.player.speed * dt;
  }

  state.player.x = Math.max(state.player.r, Math.min(canvas.width - state.player.r, state.player.x));
  state.player.y = Math.max(state.player.r, Math.min(canvas.height - state.player.r, state.player.y));

  const distance = Math.hypot(
    state.player.x - state.crystal.x,
    state.player.y - state.crystal.y
  );

  if (distance < state.player.r + state.crystal.r + 4) collectCrystal();

  state.particles = state.particles.filter((p) => {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
    return p.life > 0;
  });
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#071426');
  gradient.addColorStop(1, '#140d2c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
  ctx.lineWidth = 1;
  const grid = 48;

  for (let x = 0; x <= canvas.width; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= canvas.height; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawCrystal() {
  ctx.save();
  ctx.translate(state.crystal.x, state.crystal.y);
  ctx.rotate(performance.now() / 850);

  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 42);
  glow.addColorStop(0, 'rgba(125, 211, 252, 0.35)');
  glow.addColorStop(1, 'rgba(125, 211, 252, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 42, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#7dd3fc';
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(14, 0);
  ctx.lineTo(0, 18);
  ctx.lineTo(-14, 0);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawPlayer() {
  const p = state.player;
  const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 45);
  glow.addColorStop(0, 'rgba(139, 92, 246, 0.35)');
  glow.addColorStop(1, 'rgba(139, 92, 246, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 45, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#8b5cf6';
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(p.x + 6, p.y - 5, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.globalAlpha = Math.min(1, p.life * 1.4);
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function draw() {
  drawBackground();
  drawCrystal();
  drawParticles();
  drawPlayer();

  ctx.fillStyle = 'rgba(226, 232, 240, 0.7)';
  ctx.font = '600 18px system-ui';
  ctx.fillText('Colete o cristal azul', 26, 36);
}

function loop(now) {
  if (!state.running) return;
  const dt = Math.min((now - state.lastTime) / 1000, 0.033);
  state.lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(key)) {
    event.preventDefault();
    keys.add(key);
  }
});

window.addEventListener('keyup', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys.delete(key);
});

const directionMap = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight'
};

document.querySelectorAll('[data-dir]').forEach((button) => {
  const key = directionMap[button.dataset.dir];

  const press = (event) => {
    event.preventDefault();
    virtualKeys.add(key);
  };

  const release = (event) => {
    event.preventDefault();
    virtualKeys.delete(key);
  };

  button.addEventListener('pointerdown', press);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('pointerleave', release);
});

startBtn.addEventListener('click', startGame);

draw();
