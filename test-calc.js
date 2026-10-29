// Tests für den Rechenkern von zuschnitt. Aufruf: node test-calc.js oder node --test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Z = require('./zuschnitt.js');

const teil = (laenge, anzahl = 1, name = 'T') => ({ name, laenge, anzahl });
const pt = (laenge, breite, anzahl = 1, maserung = false, name = 'T') => ({ name, laenge, breite, anzahl, maserung });
const laengen = (latte) => latte.stuecke.map((s) => s.laenge);
const lage = (s) => [s.x, s.y, s.w, s.h];
const rechteck = (f) => [f.x, f.y, f.w, f.h];

/* ---------- Testvektoren Latten ---------- */

test('L1: 3 × 800 in 2400 mit Fuge 4 braucht 2 Latten', () => {
  const e = Z.planeLatten(2400, 4, [teil(800, 3)]);
  assert.equal(e.anzahl, 2);
  assert.deepEqual(laengen(e.latten[0]), [800, 800]);
  assert.equal(e.latten[0].belegt, 1608);
  assert.equal(e.latten[0].rest, 792);
  assert.deepEqual(e.latten[0].stuecke.map((s) => s.x), [0, 804]);
  assert.deepEqual(laengen(e.latten[1]), [800]);
  assert.equal(e.latten[1].rest, 1596);
  assert.equal(e.ausnutzung, 50.0);
  assert.deepEqual(e.nichtPlatzierbar, []);
});

test('L2: gemischte Längen mit Fuge 3', () => {
  const e = Z.planeLatten(2000, 3, [teil(1200), teil(700), teil(500, 2), teil(300)]);
  assert.equal(e.anzahl, 2);
  assert.deepEqual(laengen(e.latten[0]), [1200, 700]);
  assert.equal(e.latten[0].rest, 94);
  assert.deepEqual(laengen(e.latten[1]), [500, 500, 300]);
  // Nach der Regel im Scope: belegt = 3 × Fuge + 1300 = 1309, Rest = 2000 - 1309 = 691.
  // Der Scope nennt hier 694 (Fuge nach dem letzten Stück nicht gezählt). Das passt nicht
  // zu seiner eigenen Regel und zu Latte 1 (94), also gilt die Regel.
  assert.equal(e.latten[1].belegt, 1309);
  assert.equal(e.latten[1].rest, 691);
  assert.equal(e.ausnutzung, 80.0);
});

test('L3: Stücke füllen die Latte exakt, zu langes Teil ist nicht platzierbar', () => {
  const e = Z.planeLatten(2400, 4, [teil(1198, 2, 'A'), teil(2500, 1, 'Lang')]);
  assert.equal(e.anzahl, 1);
  assert.deepEqual(laengen(e.latten[0]), [1198, 1198]);
  assert.equal(e.latten[0].rest, 0);
  assert.equal(e.nichtPlatzierbar.length, 1);
  assert.equal(e.nichtPlatzierbar[0].name, 'Lang');
  assert.match(e.nichtPlatzierbar[0].grund, /länger/);
});

/* ---------- Testvektoren Platten ---------- */

test('P1: Maserung beachten, 2 Platten', () => {
  const e = Z.planePlatten(2000, 1000, 4, [pt(1000, 500, 2, true)]);
  assert.equal(e.anzahl, 2);
  assert.deepEqual(lage(e.platten[0].stuecke[0]), [0, 0, 1000, 500]);
  assert.equal(e.platten[0].stuecke[0].gedreht, false);
  assert.deepEqual(e.platten[0].frei.map(rechteck), [[1004, 0, 996, 1000], [0, 504, 1000, 496]]);
  assert.deepEqual(lage(e.platten[1].stuecke[0]), [0, 0, 1000, 500]);
  assert.equal(e.ausnutzung, 25.0);
});

