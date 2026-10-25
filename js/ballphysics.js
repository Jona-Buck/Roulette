// =============================================================================
// Kugel-Physik: deterministische 2.5D-Simulation im mitrotierenden Kessel-Bezugssystem
//
// Idee: Die Zielzahl steht vorher fest (Zufallsgenerator im Spiel). Statt die Kugel
// per Formel zur Zielzahl zu "führen", wird eine ECHTE Physik-Simulation mit zufälligen
// Startbedingungen berechnet und nur eine Flugbahn akzeptiert, die von selbst in der
// Zielzahl endet. Die Animation spielt diese Flugbahn dann exakt ab.
// Es gibt keinerlei Steuerkräfte: jede Bahn ist reine Physik, jede sieht anders aus.
//
// Ablauf einer Bahn:
//  1. Abwurf: Die Kugel wird aus ihrem Fach auf die Außenbahn geschleudert.
//  2. Außenbahn: Sie kreist viele Male mit hoher Geschwindigkeit an der Außenwand
//     (Polarkoordinaten, daher ohne Rundungsverluste). Rollwiderstand + Luftwiderstand
//     bremsen sie; die Bank-Schwerkraft zieht sie nach innen. Sobald ihre Fliehkraft
//     nicht mehr reicht (v² < G·R), spiralt sie nach innen und verlässt die Bahn.
//  3. Fächerring: Sie fällt in den Ring, springt mehrfach auf, hüpft über die niedrigen
//     Trennstege (schnell) oder prallt von ihnen ab (langsam) und rollt in einer
//     gewölbten Mulde aus.
//
// Einheiten: Referenz-Einheiten (Fächer-Außenradius = 184), Zeit in 1/60-s-Schritten.
// Winkel: gleiche Konvention wie angleForIndex() (Fach 0 oben, Winkel wächst im Uhrzeigersinn).
// Die Kugel dreht sich im Kessel-Bezugssystem in POSITIVER Richtung; der Rotor dreht sich
// auf dem Bildschirm in NEGATIVER Richtung -> auf dem Bildschirm laufen beide gegeneinander.
// Die Rotation des Kessels wird erst beim Zeichnen addiert.
// =============================================================================

const BP = {
  N: 37,
  R_TRACK: 207,      // Kugelbahn außen (entspricht outerBallRadius)
  R_EDGE: 188,       // Innenkante der Bahn: hier fällt die Kugel in den Fächerring
  R_POCKET_OUT: 185, // äußere Begrenzung im Fächerring
  R_FRET_OUT: 184,   // Außenkante der Trennstege (entspricht pocketRadius)
  R_HUB: 55.2,       // Nabenrand
  R_REST: 136.2,     // Ruheradius im Fach (0.74 * pocketRadius)
  BALL_R: 6.5,
  FRET_T: 2.4,       // Stegdicke
  FRET_H: 1.8,       // Steghöhe: unterhalb dieser Höhe berühren sich Kugel und Steg
  Z_TRACK: 16,       // Höhe der Kugelbahn über dem Fächerring
  SUB: 4,            // Teilschritte pro Bild (numerische Genauigkeit + Abtastrate der Bahn)
  LAUNCH_STEPS: 14,  // Abwurf-Rampe (in Bildern)
  V0_MIN: 72,        // Startgeschwindigkeit auf der Bahn (Einheiten pro Bild), ca. 3.3-3.9 U/s
  V0_MAX: 84,

  // Außenbahn
  A_TRACK: 0.07,     // Rollwiderstand: konstante Verzögerung
  C_TRACK: 0.0015,   // Luftwiderstand: proportional zur Geschwindigkeit
  G_BANK: 1.85,      // Bank-Schwerkraft nach innen (Kugel verlässt die Wand bei v² < G·R)
  C_RAD: 0.05,       // radiale Dämpfung beim Hinabrollen der Bank

  // Fächerring
  C_AIR: 0.0015,
  C_FLOOR: 0.055,    // Rollreibung am Fachboden (proportional zum Tempo)
  A_FLOOR: 0.01,     // Haftreibung am Fachboden (konstante Bremsung): Kugel kommt zum Stehen
  C_RADIAL: 0.12,    // zusätzliche radiale Dämpfung am Fachboden (Boden ist gewölbt)
  G_Z: 0.28,         // Schwerkraft senkrecht
  E_Z: 0.58,         // Sprungkraft (Restitution) am Boden (pro Aufprall zufällig +-15%)
  VZ_STOP: 0.22,
  E_FRET: 0.45,      // Restitution an den Trennstegen (nur bei langsamer Kugel)
  V_HOP: 3.5,        // ab diesem Tempo (Einheiten/Bild) hüpft die Kugel über einen Steg statt abzuprallen
  K_HOP: 0.12,       // Aufwärts-Impuls beim Hüpfen über einen Steg (Anteil des Tempos)
  VZ_HOP_MAX: 3.2,   // nie höher als der Absturz von der Bahn
  HOP_LOSS: 0.12,    // Tempo-Verlust beim Hüpfen über einen Steg
  SETTLE_V: 0.04,    // Ruhe: langsamer als das ...
  SETTLE_FRAMES: 10, // ... für so viele Bilder am Stück
  E_EDGE: 0.35,
  E_HUB: 0.5,
  K_R: 0.010,        // Fachboden-Wölbung radial (zieht zur Ruheposition)
  K_T: 0.012,        // Fachboden-Mulde tangential (zieht zur Fachmitte)
  KICK: 0.9,         // Zufalls-Impuls beim Aufprall (Unebenheiten/Ablenker)
  LAND_FRICTION: 0.93
};

