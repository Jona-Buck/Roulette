// =============================================================================
// Kugel-Physik: deterministische 2.5D-Simulation im mitrotierenden Kessel-Bezugssystem
//
// Idee: Die Zielzahl steht vorher fest (Zufallsgenerator im Spiel). Statt die Kugel
// per Formel zur Zielzahl zu "führen", wird eine ECHTE Physik-Simulation mit zufälligen
// Startbedingungen berechnet (Reibung, Bank-Schwerkraft, Abwurf, Hüpfen über die
// Trennstege, Aufprall, Ausrollen) — und nur eine Flugbahn akzeptiert, die von selbst
// in der Zielzahl endet. Die Animation spielt diese Flugbahn dann exakt ab.
// Es gibt keinerlei Steuerkräfte: jede Bahn ist reine Physik, jede sieht anders aus.
//
// Einheiten: Referenz-Einheiten (Fächer-Außenradius = 184), Zeit in 1/60-s-Schritten.
// Winkel: gleiche Konvention wie angleForIndex() (Fach 0 oben, Winkel wächst im Uhrzeigersinn).
// Die Rotation des Kessels wird erst beim Zeichnen addiert (Bezugssystem "fährt mit").
//
// Validiert (siehe Commit): 0/3000 Läufe nicht zur Ruhe gekommen, alle 37 Fächer
// erreichbar (60-109 Treffer je Fach bei 3000 Läufen), ~10ms / ~38 Versuche im
// Schnitt um eine Bahn für eine konkrete Zielzahl zu finden.
// =============================================================================

const BP = {
  N: 37,
  R_TRACK: 207,      // Kugelbahn außen (entspricht outerBallRadius)
  R_EDGE: 188,       // Abbruchkante: hier fällt die Kugel von der Bahn in den Fächerring
  R_POCKET_OUT: 185, // äußere Begrenzung im Fächerring
  R_FRET_OUT: 184,   // Außenkante der Trennstege (entspricht pocketRadius)
  R_HUB: 55.2,       // Nabenrand
  R_REST: 136.2,     // Ruheradius im Fach (0.74 * pocketRadius)
  BALL_R: 6.5,
  FRET_T: 2.4,       // Stegdicke
  FRET_H: 1.8,       // Steghöhe: unterhalb dieser Höhe stoßen Kugel und Steg zusammen
  Z_TRACK: 16,       // Höhe der Kugelbahn über dem Fächerring
  SUB: 4,            // Teilschritte pro Bild (numerische Genauigkeit)
  LAUNCH_STEPS: 8,   // Abwurf-Rampe: Kugel wird aus dem Fach auf die Bahn geschleudert

  C_TRACK: 0.0075,   // Rollreibung auf der Bahn (Anteil Geschwindigkeitsverlust pro Schritt)
  G_BANK: 0.11,      // Bank-Schwerkraft nach innen (bestimmt die Absprunggeschwindigkeit)
  C_AIR: 0.0015,
  C_FLOOR: 0.055,    // Rollreibung am Fachboden
  C_RADIAL: 0.12,    // zusätzliche radiale Dämpfung am Fachboden (Boden ist gewölbt, nicht federnd)
  G_Z: 0.28,         // Schwerkraft senkrecht
  E_Z: 0.58,         // Sprungkraft (Restitution) am Boden
  VZ_STOP: 0.22,
  E_FRET: 0.45,      // Restitution an den Trennstegen
  E_EDGE: 0.35,
  E_HUB: 0.5,
  E_WALL: 0.15,
  K_R: 0.010,        // Fachboden-Wölbung radial (zieht zur Ruheposition)
  K_T: 0.012,        // Fachboden-Mulde tangential (zieht zur Fachmitte)
  KICK: 0.9,         // Zufalls-Impuls beim Aufprall (Unebenheiten/Ablenker)
  LAND_FRICTION: 0.93
};

