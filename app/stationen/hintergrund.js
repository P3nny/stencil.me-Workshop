// ---- Station „Hintergrund ändern“ ----
// Für jede Person: Die KI (BodyPix) stellt das Foto frei, das Kind wählt einen
// gemeinfreien Hintergrund, das fertige Bild geht über die Outbox an den Laptop.
// Freistellen und Zusammensetzen passieren auf dem iPad.
(function(){
  const KANTE_RADIUS = 2; // Kante weichzeichnen (px), sonst sieht der Rand ausgeschnitten aus
  const ARBEIT_PX = 640; // längere Seite: reicht für die Anzeige und schont alte iPads

  function bildLaden(src){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(src + ' lässt sich nicht laden'));
      img.src = src;
    });
  }

  // Box-Unschärfe in einer Richtung (erst Zeilen, dann Spalten: viel weniger Rechnen als 2D)
  function unschaerfe1d(a, w, h, waagrecht){
    const b = new Float32Array(w * h);
    const laenge = waagrecht ? w : h, anzahl = waagrecht ? h : w;
    for(let k = 0; k < anzahl; k++){
      for(let i = 0; i < laenge; i++){
        let summe = 0, n = 0;
        for(let d = -KANTE_RADIUS; d <= KANTE_RADIUS; d++){
          const j = i + d;
          if(j < 0 || j >= laenge) continue;
          summe += waagrecht ? a[k * w + j] : a[j * w + k];
          n++;
        }
        b[waagrecht ? k * w + i : i * w + k] = summe / n;
      }
    }
    return b;
  }

  // Alpha-Kanal aus der BodyPix-Maske, mit weicher Kante
  function alphaAusMaske(seg){
    const w = seg.width, h = seg.height;
    let a = new Float32Array(w * h);
    for(let i = 0; i < a.length; i++) a[i] = seg.data[i] ? 1 : 0;
    for(let durchgang = 0; durchgang < 2; durchgang++){
      a = unschaerfe1d(unschaerfe1d(a, w, h, true), w, h, false);
    }
    return a;
  }

  // Person ohne Hintergrund (transparent), gleiche Größe wie das Foto
  function freistellen(img, seg){
    const c = document.createElement('canvas');
    c.width = seg.width; c.height = seg.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const daten = ctx.getImageData(0, 0, c.width, c.height);
    const alpha = alphaAusMaske(seg);
    for(let i = 0; i < alpha.length; i++) daten.data[i * 4 + 3] = Math.round(alpha[i] * 255);
    ctx.putImageData(daten, 0, 0);
    return c;
  }

  // Hintergrund füllt das ganze Bild (wie CSS cover), Person darüber
  function zusammensetzen(person, hintergrund){
    const c = document.createElement('canvas');
    c.width = person.width; c.height = person.height;
    const ctx = c.getContext('2d');
    const scale = Math.max(c.width / hintergrund.naturalWidth, c.height / hintergrund.naturalHeight);
    const bw = hintergrund.naturalWidth * scale, bh = hintergrund.naturalHeight * scale;
    ctx.drawImage(hintergrund, (c.width - bw) / 2, (c.height - bh) / 2, bw, bh);
    ctx.drawImage(person, 0, 0);
    return c;
  }

  function person(station, api, index, name){
    const el = api.el;
    const eintrag = api.eintrag;
    eintrag.bilder = eintrag.bilder || {};
    const stand = eintrag.bilder[index] || {};

    const freiBox = el('div', { klasse: 'frei-bild leer' });
    const freiNotiz = el('p', { klasse: 'hinweis', text: 'Die KI stellt dich frei … (beim ersten Mal dauert es etwas)' });
    const ergebnisBox = el('div', { klasse: 'ergebnis-bild leer' });
    const auswahl = el('div', { klasse: 'hintergrund-auswahl' });
    const sendenKnopf = el('button', { type: 'button', text: 'Bild an den Laptop schicken', disabled: 'disabled' });
    const sendStatus = el('p', { klasse: 'hinweis' });

    const box = el('section', { klasse: 'hintergrund-person' }, [
      el('h2', { text: 'Bild von ' + name }),
      el('div', { klasse: 'hintergrund-reihe' }, [
        el('figure', {}, [freiBox, el('figcaption', {}, [el('strong', { text: 'Freigestellt ' }), el('span', { klasse: 'etikett mini typ-ki', text: 'KI' })]), freiNotiz]),
        el('figure', {}, [ergebnisBox, el('figcaption', {}, [el('strong', { text: 'Mit neuem Hintergrund' })])])
      ]),
      el('p', { klasse: 'auswahl-titel', text: 'Such dir einen Hintergrund aus:' }),
      auswahl,
      sendenKnopf,
      sendStatus
    ]);

    let freigestellt = null;
    let ergebnis = null;

    function knopfAktualisieren(){
      const gesendet = !!stand.gesendetHintergrund;
      const geaendert = gesendet && stand.gesendetHintergrund !== stand.hintergrund;
      sendenKnopf.disabled = !ergebnis || (gesendet && !geaendert);
      sendenKnopf.textContent = geaendert ? 'Neues Bild schicken' : gesendet ? '✓ Bild ist abgeschickt' : 'Bild an den Laptop schicken';
    }

    function waehlen(h){
      stand.hintergrund = h.datei;
      eintrag.bilder[index] = stand;
      api.speichern();
      Array.prototype.forEach.call(auswahl.children, b => b.classList.toggle('an', b.getAttribute('data-datei') === h.datei));
      return bildLaden('/stationen/' + h.datei).then(hg => {
        ergebnis = zusammensetzen(freigestellt, hg);
        ergebnisBox.innerHTML = '';
        ergebnisBox.classList.remove('leer');
        ergebnisBox.appendChild(ergebnis);
        knopfAktualisieren();
      }).catch(err => api.fehler('Der Hintergrund lässt sich nicht laden.', err));
    }

    (station.hintergruende || []).forEach(h => {
      const b = el('button', { type: 'button', klasse: 'hintergrund-wahl', 'data-datei': h.datei, disabled: 'disabled', onclick: () => waehlen(h) }, [
        el('img', { src: '/stationen/' + h.datei, alt: '' }),
        el('span', { text: h.titel })
      ]);
      auswahl.appendChild(b);
    });

    sendenKnopf.addEventListener('click', () => {
      if(!ergebnis) return;
      sendenKnopf.disabled = true;
      const key = 'hintergrund:' + index + ':' + Speicher.neueId();
      const alt = stand.key;
      const hintergrund = stand.hintergrund;
      Speicher.dateiSchreiben(key, Bild.alsJpeg(ergebnis))
        .then(() => alt ? Speicher.dateiSchreiben(alt, undefined) : null)
        .then(() => Outbox.datei(api.gruppe.id, station.id, key))
        .then(() => {
          stand.key = key;
          stand.gesendetHintergrund = hintergrund;
          eintrag.bilder[index] = stand;
          return api.speichern();
        })
        .then(() => {
          sendStatus.textContent = '✓ Gesichert auf dem iPad. Es geht automatisch an den Laptop (Anzeige oben).';
          knopfAktualisieren();
          api.pruefen();
        })
        .catch(err => {
          knopfAktualisieren();
          api.fehler('Das Bild ließ sich nicht speichern. Bitte nochmal antippen.', err);
        });
    });

    function ohneKi(text, err){
      if(err) console.error(err);
      freiNotiz.textContent = text;
      stand.ohne = true;
      eintrag.bilder[index] = stand;
      api.speichern().then(() => api.pruefen());
    }

    function rechnen(){
      let img = null;
      return Speicher.lesen('foto-key:' + index)
        .then(key => key ? Speicher.dateiAlsUrl(key) : null)
        .then(url => {
          if(!url) throw new Error('kein Foto');
          return bildLaden(url);
        })
        .then(bild => {
          img = Personen.verkleinert(bild, ARBEIT_PX);
          return Personen.segmentieren(img);
        })
        .then(seg => {
          let anteil = 0;
          for(let i = 0; i < seg.data.length; i++) anteil += seg.data[i];
          if(anteil / seg.data.length < 0.02){
            return ohneKi('Die KI hat dich auf dem Foto nicht gefunden. Du kannst die Station trotzdem beenden.');
          }
          freigestellt = freistellen(img, seg);
          freiBox.innerHTML = '';
          freiBox.classList.remove('leer');
          freiBox.appendChild(freigestellt);
          freiNotiz.textContent = 'Das Karomuster zeigt: Hier ist jetzt nichts mehr.';
          Array.prototype.forEach.call(auswahl.children, b => { b.disabled = false; });
          const vorher = (station.hintergruende || []).filter(h => h.datei === stand.hintergrund)[0];
          if(vorher) return waehlen(vorher);
          knopfAktualisieren();
        })
        .catch(err => {
          if(err && err.message === 'kein Foto') return api.fehler('Kein Foto gefunden. Mach zuerst die Foto-Station.', err);
          ohneKi('Die KI konnte das Foto nicht freistellen. Du kannst die Station trotzdem beenden.', err);
        });
    }

    return { box: box, rechnen: rechnen };
  }

  Rahmen.eigeneArt('hintergrund', {
    anzeigen: (station, api) => {
      const personen = api.gruppe.personen.map((name, i) => person(station, api, i, name));
      // Nacheinander: zwei Freistellungen gleichzeitig wären zu viel für alte iPads
      personen.reduce((kette, p) => kette.then(p.rechnen), Promise.resolve());
      return api.el('div', {}, personen.map(p => p.box));
    },
    erfuellt: (eintrag, gruppe) => gruppe.personen.every((n, i) => {
      const b = eintrag.bilder && eintrag.bilder[i];
      return b && (b.ohne || b.gesendetHintergrund);
    })
  });
})();
