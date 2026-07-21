'use strict';

const CELL_W = 54, CELL_H = 48, STREET_H = 16, SPLIT_W = 16, CORNER = 18, ZERO_W = 54, COL_BTN_W = 52;

let els = {};

function $(id) { return document.getElementById(id); }

function initUI() {
  els = {
    bal: $('bal'), staked: $('staked'), chipTray: $('chipTray'),
    spinBtn: $('spinBtn'), clearBtn: $('clearBtn'), undoBtn: $('undoBtn'),
    history: $('historyBar'), result: $('resultBanner'), broke: $('brokeModal'),
    brokeReset: $('brokeReset'), zeroCell: $('zeroCell'), gridStage: $('gridStage'),
    colBtns: $('colBtns'), dozensRow: $('dozensRow'), outsideRow: $('outsideRow')
  };

  buildChipTray();
  buildTable();

  els.spinBtn.addEventListener('click', doSpin);
  els.clearBtn.addEventListener('click', () => {
    if (S.spinning) return;
    clearBets();
    renderActiveBets();
  });
  els.undoBtn.addEventListener('click', () => {
    if (S.spinning) return;
    undoLastBet();
    renderActiveBets();
  });
  els.brokeReset.addEventListener('click', () => {
    S.bal = STARTING_BALANCE;
    updateBalanceUI();
    els.broke.classList.remove('open');
  });

  updateBalanceUI();
}

function buildChipTray() {
  els.chipTray.innerHTML = '';
  CHIP_VALUES.forEach((val, i) => {
    const c = document.createElement('button');
    c.className = 'chip chip-' + val;
    c.dataset.val = val;
    if (i === 1) c.classList.add('selected');
    c.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(el => el.classList.remove('selected'));
      c.classList.add('selected');
      S.chip = val;
    });
    els.chipTray.appendChild(c);
  });
}

function makeZone(type, numbers, label, x, y, w, h, extraClass) {
  const z = document.createElement('div');
  z.className = 'zone ' + (extraClass || '');
  z.style.left = x + 'px';
  z.style.top = y + 'px';
  z.style.width = w + 'px';
  z.style.height = h + 'px';
  z.dataset.type = type;
  z.title = label;
  z.addEventListener('click', () => onZoneClick(z, type, numbers));
  return z;
}

function buildTable() {
  // Zero-Zelle
  els.zeroCell.style.width = ZERO_W + 'px';
  els.zeroCell.style.height = (CELL_H * 3) + 'px';
  els.zeroCell.textContent = '0';
  els.zeroCell.addEventListener('click', () => onZoneClick(els.zeroCell, 'straight', [0]));

  // Grid-Stage
  const stage = els.gridStage;
  stage.style.width = (CELL_W * 12) + 'px';
  stage.style.height = (CELL_H * 3 + STREET_H) + 'px';
  stage.innerHTML = '';

  // Zahlen-Zellen
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 12; col++) {
      const n = TABLE_GRID[row][col];
      const cell = document.createElement('div');
      cell.className = 'cell ' + numColor(n);
      cell.textContent = n;
      cell.style.left = (col * CELL_W) + 'px';
      cell.style.top = (row * CELL_H) + 'px';
      cell.style.width = CELL_W + 'px';
      cell.style.height = CELL_H + 'px';
      cell.addEventListener('click', () => onZoneClick(cell, 'straight', [n]));
      stage.appendChild(cell);
    }
  }

  // Horizontale Splits (gleiche Reihe, Nachbarspalten)
  for (let row = 0; row < 3; row++) {
    for (let col = 1; col < 12; col++) {
      const nums = [TABLE_GRID[row][col - 1], TABLE_GRID[row][col]];
      const z = makeZone('split', nums, 'Split ' + nums.join('/'),
        col * CELL_W - SPLIT_W / 2, row * CELL_H, SPLIT_W, CELL_H, 'split-h');
      stage.appendChild(z);
    }
  }

  // Vertikale Splits (gleiche Spalte, Nachbarreihen) + Ecken
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 12; col++) {
      const nums = [TABLE_GRID[row][col], TABLE_GRID[row + 1][col]];
      const z = makeZone('split', nums, 'Split ' + nums.join('/'),
        col * CELL_W, (row + 1) * CELL_H - SPLIT_W / 2, CELL_W, SPLIT_W, 'split-v');
      stage.appendChild(z);
    }
    for (let col = 1; col < 12; col++) {
      const nums = [
        TABLE_GRID[row][col - 1], TABLE_GRID[row][col],
        TABLE_GRID[row + 1][col - 1], TABLE_GRID[row + 1][col]
      ];
      const z = makeZone('corner', nums, 'Ecke ' + nums.join('/'),
        col * CELL_W - CORNER / 2, (row + 1) * CELL_H - CORNER / 2, CORNER, CORNER, 'corner');
      stage.appendChild(z);
    }
  }

  // Straße (pro Spalten-Triplet) + Sechserlinie (zwischen Triplets)
  for (let col = 0; col < 12; col++) {
    const nums = [TABLE_GRID[0][col], TABLE_GRID[1][col], TABLE_GRID[2][col]];
    const z = makeZone('street', nums, 'Straße ' + nums.slice().sort((a, b) => a - b).join('/'),
      col * CELL_W, CELL_H * 3, CELL_W, STREET_H, 'street');
    stage.appendChild(z);
  }
  for (let col = 1; col < 12; col++) {
    const nums = [
      TABLE_GRID[0][col - 1], TABLE_GRID[1][col - 1], TABLE_GRID[2][col - 1],
      TABLE_GRID[0][col], TABLE_GRID[1][col], TABLE_GRID[2][col]
    ];
    const z = makeZone('sixline', nums, 'Sechserlinie',
      col * CELL_W - SPLIT_W / 2, CELL_H * 3, SPLIT_W, STREET_H, 'sixline');
    stage.appendChild(z);
  }

  // Spalten-Wetten (2:1), rechts
  els.colBtns.innerHTML = '';
  els.colBtns.style.height = (CELL_H * 3) + 'px';
  for (let row = 0; row < 3; row++) {
    const btn = document.createElement('div');
    btn.className = 'outbet colbet';
    btn.textContent = '2:1';
    btn.style.height = CELL_H + 'px';
    btn.style.width = COL_BTN_W + 'px';
    btn.addEventListener('click', () => onZoneClick(btn, 'column', TABLE_GRID[row].slice()));
    els.colBtns.appendChild(btn);
  }

  // Dutzend
  els.dozensRow.innerHTML = '';
  const dozenLabels = ['1 – 12', '13 – 24', '25 – 36'];
  const dozenTitles = ['1. Dutzend (1-12)', '2. Dutzend (13-24)', '3. Dutzend (25-36)'];
  for (let i = 0; i < 3; i++) {
    const btn = document.createElement('div');
    btn.className = 'outbet dozen';
    btn.textContent = dozenLabels[i];
    btn.title = dozenTitles[i];
    btn.style.width = (CELL_W * 4) + 'px';
    btn.addEventListener('click', () => onZoneClick(btn, 'dozen', dozenNumbers(i)));
    els.dozensRow.appendChild(btn);
  }

  // Außenwetten
  els.outsideRow.innerHTML = '';
  const outside = [
    { label: '1-18', type: 'highlow', nums: lowNumbers() },
    { label: 'GERADE', type: 'evenodd', nums: evenNumbers() },
    { label: 'ROT', type: 'redblack', nums: redNumbers(), cls: 'red' },
    { label: 'SCHWARZ', type: 'redblack', nums: blackNumbers(), cls: 'black' },
    { label: 'UNGERADE', type: 'evenodd', nums: oddNumbers() },
    { label: '19-36', type: 'highlow', nums: highNumbers() }
  ];
  outside.forEach(o => {
    const btn = document.createElement('div');
    btn.className = 'outbet wide ' + (o.cls || '');
    btn.textContent = o.label;
    btn.style.width = (CELL_W * 2) + 'px';
    btn.addEventListener('click', () => onZoneClick(btn, o.type, o.nums));
    els.outsideRow.appendChild(btn);
  });
}