test('P2: Maserung egal, beide gedreht auf 1 Platte', () => {
  const e = Z.planePlatten(2000, 1000, 4, [pt(1000, 500, 2, false)]);
  assert.equal(e.anzahl, 1);
  const [a, b] = e.platten[0].stuecke;
  assert.deepEqual(lage(a), [0, 0, 500, 1000]);
  assert.equal(a.gedreht, true);
  assert.deepEqual(lage(b), [504, 0, 500, 1000]);
  assert.equal(b.gedreht, true);
  assert.deepEqual(e.platten[0].frei.map(rechteck), [[1008, 0, 992, 1000]]);
  assert.equal(e.ausnutzung, 50.0);
});

test('P3: Fuge 0, drei Teile, Reste wie von Hand gerechnet', () => {
  const e = Z.planePlatten(1000, 600, 0, [pt(600, 400, 1, true, 'A'), pt(400, 200, 2, true, 'B')]);
  assert.equal(e.anzahl, 1);
  const st = e.platten[0].stuecke;
  assert.deepEqual(st.map((s) => s.name), ['A', 'B', 'B']);
  assert.deepEqual(st.map((s) => [s.x, s.y]), [[0, 0], [0, 400], [600, 0]]);
  assert.deepEqual(e.platten[0].frei.map(rechteck), [[400, 400, 200, 200], [600, 200, 400, 400]]);
  assert.equal(e.ausnutzung, 66.7);
});

test('P4: zu großes Teil ist auch gedreht nicht platzierbar', () => {
  const e = Z.planePlatten(2000, 1000, 4, [pt(2100, 300, 1, false, 'Zu lang')]);
  assert.equal(e.anzahl, 0);
  assert.equal(e.ausnutzung, 0);
  assert.equal(e.nichtPlatzierbar.length, 1);
  assert.match(e.nichtPlatzierbar[0].grund, /auch gedreht/);
});

test('Teil passt nur gedreht, Maserung verbietet es', () => {
  const e = Z.planePlatten(2000, 1000, 4, [pt(800, 1500, 1, true, 'Hoch')]);
  assert.equal(e.anzahl, 0);
  assert.match(e.nichtPlatzierbar[0].grund, /Maserung/);
  const f = Z.planePlatten(2000, 1000, 4, [pt(800, 1500, 1, false, 'Hoch')]);
  assert.equal(f.anzahl, 1);
  assert.equal(f.platten[0].stuecke[0].gedreht, true);
});

/* ---------- Fuge ---------- */

test('Fuge 0 gegen Fuge 4', () => {
  assert.equal(Z.planeLatten(2400, 0, [teil(800, 3)]).anzahl, 1);
  assert.equal(Z.planeLatten(2400, 4, [teil(800, 3)]).anzahl, 2);
  assert.equal(Z.planePlatten(1000, 1000, 0, [pt(500, 500, 4)]).anzahl, 1);
  // mit Fuge bleiben neben 500 nur 496 mm, jedes Stück braucht eine eigene Platte
  assert.equal(Z.planePlatten(1000, 1000, 4, [pt(500, 500, 4)]).anzahl, 4);
});

/* ---------- Ablehnung ungültiger Eingaben ---------- */

test('Anzahl 0 und negative Maße werden abgelehnt', () => {
  assert.throws(() => Z.planeLatten(2400, 4, [teil(800, 0)]), RangeError);
  assert.throws(() => Z.planeLatten(2400, 4, [teil(-800, 1)]), RangeError);
  assert.throws(() => Z.planeLatten(-2400, 4, [teil(800, 1)]), RangeError);
  assert.throws(() => Z.planeLatten(2400, -1, [teil(800, 1)]), RangeError);
  assert.throws(() => Z.planeLatten(2400, 4, [teil(80.5, 1)]), RangeError);
  assert.throws(() => Z.planePlatten(2000, 1000, 4, [pt(100, -5)]), RangeError);
  assert.throws(() => Z.planePlatten(2000, 0, 4, [pt(100, 100)]), RangeError);
  assert.throws(() => Z.planePlatten(2000, 1000, 4, [pt(100, 100, 0)]), RangeError);
});

test('Mehr als 500 Stücke werden abgelehnt', () => {
  assert.throws(() => Z.planeLatten(2400, 4, [teil(100, 501)]), /500/);
  assert.doesNotThrow(() => Z.planeLatten(2400, 4, [teil(100, 500)]));
});

