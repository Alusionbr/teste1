const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  overlay: document.getElementById('overlay'),
  startBtn: document.getElementById('startBtn'),
  message: document.getElementById('message'),
  day: document.getElementById('day'),
  clock: document.getElementById('clock'),
  kills: document.getElementById('kills'),
  hpBar: document.getElementById('hpBar'),
  hpText: document.getElementById('hpText'),
  hungerBar: document.getElementById('hungerBar'),
  hungerText: document.getElementById('hungerText'),
  thirstBar: document.getElementById('thirstBar'),
  thirstText: document.getElementById('thirstText'),
  staminaBar: document.getElementById('staminaBar'),
  staminaText: document.getElementById('staminaText'),
  food: document.getElementById('foodCount'),
  water: document.getElementById('waterCount'),
  med: document.getElementById('medCount'),
  scrap: document.getElementById('scrapCount'),
  objective: document.getElementById('objective')
};

const keys = new Set();
const virtualKeys = new Set();

const MAP = {
  width: 1800,
  height: 1100,
  shelter: { x: 120, y: 120, w: 260, h: 190 }
};

const ruins = [
  { x: 510, y: 120, w: 250, h: 170 },
  { x: 950, y: 80, w: 270, h: 210 },
  { x: 1370, y: 140, w: 250, h: 180 },
  { x: 460, y: 520, w: 300, h: 220 },
  { x: 920, y: 500, w: 250, h: 190 },
  { x: 1320, y: 610, w: 310, h: 230 },
  { x: 260, y: 850, w: 230, h: 150 },
  { x: 760, y: 850, w: 260, h: 150 }
];

const state = {
  running: false,
  lastTime: 0,
  elapsed: 0,
  worldMinutes: 360,
  day: 1,
  kills: 0,
  messageTimer: 0,
  camera: { x: 0, y: 0 },
  player: {
    x: 240,
    y: 220,
    r: 15,
    speed: 185,
    hp: 100,
    hunger: 100,
    thirst: 100,
    stamina: 100,
    facingX: 1,
    facingY: 0,
    attackCooldown: 0,
    attackFlash: 0,
    invulnerable: 0
  },
  inventory: { food: 1, water: 1, med: 1, scrap: 0 },
  loot: [],
  infected: [],
  particles: []
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function circleRectCollision(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy < circle.r * circle.r;
}

function isInsideShelter(entity) {
  return entity.x > MAP.shelter.x && entity.x < MAP.shelter.x + MAP.shelter.w &&
    entity.y > MAP.shelter.y && entity.y < MAP.shelter.y + MAP.shelter.h;
}

function showMessage(text, seconds = 2.2) {
  ui.message.textContent = text;
  ui.message.classList.add('show');
  state.messageTimer = seconds;
}

function spawnLoot(count = 12) {
  const types = ['food', 'water', 'scrap', 'scrap', 'scrap', 'med'];
  state.loot = [];

  for (let i = 0; i < count; i += 1) {
    const ruin = ruins[Math.floor(Math.random() * ruins.length)];
    state.loot.push({
      x: randomBetween(ruin.x + 24, ruin.x + ruin.w - 24),
      y: randomBetween(ruin.y + 24, ruin.y + ruin.h - 24),
      r: 10,
      type: types[Math.floor(Math.random() * types.length)]
    });
  }
}

function spawnInfected(count = 7) {
  state.infected = [];

  for (let i = 0; i < count; i += 1) {
    let x;
    let y;
    do {
      x = randomBetween(430, MAP.width - 70);
      y = randomBetween(80, MAP.height - 70);
    } while (Math.hypot(x - state.player.x, y - state.player.y) < 300 || isInsideShelter({ x, y }));

    state.infected.push({
      x,
      y,
      r: 15,
      hp: 70,
      speed: randomBetween(58, 78),
      aggro: randomBetween(260, 390),
      attackCooldown: 0,
      wanderAngle: Math.random() * Math.PI * 2,
      wanderTimer: randomBetween(1, 3),
      hitFlash: 0
    });
  }
}

function resetGame() {
  state.running = false;
  state.lastTime = 0;
  state.elapsed = 0;
  state.worldMinutes = 360;
  state.day = 1;
  state.kills = 0;
  state.messageTimer = 0;
  state.camera.x = 0;
  state.camera.y = 0;
  state.player.x = 240;
  state.player.y = 220;
  state.player.hp = 100;
  state.player.hunger = 100;
  state.player.thirst = 100;
  state.player.stamina = 100;
  state.player.facingX = 1;
  state.player.facingY = 0;
  state.player.attackCooldown = 0;
  state.player.attackFlash = 0;
  state.player.invulnerable = 0;
  state.inventory = { food: 1, water: 1, med: 1, scrap: 0 };
  state.particles = [];
  spawnLoot(14);
  spawnInfected(7);
  updateUI();
}

function startGame() {
  resetGame();
  state.running = true;
  ui.overlay.classList.add('hidden');
  showMessage('Saia do abrigo e procure suprimentos.');
  state.lastTime = performance.now();
  requestAnimationFrame(loop);
}

function addParticles(x, y, color, amount = 8) {
  for (let i = 0; i < amount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomBetween(25, 95);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randomBetween(.35, .75),
      maxLife: .75,
      size: randomBetween(2, 4),
      color
    });
  }
}

