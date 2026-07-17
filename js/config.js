'use strict';

// Europäische Kesselreihenfolge (37 Felder, 1x Zero)
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function numColor(n) {
  if (n === 0) return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}

// Tisch-Layout: 3 Reihen x 12 Spalten. Reihe 0 = oben (3,6,9...36), Reihe 2 = unten (1,4,7...34)
// grid[row][col] -> Zahl
const TABLE_GRID = [[],[],[]];
for (let col = 0; col < 12; col++) {
  TABLE_GRID[0][col] = col * 3 + 3; // oben
  TABLE_GRID[1][col] = col * 3 + 2; // mitte
  TABLE_GRID[2][col] = col * 3 + 1; // unten
}

const CHIP_VALUES = [1, 5, 10, 25, 100];

// Auszahlungsquoten (Gewinn-Multiplikator, OHNE Einsatzrückgabe -> wird in bets.js addiert)
const PAYOUTS = {
  straight: 35,
  split: 17,
  street: 11,
  corner: 8,
  sixline: 5,
  column: 2,
  dozen: 2,
  redblack: 1,
  evenodd: 1,
  highlow: 1
};

const STARTING_BALANCE = 1000;
