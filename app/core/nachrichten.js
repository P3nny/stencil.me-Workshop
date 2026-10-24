// ---- Nachrichten vom Laptop („Euer Stempel wird gelasert“, „… ist fertig“) ----
// Das iPad fragt einmal pro Minute beim Laptop nach Nachrichten für die eigene Gruppe und zeigt
// neue oben als Hinweis. „OK“ merkt sich das iPad. Ohne Laptop passiert einfach nichts.
(function(){
  const ABFRAGE_MS = 60000; // einmal pro Minute reicht (Patricia, 24.10.)
  const TIMEOUT_MS = 5000;
  let box = null;
  let gruppe = null;

  function abfragen(){
    if(!gruppe || !box) return Promise.resolve();
    const anfrage = fetch('/api/nachrichten?gruppe=' + gruppe, { cache: 'no-store' }).then(r => r.json());
    const limit = new Promise((resolve, reject) => setTimeout(() => reject(new Error('Zeitüberschreitung')), TIMEOUT_MS));
    return Promise.all([Promise.race([anfrage, limit]), Speicher.lesen('nachrichten-gelesen')])
      .then(werte => {
        const gelesen = werte[1] || [];
        const neu = (werte[0].nachrichten || []).filter(n => gelesen.indexOf(n.id) < 0);
        zeigen(neu, gelesen);
      })
      .catch(() => { /* Laptop nicht erreichbar: später nochmal */ });
  }

  function zeigen(neu, gelesen){
    box.innerHTML = '';
    box.hidden = !neu.length;
    neu.forEach(n => {
      const ok = document.createElement('button');
      ok.type = 'button';
      ok.textContent = 'OK';
      ok.addEventListener('click', () => {
        gelesen.push(n.id);
        Speicher.schreiben('nachrichten-gelesen', gelesen).then(abfragen);
      });
      const zeile = document.createElement('div');
      zeile.className = 'nachricht';
      const text = document.createElement('p');
      text.textContent = '📣 ' + n.text;
      zeile.appendChild(text);
      zeile.appendChild(ok);
      box.appendChild(zeile);
    });
  }

  window.Nachrichten = {
    // ziel: Element, in dem die Hinweise erscheinen; gruppeId: aus Speicher 'gruppe'
    starten: (ziel, gruppeId) => {
      box = ziel;
      gruppe = gruppeId;
      box.className = 'nachrichten';
      box.hidden = true;
      abfragen();
      setInterval(abfragen, ABFRAGE_MS);
    }
  };
})();