function resolvePlayerMovement(nextX, nextY) {
  const p = state.player;
  const originalX = p.x;
  const originalY = p.y;

  p.x = clamp(nextX, p.r, MAP.width - p.r);
  if (ruins.some((r) => circleRectCollision(p, r))) p.x = originalX;

  p.y = clamp(nextY, p.r, MAP.height - p.r);
  if (ruins.some((r) => circleRectCollision(p, r))) p.y = originalY;
}

function useItem(type) {
  if (!state.running) return;
  const inv = state.inventory;
  const p = state.player;

  if (inv[type] <= 0) {
    showMessage('Você não possui esse item.');
    return;
  }

  if (type === 'food') {
    if (p.hunger >= 98) return showMessage('Você não está com fome.');
    inv.food -= 1;
    p.hunger = clamp(p.hunger + 42, 0, 100);
    showMessage('Você comeu uma conserva.');
  }

  if (type === 'water') {
    if (p.thirst >= 98) return showMessage('Você não está com sede.');
    inv.water -= 1;
    p.thirst = clamp(p.thirst + 48, 0, 100);
    showMessage('Você bebeu água.');
  }

  if (type === 'med') {
    if (p.hp >= 98) return showMessage('Sua vida já está cheia.');
    inv.med -= 1;
    p.hp = clamp(p.hp + 50, 0, 100);
    showMessage('Ferimentos tratados.');
  }

  updateUI();
}

function attack() {
  const p = state.player;
  if (!state.running || p.attackCooldown > 0) return;

  p.attackCooldown = .48;
  p.attackFlash = .13;
  const reach = 66;
  const hitX = p.x + p.facingX * 35;
  const hitY = p.y + p.facingY * 35;
  let hit = false;

  for (const enemy of state.infected) {
    if (enemy.hp <= 0) continue;
    const d = Math.hypot(enemy.x - hitX, enemy.y - hitY);
    if (d < reach) {
      enemy.hp -= 35;
      enemy.hitFlash = .12;
      enemy.x += p.facingX * 14;
      enemy.y += p.facingY * 14;
      addParticles(enemy.x, enemy.y, '#7e332d', 7);
      hit = true;

      if (enemy.hp <= 0) {
        state.kills += 1;
        if (Math.random() < .3) {
          state.loot.push({ x: enemy.x, y: enemy.y, r: 10, type: Math.random() < .7 ? 'scrap' : 'food' });
        }
      }
    }
  }

  if (!hit) addParticles(hitX, hitY, '#aaa696', 3);
  state.infected = state.infected.filter((e) => e.hp > 0);
  updateUI();
}

