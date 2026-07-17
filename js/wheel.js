'use strict';

const WHEEL_N = WHEEL_ORDER.length; // 37
let wheelCanvas, wheelCtx, ballCanvas, ballCtx;
let wheelRadius = 0, centerX = 0, centerY = 0;
let pocketRadius = 0, outerBallRadius = 0;

const WHEEL_COLORS = { green: '#1c8a4a', red: '#a5192b', black: '#1a1a1a' };
const PERSPECTIVE_Y = 1.0; // 1.0 = reine Draufsicht (kein Kippen/keine Ellipse)

// Persistenter Zustand zwischen Spins, damit nichts "springt"
const ballState = { angle: -Math.PI / 2, radius: 0 };
const wheelState = { rot: 0 };

function angleForIndex(i) {
  return (i / WHEEL_N) * Math.PI * 2 - Math.PI / 2;
}
function angleForNumber(n) {
  return angleForIndex(WHEEL_ORDER.indexOf(n));
}
function norm2PI(a) { return ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); }

function initWheel(wheelEl, ballEl) {
  wheelCanvas = wheelEl;
  ballCanvas = ballEl;
  wheelCtx = wheelCanvas.getContext('2d');
  ballCtx = ballCanvas.getContext('2d');
  resizeWheel();
  drawWheel(wheelState.rot);
  ballState.radius = outerBallRadius;
  drawBall(ballState.angle, ballState.radius);

  if (window.ResizeObserver) {
    new ResizeObserver(() => { resizeWheel(); drawWheel(wheelState.rot); drawBall(ballState.angle, ballState.radius); })
      .observe(wheelCanvas.parentElement);
  }
}

function resizeWheel() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const size = Math.max(120, wheelCanvas.parentElement.clientWidth);
  for (const c of [wheelCanvas, ballCanvas]) {
    c.width = Math.round(size * dpr);
    c.height = Math.round(size * dpr);
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

// Zeichnet Kessel+Zahlen mit gegebener Rotor-Rotation, gestaucht für Perspektive.
function drawWheel(rotation) {
  const ctx = wheelCtx;
  ctx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(1, PERSPECTIVE_Y);
  ctx.translate(-centerX, -centerY);

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
    const a0 = angleForIndex(i) + rotation - seg / 2;
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

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angleForIndex(i) + rotation);
    ctx.scale(1, 1 / PERSPECTIVE_Y); // Text nicht mit-stauchen, bleibt lesbar
    ctx.fillStyle = '#f5e9c9';
    ctx.font = `bold ${Math.max(10, pocketRadius * 0.1)}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), 0, -pocketRadius * 0.9);
    ctx.restore();
  }

  // Nabe
  ctx.beginPath();
  ctx.arc(centerX, centerY, pocketRadius * 0.32, 0, Math.PI * 2);
  const hubGrad = ctx.createRadialGradient(centerX, centerY - pocketRadius * 0.1, 2, centerX, centerY, pocketRadius * 0.32);
  hubGrad.addColorStop(0, '#4a2e12');
  hubGrad.addColorStop(1, '#1c1006');
  ctx.fillStyle = hubGrad;
  ctx.fill();
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rotation;
    ctx.beginPath();
    ctx.moveTo(centerX + Math.cos(a) * pocketRadius * 0.32, centerY + Math.sin(a) * pocketRadius * 0.32);
    ctx.lineTo(centerX + Math.cos(a) * pocketRadius, centerY + Math.sin(a) * pocketRadius);
    ctx.stroke();
  }

  ctx.restore();
}

function drawBall(angle, radius) {
  const ctx = ballCtx;
  ctx.clearRect(0, 0, ballCanvas.width, ballCanvas.height);

  const x = centerX + Math.cos(angle) * radius;
  const y = centerY + Math.sin(angle) * radius * PERSPECTIVE_Y;
  const r = Math.max(3, wheelRadius * 0.035);

  // Schatten (Draufsicht: leichter Versatz simuliert Lichtquelle von oben)
  ctx.beginPath();
  ctx.arc(x + r * 0.25, y + r * 0.25, r * 1.05, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();

  // Kugel
  const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.15, x, y, r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#b9b9b9');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

// Dreht Rotor + Kugel physikalisch plausibel und lässt die Kugel exakt bei der Zielzahl landen.
function spinBallTo(winningNumber, durationMs, onDone) {
  // Rotor: unabhängige Drehung, Gegenrichtung zur Kugel, deutlich langsamer als die Kugel
  const wheelStart = wheelState.rot;
  const wheelRotations = 0.6 + Math.random() * 0.6;
  const wheelEnd = wheelStart - (wheelRotations * Math.PI * 2 + Math.random() * (Math.PI / 2));

  // Kugel muss bei Landung exakt über der Zielzahl stehen -> Zielwinkel hängt von der Rotor-Endposition ab
  const targetAbsAngle = angleForNumber(winningNumber) + wheelEnd;

  const ballStart = ballState.angle;
  const rotations = 6 + Math.random() * 2.2;
  let target = targetAbsAngle;
  while (target < ballStart) target += Math.PI * 2;
  const totalAngle = (target - ballStart) + rotations * Math.PI * 2;

  const dropStart = 0.64;
  const finalRadius = pocketRadius * 0.74;
  const bounceAmp = (outerBallRadius - finalRadius) * 0.22;
  const bounceCycles = 5.5;

  const t0 = performance.now();

  function frame(now) {
    const t = Math.min(1, (now - t0) / durationMs);
    const easedBall = easeOutCubic(t);
    const angle = ballStart + totalAngle * easedBall;

    const wheelT = easeOutCubic(t);
    const rot = wheelStart + (wheelEnd - wheelStart) * wheelT;

    let radius;
    if (t < dropStart) {
      radius = outerBallRadius;
    } else {
      const dt = (t - dropStart) / (1 - dropStart);
      const base = outerBallRadius - (outerBallRadius - finalRadius) * easeOutCubic(dt);
      const decay = Math.pow(1 - dt, 2);
      const bounce = decay * bounceAmp * Math.sin(dt * bounceCycles * Math.PI * 2);
      radius = base + bounce;
    }

    drawWheel(rot);
    drawBall(angle, radius);

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      wheelState.rot = norm2PI(wheelEnd);
      ballState.angle = norm2PI(targetAbsAngle);
      ballState.radius = finalRadius;
      drawWheel(wheelState.rot);
      drawBall(ballState.angle, ballState.radius);
      if (onDone) onDone();
    }
  }
  requestAnimationFrame(frame);
}
