// ---- Outbox: erst aufs iPad, dann an den Laptop ----
// Wie beim Stempel in stencil.html: Jeder Eintrag (Check-in, Antworten, Foto) wird
// sofort auf dem iPad gespeichert und dann an den Laptop geschickt. Ist der Laptop
// nicht erreichbar, versucht es die App alle 15 s erneut. Jeder Eintrag hat eine
// eigene ID, damit er beim Laptop nie doppelt ankommt.
// Ohne Laptop (z. B. Netlify) bleibt alles auf dem iPad, die App läuft weiter.
(function(){
  const RETRY_MS = 15000;
  const SEND_TIMEOUT_MS = 10000;
  let laeuft = false;
  let nochmal = false; // während eines Laufs neu dazugekommen -> direkt nochmal senden
  const beobachter = [];

  function mitZeitlimit(promise){
    const limit = new Promise((resolve, reject) => setTimeout(() => reject(new Error('Zeitüberschreitung')), SEND_TIMEOUT_MS));
    return Promise.race([promise, limit]);
  }

  function antwortPruefen(res){
    if(!res.ok) throw new Error('Status ' + res.status);
    return res.json();
  }

  function senden(eintrag){
    if(eintrag.art === 'stempel'){
      // Gleicher Weg wie in stencil.html: Der Laptop legt den Stempel zu den anderen für den Mr Beam
      const url = '/api/stempel?id=' + eintrag.id + '&name=' + encodeURIComponent(eintrag.name);
      return mitZeitlimit(fetch(url, { method: 'POST', headers: { 'Content-Type': 'image/svg+xml' }, body: eintrag.svg }).then(antwortPruefen));
    }
    if(eintrag.art === 'datei'){
      return Speicher.dateiLesen(eintrag.dateiKey).then(datei => {
        if(!datei) return; // Foto inzwischen ersetzt: nichts mehr zu senden
        const url = '/api/datei?id=' + eintrag.id + '&gruppe=' + eintrag.gruppe + '&station=' + encodeURIComponent(eintrag.station);
        return mitZeitlimit(fetch(url, { method: 'POST', headers: { 'Content-Type': datei.typ }, body: datei.daten }).then(antwortPruefen));
      });
    }
    return mitZeitlimit(fetch('/api/ereignis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: eintrag.id, gruppe: eintrag.gruppe, art: eintrag.ereignis, station: eintrag.station, zeit: eintrag.zeit, daten: eintrag.daten })
    }).then(antwortPruefen));
  }

  function meldeStand(){
    return Speicher.outboxAlle().then(eintraege => {
      const offen = eintraege.filter(e => !e.gesendet).length;
      const stand = { gesamt: eintraege.length, offen: offen, dauerhaft: Speicher.dauerhaft };
      beobachter.forEach(fn => fn(stand));
      return stand;
    });
  }

  function abarbeiten(){
    if(laeuft){
      nochmal = true;
      return Promise.resolve();
    }
    laeuft = true;
    return Speicher.outboxAlle()
      .then(eintraege => {
        const offen = eintraege.filter(e => !e.gesendet).sort((a, b) => a.zeit < b.zeit ? -1 : 1);
        // Nacheinander senden, damit alte iPads und der Laptop nicht überlastet werden
        return offen.reduce((kette, eintrag) => kette.then(() =>
          senden(eintrag)
            .then(() => { eintrag.gesendet = true; return Speicher.outboxSchreiben(eintrag.id, eintrag); })
            .catch(() => { /* Laptop nicht erreichbar: beim nächsten Versuch erneut */ })
        ), Promise.resolve());
      })
      .then(meldeStand)
      .catch(err => console.error(err))
      .then(() => {
        laeuft = false;
        if(nochmal){
          nochmal = false;
          abarbeiten();
        }
      });
  }

  function hinzufuegen(eintrag){
    eintrag.id = eintrag.id || Speicher.neueId();
    eintrag.zeit = eintrag.zeit || new Date().toISOString();
    eintrag.gesendet = false;
    return Speicher.outboxSchreiben(eintrag.id, eintrag)
      .then(meldeStand)
      .then(() => { abarbeiten(); return eintrag.id; });
  }

  window.Outbox = {
    // Ereignis: Check-in, Station beendet, Anmeldung …
    ereignis: (gruppe, ereignis, station, daten) =>
      hinzufuegen({ art: 'ereignis', gruppe: gruppe, ereignis: ereignis, station: station || '', daten: daten || {} }),
    // Datei: liegt schon in Speicher.dateien unter dateiKey, hier nur der Verweis
    datei: (gruppe, station, dateiKey) =>
      hinzufuegen({ art: 'datei', gruppe: gruppe, station: station, dateiKey: dateiKey }),
    // Stempel-Datei (SVG) für den Lasercutter, mit Vorname oder Spitzname
    stempel: (gruppe, name, svg) =>
      hinzufuegen({ art: 'stempel', gruppe: gruppe, name: name, svg: svg }),
    beobachten: fn => { beobachter.push(fn); meldeStand(); },
    abarbeiten: abarbeiten,
    starten: () => {
      abarbeiten();
      setInterval(abarbeiten, RETRY_MS);
    }
  };
})();