function collectNearbyLoot() {
  const p = state.player;
  const collected = [];

  state.loot.forEach((item, index) => {
    if (distance(p, item) < p.r + item.r + 7) collected.push(index);
  });

  for (let i = collected.length - 1; i >= 0; i -= 1) {
    const item = state.loot[collected[i]];
    state.loot.splice(collected[i], 1);

    if (item.type === 'scrap') state.inventory.scrap += Math.random() < .35 ? 2 : 1;
    else state.inventory[item.type] += 1;

    const labels = { food: 'Comida encontrada', water: 'Água encontrada', med: 'Kit médico encontrado', scrap: 'Sucata coletada' };
    showMessage(labels[item.type]);
    addParticles(item.x, item.y, '#a9a864', 8);
  }
}

function updatePlayer(dt) {
  const p = state.player;
  const active = new Set([...keys, ...virtualKeys]);
  let dx = 0;
  let dy = 0;

  if (active.has('ArrowLeft') || active.has('a')) dx -= 1;
  if (active.has('ArrowRight') || active.has('d')) dx += 1;
  if (active.has('ArrowUp') || active.has('w')) dy -= 1;
  if (active.has('ArrowDown') || active.has('s')) dy += 1;

  const running = active.has('Shift') || active.has('run');
  let speed = p.speed;

  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    p.facingX = dx;
    p.facingY = dy;

    if (running && p.stamina > 2) {
      speed *= 1.62;
      p.stamina = clamp(p.stamina - 29 * dt, 0, 100);
    } else {
      p.stamina = clamp(p.stamina + 15 * dt, 0, 100);
    }

    resolvePlayerMovement(p.x + dx * speed * dt, p.y + dy * speed * dt);
  } else {
    p.stamina = clamp(p.stamina + 22 * dt, 0, 100);
  }

  p.attackCooldown = Math.max(0, p.attackCooldown - dt);
  p.attackFlash = Math.max(0, p.attackFlash - dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt);

  p.hunger = clamp(p.hunger - 0.52 * dt, 0, 100);
  p.thirst = clamp(p.thirst - 0.78 * dt, 0, 100);

  if (p.hunger <= 0 || p.thirst <= 0) p.hp = clamp(p.hp - 5.5 * dt, 0, 100);

  if (isInsideShelter(p)) {
    p.hp = clamp(p.hp + 1.8 * dt, 0, 100);
  }

  collectNearbyLoot();
}

function updateInfected(dt) {
  const p = state.player;

  for (const enemy of state.infected) {
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    enemy.wanderTimer -= dt;

    const d = distance(enemy, p);
    let vx = 0;
    let vy = 0;

    if (!isInsideShelter(p) && d < enemy.aggro) {
      vx = (p.x - enemy.x) / Math.max(d, 1);
      vy = (p.y - enemy.y) / Math.max(d, 1);
    } else {
      if (enemy.wanderTimer <= 0) {
        enemy.wanderTimer = randomBetween(1, 3.2);
        enemy.wanderAngle += randomBetween(-1.7, 1.7);
      }
      vx = Math.cos(enemy.wanderAngle) * .4;
      vy = Math.sin(enemy.wanderAngle) * .4;
    }

    const nx = clamp(enemy.x + vx * enemy.speed * dt, enemy.r, MAP.width - enemy.r);
    const ny = clamp(enemy.y + vy * enemy.speed * dt, enemy.r, MAP.height - enemy.r);
    const temp = { x: nx, y: ny, r: enemy.r };

    if (!ruins.some((r) => circleRectCollision(temp, r)) && !isInsideShelter(temp)) {
      enemy.x = nx;
      enemy.y = ny;
    } else {
      enemy.wanderAngle += Math.PI * .7;
    }

    if (!isInsideShelter(p) && d < p.r + enemy.r + 8 && enemy.attackCooldown <= 0 && p.invulnerable <= 0) {
      p.hp = clamp(p.hp - 12, 0, 100);
      p.invulnerable = .45;
      enemy.attackCooldown = 1;
      addParticles(p.x, p.y, '#9f473c', 8);
      showMessage('Um infectado atingiu você!');
    }
  }
}

