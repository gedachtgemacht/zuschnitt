/*
 * zuschnitt. Rechenkern
 * Reine Funktionen ohne Abhängigkeiten. Im Browser global (window.Zuschnitt),
 * in Node über module.exports.
 * Alle Maße sind ganze Millimeter.
 * Lizenz: AGPL-3.0
 */
(function (root) {
  'use strict';

  var VERSION = 1;
  var MAX_STUECKE = 500;
  var SPEICHER_SCHLUESSEL = 'zuschnitt.v1';

  function istGanz(n) {
    return typeof n === 'number' && isFinite(n) && Math.floor(n) === n;
  }

  function pruefeMass(n, wofuer) {
    if (!istGanz(n) || n <= 0) {
      throw new RangeError(wofuer + ' muss eine ganze Zahl über 0 sein');
    }
  }

  function pruefeFuge(fuge) {
    if (!istGanz(fuge) || fuge < 0) {
      throw new RangeError('Fuge muss eine ganze Zahl ab 0 sein');
    }
  }

  /* Ausnutzung in Prozent mit einer Nachkommastelle. */
  function prozent(teil, ganz) {
    if (!ganz) return 0;
    return Math.round((teil / ganz) * 1000) / 10;
  }

  /*
   * Löst Teile nach anzahl in Einzelstücke auf und prüft dabei die Eingabe.
   * mitBreite: true bei Platten.
   */
  function aufloesen(teile, mitBreite) {
    if (!Array.isArray(teile)) throw new TypeError('Teile müssen eine Liste sein');
    var stuecke = [];
    var gesamt = 0;
    teile.forEach(function (t, i) {
      var name = t.name || ('Teil ' + (i + 1));
      pruefeMass(t.laenge, 'Länge von ' + name);
      if (mitBreite) pruefeMass(t.breite, 'Breite von ' + name);
      var anzahl = t.anzahl === undefined ? 1 : t.anzahl;
      if (!istGanz(anzahl) || anzahl < 1) {
        throw new RangeError('Anzahl von ' + name + ' muss eine ganze Zahl ab 1 sein');
      }
      gesamt += anzahl;
      if (gesamt > MAX_STUECKE) {
        throw new RangeError('Höchstens ' + MAX_STUECKE + ' Stücke pro Projekt');
      }
      for (var k = 0; k < anzahl; k++) {
        var s = { teil: i, name: name, laenge: t.laenge };
        if (mitBreite) {
          s.breite = t.breite;
          s.maserung = !!t.maserung;
        }
        stuecke.push(s);
      }
    });
    return stuecke;
  }

  /*
   * Latten: First Fit Decreasing.
   * Ergebnis: { latten: [{ stuecke: [{name, laenge, x, teil}], belegt, rest }],
   *             nichtPlatzierbar: [{name, laenge, teil, grund}], anzahl, ausnutzung }
   */
  function planeLatten(laenge, fuge, teile) {
    pruefeMass(laenge, 'Lattenlänge');
    pruefeFuge(fuge);
    var stuecke = aufloesen(teile, false);
    var reihe = stuecke.map(function (s, i) { return { s: s, i: i }; });
    reihe.sort(function (a, b) { return (b.s.laenge - a.s.laenge) || (a.i - b.i); });

    var latten = [];
    var nicht = [];
    var summe = 0;
    reihe.forEach(function (e) {
      var s = e.s;
      if (s.laenge > laenge) {
        nicht.push({ name: s.name, laenge: s.laenge, teil: s.teil,
          grund: 'länger als die Latte (' + s.laenge + ' > ' + laenge + ' mm)' });
        return;
      }
      var ziel = null;
      for (var j = 0; j < latten.length; j++) {
        if (latten[j].belegt + s.laenge <= laenge) { ziel = latten[j]; break; }
      }
      if (!ziel) {
        ziel = { stuecke: [], belegt: 0 };
        latten.push(ziel);
      }
      ziel.stuecke.push({ name: s.name, laenge: s.laenge, x: ziel.belegt, teil: s.teil });
      ziel.belegt += s.laenge + fuge;
      summe += s.laenge;
    });
    latten.forEach(function (l) { l.rest = Math.max(0, laenge - l.belegt); });

    return {
      art: 'latte',
      laenge: laenge,
      fuge: fuge,
      latten: latten,
      nichtPlatzierbar: nicht,
      anzahl: latten.length,
      ausnutzung: prozent(summe, latten.length * laenge)
    };
  }

  /* Bestes freies Rechteck für ein Stück über alle offenen Platten. */
  function sucheLage(platten, s) {
    var lagen = [{ pw: s.laenge, ph: s.breite, gedreht: false }];
    if (!s.maserung && s.laenge !== s.breite) {
      lagen.push({ pw: s.breite, ph: s.laenge, gedreht: true });
    }
    var best = null;
    for (var p = 0; p < platten.length; p++) {
      var frei = platten[p].frei;
      for (var r = 0; r < frei.length; r++) {
        var f = frei[r];
        for (var o = 0; o < lagen.length; o++) {
          var lg = lagen[o];
          if (lg.pw > f.w || lg.ph > f.h) continue;
          var restFl = f.w * f.h - lg.pw * lg.ph;
          var kurz = Math.min(f.w - lg.pw, f.h - lg.ph);
          if (!best || restFl < best.restFl || (restFl === best.restFl && kurz < best.kurz)) {
            best = { p: p, r: r, pw: lg.pw, ph: lg.ph, gedreht: lg.gedreht, restFl: restFl, kurz: kurz };
          }
        }
      }
    }
    return best;
  }

  function legeAb(platte, lage, s, fuge) {
    var f = platte.frei[lage.r];
    var pw = lage.pw, ph = lage.ph;
    platte.stuecke.push({
      name: s.name, laenge: s.laenge, breite: s.breite, teil: s.teil,
      x: f.x, y: f.y, w: pw, h: ph, gedreht: lage.gedreht
    });
    var rechts, unten;
    if (f.w - pw < f.h - ph) {
      // erst waagerecht schneiden
      rechts = { x: f.x + pw + fuge, y: f.y, w: f.w - pw - fuge, h: ph };
      unten = { x: f.x, y: f.y + ph + fuge, w: f.w, h: f.h - ph - fuge };
    } else {
      // erst senkrecht schneiden
      rechts = { x: f.x + pw + fuge, y: f.y, w: f.w - pw - fuge, h: f.h };
      unten = { x: f.x, y: f.y + ph + fuge, w: pw, h: f.h - ph - fuge };
    }
    platte.frei.splice(lage.r, 1);
    [rechts, unten].forEach(function (n) {
      if (n.w > 0 && n.h > 0) platte.frei.push(n);
    });
  }

  /*
   * Platten: Guillotine mit Liste freier Rechtecke. x entlang der Plattenlänge.
   * Ergebnis: { platten: [{ stuecke: [{name, laenge, breite, x, y, w, h, gedreht, teil}],
   *             frei: [{x, y, w, h}] }], nichtPlatzierbar, anzahl, ausnutzung }
   */
  function planePlatten(laenge, breite, fuge, teile) {
    pruefeMass(laenge, 'Plattenlänge');
    pruefeMass(breite, 'Plattenbreite');
    pruefeFuge(fuge);
    var stuecke = aufloesen(teile, true);
    var reihe = stuecke.map(function (s, i) { return { s: s, i: i }; });
    reihe.sort(function (a, b) {
      var fa = a.s.laenge * a.s.breite, fb = b.s.laenge * b.s.breite;
      var la = Math.max(a.s.laenge, a.s.breite), lb = Math.max(b.s.laenge, b.s.breite);
      return (fb - fa) || (lb - la) || (a.i - b.i);
    });

    var platten = [];
    var nicht = [];
    var summe = 0;
    reihe.forEach(function (e) {
      var s = e.s;
      var passtGerade = s.laenge <= laenge && s.breite <= breite;
      var passtGedreht = s.breite <= laenge && s.laenge <= breite;
      if (!passtGerade && !(passtGedreht && !s.maserung)) {
        var grund = passtGedreht
          ? 'passt nur gedreht, Maserung verbietet das Drehen'
          : 'größer als die Platte, auch gedreht';
        nicht.push({ name: s.name, laenge: s.laenge, breite: s.breite, teil: s.teil, grund: grund });
        return;
      }
      var lage = sucheLage(platten, s);
      if (!lage) {
        platten.push({ stuecke: [], frei: [{ x: 0, y: 0, w: laenge, h: breite }] });
        var neu = sucheLage([platten[platten.length - 1]], s);
        neu.p = platten.length - 1;
        lage = neu;
      }
      legeAb(platten[lage.p], lage, s, fuge);
      summe += s.laenge * s.breite;
    });

    return {
      art: 'platte',
      laenge: laenge,
      breite: breite,
      fuge: fuge,
      platten: platten,
      nichtPlatzierbar: nicht,
      anzahl: platten.length,
      ausnutzung: prozent(summe, platten.length * laenge * breite)
    };
  }

  /* ---------- Projekte und Daten ---------- */

  function hatNur(obj, erlaubt) {
    return Object.keys(obj).filter(function (k) { return erlaubt.indexOf(k) < 0; });
  }

  function istObjekt(o) {
    return o !== null && typeof o === 'object' && !Array.isArray(o);
  }

  /*
   * Prüft ein Projekt auf Form und Werte.
   * Gibt eine Liste von { feld, meldung } zurück, leer wenn alles stimmt.
   * feld ist ein Pfad wie "material.laenge" oder "teile.0.anzahl".
   */
  function pruefeProjekt(p) {
    var f = [];
    function fehler(feld, meldung) { f.push({ feld: feld, meldung: meldung }); }
    if (!istObjekt(p)) { fehler('', 'Projekt ist kein Objekt'); return f; }
    var platte = p.art === 'platte';
    if (p.art !== 'platte' && p.art !== 'latte') fehler('art', 'Art muss platte oder latte sein');
    var unbekannt = hatNur(p, ['id', 'name', 'art', 'beispiel', 'material', 'teile']);
    if (unbekannt.length) fehler('', 'Unbekannte Felder: ' + unbekannt.join(', '));
    if (typeof p.id !== 'string' || !p.id) fehler('id', 'ID fehlt');
    if (typeof p.name !== 'string') fehler('name', 'Name fehlt');
    if (p.beispiel !== undefined && typeof p.beispiel !== 'boolean') fehler('beispiel', 'beispiel muss wahr oder falsch sein');

    var m = p.material;
    if (!istObjekt(m)) {
      fehler('material', 'Rohmaterial fehlt');
    } else {
      var mFelder = platte ? ['laenge', 'breite', 'fuge', 'preis'] : ['laenge', 'fuge', 'preis'];
      var mu = hatNur(m, mFelder);
      if (mu.length) fehler('material', 'Unbekannte Felder im Rohmaterial: ' + mu.join(', '));
      if (!istGanz(m.laenge) || m.laenge <= 0) fehler('material.laenge', 'ganze Zahl über 0');
      if (platte && (!istGanz(m.breite) || m.breite <= 0)) fehler('material.breite', 'ganze Zahl über 0');
      if (!istGanz(m.fuge) || m.fuge < 0) fehler('material.fuge', 'ganze Zahl ab 0');
      if (m.preis !== undefined && m.preis !== null &&
          (typeof m.preis !== 'number' || !isFinite(m.preis) || m.preis < 0)) {
        fehler('material.preis', 'Zahl ab 0 oder leer');
      }
    }

    if (!Array.isArray(p.teile)) {
      fehler('teile', 'Teileliste fehlt');
    } else {
      var tFelder = platte
        ? ['id', 'name', 'laenge', 'breite', 'anzahl', 'maserung']
        : ['id', 'name', 'laenge', 'anzahl'];
      var summe = 0;
      p.teile.forEach(function (t, i) {
        var pf = 'teile.' + i + '.';
        if (!istObjekt(t)) { fehler('teile.' + i, 'Teil ist kein Objekt'); return; }
        var tu = hatNur(t, tFelder);
        if (tu.length) fehler('teile.' + i, 'Unbekannte Felder: ' + tu.join(', '));
        if (typeof t.id !== 'string' || !t.id) fehler(pf + 'id', 'ID fehlt');
        if (typeof t.name !== 'string') fehler(pf + 'name', 'Name fehlt');
        if (!istGanz(t.laenge) || t.laenge <= 0) fehler(pf + 'laenge', 'ganze Zahl über 0');
        if (platte && (!istGanz(t.breite) || t.breite <= 0)) fehler(pf + 'breite', 'ganze Zahl über 0');
        if (!istGanz(t.anzahl) || t.anzahl < 1) fehler(pf + 'anzahl', 'ganze Zahl ab 1');
        else summe += t.anzahl;
        if (platte && typeof t.maserung !== 'boolean') fehler(pf + 'maserung', 'wahr oder falsch');
      });
      if (summe > MAX_STUECKE) fehler('teile', 'Höchstens ' + MAX_STUECKE + ' Stücke pro Projekt, hier ' + summe);
    }
    return f;
  }

  /*
   * Berechnet ein Projekt. Bei Fehlern { fehler: [...] }, sonst das Ergebnis
   * von planePlatten bzw. planeLatten plus kosten (oder null ohne Preis).
   */
  function berechne(p) {
    var f = pruefeProjekt(p);
    if (f.length) return { fehler: f };
    var m = p.material;
    var e = p.art === 'platte'
      ? planePlatten(m.laenge, m.breite, m.fuge, p.teile)
      : planeLatten(m.laenge, m.fuge, p.teile);
    e.kosten = (typeof m.preis === 'number') ? Math.round(e.anzahl * m.preis * 100) / 100 : null;
    return e;
  }

  /* Prüft ein ganzes Datenobjekt. Gibt eine Meldung zurück oder null. */
  function pruefeDaten(d) {
    if (!istObjekt(d)) return 'Die Datei enthält kein JSON-Objekt.';
    if (d.version !== VERSION) return 'Unbekannte Version: ' + JSON.stringify(d.version) + ', erwartet ' + VERSION + '.';
    var u = hatNur(d, ['version', 'projekte']);
    if (u.length) return 'Unbekannte Felder: ' + u.join(', ') + '.';
    if (!Array.isArray(d.projekte)) return 'Feld projekte fehlt oder ist keine Liste.';
    for (var i = 0; i < d.projekte.length; i++) {
      var f = pruefeProjekt(d.projekte[i]);
      if (f.length) {
        var n = istObjekt(d.projekte[i]) && typeof d.projekte[i].name === 'string' ? d.projekte[i].name : ('Nr. ' + (i + 1));
        return 'Projekt ' + n + ': ' + (f[0].feld ? f[0].feld + ': ' : '') + f[0].meldung + '.';
      }
    }
    return null;
  }

  function exportiere(daten) {
    return JSON.stringify(daten, null, 2);
  }

  function dateiname(datum) {
    function zwei(n) { return (n < 10 ? '0' : '') + n; }
    return 'zuschnitt-' + datum.getFullYear() + '-' + zwei(datum.getMonth() + 1) + '-' + zwei(datum.getDate()) + '.json';
  }

  /*
   * Importiert einen JSON-Text in bestehende Daten. Ändert daten nicht.
   * neueId(praefix) liefert eine neue, eindeutige ID.
   * Ergebnis: { ok: true, daten, anzahl } oder { ok: false, meldung }.
   */
  function importiere(daten, text, neueId) {
    var d;
    try { d = JSON.parse(text); } catch (e) {
      return { ok: false, meldung: 'Die Datei ist kein gültiges JSON.' };
    }
    var m = pruefeDaten(d);
    if (m) return { ok: false, meldung: m };
    var neu = JSON.parse(JSON.stringify(daten));
    d.projekte.forEach(function (p) {
      var q = JSON.parse(JSON.stringify(p));
      q.id = neueId('p');
      q.teile.forEach(function (t) { t.id = neueId('t'); });
      neu.projekte.push(q);
    });
    return { ok: true, daten: neu, anzahl: d.projekte.length };
  }

  var api = {
    VERSION: VERSION,
    MAX_STUECKE: MAX_STUECKE,
    SPEICHER_SCHLUESSEL: SPEICHER_SCHLUESSEL,
    aufloesen: aufloesen,
    planeLatten: planeLatten,
    planePlatten: planePlatten,
    pruefeProjekt: pruefeProjekt,
    berechne: berechne,
    pruefeDaten: pruefeDaten,
    exportiere: exportiere,
    importiere: importiere,
    dateiname: dateiname,
    prozent: prozent
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Zuschnitt = api;
})(typeof self !== 'undefined' ? self : this);
