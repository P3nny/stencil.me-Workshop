// ---- Station „Pixel vs. Vektor“ ----
// Teil 1: Erklärung und Infografik aus der Stationenkarte, dazu Verständnisfragen.
// Teil 2 (erst wenn alle Fragen richtig sind): SVG-Code im Code-Editor (app/core/code-editor.js),
// Vorschau sofort, die App prüft die Aufgaben und gibt Rückmeldung. Der Code geht beim
// Beenden mit den Antworten an den Laptop (antworten['svg-code']).
(function(){
  const PFLICHT = ['farbe', 'radius', 'dreieck', 'stern'];
  const normalisieren = code => CodeEditor.normalisieren(code);

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
    if(sterne.length >= 2 && !erledigt.bonus) hinweise.bonus = 'Beide Sterne haben noch dieselbe Farbe. Ändert fill beim zweiten Stern.';

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
      let speicherTimer = null;

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

      // ---- Teil 2: SVG-Übung im Code-Editor (Lückentext, eine Aufgabe nach der anderen) ----
      eintrag.editor = eintrag.editor || {};
      teil2.appendChild(el('h2', { text: 'Teil 2: SVG-Code schreiben' }));
      teil2.appendChild(el('p', { text: 'Tippt in die hellen Felder im Code. Neue Formen kommen mit „Baustein einfügen“ an die richtige Stelle.' }));
      teil2.appendChild(CodeEditor.erstellen({
        vorlage: uebung.vorlage,
        luecken: uebung.luecken,
        bausteine: uebung.bausteine,
        aufgaben: uebung.aufgaben,
        profiNachAufgaben: true, // erst die Aufgaben, dann frei bearbeiten
        zustand: eintrag.editor,
        pruefen: pruefen,
        vorschau: (code, box) => {
          box.innerHTML = '';
          pruefen(code).svgs.forEach(svg => box.appendChild(alsBild(svg)));
        },
        beiAenderung: (code, erledigt) => {
          eintrag.uebung = erledigt;
          eintrag.antworten['svg-code'] = code;
          clearTimeout(speicherTimer);
          speicherTimer = setTimeout(() => { api.speichern(); }, 400);
          api.pruefen();
        }
      }));
      teil2.hidden = !quizFertig();
      return el('div', { klasse: 'pv-station' }, [teil1, quiz, teil2]);
    },
    erfuellt: (eintrag, gruppe, station) => {
      const fragenOk = (station.verstaendnis || []).every((f, i) => eintrag.quiz && eintrag.quiz[i]);
      return fragenOk && PFLICHT.every(id => eintrag.uebung && eintrag.uebung[id]);
    }
  });
})();