function updateWorld(dt) {
  state.elapsed += dt;
  state.worldMinutes += dt * 6.5;

  if (state.worldMinutes >= 1440) {
    state.worldMinutes -= 1440;
    state.day += 1;
    spawnLoot(10 + Math.min(state.day, 6));

    const extra = Math.min(4 + state.day * 2, 18);
    const existing = state.infected.length;
    spawnInfected(Math.max(existing, extra));
    showMessage(`Dia ${state.day}. Mais infectados surgiram.` , 3);
  }

  state.messageTimer -= dt;
  if (state.messageTimer <= 0) ui.message.classList.remove('show');

  state.particles = state.particles.filter((particle) => {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= .94;
    particle.vy *= .94;
    return particle.life > 0;
  });
}

function updateCamera() {
  state.camera.x = clamp(state.player.x - canvas.width / 2, 0, MAP.width - canvas.width);
  state.camera.y = clamp(state.player.y - canvas.height / 2, 0, MAP.height - canvas.height);
}

function updateUI() {
  const p = state.player;
  const inv = state.inventory;

  ui.day.textContent = state.day;
  const h = Math.floor(state.worldMinutes / 60) % 24;
  const m = Math.floor(state.worldMinutes % 60);
  ui.clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  ui.kills.textContent = state.kills;

  const bars = [
    [ui.hpBar, ui.hpText, p.hp],
    [ui.hungerBar, ui.hungerText, p.hunger],
    [ui.thirstBar, ui.thirstText, p.thirst],
    [ui.staminaBar, ui.staminaText, p.stamina]
  ];

  for (const [bar, text, value] of bars) {
    bar.style.width = `${clamp(value, 0, 100)}%`;
    text.textContent = Math.round(value);
  }

  ui.food.textContent = inv.food;
  ui.water.textContent = inv.water;
  ui.med.textContent = inv.med;
  ui.scrap.textContent = inv.scrap;

  if (isInsideShelter(p)) ui.objective.textContent = 'Zona segura';
  else if (p.thirst < 30) ui.objective.textContent = 'Procure água';
  else if (p.hunger < 30) ui.objective.textContent = 'Procure comida';
  else ui.objective.textContent = 'Explore as ruínas';
}

function gameOver() {
  state.running = false;
  ui.overlay.classList.remove('hidden');
  ui.overlay.querySelector('.eyebrow').textContent = `FIM • DIA ${state.day}`;
  ui.overlay.querySelector('h2').textContent = 'Você não sobreviveu.';
  ui.overlay.querySelector('p:not(.eyebrow)').textContent = `Abates: ${state.kills}. Sucata coletada: ${state.inventory.scrap}. Tente novamente e volte ao abrigo quando estiver ferido.`;
  ui.startBtn.textContent = 'TENTAR NOVAMENTE';
}

function drawGround() {
  ctx.fillStyle = '#25271f';
  ctx.fillRect(0, 0, MAP.width, MAP.height);

  ctx.fillStyle = '#303228';
  for (let x = 0; x < MAP.width; x += 90) ctx.fillRect(x, 380, 54, 190);
  ctx.fillRect(0, 410, MAP.width, 120);
  ctx.fillRect(800, 0, 115, MAP.height);

  ctx.strokeStyle = 'rgba(205, 194, 151, .08)';
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 18]);
  ctx.beginPath();
  ctx.moveTo(0, 470);
  ctx.lineTo(MAP.width, 470);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(857, 0);
  ctx.lineTo(857, MAP.height);
  ctx.stroke();
  ctx.setLineDash([]);

  for (let i = 0; i < 85; i += 1) {
    const x = (i * 193) % MAP.width;
    const y = (i * 127) % MAP.height;
    ctx.fillStyle = i % 3 === 0 ? '#343328' : '#1d201a';
    ctx.fillRect(x, y, 5 + (i % 5), 3 + (i % 4));
  }
}

