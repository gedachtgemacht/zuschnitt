# zuschnitt.

Plane den Zuschnitt von Platten und Latten mit wenig Verschnitt, offline im Browser.

## Problem

Wer im Baumarkt Platten oder Latten kauft, will wissen: Wie viele brauche ich, und wie schneide ich sie, damit wenig übrig bleibt? Dafür gibt es Zuschnittplaner, aber die brauchbaren sind Web-Dienste mit Konto, Abo oder Grenzen in der kostenlosen Stufe, oder Desktop-Programme nur für Windows. Die offenen Alternativen laufen nur mit Entwicklerwerkzeugen. Oft vergessen einfache Rechnungen die Schnittfuge: Drei Stücke à 800 mm passen eben nicht in eine 2400 mm Latte, wenn das Sägeblatt 4 mm frisst.

## Zielgruppe

Heimwerker, Möbelbauer im Hobbykeller, Leute mit Tauchsäge oder Handkreissäge, die vor dem Einkauf oder am Zuschnitttisch auf dem Handy planen. Kein CNC, keine Industrie.

## Vorbild und Abgrenzung

- **CutList Optimizer** (Web-Dienst): Platten und Latten, Schnittfuge, Maserung, Grafik. Kostenlose Stufe mit Grenzen, mehr nur gegen Bezahlung im Abo, Konto für Speichern. Preise wechseln, beim Schreiben nicht nachgeprüft.
- **MaxCut** (Windows): kostenlose Community Edition, Business Edition laut Vergleichsportalen etwa 20 USD im Monat oder 200 USD im Jahr. Nicht auf dem Handy.
- **Offene Projekte**: freecut (Rust, Schnittfuge, Musterrichtung, deutsche Oberfläche, muss selbst gebaut werden), opcut (Python, Kommandozeile), cutlayout (Kommandozeile, Solver-Build). Inhaltlich kommt freecut nah heran.

zuschnitt. ist eine einzelne Seite im Browser: öffnen, Maße eintippen, Plan sehen, drucken. Ohne Installation, ohne Konto, offline als PWA, auf Deutsch. Der Mehrwert ist Zugänglichkeit, nicht ein besserer Algorithmus. Die Heuristik liefert gute, aber nicht beweisbar optimale Pläne, und das steht auch so in der Oberfläche.

## Funktionen v1

- Projekte anlegen, umbenennen, löschen. Jedes Projekt ist entweder **Platten** (2D) oder **Latten** (1D).
- Rohmaterial: ein Format pro Projekt (Platte: Länge × Breite, Latte: Länge), Schnittfuge in mm (Standard 4), optional Preis pro Stück.
- Teileliste: Name, Länge, (Breite), Anzahl, bei Platten Schalter „Maserung beachten“ (Teil darf nicht gedreht werden).
- Berechnen: Anzahl Platten bzw. Latten, Ausnutzung in %, Kosten, Liste nicht platzierbarer Teile mit Grund.
- Schnittplan als SVG pro Platte bzw. Latte, Teile beschriftet mit Name und Maß, Reststücke schraffiert mit Maß.
- Druckansicht (CSS `@media print`), ein Plan pro Seite.
- Export und Import als JSON-Datei, Beispielprojekt mit einem Klick entfernbar.
- Hinweis in der Ergebnisansicht: „Heuristik: guter Plan, nicht garantiert der beste.“

## Nicht-Ziele

- Mehrere Rohformate oder Reststücke als Bestand in einem Projekt.
- Nummerierte Schnittreihenfolge, Besäumung der Plattenkanten, Kantenband.
- Nicht-Guillotine-Schnitte, CNC-Export (DXF, G-Code), Optimalitätsbeweis.
- Konten, Sync, Teilen über Server, Zoll-Einheiten.

## Daten und Format

Alle Maße als ganze Millimeter. Speicher: `localStorage`, Schlüssel `zuschnitt.v1`, ein JSON-Objekt:

