'use strict';

// Ein platzierter Einsatz: { key, type, numbers:[...], amount, label }
let PLACED_BETS = [];   // Reihenfolge = Historie für Undo
let BET_MAP = {};       // key -> Referenz auf Objekt in PLACED_BETS (schnelles Stacking)

function betKey(type, numbers) {
  return type + ':' + numbers.slice().sort((a, b) => a - b).join(',');
}

function placeBet(type, numbers, amount, label) {
  const key = betKey(type, numbers);
  if (BET_MAP[key]) {
    BET_MAP[key].amount += amount;
  } else {
    const bet = { key, type, numbers: numbers.slice(), amount, label };
    PLACED_BETS.push(bet);
    BET_MAP[key] = bet;
  }
  return BET_MAP[key];
}

function undoLastBet() {
  const last = PLACED_BETS.pop();
  if (!last) return null;
  delete BET_MAP[last.key];
  return last;
}

function clearBets() {
  PLACED_BETS = [];
  BET_MAP = {};
}

function totalStaked() {
  return PLACED_BETS.reduce((sum, b) => sum + b.amount, 0);
}

// Gibt { totalReturn, winningBets } zurück. totalReturn = Einsatz + Gewinn für alle treffenden Wetten.
function calcWinnings(winningNumber) {
  let totalReturn = 0;
  const winningBets = [];
  for (const bet of PLACED_BETS) {
    if (bet.numbers.includes(winningNumber)) {
      const mult = PAYOUTS[bet.type];
      const ret = bet.amount + bet.amount * mult; // Einsatz + Gewinn
      totalReturn += ret;
      winningBets.push({ ...bet, returned: ret });
    }
  }
  return { totalReturn, winningBets };
}

// --- Hilfsfunktionen zur Erzeugung der Zahlen-Sets für Außenwetten ---

function columnNumbers(colIndexFromRight) {
  // colIndexFromRight: 0 = Reihe unten (1,4,7...34), 1 = Mitte, 2 = oben
  const row = 2 - colIndexFromRight;
  return TABLE_GRID[row].slice();
}

function dozenNumbers(dozenIndex) {
  // 0 = 1-12, 1 = 13-24, 2 = 25-36
  const start = dozenIndex * 12 + 1;
  return Array.from({ length: 12 }, (_, i) => start + i);
}

function redNumbers() { return Array.from(RED_NUMBERS); }
function blackNumbers() {
  const arr = [];
  for (let n = 1; n <= 36; n++) if (!RED_NUMBERS.has(n)) arr.push(n);
  return arr;
}
function evenNumbers() { return Array.from({length:18}, (_,i)=>(i+1)*2); }
function oddNumbers() { return Array.from({length:18}, (_,i)=>i*2+1); }
function lowNumbers() { return Array.from({length:18}, (_,i)=>i+1); }
function highNumbers() { return Array.from({length:18}, (_,i)=>i+19); }