function drawShelter() {
  const s = MAP.shelter;
  ctx.fillStyle = '#37392c';
  ctx.fillRect(s.x, s.y, s.w, s.h);
  ctx.strokeStyle = '#bab064';
  ctx.lineWidth = 3;
  ctx.strokeRect(s.x, s.y, s.w, s.h);

  ctx.fillStyle = '#6d6740';
  ctx.fillRect(s.x + s.w - 18, s.y + 70, 20, 52);

  ctx.fillStyle = '#d1c56f';
  ctx.font = '800 16px system-ui';
  ctx.fillText('ABRIGO', s.x + 18, s.y + 28);
  ctx.fillStyle = '#92907b';
  ctx.font = '12px system-ui';
  ctx.fillText('zona segura • cura lenta', s.x + 18, s.y + 47);
}

function drawRuins() {
  ruins.forEach((r, index) => {
    ctx.fillStyle = index % 2 ? '#3a3930' : '#33352d';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = '#171914';
    ctx.lineWidth = 5;
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    ctx.fillStyle = '#1b1d18';
    ctx.fillRect(r.x + 24, r.y - 2, 40, 14);
    ctx.fillRect(r.x + r.w - 80, r.y + r.h - 12, 50, 14);

    ctx.fillStyle = '#2a2b24';
    for (let i = 0; i < 3; i += 1) {
      ctx.fillRect(r.x + 35 + i * 63, r.y + 45 + (i % 2) * 45, 28, 22);
    }
  });
}

function drawLoot() {
  const colors = { food: '#b58b55', water: '#628c91', med: '#a9a7a0', scrap: '#8b875d' };

  for (const item of state.loot) {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.fillStyle = colors[item.type];
    ctx.beginPath();
    ctx.arc(0, 0, item.r + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#171913';
    ctx.font = '900 11px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const letter = { food: 'F', water: 'A', med: '+', scrap: 'S' }[item.type];
    ctx.fillText(letter, 0, 1);
    ctx.restore();
  }
}

function drawInfected() {
  for (const enemy of state.infected) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);

    ctx.fillStyle = enemy.hitFlash > 0 ? '#d47b68' : '#74433b';
    ctx.beginPath();
    ctx.arc(0, 0, enemy.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#b4aa82';
    ctx.beginPath();
    ctx.arc(-4, -4, 2.5, 0, Math.PI * 2);
    ctx.arc(5, -3, 2.5, 0, Math.PI * 2);
    ctx.fill();

    if (enemy.hp < 70) {
      ctx.fillStyle = '#171913';
      ctx.fillRect(-16, -24, 32, 4);
      ctx.fillStyle = '#a55045';
      ctx.fillRect(-16, -24, 32 * clamp(enemy.hp / 70, 0, 1), 4);
    }

    ctx.restore();
  }
}

