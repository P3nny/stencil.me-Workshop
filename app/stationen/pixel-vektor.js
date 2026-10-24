// ---- Station „Pixel vs. Vektor“ ----
// Teil 1: Erklärung und Infografik aus der Stationenkarte, dazu Verständnisfragen.
// Teil 2 (erst wenn alle Fragen richtig sind): SVG-Code schreiben, Vorschau sofort,
// die App prüft die Aufgaben und gibt Rückmeldung. Der Code geht beim Beenden mit
// den Antworten an den Laptop (antworten['svg-code']).
(function(){
  const PRUEF_PAUSE_MS = 300;
  const PFLICHT = ['farbe', 'radius', 'dreieck', 'stern'];

  // iPad-Tastaturen machen aus " gern „ “ ” (typografische Anführungszeichen)
  function normalisieren(code){
    return code.replace(/[„“”″]/g, '"').replace(/[‚‘’′]/g, "'");
  }

  function punkte(polygon){
    const zahlen = (polygon.getAttribute('points') || '').trim().split(/[\s,]+/).filter(z => z !== '' && !isNaN(parseFloat(z)));
    return Math.floor(zahlen.length / 2);
  }

  function istFarbe(wert){
    try{
      return !!(window.CSS && CSS.supports && CSS.supports('color', wert));
    }catch(err){
      return true; // im Zweifel nicht meckern
    }
  }

  // Nur Formen anzeigen: Skripte und Ereignis-Attribute raus. Die Vorschau ist ein <img>,
  // dort laufen ohnehin keine Skripte.
  function alsBild(svg){
    Array.prototype.forEach.call(svg.querySelectorAll('script, foreignObject'), e => e.parentNode.removeChild(e));
    Array.prototype.forEach.call([svg].concat(Array.prototype.slice.call(svg.querySelectorAll('*'))), e => {
      Array.prototype.slice.call(e.attributes).forEach(a => {
        if(/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) e.removeAttribute(a.name);
      });
    });
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const img = document.createElement('img');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
    img.alt = 'Vorschau';
    return img;
  }

  // Ergebnis der Prüfung: { erledigt: {id: true|false}, hinweise: {id: Text}, syntax: Text|null, svgs: [Element] }
  function pruefen(code){
    const sauber = normalisieren(code);
    const doc = new DOMParser().parseFromString('<body>' + sauber + '</body>', 'text/html');
    const svgs = Array.prototype.slice.call(doc.querySelectorAll('svg'));
    const kreis = doc.querySelector('circle');
    const polygone = Array.prototype.slice.call(doc.querySelectorAll('polygon'));
    const erledigt = {}, hinweise = {};

    const fill = kreis ? (kreis.getAttribute('fill') || '').trim() : '';
    erledigt.farbe = !!kreis && fill !== '' && fill.toLowerCase() !== 'yellow' && istFarbe(fill);
    if(kreis && fill && fill.toLowerCase() !== 'yellow' && !istFarbe(fill)) hinweise.farbe = '„' + fill + '“ kennt der Browser nicht als Farbe. Probiert red, blue oder pink.';
    if(!kreis) hinweise.farbe = 'Der Kreis (<circle … />) ist verschwunden.';

    const r = kreis ? parseFloat(kreis.getAttribute('r')) : NaN;
    erledigt.radius = !isNaN(r) && r > 0 && r !== 40;
    if(kreis && !isNaN(r) && r > 50) hinweise.radius = 'Der Kreis ist größer als die Fläche (100 × 100) und wird abgeschnitten. Gut beobachtet?';

    erledigt.dreieck = polygone.some(p => punkte(p) === 3);
    if(!erledigt.dreieck && polygone.some(p => punkte(p) > 0 && punkte(p) < 3)) hinweise.dreieck = 'Ein Dreieck braucht 3 Punkte, also 3 Zahlenpaare bei points.';

    const sterne = polygone.filter(p => punkte(p) === 10);
    erledigt.stern = sterne.length > 0;
    if(!erledigt.stern && polygone.some(p => punkte(p) > 3 && punkte(p) !== 10)) hinweise.stern = 'Ein Stern hat hier 10 Punkte. Zählt die Zahlenpaare bei points nach.';

    const sternFarben = sterne.map(p => (p.getAttribute('fill') || '').toLowerCase());
    erledigt.bonus = sterne.length >= 2 && sternFarben.some(f => f !== sternFarben[0]);

    // Grobe Syntaxprüfung: Der Browser repariert viel, als XML gelesen fällt ein Fehler auf
    let syntax = null;
    const xml = new DOMParser().parseFromString('<wurzel>' + sauber.replace(/&(?![a-z]+;|#\d+;)/gi, '&amp;') + '</wurzel>', 'application/xml');
    if(xml.getElementsByTagName('parsererror').length) syntax = 'Achtung: Irgendwo fehlt ein Zeichen, zum Beispiel <, >, / oder ". Die Vorschau zeigt, was trotzdem klappt.';
    if(!svgs.length) syntax = 'Kein <svg> gefunden. Jeder Block beginnt mit <svg …> und endet mit </svg>.';

    return { erledigt: erledigt, hinweise: hinweise, syntax: syntax, svgs: svgs };
  }

  Rahmen.eigeneArt('pixel-vektor', {
    anzeigen: (station, api) => {
      const el = api.el;
      const eintrag = api.eintrag;
      const erkl = station.erklaerung || {};
      const fragen = station.verstaendnis || [];
      const uebung = station.uebung || { start: '', aufgaben: [] };
      eintrag.quiz = eintrag.quiz || {};
      eintrag.fehlversuche = eintrag.fehlversuche || 0;
      eintrag.antworten = eintrag.antworten || {};
      if(!eintrag.antworten['svg-code']) eintrag.antworten['svg-code'] = uebung.start;

      // ---- Teil 1: Erklärung ----
      const teil1 = el('section', { klasse: 'pv-teil' }, [
        el('h2', { text: 'Teil 1: ' + (erkl.titel || 'Erklärung') }),
        el('div', { klasse: 'pv-erklaerung' }, [
          erkl.infografik ? el('figure', { klasse: 'pv-infografik' }, [
            el('img', { src: '/stationen/' + erkl.infografik, alt: 'Infografik: Pixelgrafiken vs. Vektorgrafiken' })
          ]) : null,
          el('div', { klasse: 'pv-text' }, (erkl.absaetze || []).map(a => el('p', { text: a })).concat([
            erkl.merkhilfe ? el('p', { klasse: 'pv-merk' }, [el('strong', { text: '💡 Merkhilfe: ' }), el('span', { text: erkl.merkhilfe })]) : null,
            erkl.bezug ? el('p', { klasse: 'pv-bezug' }, [el('strong', { text: 'Bezug zu stencil.me: ' }), el('span', { text: erkl.bezug })]) : null
          ]))
        ])
      ]);

      // ---- Verständnisfragen ----
      const teil2 = el('section', { klasse: 'pv-teil' });
      teil2.hidden = true;
      function quizFertig(){
        return fragen.every((f, i) => eintrag.quiz[i]);
      }
      const quiz = el('div', { klasse: 'pv-quiz' }, [el('h2', { text: 'Habt ihr es verstanden?' })].concat(fragen.map((f, i) => {
        const rueck = el('p', { klasse: 'pv-rueckmeldung' });
        const knoepfe = el('div', { klasse: 'auswahl' }, f.antworten.map((a, j) => el('button', {
          type: 'button', klasse: 'wahl' + (eintrag.quiz[i] && j === f.richtig ? ' an' : ''), text: a,
          onclick: ev => {
            if(eintrag.quiz[i]) return;
            if(j === f.richtig){
              eintrag.quiz[i] = true;
              ev.target.classList.add('an');
              rueck.className = 'pv-rueckmeldung richtig';
              rueck.textContent = '✓ Richtig! ' + (f.erklaerung || '');
              if(quizFertig()) teil2.hidden = false;
            }else{
              eintrag.fehlversuche++;
              ev.target.classList.add('falsch');
              rueck.className = 'pv-rueckmeldung falsch';
              rueck.textContent = 'Noch nicht. Schaut nochmal in die Erklärung oben und probiert es nochmal.';
            }
            api.speichern();
            api.pruefen();
          }
        })));
        if(eintrag.quiz[i]){
          rueck.className = 'pv-rueckmeldung richtig';
          rueck.textContent = '✓ Richtig! ' + (f.erklaerung || '');
        }
        return el('div', { klasse: 'pv-frage' }, [el('p', { klasse: 'pv-frage-text', text: (i + 1) + '. ' + f.frage }), knoepfe, rueck]);
      })));

      // ---- Teil 2: SVG-Übung ----
      const editor = el('textarea', { klasse: 'pv-code', rows: '12', spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off', 'aria-label': 'SVG-Code' });
      editor.value = eintrag.antworten['svg-code'];
      const vorschau = el('div', { klasse: 'pv-vorschau' });
      const syntaxBox = el('p', { klasse: 'pv-syntax' });
      syntaxBox.hidden = true;
      const haken = {};
      const hinweisFelder = {};
      const liste = el('ol', { klasse: 'pv-aufgaben' }, uebung.aufgaben.map(a => {
        haken[a.id] = el('span', { klasse: 'pv-haken', text: '○' });
        hinweisFelder[a.id] = el('span', { klasse: 'pv-hinweis' });
        const teile = [haken[a.id], el('span', { text: ' ' + a.text }), hinweisFelder[a.id]];
        if(a.baustein){
          teile.push(el('pre', { klasse: 'pv-baustein', text: a.baustein }));
          teile.push(el('button', { type: 'button', klasse: 'secondary klein', text: 'Hilfe: Baustein einfügen', onclick: () => {
            editor.value = editor.value.replace(/\s*$/, '') + '\n' + a.baustein + '\n';
            aktualisieren();
          } }));
        }
        return el('li', { klasse: a.freiwillig ? 'freiwillig' : '' }, teile);
      }));

      let timer = null;
      function aktualisieren(){
        const code = editor.value;
        const ergebnis = pruefen(code);
        vorschau.innerHTML = '';
        ergebnis.svgs.forEach(svg => vorschau.appendChild(alsBild(svg)));
        syntaxBox.hidden = !ergebnis.syntax;
        syntaxBox.textContent = ergebnis.syntax || '';
        Object.keys(haken).forEach(id => {
          const ok = !!ergebnis.erledigt[id];
          haken[id].textContent = ok ? '✓' : '○';
          haken[id].parentNode.classList.toggle('ok', ok);
          hinweisFelder[id].textContent = !ok && ergebnis.hinweise[id] ? ' → ' + ergebnis.hinweise[id] : (ok && ergebnis.hinweise[id] ? ' (' + ergebnis.hinweise[id] + ')' : '');
        });
        eintrag.uebung = ergebnis.erledigt;
        // Gespeichert wird mit geraden Anführungszeichen, damit der Code auch außerhalb der App läuft
        eintrag.antworten['svg-code'] = normalisieren(code);
        clearTimeout(timer);
        timer = setTimeout(() => { api.speichern(); }, 400);
        api.pruefen();
      }
      let eingabeTimer = null;
      editor.addEventListener('input', () => {
        clearTimeout(eingabeTimer);
        eingabeTimer = setTimeout(aktualisieren, PRUEF_PAUSE_MS);
      });

      const zuruecksetzen = el('button', { type: 'button', klasse: 'secondary klein', text: 'Code zurücksetzen', onclick: () => {
        if(!confirm('Euren Code löschen und mit dem Kreis neu anfangen?')) return;
        editor.value = uebung.start;
        aktualisieren();
      } });

      teil2.appendChild(el('h2', { text: 'Teil 2: SVG-Code schreiben' }));
      teil2.appendChild(el('p', { text: 'Links schreibt ihr den Code, rechts seht ihr sofort das Ergebnis. Die Haken zeigen, was schon geschafft ist.' }));
      teil2.appendChild(el('div', { klasse: 'pv-arbeitsplatz' }, [
        el('div', { klasse: 'pv-links' }, [editor, syntaxBox, zuruecksetzen]),
        el('div', { klasse: 'pv-rechts' }, [el('p', { klasse: 'pv-label', text: 'Ergebnis' }), vorschau])
      ]));
      teil2.appendChild(liste);
      teil2.hidden = !quizFertig();
      aktualisieren();

      return el('div', { klasse: 'pv-station' }, [teil1, quiz, teil2]);
    },
    erfuellt: (eintrag, gruppe, station) => {
      const fragenOk = (station.verstaendnis || []).every((f, i) => eintrag.quiz && eintrag.quiz[i]);
      return fragenOk && PFLICHT.every(id => eintrag.uebung && eintrag.uebung[id]);
    }
  });
})();
