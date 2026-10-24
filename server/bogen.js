// ---- Bögen auf der Laptop-Seite: A4-Holzplatte (Mr Beam) und A4-Stickerfolie (Cameo) ----
// Gleiche Logik für beide: Liste mit Häkchen, automatisch anordnen (wer zuerst fertig war,
// kommt zuerst), Vorschau, danach Verlauf mit Nachrichten an die Gruppen.
// Was beim fertigen Bogen passiert (herunterladen bzw. an den Plotter), entscheidet
// die Seite über optionen.fertig(bogen).
(function () {
  "use strict";
  var BREITE = 210, HOEHE = 297; // mm, A4
  var VERLAUF_MAX = 10;

  function lesen(key, leer) {
    try { return JSON.parse(localStorage.getItem(key) || leer); } catch (e) { return JSON.parse(leer); }
  }
  function schreiben(key, wert) {
    try { localStorage.setItem(key, JSON.stringify(wert)); } catch (e) { /* nur Komfort */ }
  }

  function namenListe(namen) {
    return namen.length > 1 ? namen.slice(0, -1).join(", ") + " und " + namen[namen.length - 1] : namen[0];
  }

  // Ein Stück als Gruppe auf dem Bogen. IDs bekommen eine Vorsilbe, sonst würden sich
  // die Stücke gegenseitig z. B. die Schnittkontur wegnehmen. „schneiden-rot“ und
  // „zeichnen-stift“ bleiben, daran erkennt der Plotter Messer und Stift (server/plotter.py).
  function gruppe(text, n, x, y) {
    var doc = new DOMParser().parseFromString(text, "image/svg+xml");
    var inner = doc.documentElement.innerHTML
      .replace(/id="([^"]+)"/g, function (m, id) { return id === "schneiden-rot" || id === "zeichnen-stift" ? m : 'id="s' + n + "-" + id + '"'; })
      .replace(/url\(#([^)]+)\)/g, "url(#s" + n + "-$1)");
    return '<g transform="translate(' + x.toFixed(3) + "," + y.toFixed(3) + ')">' + inner + "</g>";
  }

  function groesse(text) {
    var root = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
    var vb = (root.getAttribute("viewBox") || "").split(/[\s,]+/).map(parseFloat);
    return { w: vb[2] || parseFloat(root.getAttribute("width")), h: vb[3] || parseFloat(root.getAttribute("height")) };
  }

  function erstellen(o) {
    var auswahl = {};
    var platziert = lesen(o.schluessel + "-platziert", "[]");
    var liste = [];
    var gesehen = null;
    var aktuell = null; // { svg, pfade, stuecke }

    function istGewaehlt(pfad) {
      return pfad in auswahl ? auswahl[pfad] : platziert.indexOf(pfad) < 0;
    }

    // Regal-Packen: Reihe für Reihe. Nach dem ersten Stück, das nicht mehr passt, ist Schluss,
    // damit keins von später vorrutscht.
    function regal(items) {
      var x = o.rand, y = o.rand, zeile = 0, passt = [], rest = [];
      items.forEach(function (it) {
        if (rest.length) { rest.push(it); return; }
        if (x + it.w > BREITE - o.rand) { x = o.rand; y += zeile + o.abstand; zeile = 0; }
        if (it.w > BREITE - 2 * o.rand || y + it.h > HOEHE - o.rand) { rest.push(it); return; }
        it.x = x; it.y = y;
        passt.push(it);
        x += it.w + o.abstand;
        zeile = Math.max(zeile, it.h);
      });
      return { passt: passt, rest: rest };
    }

    // Erst in Ankunftsreihenfolge prüfen, wer passt, dann platzsparend (höchste zuerst)
    function anordnen(items) {
      var probe = regal(items);
      var sortiert = probe.passt.map(function (it, i) { return { it: it, i: i }; })
        .sort(function (a, b) { return (b.it.h - a.it.h) || (a.i - b.i); })
        .map(function (p) { return p.it; });
      var gepackt = regal(sortiert);
      return { passt: gepackt.passt, rest: gepackt.rest.concat(probe.rest) };
    }

    function el(id) { return document.getElementById(o.id + "-" + id); }

    function listeZeigen(daten) {
      liste = daten.stempel;
      el("anzahl").textContent = liste.length + " " + o.mehrzahl;
      el("ordner").textContent = daten.ordner;
      var grid = el("grid");
      grid.innerHTML = "";
      liste.forEach(function (s) {
        var box = document.createElement("div");
        box.className = "stamp" + (gesehen && gesehen.indexOf(s.pfad) < 0 ? " new" : "") + (platziert.indexOf(s.pfad) >= 0 ? " placed" : "");
        var img = document.createElement("img");
        img.src = o.dateien + encodeURI(s.pfad);
        img.alt = o.einzahl + " von " + s.name;
        var name = document.createElement("div");
        name.className = "name";
        name.textContent = s.name;
        var zeit = document.createElement("div");
        zeit.textContent = s.tag + " " + s.zeit;
        var label = document.createElement("label");
        var check = document.createElement("input");
        check.type = "checkbox";
        check.checked = istGewaehlt(s.pfad);
        check.addEventListener("change", function () { auswahl[s.pfad] = check.checked; });
        label.appendChild(check);
        label.appendChild(document.createTextNode(o.haken));
        [img, name, zeit, label].forEach(function (k) { box.appendChild(k); });
        if (o.einzelDownload) {
          var link = document.createElement("a");
          link.className = "download";
          link.href = o.dateien + encodeURI(s.pfad);
          link.download = s.datei;
          link.textContent = "Herunterladen";
          box.appendChild(link);
        }
        grid.appendChild(box);
      });
      gesehen = liste.map(function (s) { return s.pfad; });
    }

    function laden() {
      return fetch(o.liste, { cache: "no-store" })
        .then(function (r) { return r.json(); })
        .then(function (daten) { el("fehler").innerHTML = ""; listeZeigen(daten); })
        .catch(function () { el("fehler").innerHTML = '<div class="error">Server nicht erreichbar. Läuft das Server-Fenster noch?</div>'; });
    }

    function zusammenstellen() {
      // Älteste zuerst (die Liste ist neueste zuerst)
      var gewaehlt = liste.filter(function (s) { return istGewaehlt(s.pfad); }).reverse();
      var info = el("info");
      el("layout").hidden = false;
      if (!gewaehlt.length) {
        info.innerHTML = '<p class="warn">Nichts angehakt.</p>';
        el("vorschau").innerHTML = "";
        aktuell = null;
        o.bereit(null);
        return Promise.resolve();
      }
      return Promise.all(gewaehlt.map(function (s) {
        return fetch(o.dateien + encodeURI(s.pfad), { cache: "no-store" }).then(function (r) { return r.text(); })
          .then(function (text) { var g = groesse(text); return { s: s, text: text, w: g.w, h: g.h }; });
      })).then(function (items) {
        var ergebnis = anordnen(items);
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + BREITE + " " + HOEHE + '" width="' + BREITE + 'mm" height="' + HOEHE + 'mm">' +
          ergebnis.passt.map(function (it, n) { return gruppe(it.text, n, it.x, it.y); }).join("") + "</svg>";
        aktuell = {
          svg: svg,
          pfade: ergebnis.passt.map(function (it) { return it.s.pfad; }),
          stuecke: ergebnis.passt.map(function (it) { return { name: it.s.name, gruppe: it.s.gruppe, pfad: it.s.pfad }; })
        };
        el("vorschau").innerHTML = svg;
        var html = "<p><b>" + ergebnis.passt.length + " " + o.mehrzahl + "</b> auf " + o.bogen + ": " +
          ergebnis.passt.map(function (it) { return it.s.name; }).join(", ") + "</p>";
        if (ergebnis.rest.length) {
          html += '<p class="warn">Passen nicht mehr: ' + ergebnis.rest.map(function (it) { return it.s.name; }).join(", ") +
            ". Die kommen auf " + o.naechster + ".</p>";
        }
        info.innerHTML = html;
        o.bereit(aktuell);
      }).catch(function () {
        info.innerHTML = '<p class="warn">Dateien konnten nicht geladen werden.</p>';
      });
    }

    // Bogen ist erledigt (heruntergeladen bzw. an den Plotter): grau markieren, in den Verlauf
    function abgeschlossen(name) {
      if (!aktuell) return;
      aktuell.pfade.forEach(function (p) { if (platziert.indexOf(p) < 0) platziert.push(p); delete auswahl[p]; });
      schreiben(o.schluessel + "-platziert", platziert);
      var verlauf = lesen(o.schluessel + "-verlauf", "[]");
      verlauf.unshift({ datei: name, stempel: aktuell.stuecke });
      schreiben(o.schluessel + "-verlauf", verlauf.slice(0, VERLAUF_MAX));
      verlaufZeigen();
      laden();
    }

    // Pro Gruppe eine eigene Nachricht mit den Namen ihrer Stücke auf diesem Bogen
    function benachrichtigen(eintrag, art, rueckmeldung) {
      var proGruppe = {};
      eintrag.stempel.forEach(function (s) {
        if (!s.gruppe) return;
        (proGruppe[s.gruppe] = proGruppe[s.gruppe] || []).push(s.name);
      });
      var gruppen = Object.keys(proGruppe);
      if (!gruppen.length) {
        rueckmeldung.textContent = "Keine Gruppe bekannt (alte Dateien ohne Gruppe).";
        return;
      }
      Promise.all(gruppen.map(function (g) {
        return fetch("/api/nachricht", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gruppen: [g], text: o.nachrichten[art].text(proGruppe[g]) })
        }).then(function (r) { if (!r.ok) throw new Error(r.status); });
      })).then(function () {
        eintrag.gesendet = eintrag.gesendet || {};
        eintrag.gesendet[art] = new Date().toTimeString().slice(0, 5);
        schreiben(o.schluessel + "-verlauf", lesen(o.schluessel + "-verlauf", "[]").map(function (p) { return p.datei === eintrag.datei ? eintrag : p; }));
        verlaufZeigen();
      }).catch(function () { rueckmeldung.textContent = "Senden hat nicht geklappt."; });
    }

    function verlaufZeigen() {
      var box = el("verlauf");
      box.innerHTML = "";
      lesen(o.schluessel + "-verlauf", "[]").forEach(function (eintrag) {
        var zeile = document.createElement("div");
        zeile.className = "history-row";
        var label = document.createElement("span");
        var fett = document.createElement("b");
        fett.textContent = eintrag.datei + " ";
        label.appendChild(fett);
        label.appendChild(document.createTextNode(eintrag.stempel.map(function (s) { return s.name; }).join(", ")));
        zeile.appendChild(label);
        var rueckmeldung = document.createElement("span");
        Object.keys(o.nachrichten).forEach(function (art) {
          var b = document.createElement("button");
          b.type = "button";
          b.textContent = o.nachrichten[art].knopf;
          b.addEventListener("click", function () { benachrichtigen(eintrag, art, rueckmeldung); });
          zeile.appendChild(b);
          if (eintrag.gesendet && eintrag.gesendet[art]) {
            var ok = document.createElement("span");
            ok.className = "sent";
            ok.textContent = "✓ " + eintrag.gesendet[art];
            zeile.appendChild(ok);
          }
        });
        zeile.appendChild(rueckmeldung);
        box.appendChild(zeile);
      });
      if (!box.children.length) box.innerHTML = '<div class="hint">Noch nichts erledigt.</div>';
    }

    el("bauen").addEventListener("click", zusammenstellen);
    el("zuruecksetzen").addEventListener("click", function () {
      if (!window.confirm("Alle wieder anhaken, auch die schon gelaserten? Nur nötig, wenn ein Bogen schiefging.")) return;
      platziert = [];
      auswahl = {};
      schreiben(o.schluessel + "-platziert", platziert);
      laden();
    });
    verlaufZeigen();
    laden();
    setInterval(laden, 5000);
    return { abgeschlossen: abgeschlossen, laden: laden, aktuell: function () { return aktuell; } };
  }

  window.Bogen = { erstellen: erstellen, namenListe: namenListe };
})();
