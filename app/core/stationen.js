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

  // Bonus-Stationen (z. B. Sticker) und optionale Stationen (Claude: nur mit
  // Einwilligung) zählen nicht zu „x von y“ und nicht fürs Puzzle
  function pflicht(liste){
    return liste.filter(s => !s.bonus && !s.optional);
  }

  function anzahlFertig(liste, f){
    return pflicht(liste).filter(s => istFertig(f, s.id)).length;
  }

  // Wie viele Stationen müssen geschafft sein, bevor eine Bonus-Station frei ist?
  function fehlenBisBonus(liste, f, station){
    if(freigegeben(station)) return 0;
    return Math.max(0, (station.mindestFertig || 0) - anzahlFertig(liste, f));
  }

  // Freigaben vom Laptop (z. B. „Feedbackbogen für alle“): Station mit passendem
  // Feld freigabe ist dann ohne Voraussetzungen offen
  let freigaben = [];
  function freigabenLaden(){
    const anfrage = jsonHolen('/api/einstellungen').then(e => e.freigaben || []);
    const limit = new Promise(resolve => setTimeout(() => resolve(null), BELEGUNG_TIMEOUT_MS));
    return Promise.race([anfrage, limit]).catch(() => null)
      .then(f => f ? Speicher.schreiben('freigaben', f).then(() => f) : Speicher.lesen('freigaben'))
      .then(f => { freigaben = f || []; return freigaben; });
  }
  function freigegeben(station){
    return !!station.freigabe && freigaben.indexOf(station.freigabe) >= 0;
  }

  // Voraussetzungen, die es als Station (noch) nicht gibt, zählen nicht.
  // So kann eine Station schon auf eine spätere verweisen (z. B. Körpererkennung).
  function voraussetzungen(liste, station){
    if(freigegeben(station)) return [];
    return (station.braucht || []).filter(b => liste.some(s => s.id === b));
  }

  function moeglich(liste, f){
    return liste.filter(s => !istFertig(f, s.id) && voraussetzungen(liste, s).every(b => istFertig(f, b)) && !fehlenBisBonus(liste, f, s));
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
    // Optionale Stationen nur vorschlagen, wenn keine andere frei ist
    const freiOhneOptional = frei.filter(s => !s.optional);
    const wahl = freiOhneOptional.length ? freiOhneOptional : frei;
    if(wahl.length) return wahl[Math.floor(Math.random() * wahl.length)];
    return kandidaten.slice().sort((a, b) => besetzt(a) - besetzt(b))[0];
  }

  window.Stationen = {
    laden: laden,
    fortschritt: fortschritt,
    fortschrittSpeichern: f => Speicher.schreiben('fortschritt', f),
    istFertig: istFertig,
    anzahlFertig: anzahlFertig,
    anzahlPflicht: liste => pflicht(liste).length,
    fehlenBisBonus: fehlenBisBonus,
    moeglich: moeglich,
    voraussetzungen: voraussetzungen,
    freigabenLaden: freigabenLaden,
    belegung: belegung,
    naechste: naechste
  };
})();
