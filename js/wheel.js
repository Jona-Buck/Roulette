'use strict';

const WHEEL_N = WHEEL_ORDER.length; // 37
let wheelCanvas, wheelCtx, ballCanvas, ballCtx;
let wheelRadius = 0, centerX = 0, centerY = 0;
let pocketRadius = 0, outerBallRadius = 0;

const WHEEL_FONT = "'Cinzel', Georgia, serif";
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

  // --- Holz-Außenrand (Bowl) ---
  const woodGrad = ctx.createRadialGradient(
    centerX - wheelRadius * 0.25, centerY - wheelRadius * 0.3, wheelRadius * 0.1,
    centerX, centerY, wheelRadius
  );
  woodGrad.addColorStop(0, '#8a5a2e');
  woodGrad.addColorStop(0.35, '#5a3416');
  woodGrad.addColorStop(0.7, '#331d0c');
  woodGrad.addColorStop(1, '#150b04');
  ctx.beginPath();
  ctx.arc(centerX, centerY, wheelRadius, 0, Math.PI * 2);
  ctx.fillStyle = woodGrad;
  ctx.fill();

  // Holzmaserung: konzentrische Ringe mit leichter Transparenz
  for (let i = 0; i < 6; i++) {
    const r = wheelRadius * (0.98 - i * 0.045);
    ctx.beginPath();
    ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(0,0,0,0.12)' : 'rgba(255,214,150,0.08)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  // --- Messing-Zierring ---
  const brassRingOuter = wheelRadius * 0.86;
  const brassRingInner = pocketRadius + (brassRingOuter - pocketRadius) * 0.25;
  const brassGrad = ctx.createLinearGradient(centerX - wheelRadius, centerY - wheelRadius, centerX + wheelRadius, centerY + wheelRadius);
  brassGrad.addColorStop(0,    '#6b4f1e');
  brassGrad.addColorStop(0.12, '#f2d98a');
  brassGrad.addColorStop(0.24, '#8a6a2c');
  brassGrad.addColorStop(0.38, '#fff3d0');
  brassGrad.addColorStop(0.5,  '#a9812f');
  brassGrad.addColorStop(0.62, '#fff3d0');
  brassGrad.addColorStop(0.76, '#8a6a2c');
  brassGrad.addColorStop(0.88, '#f2d98a');
  brassGrad.addColorStop(1,    '#6b4f1e');
  ctx.beginPath();
  ctx.arc(centerX, centerY, brassRingOuter, 0, Math.PI * 2);
  ctx.arc(centerX, centerY, brassRingInner, 0, Math.PI * 2, true);
  ctx.fillStyle = brassGrad;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX, centerY, brassRingOuter, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,240,200,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // --- Zahlenfelder ---
  const seg = (Math.PI * 2) / WHEEL_N;
  for (let i = 0; i < WHEEL_N; i++) {
    const n = WHEEL_ORDER[i];
    const mid = angleForIndex(i) + rotation;
    const a0 = mid - seg / 2;
    const a1 = mid + seg / 2;
    const col = numColor(n);

    const pocketGrad = ctx.createRadialGradient(
      centerX + Math.cos(mid) * pocketRadius * 0.35, centerY + Math.sin(mid) * pocketRadius * 0.35, 2,
      centerX, centerY, pocketRadius
    );
    if (col === 'red') { pocketGrad.addColorStop(0, '#e2637a'); pocketGrad.addColorStop(0.55, '#a52f3f'); pocketGrad.addColorStop(1, '#4a0e16'); }
    else if (col === 'black') { pocketGrad.addColorStop(0, '#4a4a4a'); pocketGrad.addColorStop(0.55, '#1c1c1c'); pocketGrad.addColorStop(1, '#000000'); }
    else { pocketGrad.addColorStop(0, '#54d691'); pocketGrad.addColorStop(0.55, '#1c8a4a'); pocketGrad.addColorStop(1, '#06301a'); }

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, pocketRadius, a0, a1);
    ctx.closePath();
    ctx.fillStyle = pocketGrad;
    ctx.fill();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(mid);
    ctx.fillStyle = '#f6ecd4';
    ctx.font = `600 ${Math.max(10, pocketRadius * 0.115)}px ${WHEEL_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 2;
    ctx.fillText(String(n), 0, -pocketRadius * 0.88);
    ctx.restore();
  }

  // --- Metallische Fach-Trenner ---
  for (let i = 0; i < WHEEL_N; i++) {
    const a = angleForIndex(i) + rotation - seg / 2;
    const x1 = centerX + Math.cos(a) * pocketRadius * 0.12;
    const y1 = centerY + Math.sin(a) * pocketRadius * 0.12;
    const x2 = centerX + Math.cos(a) * pocketRadius;
    const y2 = centerY + Math.sin(a) * pocketRadius;
    const fretGrad = ctx.createLinearGradient(x1, y1, x2, y2);
    fretGrad.addColorStop(0, 'rgba(230,220,190,0.35)');
    fretGrad.addColorStop(1, 'rgba(230,220,190,0.85)');
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = fretGrad;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(centerX, centerY, pocketRadius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(230,220,190,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // --- Nabe ---
  const hubR = pocketRadius * 0.30;
  const hubGrad = ctx.createRadialGradient(
    centerX - hubR * 0.3, centerY - hubR * 0.4, hubR * 0.1,
    centerX, centerY, hubR
  );
  hubGrad.addColorStop(0, '#f2e6c4');
  hubGrad.addColorStop(0.4, '#b8934a');
  hubGrad.addColorStop(1, '#4a3512');
  ctx.beginPath();
  ctx.arc(centerX, centerY, hubR, 0, Math.PI * 2);
  ctx.fillStyle = hubGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,200,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Speichen mit Verjüngung + Nieten
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rotation;
    const sx = centerX + Math.cos(a) * hubR;
    const sy = centerY + Math.sin(a) * hubR;
    const ex = centerX + Math.cos(a) * pocketRadius * 0.97;
    const ey = centerY + Math.sin(a) * pocketRadius * 0.97;
    const spokeGrad = ctx.createLinearGradient(sx, sy, ex, ey);
    spokeGrad.addColorStop(0, '#e8d9ad');
    spokeGrad.addColorStop(1, '#7a5c1f');
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = spokeGrad;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX + Math.cos(a) * pocketRadius * 0.55, centerY + Math.sin(a) * pocketRadius * 0.55, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = '#f2e6c4';
    ctx.fill();
  }

  // Zentrale Kappe
  ctx.beginPath();
  ctx.arc(centerX, centerY, hubR * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = '#2a1c08';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,200,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

function drawBall(angle, radius) {
  const ctx = ballCtx;
  ctx.clearRect(0, 0, ballCanvas.width, ballCanvas.height);

  const x = centerX + Math.cos(angle) * radius;
  const y = centerY + Math.sin(angle) * radius * PERSPECTIVE_Y;
  const r = Math.max(3, wheelRadius * 0.034);

  ctx.beginPath();
  ctx.arc(x + r * 0.25, y + r * 0.25, r * 1.05, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fill();

  const grad = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.55, '#e2e2e2');
  grad.addColorStop(1, '#9c9c9c');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
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
