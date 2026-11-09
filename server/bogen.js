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

  // Werkstatt-Protokoll auf dem Laptop (Anzahl, Laser- und Plotzeiten für die Auswertung, ohne Namen)
  function protokoll(bogen, aktion, name, stuecke) {
    fetch("/api/werkstatt", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bogen: bogen, aktion: aktion, name: name, stuecke: stuecke || 0 }) }).catch(function () { /* nur Statistik */ });
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

  // Stickerfolie: Der Stift zeichnet um jedes Stück ein Rechteck in die Lücke (halber Abstand).
  // Daran schneidet Penny den Bogen von Hand auseinander, die Cameo schneidet nur die
  // Stickerschicht an (server/plotter.py) und nie durch Trägerpapier und Matte.
  function trennlinien(stuecke, luft) {
    return '<g id="trennlinien" fill="none" stroke="#999" stroke-width="0.3">' + stuecke.map(function (it) {
      var x0 = it.x - luft, y0 = it.y - luft, x1 = it.x + it.w + luft, y1 = it.y + it.h + luft;
      return '<path d="M' + [x0, y0, x1, y0, x1, y1, x0, y1].map(function (v) { return v.toFixed(2); })
        .reduce(function (a, v, i) { return a + (i === 0 ? "" : i % 2 ? "," : "L") + v; }, "") + 'Z"/>';
    }).join("") + "</g>";
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
    var aktuell = null; // { svg, pfade, stuecke, belegt }
    // Wie weit der Bogen im Gerät schon benutzt ist (nur Koordinaten, keine Namen):
    // Cursor des Regal-Packens und die Flächen der Stücke darauf, für die graue Vorschau.
    var belegt = lesen(o.schluessel + "-belegt", "null") || leerBelegt();

    function leerBelegt() { return { x: o.rand, y: o.rand, zeile: 0, flaechen: [] }; }

    // Von Hand an- oder abgehakt gilt. Sonst: noch nicht auf einem Bogen und (Platte) nur Porträts,
    // Stempel hakt Penny von Hand an (eigene Platte, andere Durchgänge, o.vorauswahl)
    function istGewaehlt(s) {
      if (s.pfad in auswahl) return auswahl[s.pfad];
      return platziert.indexOf(s.pfad) < 0 && (!o.vorauswahl || o.vorauswahl(s));
    }

    // Regal-Packen: Reihe für Reihe. Nach dem ersten Stück, das nicht mehr passt, ist Schluss,
    // damit keins von später vorrutscht.
    // start: wo der angefangene Bogen weitergeht. Höhere Stücke in der angefangenen Reihe
    // sind kein Problem, die nächste Reihe beginnt unter dem höchsten.
    function regal(items, start) {
      var x = start.x, y = start.y, zeile = start.zeile, passt = [], rest = [];
      items.forEach(function (it) {
        if (rest.length) { rest.push(it); return; }
        if (x + it.w > BREITE - o.rand) { x = o.rand; y += zeile + o.abstand; zeile = 0; }
        if (it.w > BREITE - 2 * o.rand || y + it.h > HOEHE - o.rand) { rest.push(it); return; }
        it.x = x; it.y = y;
        passt.push(it);
        x += it.w + o.abstand;
        zeile = Math.max(zeile, it.h);
      });
      return { passt: passt, rest: rest, ende: { x: x, y: y, zeile: zeile } };
    }

    // Erst in Ankunftsreihenfolge prüfen, wer passt, dann platzsparend (höchste zuerst)
    function anordnen(items) {
      var probe = regal(items, belegt);
      var sortiert = probe.passt.map(function (it, i) { return { it: it, i: i }; })
        .sort(function (a, b) { return (b.it.h - a.it.h) || (a.i - b.i); })
        .map(function (p) { return p.it; });
      var gepackt = regal(sortiert, belegt);
      return { passt: gepackt.passt, rest: gepackt.rest.concat(probe.rest), ende: gepackt.ende };
    }

    function el(id) { return document.getElementById(o.id + "-" + id); }

    function belegtZeigen() {
      var n = belegt.flaechen.length;
      el("belegt").textContent = n
        ? "Im Gerät liegt " + o.bogenEins + " mit " + n + " " + (n > 1 ? o.mehrzahl : o.einzahl) + ". Neue kommen auf den freien Rest."
        : "Im Gerät liegt " + o.bogenEins + ", noch leer.";
    }

    // Graue Flächen nur in der Vorschau, nie in der Datei für Laser oder Plotter
    function grauVorschau(svg) {
      var grau = belegt.flaechen.map(function (f) {
        return '<rect x="' + f.x + '" y="' + f.y + '" width="' + f.w + '" height="' + f.h + '" fill="#bbb" stroke="#888" stroke-width="0.5"/>';
      }).join("");
      return grau ? svg.replace(/<\/svg>$/, grau + "</svg>") : svg;
    }

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
        check.checked = istGewaehlt(s);
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
      var gewaehlt = liste.filter(function (s) { return istGewaehlt(s); }).reverse();
      var info = el("info");
      el("layout").hidden = false;
      if (!gewaehlt.length) {
        info.innerHTML = '<p class="warn">Nichts angehakt.</p>';
        el("vorschau").innerHTML = grauVorschau('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + BREITE + " " + HOEHE + '"></svg>');
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
          ergebnis.passt.map(function (it, n) { return gruppe(it.text, n, it.x, it.y); }).join("") +
          (o.trennlinien ? trennlinien(ergebnis.passt, o.abstand / 2) : "") + "</svg>";
        aktuell = {
          svg: svg,
          pfade: ergebnis.passt.map(function (it) { return it.s.pfad; }),
          stuecke: ergebnis.passt.map(function (it) { return { name: it.s.name, gruppe: it.s.gruppe, pfad: it.s.pfad }; }),
          belegt: {
            x: ergebnis.ende.x, y: ergebnis.ende.y, zeile: ergebnis.ende.zeile,
            flaechen: belegt.flaechen.concat(ergebnis.passt.map(function (it) {
              return { x: +it.x.toFixed(1), y: +it.y.toFixed(1), w: +it.w.toFixed(1), h: +it.h.toFixed(1) };
            }))
          }
        };
        if (!ergebnis.passt.length) {
          aktuell = null;
          el("vorschau").innerHTML = grauVorschau(svg);
          info.innerHTML = '<p class="warn">' + o.bogenGross + " ist voll. Neue einlegen und „" + el("neu").textContent + "“ drücken.</p>";
          o.bereit(null);
          return;
        }
        el("vorschau").innerHTML = grauVorschau(svg);
        var html = (belegt.flaechen.length ? "<p>Grau = schon benutzt, die neuen kommen auf den Rest.</p>" : "") +
          "<p><b>" + ergebnis.passt.length + " " + o.mehrzahl + "</b> auf " + o.bogen + ": " +
          ergebnis.passt.map(function (it) { return it.s.name; }).join(", ") + "</p>";
        var warnung = o.mischWarnung ? o.mischWarnung(ergebnis.passt.map(function (it) { return it.s; })) : "";
        if (warnung) html += '<p class="warn">' + warnung + "</p>";
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
      belegt = aktuell.belegt;
      schreiben(o.schluessel + "-belegt", belegt);
      belegtZeigen();
      var verlauf = lesen(o.schluessel + "-verlauf", "[]");
      verlauf.unshift({ datei: name, stempel: aktuell.stuecke });
      schreiben(o.schluessel + "-verlauf", verlauf.slice(0, VERLAUF_MAX));
      protokoll(o.id, "erstellt", name, aktuell.stuecke.length);
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
          body: JSON.stringify({ gruppen: [g], text: o.nachrichten[art].text(proGruppe[g]), art: o.id + "-" + art })
        }).then(function (r) { if (!r.ok) throw new Error(r.status); });
      })).then(function () {
        eintrag.gesendet = eintrag.gesendet || {};
        eintrag.gesendet[art] = new Date().toTimeString().slice(0, 5);
        protokoll(o.id, art, eintrag.datei);
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
    el("neu").addEventListener("click", function () {
      if (belegt.flaechen.length && !window.confirm("Wirklich " + o.bogenNeu + " eingelegt? Dann fängt die Anordnung wieder oben links an.")) return;
      belegt = leerBelegt();
      schreiben(o.schluessel + "-belegt", belegt);
      belegtZeigen();
      el("layout").hidden = true;
    });
    belegtZeigen();
    verlaufZeigen();
    laden();
    setInterval(laden, 5000);
    // „Alle Daten löschen“: Verlauf (mit Namen) und Haken vergessen
    function vergessen() {
      platziert = [];
      auswahl = {};
      aktuell = null;
      belegt = leerBelegt();
      try { ["-verlauf", "-platziert", "-belegt"].forEach(function (k) { localStorage.removeItem(o.schluessel + k); }); } catch (e) { /* egal */ }
      belegtZeigen();
      el("layout").hidden = true;
      verlaufZeigen();
      laden();
    }

    return { abgeschlossen: abgeschlossen, laden: laden, vergessen: vergessen, aktuell: function () { return aktuell; } };
  }

  window.Bogen = { erstellen: erstellen, namenListe: namenListe };
})();