function drawPlayer() {
  const p = state.player;
  ctx.save();
  ctx.translate(p.x, p.y);

  if (p.invulnerable > 0 && Math.floor(performance.now() / 70) % 2 === 0) ctx.globalAlpha = .45;

  ctx.fillStyle = '#2d3426';
  ctx.beginPath();
  ctx.arc(0, 0, p.r + 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#9f9d76';
  ctx.beginPath();
  ctx.arc(0, 0, p.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = p.attackFlash > 0 ? '#ded4a4' : '#565844';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(p.facingX * 8, p.facingY * 8);
  ctx.lineTo(p.facingX * 30, p.facingY * 30);
  ctx.stroke();

  if (p.attackFlash > 0) {
    ctx.strokeStyle = 'rgba(225, 216, 170, .5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.facingX * 26, p.facingY * 26, 35, -.9, .9);
    ctx.stroke();
  }

  ctx.restore();
}

function drawParticles() {
  for (const particle of state.particles) {
    ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawLighting() {
  const hour = (state.worldMinutes / 60) % 24;
  let darkness = 0;
  if (hour < 5 || hour > 21) darkness = .5;
  else if (hour < 7) darkness = .5 * (7 - hour) / 2;
  else if (hour > 19) darkness = .5 * (hour - 19) / 2;

  if (darkness <= 0) return;

  ctx.fillStyle = `rgba(5, 8, 9, ${darkness})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const px = state.player.x - state.camera.x;
  const py = state.player.y - state.camera.y;
  const glow = ctx.createRadialGradient(px, py, 20, px, py, 130);
  glow.addColorStop(0, `rgba(244, 223, 158, ${darkness * .36})`);
  glow.addColorStop(1, 'rgba(244, 223, 158, 0)');
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = glow;
  ctx.fillRect(px - 140, py - 140, 280, 280);
  ctx.globalCompositeOperation = 'source-over';
}

function drawMinimap() {
  const w = 145;
  const h = 88;
  const x = canvas.width - w - 14;
  const y = 14;

  ctx.fillStyle = 'rgba(9, 11, 9, .72)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(211, 206, 170, .18)';
  ctx.strokeRect(x, y, w, h);

  const sx = w / MAP.width;
  const sy = h / MAP.height;

  ctx.fillStyle = '#b9ae5c';
  ctx.fillRect(x + MAP.shelter.x * sx, y + MAP.shelter.y * sy, MAP.shelter.w * sx, MAP.shelter.h * sy);

  ctx.fillStyle = '#9d4c42';
  for (const enemy of state.infected) ctx.fillRect(x + enemy.x * sx, y + enemy.y * sy, 2, 2);

  ctx.fillStyle = '#e6dfbb';
  ctx.beginPath();
  ctx.arc(x + state.player.x * sx, y + state.player.y * sy, 3, 0, Math.PI * 2);
  ctx.fill();
}

function draw() {
  ctx.save();
  ctx.translate(-state.camera.x, -state.camera.y);
  drawGround();
  drawShelter();
  drawRuins();
  drawLoot();
  drawInfected();
  drawParticles();
  drawPlayer();
  ctx.restore();

  drawLighting();
  drawMinimap();

  ctx.fillStyle = 'rgba(10, 12, 9, .78)';
  ctx.fillRect(14, canvas.height - 47, 255, 32);
  ctx.fillStyle = '#d3d0c0';
  ctx.font = '700 13px system-ui';
  ctx.fillText(isInsideShelter(state.player) ? 'ABRIGO • você está seguro' : 'RUÍNAS • encontre recursos', 25, canvas.height - 26);
}

function update(dt) {
  updatePlayer(dt);
  updateInfected(dt);
  updateWorld(dt);
  updateCamera();
  updateUI();

  if (state.player.hp <= 0) gameOver();
}

function loop(now) {
  if (!state.running) return;
  const dt = Math.min((now - state.lastTime) / 1000, .033);
  state.lastTime = now;
  update(dt);
  draw();
  if (state.running) requestAnimationFrame(loop);
}

window.addEventListener('keydown', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const movement = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'Shift'];

  if (movement.includes(key)) {
    event.preventDefault();
    keys.add(key);
  }

  if (event.code === 'Space') {
    event.preventDefault();
    attack();
  }
  if (key === '1') useItem('food');
  if (key === '2') useItem('water');
  if (key === '3') useItem('med');
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
  const press = (event) => { event.preventDefault(); virtualKeys.add(key); };
  const release = (event) => { event.preventDefault(); virtualKeys.delete(key); };
  button.addEventListener('pointerdown', press);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('pointerleave', release);
});

document.getElementById('attackBtn').addEventListener('pointerdown', (event) => {
  event.preventDefault();
  attack();
});

document.getElementById('runBtn').addEventListener('pointerdown', (event) => {
  event.preventDefault();
  virtualKeys.add('run');
});
['pointerup', 'pointercancel', 'pointerleave'].forEach((eventName) => {
  document.getElementById('runBtn').addEventListener(eventName, () => virtualKeys.delete('run'));
});

document.getElementById('foodBtn').addEventListener('click', () => useItem('food'));
document.getElementById('waterBtn').addEventListener('click', () => useItem('water'));
document.getElementById('medBtn').addEventListener('click', () => useItem('med'));
ui.startBtn.addEventListener('click', startGame);

resetGame();
draw();