function onZoneClick(el, type, numbers) {
  if (S.spinning) return;
  if (!canPlaceBet(S.chip)) {
    flashMessage('Nicht genug Guthaben für diesen Einsatz.');
    return;
  }
  const bet = placeBet(type, numbers, S.chip, el.title || el.textContent);
  spawnChipMarker(el, bet.amount);
  updateBalanceUI();
}

function spawnChipMarker(el, amount) {
  let marker = el.querySelector('.chip-marker');
  if (!marker) {
    marker = document.createElement('div');
    marker.className = 'chip-marker';
    el.appendChild(marker);
  }
  marker.dataset.amt = amount;
  marker.classList.remove('pop');
  void marker.offsetWidth;
  marker.classList.add('pop');
}

function renderActiveBets() {
  document.querySelectorAll('.chip-marker').forEach(m => m.remove());
  updateBalanceUI();
}

function updateBalanceUI() {
  els.bal.textContent = S.bal.toFixed(0) + ' €';
  els.staked.textContent = totalStaked().toFixed(0) + ' €';
}

function setControlsEnabled(enabled) {
  els.spinBtn.disabled = !enabled;
  els.clearBtn.disabled = !enabled;
  els.undoBtn.disabled = !enabled;
  document.querySelectorAll('.zone, .cell, .outbet, #zeroCell, .chip')
    .forEach(el => el.classList.toggle('disabled', !enabled));
}

let msgTimer = null;
function flashMessage(text) {
  els.result.textContent = text;
  els.result.className = 'result-banner info open';
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => els.result.classList.remove('open'), 2200);
}

function showResult(winningNumber, totalReturn, stake, winningBets) {
  const net = totalReturn - stake;
  const color = numColor(winningNumber);
  const colorLabel = color === 'green' ? 'Grün' : color === 'red' ? 'Rot' : 'Schwarz';
  let text = `${winningNumber} (${colorLabel}) — `;
  text += net > 0 ? `Gewinn: +${net.toFixed(0)} €` : net === 0 ? 'Unentschieden' : `Verlust: ${net.toFixed(0)} €`;
  els.result.textContent = text;
  els.result.className = 'result-banner open ' + (net > 0 ? 'win' : net < 0 ? 'lose' : 'push');
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => els.result.classList.remove('open'), 3200);
}

function renderHistory() {
  els.history.innerHTML = '';
  S.history.forEach(n => {
    const d = document.createElement('div');
    d.className = 'hist-chip ' + numColor(n);
    d.textContent = n;
    els.history.appendChild(d);
  });
}

function showBrokeModal() {
  els.broke.classList.add('open');
}

document.addEventListener('DOMContentLoaded', () => {
  initWheel($('wheelCanvas'), $('ballCanvas'));
  initUI();
});
