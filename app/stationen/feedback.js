// ---- Station „Feedback zum Workshop“ ----
// Fragen aus der Abschlusspräsentation (07_stencil.me - Abschluss.pdf, Seite „Feedback“).
// Jede Person füllt einen eigenen Bogen aus. Die Bögen gehen beim Beenden anonym an den
// Laptop: einzeln über die Outbox an /api/feedback, ohne Gruppe, ohne Namen, ohne Uhrzeit,
// in zufälliger Reihenfolge. Nicht in antworten, sonst lägen sie im Ordner der Gruppe (Patricia, 08.11.).
(function(){
  Rahmen.eigeneArt('feedback', {
    anzeigen: (station, api) => {
      const el = api.el;
      const eintrag = api.eintrag;
      eintrag.feedback = eintrag.feedback || {};
      eintrag.antworten = eintrag.antworten || {};
      // Zur Auswahl: die Stationen, die die Gruppe geschafft hat (ohne Bonus)
      const geschafft = api.liste.filter(s => !s.bonus && Stationen.istFertig(api.fortschritt, s.id));

      // Ältere Fassung legte die Bögen in antworten (gehen mit der Gruppe an den Laptop): weg damit
      delete eintrag.antworten.feedback;

      function uebernehmen(){
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
          if(frage.art === 'janein'){
            // Ja/Nein, darunter freiwillig: „Warum?“ bzw. „Warum nicht?“ (Feld <id>Warum)
            teile.push(titel);
            const warumId = frage.id + 'Warum';
            const warumTitel = el('p', { klasse: 'regel-titel' });
            const warum = el('textarea', { rows: '2', id: 'fb-' + i + '-' + warumId });
            warum.value = antwort[warumId] || '';
            warum.addEventListener('input', () => {
              antwort[warumId] = warum.value;
              uebernehmen();
            });
            const warumBox = el('label', { klasse: 'eingabe', for: 'fb-' + i + '-' + warumId }, [warumTitel, warum]);
            const warumZeigen = () => {
              warumBox.hidden = !antwort[frage.id];
              warumTitel.textContent = (antwort[frage.id] === 'nein' ? 'Warum nicht?' : 'Warum?') + ' (freiwillig)';
            };
            teile.push(el('div', { klasse: 'auswahl' }, [['ja', 'Ja'], ['nein', 'Nein']].map(w => el('button', {
              type: 'button', klasse: 'wahl' + (antwort[frage.id] === w[0] ? ' an' : ''), text: w[1],
              onclick: ev => {
                antwort[frage.id] = w[0];
                Array.prototype.forEach.call(ev.target.parentNode.children, b => b.classList.toggle('an', b === ev.target));
                warumZeigen();
                uebernehmen();
              }
            }))));
            warumZeigen();
            teile.push(warumBox);
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
    // „Station beendet“: jeden Bogen einzeln und gemischt in die Outbox, nur einmal
    beimBeenden: (eintrag, gruppe) => {
      if(eintrag.feedbackGesendet) return Promise.resolve();
      const boegen = gruppe.personen.map((n, i) => Object.assign({}, (eintrag.feedback || {})[i] || {}));
      for(let k = boegen.length - 1; k > 0; k--){
        const j = Math.floor(Math.random() * (k + 1));
        const t = boegen[k]; boegen[k] = boegen[j]; boegen[j] = t;
      }
      return boegen.reduce((kette, bogen) => kette.then(() => Outbox.feedback(bogen)), Promise.resolve())
        .then(() => { eintrag.feedbackGesendet = true; });
    },
    erfuellt: (eintrag, gruppe, station) => gruppe.personen.every((n, i) => {
      const a = (eintrag.feedback || {})[i] || {};
      return station.feedback.every(f => !f.pflicht || String(a[f.id] || '').trim().length > 0);
    })
  });
})();
