// ---- Station „Feedback zum Workshop“ ----
// Fragen aus der Abschlusspräsentation (07_stencil.me - Abschluss.pdf, Seite „Feedback“).
// Jede Person füllt einen eigenen Bogen aus. Die Antworten gehen beim Beenden als
// antworten.feedback (Liste pro Person, mit Vorname) an den Laptop.
(function(){
  Rahmen.eigeneArt('feedback', {
    anzeigen: (station, api) => {
      const el = api.el;
      const eintrag = api.eintrag;
      eintrag.feedback = eintrag.feedback || {};
      eintrag.antworten = eintrag.antworten || {};
      // Zur Auswahl: die Stationen, die die Gruppe geschafft hat (ohne Bonus)
      const geschafft = api.liste.filter(s => !s.bonus && Stationen.istFertig(api.fortschritt, s.id));

      function uebernehmen(){
        eintrag.antworten.feedback = api.gruppe.personen.map((name, i) => Object.assign({ name: name }, eintrag.feedback[i] || {}));
        api.speichern();
        api.pruefen();
      }

      return el('div', { klasse: 'feedback-station' }, [
        el('p', { klasse: 'hinweis', text: '🎤 Tipp: Statt zu tippen könnt ihr auch die Mikrofon-Taste auf der Tastatur antippen und sprechen.' })
      ].concat(api.gruppe.personen.map((name, i) => {
        const antwort = eintrag.feedback[i] = eintrag.feedback[i] || {};
        const teile = [el('h2', { text: 'Bogen von ' + name })];
        station.feedback.forEach(frage => {
          const titel = el('p', { klasse: 'regel-titel', text: frage.text + (frage.pflicht ? '' : ' (freiwillig)') });
          if(frage.art === 'station'){
            teile.push(titel);
            teile.push(el('div', { klasse: 'auswahl' }, geschafft.map(s => el('button', {
              type: 'button', klasse: 'wahl' + (antwort[frage.id] === s.id ? ' an' : ''), text: s.titel,
              onclick: ev => {
                antwort[frage.id] = s.id;
                Array.prototype.forEach.call(ev.target.parentNode.children, b => b.classList.toggle('an', b === ev.target));
                uebernehmen();
              }
            }))));
            return;
          }
          const feld = frage.art === 'wort'
            ? el('input', { type: 'text', maxlength: '30', id: 'fb-' + i + '-' + frage.id, klasse: 'feedback-wort' })
            : el('textarea', { rows: '2', id: 'fb-' + i + '-' + frage.id });
          feld.value = antwort[frage.id] || '';
          feld.addEventListener('input', () => {
            antwort[frage.id] = feld.value;
            uebernehmen();
          });
          teile.push(el('label', { klasse: 'eingabe', for: 'fb-' + i + '-' + frage.id }, [titel, feld]));
        });
        return el('section', { klasse: 'feedback-person' }, teile);
      })));
    },
    erfuellt: (eintrag, gruppe, station) => gruppe.personen.every((n, i) => {
      const a = (eintrag.feedback || {})[i] || {};
      return station.feedback.every(f => !f.pflicht || String(a[f.id] || '').trim().length > 0);
    })
  });
})();
