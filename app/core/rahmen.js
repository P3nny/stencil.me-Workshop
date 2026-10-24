// ---- Rahmen jeder Station ----
// Kopfleiste (Namen, „x von y“, Puzzle), Check-in, Schritte, Input,
// „Station beendet“, Abschlussfragen und Vorschlag für die nächste Station.
// Eigene Stationsteile (stencil.me, Hintergrund ändern) liegen in app/stationen/
// und melden sich mit Rahmen.eigeneArt() an.
(function(){
  const TYP_TEXT = { programm: 'Computerprogramm', ki: 'KI (Bildbearbeitung)', generativ: 'Generative KI', analog: 'Ohne Computer' };
  const DATENWEG_TEXT = { ipad: 'Bleibt auf dem iPad', laptop: 'Geht an den Laptop', 'laptop-video': 'Geht an den Laptop · Video: YouTube', online: 'Geht an einen Online-Dienst' };
  const KI_ANTWORTEN = [
    { wert: 'generativ', text: 'Generative KI' },
    { wert: 'ki', text: 'Bildbearbeitungs-KI' },
    { wert: 'programm', text: 'Keine KI, nur ein Programm' },
    { wert: 'analog', text: 'Ohne Computer' },
    { wert: 'weiss-nicht', text: 'Weiß nicht' }
  ];
  // Eigene Stationsteile (z. B. stencil.me): art -> { anzeigen(station, api), erfuellt(eintrag, gruppe, station) }
  const eigeneArten = {};
  const TEST = /[?&]test\b/.test(location.search);

  // ---- kleine Helfer ----
  function el(tag, attrs, kinder){
    const e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(k => {
      if(k === 'text') e.textContent = attrs[k];
      else if(k === 'klasse') e.className = attrs[k];
      else if(k.indexOf('on') === 0) e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    (kinder || []).forEach(k => { if(k) e.appendChild(k); });
    return e;
  }

  let fehlerTimer = null;
  function fehler(text, err){
    if(err) console.error(err);
    const box = document.getElementById('fehler');
    box.textContent = text;
    box.hidden = false;
    clearTimeout(fehlerTimer);
    fehlerTimer = setTimeout(() => { box.hidden = true; }, 10000);
  }
  const ALLGEMEINER_FEHLER = 'Da ist etwas schiefgegangen. Probier es nochmal.';
  window.addEventListener('error', e => fehler(ALLGEMEINER_FEHLER, e.error || e.message));
  window.addEventListener('unhandledrejection', e => fehler(ALLGEMEINER_FEHLER, e.reason));

  // ---- Kopfleiste ----
  // Pro Person ein Puzzle mit so vielen Teilen wie Stationen. Pro fertiger Station
  // kommt ein Teil dazu. Bild: Stempel-Porträt (ab Screen 3), sonst das Foto.
  function portraetUrl(i){
    return Speicher.dateiAlsUrl('portraet:' + i).then(url => url || Speicher.lesen('foto-key:' + i).then(key => key ? Speicher.dateiAlsUrl(key) : null));
  }

  function puzzle(name, bildUrl, teile, fertig){
    const spalten = Math.ceil(Math.sqrt(teile));
    const zeilen = Math.ceil(teile / spalten);
    const feld = el('div', { klasse: 'puzzle-feld' });
    feld.style.gridTemplateColumns = 'repeat(' + spalten + ', 1fr)';
    for(let i = 0; i < spalten * zeilen; i++){
      const teil = el('div', { klasse: 'puzzle-teil' + (i < fertig ? ' da' : '') });
      if(i < fertig && bildUrl){
        teil.style.backgroundImage = 'url(' + bildUrl + ')';
        teil.style.backgroundSize = (spalten * 100) + '% ' + (zeilen * 100) + '%';
        teil.style.backgroundPosition = (spalten > 1 ? (i % spalten) / (spalten - 1) * 100 : 0) + '% ' + (zeilen > 1 ? Math.floor(i / spalten) / (zeilen - 1) * 100 : 0) + '%';
      }
      feld.appendChild(teil);
    }
    return el('div', { klasse: 'puzzle' }, [feld, el('div', { klasse: 'puzzle-name', text: name })]);
  }

  function kopfleiste(gruppe, liste, f){
    const kopf = document.getElementById('kopf');
    const fertig = Stationen.anzahlFertig(liste, f);
    return Promise.all(gruppe.personen.map((p, i) => portraetUrl(i))).then(urls => {
      kopf.innerHTML = '';
      const gesamt = Stationen.anzahlPflicht(liste);
      kopf.appendChild(el('div', { klasse: 'puzzles' }, gruppe.personen.map((name, i) => puzzle(name, urls[i], gesamt, fertig))));
      kopf.appendChild(el('div', { klasse: 'zaehler' }, [
        el('strong', { text: fertig + ' von ' + gesamt }),
        el('span', { text: ' Stationen geschafft' })
      ]));
      kopf.appendChild(el('div', { klasse: 'sync', id: 'sync' }));
      // Nachrichten vom Laptop (einmal pro Seite starten, der Kopf wird öfter neu gezeichnet)
      if(window.Nachrichten && !nachrichtenBox){
        nachrichtenBox = el('div');
        kopf.parentNode.insertBefore(nachrichtenBox, kopf);
        Nachrichten.starten(nachrichtenBox, gruppe.id);
      }
      if(!syncBeobachtet){
        syncBeobachtet = true;
        Outbox.beobachten(syncAnzeigen);
      }
      Outbox.abarbeiten();
    });
  }

  let syncBeobachtet = false;
  let nachrichtenBox = null;
  function syncAnzeigen(stand){
    const box = document.getElementById('sync');
    if(!box) return;
    const teile = [stand.dauerhaft ? '✓ Gesichert auf dem iPad' : '⚠ Nur vorübergehend gespeichert. App bitte nicht schließen.'];
    if(stand.gesamt && !stand.offen) teile.push('✓ Gesichert auf dem Laptop');
    if(stand.offen) teile.push('… ' + stand.offen + ' noch nicht beim Laptop');
    box.textContent = teile.join(' · ');
  }

  // ---- Station ----
  let ctx = null; // { gruppe, liste, f, station, eintrag, pruefen }

  // Andere Tabs (jeder QR-Scan öffnet einen neuen) speichern ihre Stationen ebenfalls.
  // Darum frisch lesen und nur die eigene Station einsetzen, nie den alten Stand
  // der ganzen Gruppe zurückschreiben.
  function frischUebernehmen(){
    return Stationen.fortschritt().then(frisch => {
      Object.keys(frisch.stationen).forEach(id => {
        if(id !== ctx.station.id) ctx.f.stationen[id] = frisch.stationen[id];
      });
      ctx.f.aktuell = frisch.aktuell;
    });
  }

  function speichern(){
    const aktuell = ctx.f.aktuell;
    return frischUebernehmen().then(() => {
      ctx.f.aktuell = aktuell;
      return Stationen.fortschrittSpeichern(ctx.f);
    });
  }

  function etiketten(station, mitTyp){
    return el('div', { klasse: 'etiketten' }, [
      mitTyp ? el('span', { klasse: 'etikett typ-' + station.typ, text: TYP_TEXT[station.typ] || station.typ }) : null,
      el('span', { klasse: 'etikett datenweg', text: DATENWEG_TEXT[station.datenweg] || station.datenweg })
    ]);
  }

  function fotoFeld(station, index, name){
    const eintrag = ctx.eintrag;
    const vorschau = el('img', { klasse: 'foto-vorschau', alt: '' });
    vorschau.hidden = true;
    const keyAlt = (eintrag.dateien || {})[index];
    if(keyAlt) Speicher.dateiAlsUrl(keyAlt).then(url => { if(url){ vorschau.src = url; vorschau.hidden = false; } });

    const input = el('input', { type: 'file', accept: 'image/*', capture: station.id === 'foto' ? 'user' : 'environment' });
    input.hidden = true;
    const status = el('div', { klasse: 'hinweis' });
    const knopf = el('button', { type: 'button', text: keyAlt ? 'Neues Foto' : 'Foto aufnehmen', onclick: () => input.click() });

    input.addEventListener('change', () => {
      const datei = input.files && input.files[0];
      if(!datei) return;
      status.textContent = 'Wird gespeichert …';
      knopf.disabled = true;
      Bild.fotoVerkleinern(datei)
        .then(bild => {
          const key = station.id + ':' + index + ':' + Speicher.neueId();
          const alt = (eintrag.dateien || {})[index];
          eintrag.dateien = eintrag.dateien || {};
          eintrag.dateien[index] = key;
          return Speicher.dateiSchreiben(key, bild)
            .then(() => alt ? Speicher.dateiSchreiben(alt, undefined) : null)
            // Rohfoto der Foto-Station merken: brauchen spätere Stationen und das Puzzle
            .then(() => station.id === 'foto' ? Speicher.schreiben('foto-key:' + index, key) : null)
            .then(speichern)
            .then(() => Speicher.dateiAlsUrl(key));
        })
        .then(url => {
          vorschau.src = url;
          vorschau.hidden = false;
          status.textContent = station.check.hochladen ? '✓ Foto gespeichert (geht beim Beenden an den Laptop)' : '✓ Foto gespeichert (bleibt auf dem iPad)';
          knopf.textContent = 'Neues Foto';
          ctx.pruefen();
          if(station.check.personPruefen) return personPruefen(knopf.parentNode.querySelector('.ki-pruefung'), index, url);
        })
        .catch(err => fehler('Das Foto hat nicht geklappt. Mach bitte ein neues.', err))
        .then(() => { knopf.disabled = false; input.value = ''; });
    });

    const titel = station.check.proPerson ? (station.check.text || 'Foto von') + ' ' + name : (station.check.text || 'Foto');
    const ki = el('div', { klasse: 'ki-pruefung' });
    if(station.check.personPruefen){
      // Abgebrochene Prüfung (Seite neu geladen): Foto gilt, der Workshop soll nicht hängen
      if((eintrag.person || {})[index] === 'pruefen') eintrag.person[index] = 'fehler';
      personAnzeigen(ki, index);
    }
    return el('div', { klasse: 'foto-feld' }, [el('p', { klasse: 'foto-titel', text: titel }), knopf, input, status, el('div', { klasse: 'foto-ergebnis' }, [vorschau, ki])]);
  }

  // ---- KI prüft: Ist eine Person auf dem Foto? ----
  const PERSON_TEXT = {
    pruefen: '🔍 Die KI sucht dich auf dem Foto … (beim ersten Mal dauert es etwas)',
    ok: '✓ Die KI hat dich erkannt.',
    klein: '✓ Die KI hat dich erkannt, aber du bist ziemlich klein. Tipp: näher ran an die Kamera.',
    keine: '✗ Die KI findet hier keine Person. Mach ein neues Foto: Gesicht groß, nur Packpapier dahinter.',
    trotzdem: 'Du nimmst das Foto, obwohl die KI keine Person gefunden hat.',
    fehler: 'Die KI konnte das Foto nicht prüfen. Es geht trotzdem weiter.'
  };
  const pruefTokens = {};

  function personAnzeigen(box, index){
    const zustand = (ctx.eintrag.person || {})[index];
    box.innerHTML = '';
    box.className = 'ki-pruefung' + (zustand ? ' ' + zustand : '');
    if(!zustand) return;
    box.appendChild(el('p', { text: PERSON_TEXT[zustand] }));
    if(zustand === 'keine'){
      box.appendChild(el('button', { type: 'button', klasse: 'secondary klein', text: 'Trotzdem nehmen', onclick: () => {
        ctx.eintrag.person[index] = 'trotzdem';
        speichern();
        personAnzeigen(box, index);
        ctx.pruefen();
      } }));
    }
  }

  function personPruefen(box, index, url){
    const token = (pruefTokens[index] || 0) + 1;
    pruefTokens[index] = token;
    ctx.eintrag.person = ctx.eintrag.person || {};
    ctx.eintrag.person[index] = 'pruefen';
    personAnzeigen(box, index);
    ctx.pruefen();
    return Personen.pruefen(url).then(ergebnis => {
      if(pruefTokens[index] !== token) return; // inzwischen neues Foto
      ctx.eintrag.person[index] = ergebnis.status;
      return speichern().then(() => {
        personAnzeigen(box, index);
        ctx.pruefen();
      });
    });
  }

  function checkBereich(station){
    const check = station.check || { art: 'bestaetigung' };
    const eintrag = ctx.eintrag;
    if(eigeneArten[check.art]){
      return el('div', { klasse: 'check' }, [eigeneArten[check.art].anzeigen(station, {
        gruppe: ctx.gruppe, eintrag: eintrag, speichern: speichern, pruefen: () => ctx.pruefen(), fehler: fehler, el: el,
        liste: ctx.liste, fortschritt: ctx.f
      })]);
    }
    if(check.art === 'foto'){
      const personen = check.proPerson ? ctx.gruppe.personen : [''];
      return el('div', { klasse: 'check' }, personen.map((name, i) => fotoFeld(station, i, name)));
    }
    if(check.art === 'text') return null; // nur Eingaben
    let text = 'Erledigt';
    let link = null;
    if(check.art === 'quiz') return quizBereich(station, check);
    const bekannt = check.art === 'bestaetigung';
    const hinweis = bekannt ? null : el('p', { klasse: 'hinweis', text: 'Diese Seite wird noch gebaut. Bis dahin: wie bisher an der Station arbeiten und dann „Erledigt“ antippen.' });
    const box = el('input', { type: 'checkbox', id: 'erledigt' });
    box.checked = !!eintrag.bestaetigt;
    box.addEventListener('change', () => {
      eintrag.bestaetigt = box.checked;
      speichern();
      ctx.pruefen();
    });
    return el('div', { klasse: 'check' }, [hinweis, link, el('label', { klasse: 'haken', for: 'erledigt' }, [box, el('span', { text: text })])]);
  }

  // Quiz-Seite (code-quiz.html, kunst-quiz.html) eingebettet. Sie meldet am Ende ihr
  // Ergebnis per postMessage. Optional zusätzlich Fotos (check.foto wie bei art 'foto').
  function quizBereich(station, check){
    const eintrag = ctx.eintrag;
    const status = el('p', { klasse: 'quiz-status' });
    function statusZeigen(){
      const e = eintrag.quizErgebnis;
      status.className = 'quiz-status' + (e ? ' fertig' : '');
      status.textContent = e ? '✓ Quiz geschafft: ' + e.richtig + ' von ' + e.gesamt + ' richtig' : 'Spielt das Quiz bis zum Ende, dann wird es hier abgehakt.';
    }
    const rahmen = el('iframe', { src: check.url, klasse: 'quiz-rahmen', title: 'Quiz' });
    window.addEventListener('message', ev => {
      if(ev.source !== rahmen.contentWindow || ev.origin !== location.origin || !ev.data || !ev.data.stencilQuiz) return;
      const e = ev.data.stencilQuiz;
      eintrag.quizErgebnis = { richtig: Number(e.richtig) || 0, gesamt: Number(e.gesamt) || 0 };
      eintrag.antworten = eintrag.antworten || {};
      eintrag.antworten.quiz = eintrag.quizErgebnis.richtig + ' von ' + eintrag.quizErgebnis.gesamt + ' richtig';
      statusZeigen();
      speichern();
      ctx.pruefen();
    });
    statusZeigen();
    const teile = [status, rahmen];
    if(check.foto){
      // fotoFeld liest station.check: hier die Foto-Angaben des Quiz-Checks
      const fotoStation = { id: station.id, check: check.foto };
      const personen = check.foto.proPerson ? ctx.gruppe.personen : [''];
      personen.forEach((name, i) => teile.push(fotoFeld(fotoStation, i, name)));
    }
    return el('div', { klasse: 'check' }, teile);
  }

  function eingabenBereich(station){
    const eintrag = ctx.eintrag;
    eintrag.antworten = eintrag.antworten || {};
    let timer = null;
    if(!(station.eingaben || []).length) return null;
    const diktat = el('p', { klasse: 'hinweis', text: '🎤 Tipp: Statt zu tippen könnt ihr auch die Mikrofon-Taste auf der Tastatur antippen und sprechen.' });
    return el('div', { klasse: 'eingaben' }, [diktat].concat((station.eingaben || []).map(e => {
      const feld = el('textarea', { rows: '3', id: 'eingabe-' + e.id });
      feld.value = eintrag.antworten[e.id] || '';
      feld.addEventListener('input', () => {
        eintrag.antworten[e.id] = feld.value;
        ctx.pruefen();
        clearTimeout(timer);
        timer = setTimeout(speichern, 400);
      });
      return el('label', { klasse: 'eingabe', for: 'eingabe-' + e.id }, [el('span', { text: e.text + (e.pflicht ? '' : ' (freiwillig)') }), feld]);
    })));
  }

  function inputErfuellt(station){
    const eintrag = ctx.eintrag;
    const check = station.check || { art: 'bestaetigung' };
    const texteOk = (station.eingaben || []).every(e => !e.pflicht || ((eintrag.antworten || {})[e.id] || '').trim().length > 0);
    if(!texteOk) return false;
    if(check.art === 'foto'){
      const anzahl = check.proPerson ? ctx.gruppe.personen.length : 1;
      for(let i = 0; i < anzahl; i++){
        if(!(eintrag.dateien || {})[i]) return false;
        const person = (eintrag.person || {})[i];
        if(check.personPruefen && (person === 'pruefen' || person === 'keine')) return false;
      }
      return true;
    }
    if(check.art === 'text') return true;
    if(check.art === 'quiz'){
      if(!eintrag.quizErgebnis) return false;
      if(!check.foto) return true;
      const fotos = check.foto.proPerson ? ctx.gruppe.personen.length : 1;
      for(let i = 0; i < fotos; i++) if(!(eintrag.dateien || {})[i]) return false;
      return true;
    }
    if(eigeneArten[check.art]) return eigeneArten[check.art].erfuellt(eintrag, ctx.gruppe, station);
    return !!eintrag.bestaetigt;
  }

  // Beispielbilder: gut (✓) und nicht so gut (✗). Bilder liegen in /stationen/bilder
  function beispiele(station){
    if(!station.beispiele || !station.beispiele.length) return null;
    return el('div', { klasse: 'beispiele' }, station.beispiele.map(b => el('figure', { klasse: b.gut ? 'gut' : 'schlecht' }, [
      el('img', { src: '/stationen/' + b.bild, alt: b.text }),
      el('figcaption', { text: (b.gut ? '✓ ' : '✗ ') + b.text })
    ])));
  }

  // Video erst nach Antippen laden (Zwei-Klick): Vorher geht nichts an YouTube
  function video(station){
    const v = station.video;
    if(!v || !/^[A-Za-z0-9_-]{11}$/.test(v.youtube || '')) return null;
    const box = el('div', { klasse: 'video' });
    const knopf = el('button', { type: 'button', text: '▶ Video laden', onclick: () => {
      box.innerHTML = '';
      box.appendChild(el('iframe', {
        src: 'https://www.youtube-nocookie.com/embed/' + v.youtube + '?rel=0',
        title: v.titel || 'Video',
        allow: 'encrypted-media; picture-in-picture; fullscreen',
        allowfullscreen: 'allowfullscreen',
        referrerpolicy: 'strict-origin-when-cross-origin'
      }));
    } });
    box.appendChild(el('div', { klasse: 'video-platzhalter' }, [
      el('p', { klasse: 'video-titel', text: '🎬 ' + (v.titel || 'Video') + (v.quelle ? ' (' + v.quelle + ')' : '') }),
      knopf,
      el('p', { klasse: 'hinweis', text: 'Das Video kommt von YouTube. Wenn du es lädst, sieht YouTube die Adresse dieses iPads.' })
    ]));
    return box;
  }

  function stationZeigen(){
    const station = ctx.station;
    const inhalt = document.getElementById('inhalt');
    inhalt.innerHTML = '';
    const beendenKnopf = el('button', { type: 'button', klasse: 'gross', text: 'Station beendet', onclick: abschlussZeigen });
    const fehltHinweis = el('p', { klasse: 'hinweis' });
    ctx.pruefen = () => {
      const ok = inputErfuellt(station);
      beendenKnopf.disabled = !ok;
      fehltHinweis.textContent = ok ? '' : 'Erst wenn alles oben erledigt ist, geht es weiter.';
    };
    const links = (station.links || []).filter(l => l.url).map(l => el('a', { href: l.url, target: '_blank', klasse: 'knopf-link', text: l.text }));
    inhalt.appendChild(el('section', { klasse: 'panel' }, [
      el('h1', { text: station.titel }),
      etiketten(station, false),
      el('ol', { klasse: 'schritte' }, station.schritte.map(s => el('li', { text: s }))),
      beispiele(station),
      links.length ? el('div', { klasse: 'links' }, links) : null,
      video(station),
      checkBereich(station),
      eingabenBereich(station),
      el('p', { klasse: 'datenschutz', text: '🔒 ' + station.datenschutz }),
      beendenKnopf,
      fehltHinweis
    ]));
    ctx.pruefen();
  }

  function abschlussZeigen(){
    const station = ctx.station;
    const eintrag = ctx.eintrag;
    const fragen = station.fragen || ['sterne'];
    const inhalt = document.getElementById('inhalt');
    inhalt.innerHTML = '';
    const fertigKnopf = el('button', { type: 'button', klasse: 'gross', text: 'Fertig', onclick: beenden });
    const aufloesung = el('div', { klasse: 'aufloesung' });
    const pruefen = () => {
      fertigKnopf.disabled = (fragen.indexOf('ki-typ') >= 0 && !eintrag.kiTyp) || (fragen.indexOf('sterne') >= 0 && !eintrag.sterne);
      // Das Typ-Etikett erst nach der Antwort zeigen, sonst wird nur abgeschrieben
      aufloesung.innerHTML = '';
      if(eintrag.kiTyp) aufloesung.appendChild(el('p', {}, [el('span', { text: 'Auflösung: ' }), etiketten(station, true).firstChild]));
    };
    const teile = [el('h1', { text: station.titel + ': geschafft?' })];
    // Reihenfolge (Patricia, 24.10.): erst Auflösungen, dann „Was hast du genutzt?“, dann Sterne
    // Auflösung zu Fragen der Station (z. B. „Was bedeuten die Farben?“), erst nach der eigenen Antwort
    (station.eingaben || []).filter(e => e.aufloesung).forEach(e => {
      teile.push(el('h2', { text: e.text }));
      teile.push(el('p', { klasse: 'deine-antwort' }, [el('span', { text: 'Deine Antwort: ' }), el('em', { text: (eintrag.antworten || {})[e.id] || '–' })]));
      teile.push(el('p', { klasse: 'aufloesung-text' }, [el('strong', { text: 'Auflösung: ' }), el('span', { text: e.aufloesung })]));
    });
    if(fragen.indexOf('ki-typ') >= 0){
      teile.push(el('h2', { text: 'Hast du hier gerade generative KI oder Bildbearbeitungs-KI genutzt?' }));
      teile.push(el('details', { klasse: 'ki-hilfe' }, [
        el('summary', { text: 'Was ist der Unterschied?' }),
        el('p', {}, [el('strong', { text: 'Programm: ' }), el('span', { text: 'feste Regeln. Gleiche Eingabe, immer gleiches Ergebnis.' })]),
        el('p', {}, [el('strong', { text: 'Bildbearbeitungs-KI: ' }), el('span', { text: 'hat aus Beispielen gelernt. Sie erkennt oder verändert dein Bild, erfindet aber nichts Neues.' })]),
        el('p', {}, [el('strong', { text: 'Generative KI: ' }), el('span', { text: 'erfindet neue Bilder oder Texte. Gleicher Auftrag, jedes Mal etwas anderes.' })])
      ]));
      teile.push(el('div', { klasse: 'auswahl' }, KI_ANTWORTEN.map(a => el('button', {
        type: 'button', klasse: 'wahl' + (eintrag.kiTyp === a.wert ? ' an' : ''), text: a.text,
        onclick: ev => {
          eintrag.kiTyp = a.wert;
          Array.prototype.forEach.call(ev.target.parentNode.children, b => b.classList.toggle('an', b === ev.target));
          speichern();
          pruefen();
        }
      }))));
      teile.push(aufloesung);
    }
    if(fragen.indexOf('sterne') >= 0){
      teile.push(el('h2', { text: 'Wie hat dir die Station gefallen?' }));
      const sterne = el('div', { klasse: 'sterne' });
      const malen = () => Array.prototype.forEach.call(sterne.children, (s, i) => s.classList.toggle('an', i < (eintrag.sterne || 0)));
      for(let n = 1; n <= 5; n++){
        sterne.appendChild(el('button', { type: 'button', klasse: 'stern', 'aria-label': n + ' Sterne', text: '★', onclick: () => {
          eintrag.sterne = n;
          malen();
          speichern();
          pruefen();
        } }));
      }
      malen();
      teile.push(sterne);
    }
    teile.push(fertigKnopf);
    teile.push(el('button', { type: 'button', klasse: 'secondary', text: 'Zurück zur Station', onclick: stationZeigen }));
    inhalt.appendChild(el('section', { klasse: 'panel' }, teile));
    pruefen();
  }

  // Fotos der Station erst jetzt an den Laptop: nur die letzten, keine verworfenen Versuche
  function fotosSenden(station, eintrag){
    const check = station.check || {};
    const hochladen = check.hochladen || (check.foto && check.foto.hochladen);
    if(!hochladen) return Promise.resolve();
    const keys = Object.keys(eintrag.dateien || {}).map(i => eintrag.dateien[i]);
    return keys.reduce((kette, key) => kette.then(() => Outbox.datei(ctx.gruppe.id, station.id, key)), Promise.resolve());
  }

  function beenden(){
    const station = ctx.station;
    const eintrag = ctx.eintrag;
    eintrag.status = 'fertig';
    eintrag.ende = new Date().toISOString();
    ctx.f.aktuell = null;
    speichern()
      .then(() => fotosSenden(station, eintrag))
      .then(() => Outbox.ereignis(ctx.gruppe.id, 'beendet', station.id, { antworten: eintrag.antworten || {}, kiTyp: eintrag.kiTyp || '', sterne: eintrag.sterne || 0 }))
      .then(() => kopfleiste(ctx.gruppe, ctx.liste, ctx.f))
      .then(() => weiterZeigen(true))
      .catch(err => fehler('Speichern hat nicht geklappt. Bitte nochmal „Fertig“ antippen.', err));
  }

  // Nach dem Abschluss (oder wenn die Station schon fertig ist): nächste Station vorschlagen
  function weiterZeigen(geradeFertig){
    const inhalt = document.getElementById('inhalt');
    inhalt.innerHTML = '';
    const panel = el('section', { klasse: 'panel' }, [
      el('h1', { text: geradeFertig ? 'Super, geschafft!' : '✓ ' + ctx.station.titel + ' ist schon erledigt' }),
      el('p', { klasse: 'hinweis', text: 'Nächste Station wird gesucht …' })
    ]);
    inhalt.appendChild(panel);
    return Stationen.belegung().then(beleg => {
      const naechste = Stationen.naechste(ctx.liste, ctx.f, beleg);
      panel.removeChild(panel.lastChild);
      if(!naechste){
        panel.appendChild(el('p', { klasse: 'gross-text', text: 'Du hast alle Stationen geschafft! 🎉' }));
        return;
      }
      panel.appendChild(el('p', { klasse: 'gross-text' }, [el('span', { text: 'Weiter geht es an der Station ' }), el('strong', { text: naechste.titel })]));
      if(naechste.optional) panel.appendChild(el('p', { text: 'Diese Station ist optional: Ihr müsst sie nicht machen.' }));
      panel.appendChild(el('p', { text: 'Geh hin und scanne dort den QR-Code.' }));
      if(TEST) panel.appendChild(el('a', { klasse: 'knopf-link', href: '?id=' + naechste.id + '&test', text: 'Test: direkt hin' }));
    });
  }

  function nichtAngemeldet(){
    const inhalt = document.getElementById('inhalt');
    inhalt.innerHTML = '';
    inhalt.appendChild(el('section', { klasse: 'panel' }, [
      el('h1', { text: 'Erst anmelden' }),
      el('p', { text: 'Melde dich zuerst auf der Startseite an.' }),
      el('a', { klasse: 'knopf-link', href: '/', text: 'Zur Startseite' }),
      TEST ? el('button', { type: 'button', text: 'Test-Gruppe anlegen (Ada und Bo)', onclick: () => {
        const gruppe = { id: Speicher.neueId(), personen: ['Ada', 'Bo'] };
        Speicher.schreiben('gruppe', gruppe)
          .then(() => Outbox.ereignis(gruppe.id, 'anmeldung', '', { personen: gruppe.personen }))
          .then(() => location.reload());
      } }) : null
    ]));
  }

  function nochNichtDran(fehlend, text){
    const inhalt = document.getElementById('inhalt');
    inhalt.innerHTML = '';
    inhalt.appendChild(el('section', { klasse: 'panel' }, [
      el('h1', { text: ctx.station.titel + ': noch nicht' }),
      text ? el('p', { text: text }) : el('p', {}, [el('span', { text: 'Diese Station kommt später. Mach zuerst: ' }), el('strong', { text: fehlend.map(s => s.titel).join(', ') })])
    ]));
  }

  function testWerkzeuge(){
    if(!TEST) return;
    document.body.appendChild(el('div', { klasse: 'test-leiste' }, [
      el('span', { text: 'Test: ' }),
      el('button', { type: 'button', klasse: 'secondary', text: 'Alles zurücksetzen', onclick: () => {
        if(!confirm('Gruppe, Fortschritt und Fotos auf diesem iPad löschen?')) return;
        Speicher.allesLoeschen()
          .then(() => location.reload())
          .catch(err => fehler('Löschen hat nicht geklappt. Andere Tabs mit der Workshop-App schließen und nochmal versuchen.', err));
      } })
    ]));
  }

  // Zurück in einen älteren Tab: Puzzle und Vorschläge mit dem Stand der anderen Tabs neu zeichnen
  function beiRueckkehr(){
    if(document.hidden || !ctx || !ctx.eintrag.status) return;
    frischUebernehmen()
      .then(() => kopfleiste(ctx.gruppe, ctx.liste, ctx.f))
      .then(() => { if(ctx.eintrag.status === 'fertig') weiterZeigen(false); })
      .catch(err => console.error(err));
  }

  // Einstieg: station.html?id=<station>. Der QR-Code an der Station zeigt auf diese Adresse.
  function station(id){
    testWerkzeuge();
    Outbox.starten();
    document.addEventListener('visibilitychange', beiRueckkehr);
    return Promise.all([Speicher.lesen('gruppe'), Stationen.laden(), Stationen.fortschritt(), Stationen.freigabenLaden()])
      .then(werte => {
        const gruppe = werte[0];
        const liste = werte[1];
        const f = werte[2];
        if(!gruppe) return nichtAngemeldet();
        const st = liste.filter(s => s.id === id)[0];
        if(!st){
          document.getElementById('inhalt').textContent = '';
          return fehler('Diese Station gibt es nicht: ' + id);
        }
        f.stationen[id] = f.stationen[id] || {};
        ctx = { gruppe: gruppe, liste: liste, f: f, station: st, eintrag: f.stationen[id] };
        document.title = st.titel + ' · stencil.me';
        // KI schon laden, während die Kinder die Tipps lesen
        if(st.check && st.check.personPruefen && window.Personen) Personen.vorladen();
        return kopfleiste(gruppe, liste, f).then(() => {
          if(ctx.eintrag.status === 'fertig') return weiterZeigen(false);
          const fehlend = Stationen.voraussetzungen(liste, st).filter(b => !Stationen.istFertig(f, b)).map(b => liste.filter(s => s.id === b)[0]);
          const bonusFehlen = Stationen.fehlenBisBonus(liste, f, st);
          if(st.bonus && (bonusFehlen || fehlend.length)){
            return nochNichtDran([], 'Das ist eine Bonus-Station. Sie geht auf, wenn ihr ' + st.mindestFertig + ' Stationen geschafft habt' +
              (bonusFehlen ? ' (noch ' + bonusFehlen + ')' : '') +
              (fehlend.length ? ', darunter: ' + fehlend.map(x => x.titel).join(', ') : '') + '.');
          }
          if(fehlend.length) return nochNichtDran(fehlend);
          if(ctx.eintrag.status !== 'begonnen'){
            // Check-in: Station ist ab jetzt für diese Gruppe besetzt
            ctx.eintrag.status = 'begonnen';
            ctx.eintrag.start = new Date().toISOString();
            f.aktuell = id;
            return speichern()
              .then(() => Outbox.ereignis(gruppe.id, 'checkin', id, {}))
              .then(stationZeigen);
          }
          stationZeigen();
        });
      })
      .catch(err => fehler('Die Station lässt sich nicht laden. Ist das iPad im WLAN?', err));
  }

  window.Rahmen = {
    station: station,
    fehler: fehler,
    el: el,
    // Eigene Stationsteile anmelden (app/stationen/*.js), z. B. Rahmen.eigeneArt('stempel', {...})
    eigeneArt: (art, teil) => { eigeneArten[art] = teil; }
  };
})();
