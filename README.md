# zuschnitt.

**Wie viele Platten brauchst du, und wie schneidest du sie?** zuschnitt. plant den Zuschnitt von Platten und Latten mit wenig Verschnitt.

Wer im Baumarkt Platten oder Latten kauft, will vorher wissen, wie viele es sein müssen. Brauchbare Zuschnittplaner sind Web-Dienste mit Konto oder Abo, Desktop-Programme nur für Windows oder Werkzeuge für Entwickler. Einfache Rechnungen vergessen oft die Schnittfuge: Drei Stücke à 800 mm passen nicht in eine 2400 mm Latte, wenn das Sägeblatt 4 mm frisst. zuschnitt. rechnet die Fuge mit, zeigt den Schnittplan als Zeichnung und lässt sich drucken.

Reine Rechnung, keine KI, kein Server. Alles bleibt auf deinem Handy.

<p align="center">
  <img src="bilder/1-uebersicht.png" width="240" alt="">
  <img src="bilder/2-breit.png" width="480" alt="">
</p>

## Warum

Bezahlte Zuschnittplaner wie CutList Optimizer oder MaxCut sind für Gelegenheitsbastler oft zu viel: Konto, Abo, Grenzen in der kostenlosen Stufe, teils nur für Windows. zuschnitt. ist eine einzelne Seite im Browser: öffnen, Maße eintippen, Plan sehen, drucken. Der Mehrwert ist Zugänglichkeit, nicht ein besserer Algorithmus.

## Funktionen

- **Projekte** anlegen, umbenennen und löschen, jeweils für Platten (2D) oder Latten (1D)
- **Rohmaterial**: ein Format pro Projekt, Schnittfuge in mm (Standard 4), optional Preis pro Stück
- **Teileliste** mit Name, Länge, Breite, Anzahl und bei Platten dem Schalter „Maserung beachten“ (Teil darf nicht gedreht werden)
- **Ergebnis**: Anzahl Platten oder Latten, Ausnutzung in Prozent, Kosten, Liste der Teile, die nicht passen, mit Grund
- **Schnittplan** als maßstäbliche Zeichnung pro Platte oder Latte, Teile mit Name und Maß, Reststücke mit Maß
- **Druckansicht**, ein Plan pro Seite
- **Export und Import** als JSON-Datei, Import fügt hinzu und überschreibt nichts
- **Beispielprojekte**, mit einem Klick entfernbar
- Hell und dunkel, funktioniert offline, installierbar als App

## Datenschutz

Nichts verlässt dein Gerät. zuschnitt. hat keinen Server, kein Konto, keine Analyse, keine Werbung und lädt nichts aus dem Netz nach. Deine Projekte liegen nur im lokalen Speicher deines Browsers (`localStorage`). Exporte entstehen nur, wenn du sie selbst auslöst.

Weil die Daten nur im Browser liegen: Wer die Websitedaten löscht, löscht auch seine Projekte. Exportiere wichtige Projekte ab und zu.

## Installation

zuschnitt. ist eine statische Web-App. Es gibt keinen Build-Schritt und keine Abhängigkeiten.

1. Den Ordner `zuschnitt/` auf einen beliebigen statischen Host legen (eigener Webspace, GitHub Pages, Netlify, ein Raspberry Pi). Für die Installation als App ist HTTPS nötig.
2. Die Adresse im Handybrowser öffnen.
3. Im Browsermenü **Zum Startbildschirm hinzufügen** wählen. Danach startet zuschnitt. wie eine App und funktioniert auch ohne Netz.

Lokal testen:

```
cd zuschnitt
python3 -m http.server 8000
```

Dann `http://localhost:8000` im Browser öffnen.

## Wie gerechnet wird

Alle Maße sind ganze Millimeter. Teile werden nach Anzahl in Einzelstücke aufgelöst. Die Rechenfunktionen in `zuschnitt.js` sind reine Funktionen ohne Abhängigkeiten.

**Latten.** First Fit Decreasing: Stücke nach Länge absteigend, bei Gleichstand in Eingabereihenfolge. Jede Latte merkt sich, wie viel schon belegt ist. Ein Stück der Länge `l` passt, wenn `belegt + l` höchstens die Lattenlänge ergibt. Danach wächst `belegt` um `l` plus Fuge. Das Stück kommt in die erste passende Latte, sonst in eine neue. Beispiel: 3 × 800 mm in einer 2400 mm Latte mit 4 mm Fuge. Zwei Stücke belegen 1608 mm, das dritte bräuchte 2408 mm und kommt in die zweite Latte.

**Platten.** Guillotine-Schnitte mit einer Liste freier Rechtecke. Stücke nach Fläche absteigend. Für jedes Stück wird unter allen offenen Platten und freien Rechtecken die Lage mit der kleinsten Restfläche gewählt, bei Gleichstand mit der kleineren kurzen Restseite. Ungedreht und, wenn die Maserung es erlaubt, gedreht. Findet sich nichts, kommt eine neue Platte. Nach dem Ablegen oben links wird das freie Rechteck in zwei neue geteilt, jeweils um die Fuge verkleinert.

**Kennzahlen.** Ausnutzung = Summe der Teilflächen (bei Latten Teillängen) ÷ Gesamtfläche (bzw. Gesamtlänge) aller verwendeten Rohstücke, eine Nachkommastelle. Kosten = Anzahl × Preis.

**Grenzen, offen benannt:**

- Die Rechnung ist eine Heuristik. Sie liefert gute Pläne, aber keinen Beweis, dass sie die besten sind. Manchmal braucht sie ein Rohstück mehr als nötig.
- Nur Guillotine-Schnitte, kein Besäumen der Plattenkanten, keine Schnittreihenfolge, kein Kantenband.
- Ein Rohformat pro Projekt, keine Reststücke als Bestand, keine Zoll-Einheiten.
- Höchstens 500 Stücke pro Projekt.
- Echte Baumarktplatten haben unsaubere Kanten. Wähle die Fuge lieber großzügig.

Die Rechenfunktionen sind mit `node test-calc.js` gegen Handrechnungen getestet.

## Lizenz

GNU Affero General Public License v3.0 (AGPL-3.0), siehe `LICENSE`.

---

**gedacht.gemacht.** Kleine, ehrliche Software. Alles bleibt auf deinem Gerät.
