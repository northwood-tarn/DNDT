const canvas = document.querySelector("canvas");
const context = canvas.getContext("2d", { alpha: true });
let width = 1;
let height = 1;
let panes = [];
let particles = [];
let lastTime = performance.now();
let emissionCarry = 0;

function resize(layout) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(1, layout.width || innerWidth);
  height = Math.max(1, layout.height || innerHeight);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  panes = Array.isArray(layout.panes) ? layout.panes : [];
}

window.api?.onCombatFogLayout?.(resize);

function randomEdgePoint(pane) {
  const edge = Math.floor(Math.random() * 4);
  const along = 0.03 + Math.random() * 0.94;
  if (edge === 0) return { x: pane.x, y: pane.y + pane.height * along, nx: -1, ny: 0, tx: 0, ty: 1 };
  if (edge === 1) return { x: pane.x + pane.width, y: pane.y + pane.height * along, nx: 1, ny: 0, tx: 0, ty: 1 };
  if (edge === 2) return { x: pane.x + pane.width * along, y: pane.y, nx: 0, ny: -1, tx: 1, ty: 0 };
  return { x: pane.x + pane.width * along, y: pane.y + pane.height, nx: 0, ny: 1, tx: 1, ty: 0 };
}

function emitParticle(pane, time) {
  const edge = randomEdgePoint(pane);
  const outward = 1.3 + Math.random() * 4.8;
  const tangent = (Math.random() - 0.5) * 5.2;
  particles.push({
    x: edge.x + edge.nx * (Math.random() * 3.4 - 1),
    y: edge.y + edge.ny * (Math.random() * 3.4 - 1),
    vx: edge.nx * outward + edge.tx * tangent,
    vy: edge.ny * outward + edge.ty * tangent,
    curl: (Math.random() - 0.5) * 2.6,
    radius: 6 + Math.random() * 18,
    life: 0,
    duration: 4.2 + Math.random() * 9.5,
    alpha: 0.018 + Math.random() * 0.048,
    hue: Math.random() < 0.56 ? "62, 170, 151" : "47, 119, 148",
    phase: time * 0.001 + Math.random() * Math.PI * 2,
  });
  if (particles.length > 850) particles.splice(0, particles.length - 850);
}

function cloud(particle, opacity) {
  const gradient = context.createRadialGradient(particle.x, particle.y, particle.radius * 0.03, particle.x, particle.y, particle.radius);
  gradient.addColorStop(0, `rgba(${particle.hue},${opacity})`);
  gradient.addColorStop(0.22, `rgba(${particle.hue},${opacity * 0.7})`);
  gradient.addColorStop(0.58, `rgba(${particle.hue},${opacity * 0.28})`);
  gradient.addColorStop(1, `rgba(${particle.hue},0)`);
  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(particle.x, particle.y, particle.radius, particle.radius * (0.38 + 0.2 * Math.sin(particle.phase)), particle.phase, 0, Math.PI * 2);
  context.fill();
}

function drawRifts(time) {
  context.save();
  context.globalCompositeOperation = "screen";
  for (const pane of panes) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.0011 + pane.x * 0.004 + pane.y * 0.002);
    context.shadowBlur = 6.5 + pulse * 9.5;
    context.shadowColor = `rgba(48, 176, 157, ${0.04 + pulse * 0.032})`;
    context.strokeStyle = `rgba(55, 151, 139, ${0.022 + pulse * 0.027})`;
    context.lineWidth = 4.2 + pulse * 7.2;
    context.strokeRect(pane.x, pane.y, pane.width, pane.height);
  }
  context.restore();
}

function frame(time) {
  const delta = Math.min(0.05, (time - lastTime) / 1000);
  lastTime = time;
  context.clearRect(0, 0, width, height);
  drawRifts(time);
  emissionCarry += delta * Math.max(6, panes.length * 5);
  while (emissionCarry >= 1 && panes.length) {
    emitParticle(panes[Math.floor(Math.random() * panes.length)], time);
    emissionCarry -= 1;
  }
  context.save();
  context.globalCompositeOperation = "screen";
  for (const particle of particles) {
    particle.life += delta;
    const progress = particle.life / particle.duration;
    const turn = particle.curl * delta;
    const vx = particle.vx * Math.cos(turn) - particle.vy * Math.sin(turn);
    const vy = particle.vx * Math.sin(turn) + particle.vy * Math.cos(turn);
    particle.vx = vx + Math.sin(time * 0.0014 + particle.phase) * 0.12;
    particle.vy = vy + Math.cos(time * 0.001 + particle.phase) * 0.1;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.phase += delta * (0.24 + Math.abs(particle.curl));
    particle.radius *= 1 + delta * 0.009;
    const envelope = Math.sin(Math.PI * Math.min(1, progress));
    cloud(particle, particle.alpha * envelope);
  }
  context.restore();
  particles = particles.filter((particle) => particle.life < particle.duration);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
