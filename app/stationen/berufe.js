// ---- Station „Berufe“ ----
// Drei Berufsbilder aus 04_stencil.me-Berufe.pdf (gekürzt, Bilder nur als Icon: die
// Fotos im PDF sind von Canva), dazu drei Fragen. Abgehakt, wenn alle Fragen richtig
// sind. Der Wunschberuf ist eine normale Eingabe der Station.
(function(){
  Rahmen.eigeneArt('berufe', {
    anzeigen: (station, api) => {
      const el = api.el;
      const eintrag = api.eintrag;
      const fragen = station.verstaendnis || [];
      eintrag.quiz = eintrag.quiz || {};

      const karten = el('div', { klasse: 'berufe-karten' }, (station.berufe || []).map(b => el('section', { klasse: 'beruf' }, [
        el('h2', {}, [el('span', { klasse: 'beruf-icon', text: b.icon + ' ' }), el('span', { text: b.titel })]),
        el('p', { klasse: 'beruf-station', text: b.station }),
        el('div', {}, b.text.map(t => el('p', { text: t }))),
        el('p', {}, [el('strong', { text: 'So wird man das: ' }), el('span', { text: b.weg })])
      ])));

      const quiz = el('div', { klasse: 'pv-quiz' }, [el('h2', { text: 'Wer macht was?' })].concat(fragen.map((f, i) => {
        const rueck = el('p', { klasse: 'pv-rueckmeldung' });
        if(eintrag.quiz[i]){
          rueck.className = 'pv-rueckmeldung richtig';
          rueck.textContent = '✓ Richtig! ' + (f.erklaerung || '');
        }
        const knoepfe = el('div', { klasse: 'auswahl' }, f.antworten.map((a, j) => el('button', {
          type: 'button', klasse: 'wahl' + (eintrag.quiz[i] && j === f.richtig ? ' an' : ''), text: a,
          onclick: ev => {
            if(eintrag.quiz[i]) return;
            if(j === f.richtig){
              eintrag.quiz[i] = true;
              ev.target.classList.add('an');
              rueck.className = 'pv-rueckmeldung richtig';
              rueck.textContent = '✓ Richtig! ' + (f.erklaerung || '');
            }else{
              ev.target.classList.add('falsch');
              rueck.className = 'pv-rueckmeldung falsch';
              rueck.textContent = 'Noch nicht. Lest nochmal oben nach.';
            }
            api.speichern();
            api.pruefen();
          }
        })));
        return el('div', { klasse: 'pv-frage' }, [el('p', { klasse: 'pv-frage-text', text: (i + 1) + '. ' + f.frage }), knoepfe, rueck]);
      })));

      return el('div', { klasse: 'berufe-station' }, [karten, quiz]);
    },
    erfuellt: (eintrag, gruppe, station) => (station.verstaendnis || []).every((f, i) => eintrag.quiz && eintrag.quiz[i])
  });
})();