```json
{
  "version": 1,
  "projekte": [{
    "id": "p1", "name": "Regal", "art": "platte", "beispiel": true,
    "material": { "laenge": 2800, "breite": 2070, "fuge": 4, "preis": 39.90 },
    "teile": [{ "id": "t1", "name": "Seite", "laenge": 1800, "breite": 300, "anzahl": 2, "maserung": true }]
  }]
}
```

Bei `art: "latte"` fehlen `material.breite`, `teile[].breite` und `maserung`. Export ist genau dieses Objekt als `zuschnitt-JJJJ-MM-TT.json`. Import prüft `version` und Felder, lehnt Unbekanntes mit Meldung ab und fügt Projekte mit neuen IDs hinzu (überschreibt nichts). Ergebnisse werden nicht gespeichert, sondern neu berechnet.

## Rechenlogik

Reine Funktionen in `zuschnitt.js` (klassisches Skript, im Browser global, in Node über `module.exports`), keine Abhängigkeiten. Teile werden nach `anzahl` in Einzelstücke aufgelöst.

**Latten, `planeLatten(laenge, fuge, teile)`**: First Fit Decreasing. Stücke nach Länge absteigend, bei Gleichstand in Eingabereihenfolge. Jede Latte hat `belegt` (Start 0). Ein Stück `l` passt, wenn `belegt + l <= laenge`; danach `belegt += l + fuge`. Das Stück kommt in die erste passende Latte, sonst in eine neue. Rest einer Latte `= max(0, laenge - belegt)`. Stück länger als `laenge`: nicht platzierbar.

**Platten, `planePlatten(laenge, breite, fuge, teile)`**: Guillotine mit Liste freier Rechtecke. x läuft entlang der Plattenlänge, die Maserung der Platte liegt in x. Stücke nach Fläche absteigend, dann längere Seite absteigend, dann Eingabereihenfolge.
1. Für jedes Stück alle offenen Platten (in Reihenfolge), alle freien Rechtecke (in Listenreihenfolge), Lage ungedreht (`l` in x) und, wenn `maserung` falsch, gedreht. Passt, wenn `pw <= fw` und `ph <= fh`.
2. Wahl: kleinste Restfläche `fw*fh - pw*ph`, dann kleinere kurze Restseite `min(fw-pw, fh-ph)`, dann frühere Platte, früheres Rechteck, ungedreht vor gedreht. Kein Treffer: neue Platte.
3. Ablage oben links im Rechteck. Wenn `fw-pw < fh-ph`: erst waagerecht schneiden, rechts `(x+pw+fuge, y, fw-pw-fuge, ph)`, unten `(x, y+ph+fuge, fw, fh-ph-fuge)`. Sonst erst senkrecht, rechts `(x+pw+fuge, y, fw-pw-fuge, fh)`, unten `(x, y+ph+fuge, pw, fh-ph-fuge)`. Rechtecke mit Breite oder Höhe `<= 0` entfallen. Das benutzte Rechteck wird entfernt, die neuen hinten angehängt (rechts vor unten). Kein Zusammenfügen freier Rechtecke.

Kennzahlen: Ausnutzung `= Summe Teilflächen (bzw. Teillängen) / (Anzahl Rohstücke × Rohfläche bzw. Rohlänge)`, eine Nachkommastelle. Kosten `= Anzahl × preis`.

**Testvektoren**