test('pruefeProjekt meldet Fehler am Feld', () => {
  const p = {
    id: 'p1', name: 'X', art: 'platte',
    material: { laenge: 2800, breite: 0, fuge: 4, preis: null },
    teile: [{ id: 't1', name: 'A', laenge: 100, breite: 100, anzahl: 0, maserung: false }]
  };
  const felder = Z.pruefeProjekt(p).map((f) => f.feld);
  assert.deepEqual(felder, ['material.breite', 'teile.0.anzahl']);
  assert.ok(Z.berechne(p).fehler);
});

/* ---------- Eigenschaften mit Zufallsdaten ---------- */

function zufall(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function zufallsPlatten(seed) {
  const r = zufall(seed);
  const L = 1000 + Math.floor(r() * 2000);
  const B = 500 + Math.floor(r() * 1500);
  const fuge = Math.floor(r() * 6);
  const teile = [];
  const n = 1 + Math.floor(r() * 10);
  for (let i = 0; i < n; i++) {
    teile.push(pt(20 + Math.floor(r() * 1200), 20 + Math.floor(r() * 800), 1 + Math.floor(r() * 4), r() < 0.4, 'T' + i));
  }
  return { L, B, fuge, teile };
}

test('Platten: nichts überlappt, alles liegt in der Platte, Abstand mindestens Fuge', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const { L, B, fuge, teile } = zufallsPlatten(seed);
    const e = Z.planePlatten(L, B, fuge, teile);
    let gezaehlt = 0;
    for (const pl of e.platten) {
      const st = pl.stuecke;
      gezaehlt += st.length;
      for (const s of st) {
        assert.ok(s.x >= 0 && s.y >= 0 && s.x + s.w <= L && s.y + s.h <= B, 'in der Platte, seed ' + seed);
        if (s.maserung) assert.equal(s.gedreht, false);
        assert.deepEqual(s.gedreht ? [s.h, s.w] : [s.w, s.h], [s.laenge, s.breite]);
      }
      for (let i = 0; i < st.length; i++) {
        for (let j = i + 1; j < st.length; j++) {
          const a = st[i], b = st[j];
          const getrennt =
            a.x + a.w + fuge <= b.x || b.x + b.w + fuge <= a.x ||
            a.y + a.h + fuge <= b.y || b.y + b.h + fuge <= a.y;
          assert.ok(getrennt, `Stücke ${i} und ${j} zu nah oder überlappend, seed ${seed}`);
        }
        // freie Rechtecke überlappen kein Stück
        for (const f of pl.frei) {
          const a = st[i];
          const frei = a.x + a.w <= f.x || f.x + f.w <= a.x || a.y + a.h <= f.y || f.y + f.h <= a.y;
          assert.ok(frei, 'freies Rechteck überlappt Stück, seed ' + seed);
        }
      }
    }
    const soll = teile.reduce((s, t) => s + t.anzahl, 0);
    assert.equal(gezaehlt + e.nichtPlatzierbar.length, soll, 'jedes Stück genau einmal, seed ' + seed);
  }
});

test('Latten: Stücke in der Latte, Abstand mindestens Fuge', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const r = zufall(seed);
    const L = 500 + Math.floor(r() * 3000);
    const fuge = Math.floor(r() * 6);
    const teile = [];
    for (let i = 0; i < 1 + Math.floor(r() * 8); i++) teile.push(teil(10 + Math.floor(r() * 1500), 1 + Math.floor(r() * 5)));
    const e = Z.planeLatten(L, fuge, teile);
    for (const la of e.latten) {
      la.stuecke.forEach((s, i) => {
        assert.ok(s.x >= 0 && s.x + s.laenge <= L);
        if (i > 0) {
          const v = la.stuecke[i - 1];
          assert.ok(v.x + v.laenge + fuge <= s.x);
        }
      });
    }
  }
});

test('Ergebnis ist bei gleicher Eingabe identisch', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { L, B, fuge, teile } = zufallsPlatten(seed);
    assert.deepEqual(Z.planePlatten(L, B, fuge, teile), Z.planePlatten(L, B, fuge, teile));
  }
  const t = [teil(1200), teil(700), teil(500, 2), teil(300)];
  assert.deepEqual(Z.planeLatten(2000, 3, t), Z.planeLatten(2000, 3, t));
});

