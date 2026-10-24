// ---- Station „Bild bearbeiten“ (stencil.me) ----
// Für jede Person nacheinander: Rohbild → Schwarz-Weiß → KI: Person → Otsu → Stempel.
// Jeder Schritt erscheint als eigenes Bild, damit die Kinder sehen, was passiert.
// Einstellbar ist nur der rote Schnittrand. Der Stempel geht über die Outbox an den Laptop.
(function(){
  const PAUSE_MS = 400; // kurze Pause zwischen den Schritten, damit man sie sieht
  const SCHRITTE = [
    { titel: '1 Dein Foto', typ: 'programm' },
    { titel: '2 Schwarz-Weiß', typ: 'programm' },
    { titel: '3 KI findet dich', typ: 'ki' },
    { titel: '4 Otsu-Schwelle', typ: 'programm' },
    { titel: '5 Dein Stempel', typ: 'programm' }
  ];
  const TYP_KURZ = { programm: 'Programm', ki: 'KI' };

  function warten(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

  function person(station, api, index, name){
    const el = api.el;
    const eintrag = api.eintrag;
    eintrag.stempel = eintrag.stempel || {};
    const stand = eintrag.stempel[index] || {};

    const felder = SCHRITTE.map(s => {
      const bild = el('div', { klasse: 'schritt-bild leer' });
      const notiz = el('div', { klasse: 'schritt-notiz' });
      const fig = el('figure', { klasse: 'schritt' }, [
        bild,
        el('figcaption', {}, [el('strong', { text: s.titel }), el('span', { klasse: 'etikett mini typ-' + s.typ, text: TYP_KURZ[s.typ] })]),
        notiz
      ]);
      return { fig: fig, bild: bild, notiz: notiz };
    });

    const regler = el('input', { type: 'range', min: String(Stempel.OFFSET_MIN), max: String(Stempel.OFFSET_MAX), step: '0.5', id: 'rand-' + index });
    const reglerWert = el('strong');
    const warnung = el('p', { klasse: 'rand-warnung' });
    warnung.hidden = true;
    const sendenKnopf = el('button', { type: 'button', text: 'Stempel an den Laptop schicken', disabled: 'disabled' });
    const sendStatus = el('p', { klasse: 'hinweis' });
    const randBox = el('div', { klasse: 'rand' }, [
      el('label', { for: 'rand-' + index }, [el('span', { text: 'Roter Schnittrand: ' }), reglerWert]),
      regler,
      el('p', { klasse: 'hinweis', text: 'Der rote Rand muss in einem Stück außen um alles herumlaufen. Sonst fällt der Stempel auseinander.' }),
      warnung
    ]);
    randBox.hidden = true;

    const box = el('section', { klasse: 'stempel-person' }, [
      el('h2', { text: 'Stempel von ' + name }),
      el('div', { klasse: 'schritte-reihe' }, felder.map(f => f.fig)),
      randBox,
      sendenKnopf,
      sendStatus
    ]);

    let ergebnis = null; // Rechenergebnis aus Stempel.berechnen
    let svgAktuell = null;

    function zeigeCanvas(i, canvas){
      felder[i].bild.innerHTML = '';
      felder[i].bild.classList.remove('leer');
      felder[i].bild.appendChild(canvas);
    }

    function stempelZeichnen(){
      const mm = parseFloat(regler.value);
      reglerWert.textContent = mm.toFixed(1).replace('.', ',') + ' mm';
      const st = Stempel.svg(ergebnis.mask, mm);
      svgAktuell = st.svg;
      felder[4].bild.classList.remove('leer');
      felder[4].bild.innerHTML = st.svg;
      felder[4].notiz.textContent = Math.round(st.widthMm) + ' × ' + Math.round(st.heightMm) + ' mm, gespiegelt';
      warnung.hidden = st.cutLoops <= 1;
      warnung.textContent = '⚠ Der rote Rand hat Lücken: Dein Stempel würde in ' + st.cutLoops + ' Teile zerfallen. Schieb den Regler nach rechts.';
      const gesendet = stand.gesendetMm !== undefined;
      const geaendert = gesendet && stand.gesendetMm !== mm;
      sendenKnopf.disabled = st.cutLoops > 1 || (gesendet && !geaendert);
      sendenKnopf.textContent = geaendert ? 'Geänderten Stempel neu schicken' : gesendet ? '✓ Stempel ist abgeschickt' : 'Stempel an den Laptop schicken';
    }

    let reglerTimer = null;
    regler.addEventListener('input', () => {
      reglerWert.textContent = parseFloat(regler.value).toFixed(1).replace('.', ',') + ' mm';
      // Hinter dem Regler steckt eine Distanztransformation: erst kurz nach dem Ziehen rechnen
      clearTimeout(reglerTimer);
      reglerTimer = setTimeout(() => {
        stand.randMm = parseFloat(regler.value);
        eintrag.stempel[index] = stand;
        api.speichern();
        stempelZeichnen();
      }, 150);
    });

    sendenKnopf.addEventListener('click', () => {
      if(!svgAktuell) return;
      sendenKnopf.disabled = true;
      const mm = parseFloat(regler.value);
      Outbox.stempel(api.gruppe.id, name, svgAktuell)
        .then(() => {
          stand.gesendetMm = mm;
          eintrag.stempel[index] = stand;
          return api.speichern();
        })
        .then(() => {
          sendStatus.textContent = '✓ Gesichert auf dem iPad. Er geht automatisch an den Laptop (Anzeige oben).';
          stempelZeichnen();
          api.pruefen();
        })
        .catch(err => {
          sendenKnopf.disabled = false;
          api.fehler('Der Stempel ließ sich nicht speichern. Bitte nochmal antippen.', err);
        });
    });

    // Rechnen: Schritt für Schritt, mit Bildern
    function rechnen(){
      let img = null;
      let segmentation = null;
      return Speicher.lesen('foto-key:' + index)
        .then(key => key ? Speicher.dateiAlsUrl(key) : null)
        .then(url => {
          if(!url) throw new Error('kein Foto');
          return Personen.bildAusUrl(url);
        })
        .then(bild => {
          img = bild;
          zeigeCanvas(0, Stempel.bilder.roh(img));
          return warten(PAUSE_MS);
        })
        .then(() => {
          // Schwarz-Weiß zuerst ohne KI, damit es sofort etwas zu sehen gibt
          const ohneKi = Stempel.berechnen(img, null);
          zeigeCanvas(1, Stempel.bilder.grau(ohneKi.gray));
          felder[2].notiz.textContent = 'Die KI sucht dich … (beim ersten Mal dauert es etwas)';
          return Personen.segmentieren(img).catch(err => {
            console.error(err);
            return null;
          });
        })
        .then(seg => {
          segmentation = seg;
          ergebnis = Stempel.berechnen(img, segmentation);
          zeigeCanvas(2, Stempel.bilder.person(ergebnis.gray, ergebnis.personMask));
          felder[2].notiz.textContent = ergebnis.personMask
            ? 'Pink = Person (' + Math.round(ergebnis.personAnteil * 100) + ' % des Bildes)'
            : 'Keine Person gefunden: Das ganze Bild wird verwendet.';
          return warten(PAUSE_MS);
        })
        .then(() => {
          zeigeCanvas(3, Stempel.bilder.maske(ergebnis.mask));
          felder[3].notiz.textContent = 'Heller als ' + ergebnis.schwelle + ' wird weiß, dunkler wird schwarz';
          // Stempel-Porträt fürs Puzzle in der Kopfleiste
          return Speicher.dateiSchreiben('portraet:' + index, Bild.alsPng(Stempel.bilder.maske(ergebnis.mask)));
        })
        .then(() => warten(PAUSE_MS))
        .then(() => {
          regler.value = String(stand.randMm || Stempel.autoOffset(ergebnis.mask));
          stand.randMm = parseFloat(regler.value);
          eintrag.stempel[index] = stand;
          randBox.hidden = false;
          stempelZeichnen();
          if(stand.gesendetMm !== undefined) sendStatus.textContent = '✓ Dieser Stempel ist schon abgeschickt.';
          return api.speichern();
        })
        .catch(err => {
          api.fehler(err && err.message === 'kein Foto'
            ? 'Kein Foto gefunden. Mach zuerst die Foto-Station.'
            : 'Die Bildbearbeitung hat nicht geklappt. Lade die Seite neu.', err);
        });
    }

    return { box: box, rechnen: rechnen };
  }

  Rahmen.eigeneArt('stempel', {
    anzeigen: (station, api) => {
      const personen = api.gruppe.personen.map((name, i) => person(station, api, i, name));
      // Nacheinander rechnen: zwei Fotos gleichzeitig wären zu viel für alte iPads
      personen.reduce((kette, p) => kette.then(p.rechnen), Promise.resolve());
      return api.el('div', { klasse: 'stempel-station' }, [
        api.el('p', { klasse: 'legende' }, [
          api.el('span', { klasse: 'farbe rot' }), api.el('span', { text: ' Rot ' }),
          api.el('span', { klasse: 'farbe blau' }), api.el('span', { text: ' Blau ' }),
          api.el('span', { klasse: 'farbe weiss' }), api.el('span', { text: ' Weiß: Was bedeuten die Farben? Die Frage steht unten.' })
        ])
      ].concat(personen.map(p => p.box)));
    },
    erfuellt: (eintrag, gruppe) => gruppe.personen.every((n, i) => eintrag.stempel && eintrag.stempel[i] && eintrag.stempel[i].gesendetMm !== undefined)
  });
})();
