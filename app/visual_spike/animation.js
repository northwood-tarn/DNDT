export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

export class TweenSet {
  constructor() {
    this.items = [];
  }

  add(duration, update, done = null) {
    this.items.push({
      duration: Math.max(1, duration),
      elapsed: 0,
      update,
      done,
    });
  }

  tick(deltaMs) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.elapsed += deltaMs;
      const raw = Math.min(1, item.elapsed / item.duration);
      item.update(raw);
      if (raw >= 1) {
        this.items.splice(i, 1);
        if (item.done) item.done();
      }
    }
  }
}

export function moveContainer(tweens, container, from, to, duration = 210) {
  tweens.add(duration, (t) => {
    const k = easeInOutSine(t);
    container.x = from.x + (to.x - from.x) * k;
    container.y = from.y + (to.y - from.y) * k;
    container.scale.set(1 + Math.sin(k * Math.PI) * 0.01, 1);
  }, () => {
    container.x = to.x;
    container.y = to.y;
    container.scale.set(1);
  });
}

export function attackLean(tweens, attacker, target, onImpact) {
  const ax = attacker.x;
  const ay = attacker.y;
  const dx = target.x - attacker.x;
  const dy = target.y - attacker.y;
  const len = Math.hypot(dx, dy) || 1;
  const reach = 9;
  let impacted = false;

  tweens.add(260, (t) => {
    const wind = t < 0.42 ? t / 0.42 : 1 - ((t - 0.42) / 0.58);
    const k = easeOutCubic(Math.max(0, Math.min(1, wind)));
    attacker.x = ax + (dx / len) * reach * k;
    attacker.y = ay + (dy / len) * reach * k;
    attacker.rotation = (dx >= 0 ? 1 : -1) * 0.018 * k;
    if (!impacted && t > 0.42) {
      impacted = true;
      onImpact?.();
    }
  }, () => {
    attacker.x = ax;
    attacker.y = ay;
    attacker.rotation = 0;
  });
}

export function hitFlash(tweens, target) {
  const startAlpha = target.alpha;
  tweens.add(180, (t) => {
    const pulse = Math.sin(t * Math.PI);
    target.alpha = startAlpha * (1 - pulse * 0.4);
    target.scale.set(1 + pulse * 0.08, 1 - pulse * 0.03);
  }, () => {
    target.alpha = startAlpha;
    target.scale.set(1);
  });
}

export function deathDissolve(tweens, target) {
  const sy = target.y;
  tweens.add(520, (t) => {
    const k = easeOutCubic(t);
    target.alpha = 1 - k;
    target.y = sy + 18 * k;
    target.scale.set(1 - 0.18 * k, 1 - 0.45 * k);
  });
}