/* ---------- Projekt, Kosten, Import und Export ---------- */

function beispielDaten() {
  return {
    version: 1,
    projekte: [{
      id: 'p1', name: 'Regal', art: 'platte', beispiel: true,
      material: { laenge: 2800, breite: 2070, fuge: 4, preis: 39.9 },
      teile: [{ id: 't1', name: 'Seite', laenge: 1800, breite: 300, anzahl: 2, maserung: true }]
    }, {
      id: 'p2', name: 'Rahmen', art: 'latte',
      material: { laenge: 2400, fuge: 4 },
      teile: [{ id: 't2', name: 'Holm', laenge: 800, anzahl: 3 }]
    }]
  };
}

test('berechne liefert Kosten aus Anzahl × Preis', () => {
  const d = beispielDaten();
  const e = Z.berechne(d.projekte[0]);
  assert.equal(e.anzahl, 1);
  assert.equal(e.kosten, 39.9);
  const l = Z.berechne(d.projekte[1]);
  assert.equal(l.anzahl, 2);
  assert.equal(l.kosten, null);
});

test('Export und Import: Rundreise ergibt das gleiche Objekt', () => {
  const d = beispielDaten();
  assert.deepEqual(JSON.parse(Z.exportiere(d)), d);
  assert.equal(Z.pruefeDaten(d), null);
  let n = 0;
  const r = Z.importiere({ version: 1, projekte: [] }, Z.exportiere(d), (p) => p + 'neu' + (++n));
  assert.equal(r.ok, true);
  assert.equal(r.anzahl, 2);
  // gleiche Inhalte, neue IDs
  const ohneIds = (p) => ({ ...p, id: undefined, teile: p.teile.map((t) => ({ ...t, id: undefined })) });
  assert.deepEqual(r.daten.projekte.map(ohneIds), d.projekte.map(ohneIds));
  assert.notEqual(r.daten.projekte[0].id, 'p1');
});

test('Import fügt hinzu und überschreibt nichts', () => {
  const d = beispielDaten();
  const vorher = JSON.stringify(d);
  let n = 0;
  const r = Z.importiere(d, Z.exportiere(d), (p) => p + 'x' + (++n));
  assert.equal(r.daten.projekte.length, 4);
  assert.equal(JSON.stringify(d), vorher, 'Eingabe bleibt unverändert');
  const ids = r.daten.projekte.map((p) => p.id);
  assert.equal(new Set(ids).size, 4);
});

test('Kaputte Datei gibt Meldung und ändert nichts', () => {
  const d = beispielDaten();
  const vorher = JSON.stringify(d);
  const id = () => 'neu';
  const faelle = [
    '{kaputt',
    '[]',
    JSON.stringify({ version: 2, projekte: [] }),
    JSON.stringify({ version: 1 }),
    JSON.stringify({ version: 1, projekte: [], extra: 1 }),
    JSON.stringify({ version: 1, projekte: [{ id: 'a', name: 'X', art: 'kreis', material: { laenge: 1, fuge: 0 }, teile: [] }] }),
    JSON.stringify({ version: 1, projekte: [{ id: 'a', name: 'X', art: 'latte', material: { laenge: 100, breite: 5, fuge: 0 }, teile: [] }] }),
    JSON.stringify({ version: 1, projekte: [{ id: 'a', name: 'X', art: 'latte', material: { laenge: 100, fuge: 0 }, teile: [{ id: 't', name: 'A', laenge: -1, anzahl: 1 }] }] })
  ];
  for (const text of faelle) {
    const r = Z.importiere(d, text, id);
    assert.equal(r.ok, false, text);
    assert.equal(typeof r.meldung, 'string');
    assert.ok(r.meldung.length > 0);
  }
  assert.equal(JSON.stringify(d), vorher);
});

test('Dateiname enthält das Datum', () => {
  assert.equal(Z.dateiname(new Date(2026, 0, 5)), 'zuschnitt-2026-01-05.json');
});
