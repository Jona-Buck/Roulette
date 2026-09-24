'use strict';

const S = {
  bal: STARTING_BALANCE,
  chip: CHIP_VALUES[1],   // aktuell gewählter Chip-Wert
  spinning: false,
  history: []             // letzte Gewinnzahlen, neueste zuerst
};

const SPIN_DURATION_MS = 5000;

function canPlaceBet(amount) {
  return !S.spinning && (totalStaked() + amount) <= S.bal;
}

function doSpin() {
  if (S.spinning) return;
  const stake = totalStaked();
  if (stake <= 0) {
    flashMessage('Bitte zuerst einen Einsatz platzieren.');
    return;
  }
  if (stake > S.bal) {
    flashMessage('Einsatz übersteigt Guthaben.');
    return;
  }

  S.spinning = true;
  S.bal -= stake;
  updateBalanceUI();
  setControlsEnabled(false);

  // Jede Zahl 0-36 ist genau einmal im Kessel vertreten -> Gleichverteilung
  const winningNumber = WHEEL_ORDER[Math.floor(Math.random() * WHEEL_ORDER.length)];

  spinBallTo(winningNumber, SPIN_DURATION_MS, () => {
    const { totalReturn, winningBets } = calcWinnings(winningNumber);
    S.bal += totalReturn;
    S.history.unshift(winningNumber);
    if (S.history.length > 20) S.history.pop();

    updateBalanceUI();
    renderHistory();
    showResult(winningNumber, totalReturn, stake, winningBets);

    clearBets();
    renderActiveBets();
    S.spinning = false;
    setControlsEnabled(true);

    if (S.bal < CHIP_VALUES[0]) {
      showBrokeModal();
    }
  });
}
