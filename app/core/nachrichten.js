// ---- Nachrichten vom Laptop („Euer Stempel wird gelasert“, „… ist fertig“) ----
// Das iPad fragt einmal pro Minute beim Laptop nach Nachrichten für die eigene Gruppe und zeigt
// neue oben als Hinweis. „OK“ merkt sich das iPad. Ohne Laptop passiert einfach nichts.
(function(){
  const ABFRAGE_MS = 60000; // einmal pro Minute reicht (Patricia, 24.10.)
  const ABFRAGE_PAUSE_MS = 15000; // während der Pause öfter, damit „Pause beenden“ schnell ankommt
  const TIMEOUT_MS = 5000;
  let box = null;
  let gruppe = null;
  let abfrageUhr = null;

  // ---- Pause für alle (Knopf auf der Laptop-Seite, Patricia 09.11.2026) ----
  // Vollbild über der Seite mit Countdown. Endet von selbst, wenn die Zeit um ist (auch ohne Laptop),
  // oder bei der nächsten Abfrage, wenn Penny die Pause früher beendet.
  let pauseEl = null;
  let pauseEnde = 0;   // Zeitpunkt (Uhr dieses iPads), an dem die Pause endet
  let pauseUhr = null;
  function pauseZeigen(restSekunden){
    pauseEnde = restSekunden > 0 ? Date.now() + restSekunden * 1000 : 0;
    if(!pauseEnde){
      if(pauseEl) pauseEl.hidden = true;
      clearInterval(pauseUhr);
      pauseUhr = null;
      return;
    }
    if(!pauseEl){
      pauseEl = document.createElement('div');
      pauseEl.className = 'pause';
      pauseEl.setAttribute('role', 'dialog');
      pauseEl.innerHTML = '<div class="pause-box"><p class="pause-gross">☕ Pause</p><p class="pause-bis"></p>' +
        '<p class="pause-uhr"></p><p>Lasst das iPad hier liegen. Nach der Pause geht es genau hier weiter.</p></div>';
      document.body.appendChild(pauseEl);
    }
    const bis = new Date(pauseEnde);
    pauseEl.querySelector('.pause-bis').textContent = 'bis ' + bis.getHours() + ':' + ('0' + bis.getMinutes()).slice(-2) + ' Uhr';
    pauseEl.hidden = false;
    const ticken = () => {
      const rest = Math.max(0, Math.ceil((pauseEnde - Date.now()) / 1000));
      pauseEl.querySelector('.pause-uhr').textContent = 'noch ' + Math.floor(rest / 60) + ':' + ('0' + rest % 60).slice(-2);
      if(!rest) pauseZeigen(0);
    };
    ticken();
    if(!pauseUhr) pauseUhr = setInterval(ticken, 1000);
  }

  function planen(){
    clearTimeout(abfrageUhr);
    abfrageUhr = setTimeout(() => abfragen().then(planen), pauseEnde ? ABFRAGE_PAUSE_MS : ABFRAGE_MS);
  }

  function abfragen(){
    if(!gruppe || !box) return Promise.resolve();
    const anfrage = fetch('/api/nachrichten?gruppe=' + gruppe, { cache: 'no-store' }).then(r => r.json());
    const limit = new Promise((resolve, reject) => setTimeout(() => reject(new Error('Zeitüberschreitung')), TIMEOUT_MS));
    return Promise.all([Promise.race([anfrage, limit]), Speicher.lesen('nachrichten-gelesen')])
      .then(werte => {
        const gelesen = werte[1] || [];
        if(window.Stationen) Stationen.meldungenMerken(werte[0].nachrichten || []);
        const neu = (werte[0].nachrichten || []).filter(n => gelesen.indexOf(n.id) < 0);
        zeigen(neu, gelesen, !!werte[0].loeschen);
        pauseZeigen(werte[0].pauseRest || 0);
      })
      .catch(() => { /* Laptop nicht erreichbar: später nochmal */ });
  }

  function zeigen(neu, gelesen, loeschen){
    box.innerHTML = '';
    // Abschluss: Hinweis bleibt stehen, bis das iPad gelöscht ist (nicht auf „Meine Daten“ selbst)
    const abschluss = loeschen && location.pathname !== '/app/meine-daten.html';
    box.hidden = !neu.length && !abschluss;
    if(abschluss){
      const zeile = document.createElement('div');
      zeile.className = 'nachricht';
      const text = document.createElement('p');
      text.textContent = '🔒 Der Workshop ist vorbei. Schaut euch an, was gespeichert ist, und löscht dann alles auf diesem iPad.';
      const link = document.createElement('a');
      link.href = '/app/meine-daten.html';
      link.className = 'knopf-link';
      link.textContent = 'Meine Daten';
      zeile.appendChild(text);
      zeile.appendChild(link);
      box.appendChild(zeile);
    }
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
      abfragen().then(planen);
    }
  };
})();
