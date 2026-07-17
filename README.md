# Roulette – Europäischer Roulette-Simulator (Spielgeld)

Browserbasierter Roulette-Simulator mit Spielgeld, analog zum [Book-of-Ra-Projekt](https://github.com/Jona-Buck/book-of-ra).
Kein Echtgeld-Glücksspiel.

## Variante
Europäisch (1x Zero, 37 Zahlen, Kesselreihenfolge original).

## Struktur
```
index.html         Grundgerüst der Seite
css/style.css       Gesamtes Styling (Tisch, Kessel, Chips)
js/config.js        Kesselreihenfolge, Farben, Auszahlungsquoten
js/bets.js          Wett-Logik (Platzieren, Undo, Auszahlung berechnen)
js/wheel.js         Kessel-Rendering (Canvas) + Ball-Spin-Animation
js/engine.js        Spielzustand & Spin-Ablauf
js/ui.js            Tisch-Aufbau (Zonen-Geometrie), Event-Wiring, Rendering
```

## Unterstützte Wetten
Straight (Vollzahl), Split, Straße (3er), Ecke (4er), Sechserlinie (6er),
Kolonne (2:1), Dutzend (2:1), Rot/Schwarz, Gerade/Ungerade, 1-18/19-36.

## Branch-Workflow
Entwicklung erfolgt ausschließlich im Branch `claude`. `main` ist geschützt
und wird nur per Pull Request nach Test/Review aktualisiert – identisch zum
Book-of-Ra-Projekt.

## Live
Nach Merge nach `main` und Aktivierung von GitHub Pages erreichbar unter:
`https://jona-buck.github.io/Roulette/`

## Roadmap
- GitHub Pages aktivieren (main)
- Firebase-Integration (optional, wie bei Book of Ra)
- Sound-System
- Basket-Bet (0/1/2/3) für europäische Sonderregeln
