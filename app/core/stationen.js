// ---- Stationen: Daten laden, Fortschritt, nächste Station ----
// Die Inhalte stehen in /stationen/*.json (siehe stationen/README.md).
// Einmal geladen, liegen sie auch im Speicher des iPads. Ist das Netz später weg,
// nimmt die App diese Kopie.
(function(){
  const BELEGUNG_TIMEOUT_MS = 3000;

  function jsonHolen(url){
    return fetch(url, { cache: 'no-cache' }).then(res => {
      if(!res.ok) throw new Error(url + ': Status ' + res.status);
      return res.json();
    });
  }

  function vomNetz(){
    return jsonHolen('/stationen/index.json').then(index =>
      Promise.all(index.stationen.map(id => jsonHolen('/stationen/' + id + '.json')))
    );
  }

  function laden(){
    return vomNetz()
      .then(liste => Speicher.schreiben('stationen', liste).then(() => liste))
      .catch(err => Speicher.lesen('stationen').then(liste => {
        if(!liste) throw err;
        return liste;
      }));
  }

  // Fortschritt: { stationen: { <id>: { status: 'begonnen' | 'fertig', ... } } }
  function fortschritt(){
    return Speicher.lesen('fortschritt').then(f => f || { stationen: {} });
  }

  function istFertig(f, id){
    return !!(f.stationen[id] && f.stationen[id].status === 'fertig');
  }

  function anzahlFertig(liste, f){
    return liste.filter(s => istFertig(f, s.id)).length;
  }

  // Voraussetzungen, die es als Station (noch) nicht gibt, zählen nicht.
  // So kann eine Station schon auf eine spätere verweisen (z. B. Körpererkennung).
  function voraussetzungen(liste, station){
    return (station.braucht || []).filter(b => liste.some(s => s.id === b));
  }

  function moeglich(liste, f){
    return liste.filter(s => !istFertig(f, s.id) && voraussetzungen(liste, s).every(b => istFertig(f, b)));
  }

  // Belegung vom Laptop: { <id>: Anzahl Gruppen }. Ohne Laptop: null
  function belegung(){
    const anfrage = jsonHolen('/api/belegung').then(b => b.stationen || {});
    const limit = new Promise(resolve => setTimeout(() => resolve(null), BELEGUNG_TIMEOUT_MS));
    return Promise.race([anfrage, limit]).catch(() => null);
  }

  function naechste(liste, f, beleg){
    const kandidaten = moeglich(liste, f);
    if(!kandidaten.length) return null;
    const besetzt = s => (beleg && beleg[s.id]) || 0;
    const frei = kandidaten.filter(s => besetzt(s) < (s.plaetze || 1));
    if(frei.length) return frei[Math.floor(Math.random() * frei.length)];
    return kandidaten.slice().sort((a, b) => besetzt(a) - besetzt(b))[0];
  }

  window.Stationen = {
    laden: laden,
    fortschritt: fortschritt,
    fortschrittSpeichern: f => Speicher.schreiben('fortschritt', f),
    istFertig: istFertig,
    anzahlFertig: anzahlFertig,
    moeglich: moeglich,
    voraussetzungen: voraussetzungen,
    belegung: belegung,
    naechste: naechste
  };
})();
