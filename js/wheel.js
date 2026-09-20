'use strict';

const WHEEL_N = WHEEL_ORDER.length; // 37
let wheelCanvas, wheelCtx, ballCanvas, ballCtx;
let wheelRadius = 0, centerX = 0, centerY = 0;
let pocketRadius = 0, outerBallRadius = 0;

const WHEEL_FONT = "'IBM Plex Mono', monospace";
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
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => drawWheel(wheelState.rot));
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
  pocketRadius = wheelRadius * 0.80;
  outerBallRadius = wheelRadius * 0.90;
}

function drawWheel(rotation) {
  const ctx = wheelCtx;
  ctx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(1, PERSPECTIVE_Y);
  ctx.translate(-centerX, -centerY);

  // --- Filz-Untergrund (ersetzt Holz-Bowl) ---
  ctx.beginPath();
  ctx.arc(centerX, centerY, wheelRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#08331f';
  ctx.fill();

  // --- Zahlenfelder: flache Füllung, kein Verlauf ---
  const seg = (Math.PI * 2) / WHEEL_N;
  for (let i = 0; i < WHEEL_N; i++) {
    const n = WHEEL_ORDER[i];
    const mid = angleForIndex(i) + rotation;
    const a0 = mid - seg / 2;
    const a1 = mid + seg / 2;
    const col = numColor(n);

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, pocketRadius, a0, a1);
    ctx.closePath();
    ctx.fillStyle = col === 'red' ? '#8c1f2c' : col === 'black' ? '#0a0a0a' : '#0f4a2c';
    ctx.fill();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(mid + Math.PI / 2);
    ctx.fillStyle = '#e9e2d0';
    ctx.font = `600 ${Math.max(10, pocketRadius * 0.115)}px ${WHEEL_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), 0, -pocketRadius * 0.88);
    ctx.restore();
  }

  // --- Dünne Trennlinien zwischen den Feldern (gedämpftes Bronze) ---
  for (let i = 0; i < WHEEL_N; i++) {
    const a = angleForIndex(i) + rotation - seg / 2;
    const x1 = centerX + Math.cos(a) * pocketRadius * 0.15;
    const y1 = centerY + Math.sin(a) * pocketRadius * 0.15;
    const x2 = centerX + Math.cos(a) * pocketRadius;
    const y2 = centerY + Math.sin(a) * pocketRadius;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = 'rgba(138,106,53,0.55)';
    ctx.lineWidth = 0.75;
    ctx.stroke();
  }

  // --- Ein einziger dünner Bronze-Rand als reine Linie ---
  ctx.beginPath();
  ctx.arc(centerX, centerY, pocketRadius + 2, 0, Math.PI * 2);
  ctx.strokeStyle = '#8a6a35';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // --- Flache Nabe, keine Speichen ---
  const hubR = pocketRadius * 0.30;
  ctx.beginPath();
  ctx.arc(centerX, centerY, hubR, 0, Math.PI * 2);
  ctx.fillStyle = '#8a6a35';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX, centerY, hubR * 0.34, 0, Math.PI * 2);
  ctx.fillStyle = '#5c451f';
  ctx.fill();

  // --- Eine einzige sehr sanfte Vignette (einziger Verlauf im ganzen Kessel) ---
  const vignette = ctx.createRadialGradient(centerX, centerY, wheelRadius * 0.72, centerX, centerY, wheelRadius);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.beginPath();
  ctx.arc(centerX, centerY, wheelRadius, 0, Math.PI * 2);
  ctx.fillStyle = vignette;
  ctx.fill();

  ctx.restore();
}

function drawBall(angle, radius) {
  const ctx = ballCtx;
  ctx.clearRect(0, 0, ballCanvas.width, ballCanvas.height);

  const x = centerX + Math.cos(angle) * radius;
  const y = centerY + Math.sin(angle) * radius * PERSPECTIVE_Y;
  const r = Math.max(3, wheelRadius * 0.034);

  ctx.beginPath();
  ctx.arc(x, y + r * 0.3, r * 0.9, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#e9e2d0';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
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
