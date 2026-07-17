'use strict';

const WHEEL_N = WHEEL_ORDER.length; // 37
let wheelCanvas, wheelCtx, ballCanvas, ballCtx;
let wheelRadius = 0, centerX = 0, centerY = 0;
let pocketRadius = 0, outerBallRadius = 0;

const WHEEL_COLORS = { green: '#1c8a4a', red: '#a5192b', black: '#1a1a1a' };

function angleForIndex(i) {
  // Index 0 (Zahl 0) oben, im Uhrzeigersinn
  return (i / WHEEL_N) * Math.PI * 2 - Math.PI / 2;
}
function angleForNumber(n) {
  return angleForIndex(WHEEL_ORDER.indexOf(n));
}

function initWheel(wheelEl, ballEl) {
  wheelCanvas = wheelEl;
  ballCanvas = ballEl;
  wheelCtx = wheelCanvas.getContext('2d');
  ballCtx = ballCanvas.getContext('2d');
  resizeWheel();
  drawWheel();
}

function resizeWheel() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const size = wheelCanvas.parentElement.clientWidth;
  for (const c of [wheelCanvas, ballCanvas]) {
    c.width = size * dpr;
    c.height = size * dpr;
    c.style.width = size + 'px';
    c.style.height = size + 'px';
  }
  wheelCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ballCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  centerX = centerY = size / 2;
  wheelRadius = size / 2 - 4;
  pocketRadius = wheelRadius * 0.82;
  outerBallRadius = wheelRadius * 0.90;
}

function drawWheel() {
  const ctx = wheelCtx;
  ctx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);

  // Außenring
  ctx.beginPath();
  ctx.arc(centerX, centerY, wheelRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#3b2410';
  ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.stroke();

  const seg = (Math.PI * 2) / WHEEL_N;
  for (let i = 0; i < WHEEL_N; i++) {
    const n = WHEEL_ORDER[i];
    const a0 = angleForIndex(i) - seg / 2;
    const a1 = a0 + seg;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, pocketRadius, a0, a1);
    ctx.closePath();
    ctx.fillStyle = WHEEL_COLORS[numColor(n)];
    ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Zahl
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angleForIndex(i));
    ctx.fillStyle = '#f5e9c9';
    ctx.font = `${Math.max(9, pocketRadius * 0.09)}px 'Trajan Pro', Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), 0, -pocketRadius * 0.9);
    ctx.restore();
  }

  // Nabe
  ctx.beginPath();
  ctx.arc(centerX, centerY, pocketRadius * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = '#2a180a';
  ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Speichen
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(centerX + Math.cos(a) * pocketRadius * 0.32, centerY + Math.sin(a) * pocketRadius * 0.32);
    ctx.lineTo(centerX + Math.cos(a) * pocketRadius, centerY + Math.sin(a) * pocketRadius);
    ctx.stroke();
  }
}

function drawBall(angle, radius) {
  const ctx = ballCtx;
  ctx.clearRect(0, 0, ballCanvas.width, ballCanvas.height);
  const x = centerX + Math.cos(angle) * radius;
  const y = centerY + Math.sin(angle) * radius;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(3, wheelRadius * 0.035), 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 4;
  ctx.fill();
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

// Dreht den Ball und lässt ihn exakt bei der Zielzahl landen.
function spinBallTo(winningNumber, durationMs, onDone) {
  const startAngle = -Math.PI / 2; // Startposition oben
  const targetAngle = angleForNumber(winningNumber);
  const rotations = 7 + Math.random() * 2; // 7-9 volle Umdrehungen
  let normalizedTarget = targetAngle;
  while (normalizedTarget < startAngle) normalizedTarget += Math.PI * 2;
  const totalAngle = (normalizedTarget - startAngle) + rotations * Math.PI * 2;

  const dropStart = 0.68; // ab hier fällt der Ball auf die Zahlenring-Bahn
  const t0 = performance.now();

  function frame(now) {
    const t = Math.min(1, (now - t0) / durationMs);
    const eased = easeOutCubic(t);
    const angle = startAngle + totalAngle * eased;

    let radius;
    if (t < dropStart) {
      radius = outerBallRadius;
    } else {
      const dt = (t - dropStart) / (1 - dropStart);
      radius = outerBallRadius - (outerBallRadius - pocketRadius * 0.78) * easeOutCubic(dt);
    }

    drawBall(angle, radius);

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      drawBall(targetAngle, pocketRadius * 0.78);
      if (onDone) onDone();
    }
  }
  requestAnimationFrame(frame);
}