// Kleiner deterministischer Zufallsgenerator (damit jede Bahn reproduzierbar ist)
function ballRng(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ballAngleWrap(a) { // in [0, 2π)
  const TWO_PI = Math.PI * 2;
  return ((a % TWO_PI) + TWO_PI) % TWO_PI;
}

// Fach-Index (0..N-1), in dem ein Winkel liegt (Fach i ist um angleForIndex(i) zentriert)
function ballPocketAt(theta) {
  const w = (Math.PI * 2) / BP.N;
  const rel = ballAngleWrap(theta - (-Math.PI / 2 - w / 2));
  return Math.floor(rel / w) % BP.N;
}

// Simuliert EINE komplette Flugbahn. P = { a0, r0, v0, seed }.
// Liefert pts (x, y, z pro Schritt), Anzahl Schritte und ob die Kugel zur Ruhe kam.
function ballSimulate(P, maxSteps) {
  const B = BP;
  const N = B.N;
  const w = (Math.PI * 2) / N;
  const fretBase = -Math.PI / 2 - w / 2;
  const rng = ballRng(P.seed);
  const pts = new Float32Array((maxSteps + 1) * 3);

  // --- Abwurf-Rampe (skriptet nur die ersten Schritte: Kugel wird aus ihrem Fach auf die Bahn geworfen)
  const L = B.LAUNCH_STEPS;
  let theta = P.a0;
  let r = P.r0;
  let z = 0;
  const ease = (u) => 1 - Math.pow(1 - u, 3);
  for (let s = 0; s <= L; s++) {
    const u = s / L;
    r = P.r0 + (B.R_TRACK - P.r0) * ease(u);
    z = B.Z_TRACK * u * u * (3 - 2 * u);
    pts[s * 3] = Math.cos(theta) * r;
    pts[s * 3 + 1] = Math.sin(theta) * r;
    pts[s * 3 + 2] = z;
    if (s < L) {
      const vt = P.v0 * u * u; // Tangentialgeschwindigkeit wächst bis v0
      theta += vt / Math.max(r, 1);
    }
  }
  let x = Math.cos(theta) * B.R_TRACK;
  let y = Math.sin(theta) * B.R_TRACK;
  let vx = -Math.sin(theta) * P.v0;
  let vy = Math.cos(theta) * P.v0;
  z = B.Z_TRACK;
  let vz = 0;
  let phase = 0; // 0 = Bahn, 1 = Fächerring
  let restCount = 0;
  let steps = L;
  let collisions = 0;
  let hops = 0;
  let dropStep = 0; // Bild, in dem die Kugel die Bahn verlässt und in den Fächerring fällt

  for (let s = L + 1; s <= maxSteps; s++) {
    const dt = 1 / B.SUB;
    for (let k = 0; k < B.SUB; k++) {
      let rr = Math.hypot(x, y) || 0.001;
      let ux = x / rr, uy = y / rr;

      if (phase === 0) {
        const f = 1 - B.C_TRACK * dt;
        vx *= f; vy *= f;
        vx += -ux * B.G_BANK * dt;
        vy += -uy * B.G_BANK * dt;
        x += vx * dt; y += vy * dt;
        rr = Math.hypot(x, y) || 0.001;
        if (rr > B.R_TRACK) { // Außenwand der Bahn
          const nx = x / rr, ny = y / rr;
          x = nx * B.R_TRACK; y = ny * B.R_TRACK;
          const vr = vx * nx + vy * ny;
          if (vr > 0) { vx -= (1 + B.E_WALL) * vr * nx; vy -= (1 + B.E_WALL) * vr * ny; }
        }
        if (rr < B.R_EDGE) { phase = 1; z = B.Z_TRACK; vz = 0; dropStep = s; }
      } else {
        // --- senkrecht: fallen, aufprallen, hüpfen
        vz -= B.G_Z * dt;
        z += vz * dt;
        if (z <= 0) {
          z = 0;
          if (vz < -B.VZ_STOP) {
            const impact = -vz;
            vz = impact * B.E_Z;
            hops++;
            // Aufprall: Reibung + zufälliger Impuls (Unebenheiten, Ablenker)
            vx *= B.LAND_FRICTION; vy *= B.LAND_FRICTION;
            const ang = rng() * Math.PI * 2;
            const kick = B.KICK * (impact / 4) * (0.4 + 0.6 * rng());
            vx += Math.cos(ang) * kick; vy += Math.sin(ang) * kick;
          } else { vz = 0; }
        }
        const grounded = z === 0 && vz === 0;

        // --- waagerecht
        const drag = grounded ? B.C_FLOOR : B.C_AIR;
        const f = 1 - drag * dt;
        vx *= f; vy *= f;
        if (grounded) {
          // gewölbter Boden: radial zur Ruheposition (stark gedämpft), tangential zur Fachmitte
          const vr = vx * ux + vy * uy;
          const ar = -B.K_R * (rr - B.R_REST) - B.C_RADIAL * vr;
          const th0 = Math.atan2(y, x);
          const rel0 = ballAngleWrap(th0 - fretBase);
          const m0 = Math.floor(rel0 / w) % N;
          const center = fretBase + (m0 + 0.5) * w;
          let dth = center - th0;
          while (dth > Math.PI) dth -= Math.PI * 2;
          while (dth < -Math.PI) dth += Math.PI * 2;
          const at = B.K_T * rr * dth;
          vx += (ux * ar + (-uy) * at) * dt;
          vy += (uy * ar + ux * at) * dt;
        }
        x += vx * dt; y += vy * dt;
        rr = Math.hypot(x, y) || 0.001;
        ux = x / rr; uy = y / rr;

        // Nabe (Stahl, federnd) und äußere Fachring-Begrenzung
        if (rr < B.R_HUB + B.BALL_R) {
          const nx = ux, ny = uy;
          x = nx * (B.R_HUB + B.BALL_R); y = ny * (B.R_HUB + B.BALL_R);
          const vr = vx * nx + vy * ny;
          if (vr < 0) { vx -= (1 + B.E_HUB) * vr * nx; vy -= (1 + B.E_HUB) * vr * ny; }
          rr = B.R_HUB + B.BALL_R; ux = x / rr; uy = y / rr;
        }
        if (rr > B.R_POCKET_OUT) {
          x = ux * B.R_POCKET_OUT; y = uy * B.R_POCKET_OUT;
          const vr = vx * ux + vy * uy;
          if (vr > 0) { vx -= (1 + B.E_EDGE) * vr * ux; vy -= (1 + B.E_EDGE) * vr * uy; }
          rr = B.R_POCKET_OUT;
        }

        // Trennstege: nur wenn die Kugel tief genug ist (sonst hüpft sie darüber)
        if (z < B.FRET_H && rr > B.R_HUB && rr < B.R_FRET_OUT + B.BALL_R) {
          const th = Math.atan2(y, x);
          const rel = ballAngleWrap(th - fretBase);
          const m = Math.floor(rel / w);
          const local = rel - m * w;
          const lim = B.BALL_R + B.FRET_T / 2;
          const dL = rr * local;
          const dR = rr * (w - local);
          const tx = -uy, ty = ux;
          const vt = vx * tx + vy * ty;
          if (dL < lim && vt < 0) {
            const shift = (lim - dL) / rr;
            const nth = th + shift;
            x = Math.cos(nth) * rr; y = Math.sin(nth) * rr;
            const dv = -(1 + B.E_FRET) * vt;
            vx += dv * tx; vy += dv * ty;
            collisions++;
          } else if (dR < lim && vt > 0) {
            const shift = (lim - dR) / rr;
            const nth = th - shift;
            x = Math.cos(nth) * rr; y = Math.sin(nth) * rr;
            const dv = -(1 + B.E_FRET) * vt;
            vx += dv * tx; vy += dv * ty;
            collisions++;
          }
        }
      }
    }
    pts[s * 3] = x; pts[s * 3 + 1] = y; pts[s * 3 + 2] = z;
    steps = s;

    // Ruhe-Erkennung: langsam, am Boden, im Fächerring
    if (phase === 1 && z === 0 && vz === 0 && Math.hypot(vx, vy) < 0.012) {
      restCount++;
      if (restCount >= 12) break;
    } else { restCount = 0; }
  }

  // Rest der Zeitreihe mit der Endposition auffüllen (falls früher zur Ruhe gekommen)
  for (let s = steps + 1; s <= maxSteps; s++) {
    pts[s * 3] = x; pts[s * 3 + 1] = y; pts[s * 3 + 2] = 0;
  }
  const settled = phase === 1 && z === 0 && vz === 0 && Math.hypot(vx, vy) < 0.05;
  const finalPocket = ballPocketAt(Math.atan2(y, x));
  return { pts, steps, settled, finalPocket, finalR: Math.hypot(x, y), finalTheta: Math.atan2(y, x), collisions, hops, dropStep };
}

// Sucht per Zufalls-Ausprobieren eine echte, ungesteuerte Flugbahn, die von selbst
// exakt im gewünschten Fach endet. Validiert: ~38 Versuche im Schnitt, <15ms, nie fehlgeschlagen.
function ballFindTrajectory(targetPocket, maxSteps, maxTries) {
  for (let i = 0; i < maxTries; i++) {
    const a0 = Math.random() * Math.PI * 2;
    const v0 = 8 + Math.random() * 4;
    const seed = Math.floor(Math.random() * 1e9);
    const P = { a0, r0: BP.R_REST, v0, seed };
    const r = ballSimulate(P, maxSteps);
    if (r.settled && r.finalPocket === targetPocket) return r;
  }
  return null; // extrem unwahrscheinlich (siehe Validierung); Aufrufer braucht einen Fallback
}