- L1: Latte 2400, Fuge 4, 3 × 800. Latte 1: 800, 800 (belegt 1608, dritte: 1608 + 800 = 2408 > 2400), Rest 792. Latte 2: 800, Rest 1596. Ergebnis 2 Latten, Ausnutzung 50,0 %.
- L2: Latte 2000, Fuge 3, Teile 1200, 700, 500 × 2, 300. Latte 1: 1200, 700, Rest 94. Latte 2: 500, 500, 300, Rest 694. 2 Latten, 80,0 %.
- L3: Latte 2400, Fuge 4, 2 × 1198: beide in Latte 1, Rest 0. Teil 2500: nicht platzierbar.
- P1: Platte 2000 × 1000, Fuge 4, 2 × 1000 × 500, Maserung beachten. Stück 1 auf (0,0); frei: (1004,0,996,1000), (0,504,1000,496). Stück 2 passt in keines, also Platte 2 auf (0,0). Ergebnis 2 Platten, 25,0 %.
- P2: wie P1, Maserung egal. Stück 1 gedreht 500 × 1000 auf (0,0) (kurze Restseite 0 statt 500); frei (504,0,1496,1000). Stück 2 gedreht auf (504,0); frei (1008,0,992,1000). 1 Platte, 50,0 %.
- P3: Platte 1000 × 600, Fuge 0, Maserung beachten, A 600 × 400, 2 × B 400 × 200. A auf (0,0), B auf (0,400), B auf (600,0). Frei am Ende: (400,400,200,200), (600,200,400,400). 1 Platte, 66,7 %.
- P4: Platte 2000 × 1000, Teil 2100 × 300 ohne Maserung: nicht platzierbar (auch gedreht zu groß).

## Demoseite

`index.html`, Handy zuerst, eine Spalte bis 720 px, darüber zwei Spalten (Eingabe links, Plan rechts).
- **Projekte**: Liste mit Name, Art, Anzahl Teile; neues Projekt (Platten oder Latten), Beispielprojekt mit Marke `Beispiel` und Knopf „Beispiel entfernen“; Export und Import.
- **Projekt**: Rohmaterial mit Fuge und Preis, Teileliste mit Zeilen zum Hinzufügen und Löschen, Eingaben `inputmode="numeric"`, Fehler direkt am Feld.
- **Plan**: Kennzahlen oben in `--mono` (rohstücke, ausnutzung, kosten), Heuristik-Hinweis, nicht platzierbare Teile, darunter SVG pro Rohstück, maßstäblich, Maserung als feine Linien angedeutet. Knopf „Drucken“.
Hausstil mit Tokens hell und dunkel, Name `zuschnitt.` mit Punkt in `--ac`. PWA mit `manifest.webmanifest`, `sw.js` (alle Dateien vorab im Cache), `icon.svg` (dunkles Quadrat, lila Linien: Platte mit Schnittlinien und Säge-Zahnreihe, runde Enden).

## Testplan

- `node --test`: alle Testvektoren L1 bis P4 exakt (Positionen, Drehung, Reste, Anzahl, Ausnutzung), dazu: Fuge 0 gegen Fuge 4, Anzahl 0 und negative Maße werden abgelehnt, kein Stück überlappt ein anderes, alle Stücke liegen in der Platte, Abstand zwischen Nachbarn mindestens Fuge, Ergebnis ist bei gleicher Eingabe identisch.
- Import und Export: Rundreise ergibt gleiches Objekt, kaputte Datei gibt Meldung und ändert nichts.
- Browsertest bei 390 px und 1280 px, hell und dunkel: Beispielprojekt rechnen, Plan sichtbar, kein waagerechtes Scrollen, Druckvorschau ein Plan pro Seite.
- Offline-Test: nach erstem Laden Netz aus, Seite lädt und rechnet.
- Keine externen Requests: Netzwerkprotokoll der Seite enthält nur eigene Dateien.

## Risiken

- Die Heuristik findet manchmal Pläne mit einer Platte mehr als nötig. Ehrlich kennzeichnen, nicht „optimal“ nennen.
- freecut deckt fachlich viel ab; der Mehrwert hängt an guter Bedienung auf dem Handy und der Druckansicht.
- Große Teilelisten (über ein paar hundert Stücke) können auf alten Handys spürbar dauern; v1 rechnet synchron und begrenzt auf 500 Stücke mit Meldung.
- Echte Baumarktplatten haben unsaubere Kanten; ohne Besäumung kann der Plan am Rand knapp werden. Hinweis in der Hilfe, Fuge großzügig wählen.
