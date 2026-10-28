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

function drawBall(angle, radius, height) {
  const ctx = ballCtx;
  ctx.clearRect(0, 0, ballCanvas.width, ballCanvas.height);

  const x = centerX + Math.cos(angle) * radius;
  const y = centerY + Math.sin(angle) * radius * PERSPECTIVE_Y;
  const r = Math.max(3, wheelRadius * 0.034);
  const h = height || 0; // Höhe über der Fläche (Referenz-Einheiten, echte Physik-Sprünge)

  // Schatten: löst sich von der Kugel, je höher sie gerade springt (Draufsicht-Höhenhinweis)
  const shadowOffset = r * 0.3 + h * 0.9;
  const shadowScale = Math.max(0.55, 1 - h * 0.025);
  ctx.beginPath();
  ctx.arc(x, y + shadowOffset, r * 0.9 * shadowScale, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();

  // Kugel selbst wird minimal größer, wenn sie näher an der Kamera (höher) ist
  const rBall = r * (1 + h * 0.012);
  ctx.beginPath();
  ctx.arc(x, y, rBall, 0, Math.PI * 2);
  ctx.fillStyle = '#e9e2d0';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x - rBall * 0.3, y - rBall * 0.3, rBall * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fill();
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

// Dreht den Rotor physikalisch plausibel (unverändert) und lässt die Kugel einer echten,
// komplett ungesteuerten Physik-Bahn folgen, die vorher so lange mit zufälligen
// Startbedingungen durchprobiert wurde, bis sie von selbst exakt im Zielfach endet
// (siehe js/ballphysics.js). Keine Formel führt die Kugel zur Zielzahl — die Bahn ist
// entweder komplett real oder wird verworfen.
function spinBallTo(winningNumber, durationMs, onDone) {
  // Rotor: unabhängige Drehung, Gegenrichtung zur Kugel, deutlich langsamer als die Kugel (unverändert)
  const wheelStart = wheelState.rot;
  const wheelRotations = 0.6 + Math.random() * 0.6;
  const wheelEnd = wheelStart - (wheelRotations * Math.PI * 2 + Math.random() * (Math.PI / 2));

  // Echte Physik-Bahn für die Zielzahl suchen (siehe ballphysics.js) — typ. ~10ms, nie gescheitert
  // in der Validierung; zur Sicherheit ein zweiter, großzügigerer Versuch als Netz.
  const targetIdx = WHEEL_ORDER.indexOf(winningNumber);
  let traj = ballFindTrajectory(targetIdx, 460, 800) || ballFindTrajectory(targetIdx, 700, 5000);
  if (!traj) {
    // Praktisch ausgeschlossen (siehe Validierung: 0 Fehlschläge in tausenden Läufen).
    // Kein Absturz: Kugel bleibt in der Kessel-Mitte des Zielfachs stehen, ohne Animation.
    traj = { pts: new Float32Array(3), steps: 0, finalTheta: angleForIndex(targetIdx), finalR: pocketRadius / (pocketRadius / 184) * 0.74 };
    traj.pts[0] = Math.cos(traj.finalTheta) * traj.finalR;
    traj.pts[1] = Math.sin(traj.finalTheta) * traj.finalR;
  }

  const totalSteps = traj.steps;
  const realDurationMs = Math.max(600, totalSteps * (1000 / 60)); // Dauer ergibt sich aus der Bahn, nicht aus einer festen Vorgabe
  const REF_POCKET_R = 184; // Referenz-pocketRadius, auf den ballphysics.js kalibriert ist
  const scale = pocketRadius / REF_POCKET_R;

  const t0 = performance.now();

  function sampleTrajectory(stepFloat) {
    const s0 = Math.max(0, Math.min(totalSteps, Math.floor(stepFloat)));
    const s1 = Math.min(totalSteps, s0 + 1);
    const frac = stepFloat - s0;
    const x = traj.pts[s0 * 3] + (traj.pts[s1 * 3] - traj.pts[s0 * 3]) * frac;
    const y = traj.pts[s0 * 3 + 1] + (traj.pts[s1 * 3 + 1] - traj.pts[s0 * 3 + 1]) * frac;
    const z = traj.pts[s0 * 3 + 2] + (traj.pts[s1 * 3 + 2] - traj.pts[s0 * 3 + 2]) * frac;
    return { x, y, z };
  }

  function frame(now) {
    const t = Math.min(1, (now - t0) / realDurationMs);
    const wheelT = easeOutCubic(t);
    const rot = wheelStart + (wheelEnd - wheelStart) * wheelT;

    const p = sampleTrajectory(t * totalSteps);
    const localAngle = Math.atan2(p.y, p.x);
    const localRadius = Math.hypot(p.x, p.y);
    const screenAngle = localAngle + rot; // Bezugssystem "fährt" mit dem Rotor mit
    const screenRadius = localRadius * scale;

    drawWheel(rot);
    drawBall(screenAngle, screenRadius, p.z * scale);

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      const fx = traj.pts[totalSteps * 3], fy = traj.pts[totalSteps * 3 + 1];
      const finalLocalAngle = Math.atan2(fy, fx);
      const finalLocalRadius = Math.hypot(fx, fy);
      wheelState.rot = norm2PI(wheelEnd);
      ballState.angle = norm2PI(finalLocalAngle + wheelEnd);
      ballState.radius = finalLocalRadius * scale;
      drawWheel(wheelState.rot);
      drawBall(ballState.angle, ballState.radius, 0);
      if (onDone) onDone();
    }
  }
  requestAnimationFrame(frame);
}