// Gemeinsamer Zwischenspeicher für Bahnpunkte (nur die angenommene Bahn wird kopiert)
const BP_BUF = { a: null };

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

// Simuliert EINE komplette Flugbahn. P = { a0, r0, v0, seed, target? }.
// Die Bahn wird in Teilschritten abgetastet: pts[n*3 .. +2] = (x, y, z) nach n Teilschritten.
// Ist P.target gesetzt, wird früh abgebrochen, sobald das Endfach feststeht und nicht passt.
function ballSimulate(P, maxSteps) {
  const B = BP;
  const N = B.N;
  const SUB = B.SUB;
  const dt = 1 / SUB;
  const w = (Math.PI * 2) / N;
  const fretBase = -Math.PI / 2 - w / 2;
  const rng = ballRng(P.seed);
  const maxN = maxSteps * SUB;
  const need = (maxN + 1) * 3;
  if (!BP_BUF.a || BP_BUF.a.length < need) BP_BUF.a = new Float32Array(need);
  const pts = BP_BUF.a;

  // --- 1. Abwurf-Rampe: Kugel wird aus ihrem Fach auf die Bahn geschleudert
  const L = B.LAUNCH_STEPS * SUB;
  let th = P.a0;
  const ease = (u) => 1 - Math.pow(1 - u, 3);
  for (let n = 0; n <= L; n++) {
    const u = n / L;
    const rr0 = P.r0 + (B.R_TRACK - P.r0) * ease(u);
    const zz = B.Z_TRACK * u * u * (3 - 2 * u);
    pts[n * 3] = Math.cos(th) * rr0;
    pts[n * 3 + 1] = Math.sin(th) * rr0;
    pts[n * 3 + 2] = zz;
    if (n < L) th += (P.v0 * u * u) / Math.max(rr0, 1) * dt; // Tangentialgeschwindigkeit wächst bis v0
  }

  // Zustand: Phase 0 in Polarkoordinaten (r, vr, th, om), Phase 1 in kartesischen Koordinaten
  let r = B.R_TRACK, vr = 0, om = P.v0 / B.R_TRACK;
  let x = Math.cos(th) * r, y = Math.sin(th) * r;
  let vx = 0, vy = 0, z = B.Z_TRACK, vz = 0;
  let phase = 0;
  let restCount = 0, collisions = 0, hops = 0, crossings = 0, fretHops = 0;
  let dropN = -1, dropSpeed = 0, lastPocket = -1;
  let endN = maxN;

  for (let n = L + 1; n <= maxN; n++) {
    if (phase === 0) {
      // --- 2. Außenbahn (Polarkoordinaten: exakte Kreisbewegung, keine Rundungsverluste)
      const vt = r * om;
      const aT = -(B.A_TRACK + B.C_TRACK * vt);        // Rollwiderstand + Luftwiderstand
      const aR = r * om * om - B.G_BANK - B.C_RAD * vr; // Fliehkraft - Bank-Schwerkraft
      let nvr = vr + aR * dt;
      let nr = r + nvr * dt;
      if (nr >= B.R_TRACK) { nr = B.R_TRACK; nvr = 0; } // Außenwand (verlustfrei)
      om = (r * r * om + r * aT * dt) / (nr * nr);      // Drehimpuls-Bilanz
      th += om * dt;
      r = nr; vr = nvr;
      x = Math.cos(th) * r; y = Math.sin(th) * r;
      if (r < B.R_EDGE) {                                // Innenkante erreicht: Kugel fällt in den Fächerring
        phase = 1; dropN = n;
        const c = Math.cos(th), s = Math.sin(th);
        vx = vr * c - r * om * s;
        vy = vr * s + r * om * c;
        z = B.Z_TRACK; vz = (rng() - 0.3) * 2.4;         // Ablenker an der Bahnkante: zufälliger Stoß
        dropSpeed = r * om;
      }
    } else {
      // --- 3. Fächerring
      let rr = Math.hypot(x, y) || 0.001;
      let ux = x / rr, uy = y / rr;

      // senkrecht: fallen, aufprallen, hüpfen
      vz -= B.G_Z * dt;
      z += vz * dt;
      if (z <= 0) {
        z = 0;
        if (vz < -B.VZ_STOP) {
          const impact = -vz;
          vz = impact * B.E_Z * (0.85 + 0.3 * rng());
          hops++;
          // Aufprall: Reibung + zufälliger Impuls (Unebenheiten, Ablenker)
          vx *= B.LAND_FRICTION; vy *= B.LAND_FRICTION;
          const ang = rng() * Math.PI * 2;
          const kick = B.KICK * (impact / 4) * (0.4 + 0.6 * rng());
          vx += Math.cos(ang) * kick; vy += Math.sin(ang) * kick;
        } else { vz = 0; }
      }
      const grounded = z === 0 && vz === 0;

      // waagerecht
      const drag = grounded ? B.C_FLOOR : B.C_AIR;
      const f = 1 - drag * dt;
      vx *= f; vy *= f;
      if (grounded) {
        // Haftreibung: konstante Bremsung, damit die Kugel wirklich zum Stehen kommt
        const sp = Math.hypot(vx, vy);
        if (sp > 0) { const k = Math.max(0, sp - B.A_FLOOR * dt) / sp; vx *= k; vy *= k; }
        // gewölbter Boden: radial zur Ruheposition (stark gedämpft), tangential zur Fachmitte
        const vrad = vx * ux + vy * uy;
        const ar = -B.K_R * (rr - B.R_REST) - B.C_RADIAL * vrad;
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
        x = ux * (B.R_HUB + B.BALL_R); y = uy * (B.R_HUB + B.BALL_R);
        const vrad = vx * ux + vy * uy;
        if (vrad < 0) { vx -= (1 + B.E_HUB) * vrad * ux; vy -= (1 + B.E_HUB) * vrad * uy; }
        rr = B.R_HUB + B.BALL_R;
      }
      if (rr > B.R_POCKET_OUT) {
        x = ux * B.R_POCKET_OUT; y = uy * B.R_POCKET_OUT;
        const vrad = vx * ux + vy * uy;
        if (vrad > 0) { vx -= (1 + B.E_EDGE) * vrad * ux; vy -= (1 + B.E_EDGE) * vrad * uy; }
        rr = B.R_POCKET_OUT;
      }

      // Trennstege: nur wenn die Kugel tief genug ist (sonst fliegt sie darüber)
      if (z < B.FRET_H && rr > B.R_HUB && rr < B.R_FRET_OUT + B.BALL_R) {
        const thc = Math.atan2(y, x);
        const rel = ballAngleWrap(thc - fretBase);
        const m = Math.floor(rel / w);
        const local = rel - m * w;
        const lim = B.BALL_R + B.FRET_T / 2;
        const dL = rr * local;
        const dR = rr * (w - local);
        const ux2 = x / rr, uy2 = y / rr;
        const tx = -uy2, ty = ux2;
        const vt = vx * tx + vy * ty;
        const hitL = dL < lim && vt < 0;
        const hitR = dR < lim && vt > 0;
        if (hitL || hitR) {
          collisions++;
          const vtAbs = Math.abs(vt);
          if (vtAbs > B.V_HOP) {
            // schnelle Kugel: rollt über den niedrigen Steg, bekommt einen Aufwärts-Impuls
            // und einen kleinen zufälligen Seitenstoß, verliert etwas Tempo
            const kick = Math.min(B.K_HOP * vtAbs * (0.6 + 0.8 * rng()), B.VZ_HOP_MAX);
            if (vz < B.VZ_HOP_MAX) vz = Math.min(vz + kick, B.VZ_HOP_MAX);
            z = Math.max(z, B.FRET_H + 0.02);
            const loss = B.HOP_LOSS * (0.7 + 0.6 * rng());
            vx -= loss * vt * tx; vy -= loss * vt * ty;
            const side = (rng() - 0.5) * 0.12 * vtAbs;
            vx += side * ux2; vy += side * uy2;
            fretHops++;
          } else if (hitL) {
            const nth = thc + (lim - dL) / rr;
            x = Math.cos(nth) * rr; y = Math.sin(nth) * rr;
            const dv = -(1 + B.E_FRET) * vt;
            vx += dv * tx; vy += dv * ty;
          } else {
            const nth = thc - (lim - dR) / rr;
            x = Math.cos(nth) * rr; y = Math.sin(nth) * rr;
            const dv = -(1 + B.E_FRET) * vt;
            vx += dv * tx; vy += dv * ty;
          }
        }
      }
    }
    pts[n * 3] = x; pts[n * 3 + 1] = y; pts[n * 3 + 2] = z;

    if (phase === 1 && (n % SUB) === 0) {
      const pk = ballPocketAt(Math.atan2(y, x));
      if (lastPocket >= 0 && pk !== lastPocket) crossings++;
      lastPocket = pk;
      const sp = Math.hypot(vx, vy);
      if (P.target !== undefined && z === 0 && vz === 0 && sp < B.V_HOP * 0.8 && pk !== P.target) {
        // Kugel liegt dauerhaft am Boden und kann keinen Steg mehr überhüpfen: Fach steht fest, passt nicht
        return { settled: false, finalPocket: pk, samples: n, steps: Math.ceil(n / SUB), pts, collisions, hops, crossings, fretHops,
                 dropFrame: dropN / SUB, dropSpeed, finalR: Math.hypot(x, y), finalTheta: Math.atan2(y, x) };
      }
      // Ruhe-Erkennung: langsam, am Boden, im Fächerring
      if (z === 0 && vz === 0 && sp < B.SETTLE_V) {
        restCount++;
        if (restCount >= B.SETTLE_FRAMES) { endN = n; break; }
      } else { restCount = 0; }
    }
  }

  const settled = phase === 1 && z === 0 && vz === 0 && Math.hypot(vx, vy) < 0.08;
  return {
    pts, samples: endN, steps: Math.ceil(endN / SUB), settled,
    finalPocket: ballPocketAt(Math.atan2(y, x)),
    finalR: Math.hypot(x, y), finalTheta: Math.atan2(y, x),
    collisions, hops, crossings, fretHops,
    dropFrame: dropN >= 0 ? dropN / SUB : -1, dropSpeed
  };
}

// Sucht per Zufalls-Ausprobieren eine echte, ungesteuerte Flugbahn, die von selbst
// exakt im gewünschten Fach endet. a0/r0 = Startposition im Kessel-Bezugssystem
// (normalerweise die Endposition des vorigen Spins, damit die Kugel nicht springt).
function ballFindTrajectory(targetPocket, maxSteps, maxTries, a0, r0) {
  const B = BP;
  const startR = (r0 >= B.R_HUB + B.BALL_R && r0 <= B.R_TRACK) ? r0 : B.R_REST;
  for (let i = 0; i < maxTries; i++) {
    const P = {
      a0: (a0 === undefined || a0 === null) ? Math.random() * Math.PI * 2 : a0,
      r0: startR,
      v0: B.V0_MIN + Math.random() * (B.V0_MAX - B.V0_MIN),
      seed: Math.floor(Math.random() * 1e9),
      target: targetPocket
    };
    const r = ballSimulate(P, maxSteps);
    if (r.settled && r.finalPocket === targetPocket) {
      r.pts = r.pts.slice(0, (r.samples + 1) * 3); // nur die angenommene Bahn kopieren
      return r;
    }
  }
  return null; // extrem unwahrscheinlich; Aufrufer braucht einen Fallback
}
