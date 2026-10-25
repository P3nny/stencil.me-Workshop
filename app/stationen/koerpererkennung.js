// ---- Station „Körpererkennung testen“ ----
// Live-Kamera braucht HTTPS, der Laptop läuft mit HTTP. Darum: kurzes Video mit der
// Kamera-App aufnehmen, die App spielt es in Schleife ab und BodyPix rechnet Bild für
// Bild mit. Regler und Ansicht wirken sofort. Das Video bleibt nur im Arbeitsspeicher.
(function(){
  // Schonend für alte iPads: kleines Arbeitsbild, leichtes Modell, höchstens
  // MAX_BILDER_PRO_SEK, Auflösung immer „grob“ (Patricia, 25.10.: auch gute iPads kommen
  // sonst nicht hinterher)
  const ARBEIT_PX = 320; // längere Seite, auf der BodyPix rechnet
  const MAX_BILDER_PRO_SEK = 6;
  const PAUSE_PRUEF_MS = 250; // so oft schaut die App nach, ob das Video wieder läuft
  const VIDEO_TIMEOUT_MS = 30000; // so lange darf Laden + erstes KI-Bild dauern
  const ANSICHTEN = [
    { id: 'person', text: 'Person' },
    { id: 'teile', text: 'Körperteile' },
    { id: 'unscharf', text: 'Hintergrund unscharf' }
  ];

  Rahmen.eigeneArt('koerpererkennung', {
    anzeigen: (station, api) => {
      const el = api.el;
      const eintrag = api.eintrag;
      eintrag.aufgaben = eintrag.aufgaben || {};
      eintrag.bildKi = eintrag.bildKi || {};
      const einstellung = { ansicht: 'person', aufloesung: 'low', schwelle: 0.5, deckkraft: 0.6 };

      // ---- Video aufnehmen ----
      const input = el('input', { type: 'file', accept: 'video/*', capture: 'user' });
      input.hidden = true;
      const aufnehmen = el('button', { type: 'button', text: '🎥 Video aufnehmen', onclick: () => input.click() });
      const video = el('video', { muted: 'muted', playsinline: 'playsinline', loop: 'loop' });
      video.muted = true;
      video.hidden = true;
      const ausgabe = el('canvas', { klasse: 'ki-ausgabe' });
      ausgabe.hidden = true;
      const arbeit = document.createElement('canvas');
      const status = el('p', { klasse: 'hinweis', text: 'Noch kein Video. Tipp: Kamera auf den Tisch stellen, beide ins Bild.' });
      const tempo = el('p', { klasse: 'tempo' });

      // ---- Regler ----
      function knopfGruppe(liste, feld, beiWahl){
        const gruppe = el('div', { klasse: 'auswahl' });
        liste.forEach(o => gruppe.appendChild(el('button', {
          type: 'button', klasse: 'wahl' + (einstellung[feld] === o.id ? ' an' : ''), text: o.text,
          onclick: ev => {
            einstellung[feld] = o.id;
            Array.prototype.forEach.call(gruppe.children, b => b.classList.toggle('an', b === ev.target));
            if(beiWahl) beiWahl();
          }
        })));
        return gruppe;
      }
      function regler(text, feld, min, max, schritt, hinweis){
        const wert = el('strong', { text: String(einstellung[feld]).replace('.', ',') });
        const r = el('input', { type: 'range', min: String(min), max: String(max), step: String(schritt) });
        r.value = String(einstellung[feld]);
        r.addEventListener('input', () => {
          einstellung[feld] = parseFloat(r.value);
          wert.textContent = r.value.replace('.', ',');
        });
        return el('label', { klasse: 'ki-regler' }, [el('span', {}, [el('span', { text: text + ': ' }), wert]), r, el('span', { klasse: 'hinweis', text: hinweis })]);
      }
      const regelung = el('div', { klasse: 'ki-regelung' }, [
        el('p', { klasse: 'regel-titel', text: 'Ansicht' }),
        knopfGruppe(ANSICHTEN, 'ansicht'),
        regler('Schwelle', 'schwelle', 0.1, 0.9, 0.05, 'Wie sicher muss die KI sein, dass ein Pixel zu einer Person gehört?'),
        regler('Deckkraft der Farbe', 'deckkraft', 0, 1, 0.1, '0 = nur Video, 1 = nur KI-Farbe')
      ]);
      regelung.hidden = true;

      // ---- Bild der KI-Ansicht ----
      const bildKnopf = el('button', { type: 'button', text: '📸 Bild der KI-Ansicht speichern', disabled: 'disabled' });
      const bildVorschau = el('img', { klasse: 'ki-bild', alt: '' });
      bildVorschau.hidden = true;
      const bildStatus = el('p', { klasse: 'hinweis' });
      if(eintrag.bildKi.key){
        Speicher.dateiAlsUrl(eintrag.bildKi.key).then(url => { if(url){ bildVorschau.src = url; bildVorschau.hidden = false; } });
        bildStatus.textContent = '✓ Bild ist abgeschickt. Du kannst ein neues speichern.';
      }

      // ---- Aufgaben ----
      const mindest = (station.check && station.check.mindestAufgaben) || 0;
      const aufgabenZaehler = el('p', { klasse: 'hinweis' });
      function zaehlen(){
        const n = Object.keys(eintrag.aufgaben).filter(k => eintrag.aufgaben[k]).length;
        aufgabenZaehler.textContent = n + ' von ' + (station.aufgaben || []).length + ' ausprobiert' + (mindest ? ' (mindestens ' + mindest + ')' : '');
      }
      const aufgaben = el('div', { klasse: 'aufgaben' }, (station.aufgaben || []).map((t, i) => {
        const box = el('input', { type: 'checkbox', id: 'aufgabe-' + i });
        box.checked = !!eintrag.aufgaben[i];
        box.addEventListener('change', () => {
          eintrag.aufgaben[i] = box.checked;
          zaehlen();
          api.speichern();
          api.pruefen();
        });
        return el('label', { klasse: 'aufgabe', for: 'aufgabe-' + i }, [box, el('span', { text: t })]);
      }));
      zaehlen();

      // ---- Rechnen: Bild für Bild ----
      let laeuft = false;
      let bilder = 0;
      let tempoStart = 0;

      function zeichnen(net){
        if(!laeuft) return;
        if(!document.body.contains(ausgabe)){ laeuft = false; return; } // Seite gewechselt
        // Pause, Tab im Hintergrund oder Video lädt noch: nicht rechnen, nur ab und zu nachsehen
        if(video.paused || document.hidden || video.readyState < 2){
          setTimeout(() => zeichnen(net), PAUSE_PRUEF_MS);
          return;
        }
        const beginn = performance.now();
        const ctx = arbeit.getContext('2d');
        ctx.drawImage(video, 0, 0, arbeit.width, arbeit.height);
        const opt = { internalResolution: einstellung.aufloesung, segmentationThreshold: einstellung.schwelle };
        const fertig = einstellung.ansicht === 'teile'
          ? net.segmentPersonParts(arbeit, opt).then(seg => {
            bodyPix.drawMask(ausgabe, arbeit, bodyPix.toColoredPartMask(seg), einstellung.deckkraft, 0, false);
          })
          : net.segmentPerson(arbeit, opt).then(seg => {
            if(einstellung.ansicht === 'unscharf'){
              bodyPix.drawBokehEffect(ausgabe, arbeit, seg, 8, 3, false);
            }else{
              const maske = bodyPix.toMask(seg, { r: 255, g: 45, b: 149, a: 255 }, { r: 0, g: 0, b: 0, a: 0 });
              bodyPix.drawMask(ausgabe, arbeit, maske, einstellung.deckkraft, 0, false);
            }
          });
        fertig.then(() => {
          bilder++;
          erstesBild = true;
          const sek = (performance.now() - tempoStart) / 1000;
          if(sek > 2){
            const proSek = bilder / sek;
            tempo.textContent = proSek.toFixed(1).replace('.', ',') + ' Bilder pro Sekunde';
            bilder = 0;
            tempoStart = performance.now();
          }
          bildKnopf.disabled = false;
        }).catch(err => {
          console.error(err);
        }).then(() => {
          const warten = Math.max(0, 1000 / MAX_BILDER_PRO_SEK - (performance.now() - beginn));
          setTimeout(() => zeichnen(net), warten);
        });
      }

      // Video lässt sich nicht abspielen (Format, Speicher): Hinweis statt endlos warten
      let wachhund = null;
      let erstesBild = false;
      function wachhundStarten(){
        clearTimeout(wachhund);
        erstesBild = false;
        wachhund = setTimeout(() => {
          if(!erstesBild) status.textContent = '⚠ Das Video läuft nicht. Nimm bitte ein neues, kürzeres Video auf (5 bis 10 Sekunden).';
        }, VIDEO_TIMEOUT_MS);
      }

      input.addEventListener('change', () => {
        const datei = input.files && input.files[0];
        if(!datei) return;
        wachhundStarten();
        if(video.src) URL.revokeObjectURL(video.src);
        status.textContent = 'Video wird geladen, die KI startet … (beim ersten Mal dauert es etwas)';
        video.src = URL.createObjectURL(datei);
        input.value = '';
        Promise.all([
          Personen.netz('leicht'),
          new Promise((resolve, reject) => {
            video.onloadeddata = resolve;
            video.onerror = () => reject(new Error('Video lässt sich nicht abspielen'));
          })
        ]).then(werte => {
          const scale = Math.min(1, ARBEIT_PX / Math.max(video.videoWidth, video.videoHeight));
          arbeit.width = ausgabe.width = Math.round(video.videoWidth * scale);
          arbeit.height = ausgabe.height = Math.round(video.videoHeight * scale);
          ausgabe.hidden = false;
          regelung.hidden = false;
          aufnehmen.textContent = '🎥 Neues Video aufnehmen';
          status.textContent = 'Die KI rechnet auf deinem Video. Tippe aufs Bild für Pause.';
          return video.play().then(() => {
            tempoStart = performance.now();
            bilder = 0;
            if(!laeuft){
              laeuft = true;
              zeichnen(werte[0]);
            }
          });
        }).catch(err => api.fehler('Das Video lässt sich nicht abspielen. Nimm bitte ein neues auf.', err));
      });

      ausgabe.addEventListener('click', () => { if(video.paused) video.play(); else video.pause(); });

      bildKnopf.addEventListener('click', () => {
        bildKnopf.disabled = true;
        const key = 'koerpererkennung:' + Speicher.neueId();
        const alt = eintrag.bildKi.key;
        Speicher.dateiSchreiben(key, Bild.alsJpeg(ausgabe))
          .then(() => alt ? Speicher.dateiSchreiben(alt, undefined) : null)
          .then(() => {
            eintrag.bildKi = { key: key, gesendet: true };
            return api.speichern();
          })
          .then(() => Speicher.dateiAlsUrl(key))
          .then(url => {
            bildVorschau.src = url;
            bildVorschau.hidden = false;
            bildStatus.textContent = '✓ Gespeichert auf dem iPad. Es bleibt dort.';
            api.pruefen();
          })
          .catch(err => api.fehler('Das Bild ließ sich nicht speichern. Bitte nochmal antippen.', err))
          .then(() => { bildKnopf.disabled = false; });
      });

      // Aufgaben zuerst (Patricia, 25.10.): Die Kinder lesen sie, bevor sie das Video aufnehmen
      return el('div', { klasse: 'koerper-station' }, [
        el('h2', { text: 'Aufgaben zum Ausprobieren' }),
        aufgabenZaehler,
        aufgaben,
        el('h2', { text: 'Video aufnehmen' }),
        aufnehmen, input, status, video,
        el('div', { klasse: 'ki-buehne' }, [el('div', {}, [ausgabe, tempo]), regelung]),
        el('h2', { text: 'Bild der KI-Ansicht' }),
        bildKnopf, bildStatus, bildVorschau
      ]);
    },
    erfuellt: (eintrag, gruppe, station) => {
      const n = Object.keys(eintrag.aufgaben || {}).filter(k => eintrag.aufgaben[k]).length;
      return !!(eintrag.bildKi && eintrag.bildKi.gesendet) && n >= ((station.check && station.check.mindestAufgaben) || 0);
    }
  });
})();
