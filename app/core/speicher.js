// ---- Speicher auf dem iPad (IndexedDB) ----
// Alles, was die Kinder eingeben oder aufnehmen, landet zuerst hier.
// Drei Bereiche: "werte" (Gruppe, Fortschritt, Antworten), "dateien" (Fotos)
// und "outbox" (was noch an den Laptop muss, siehe outbox.js).
// Geht IndexedDB auf dem Gerät nicht (z. B. privater Modus), bleibt alles im
// Arbeitsspeicher. Die App läuft weiter, Speicher.dauerhaft ist dann false.
(function(){
  const DB_NAME = 'werkstatt';
  const ersatz = { werte: {}, dateien: {}, outbox: {} };
  let dbPromise = null;

  function oeffnen(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      let req;
      try{
        req = indexedDB.open(DB_NAME, 1);
      }catch(err){
        resolve(null);
        return;
      }
      req.onupgradeneeded = () => {
        req.result.createObjectStore('werte');
        req.result.createObjectStore('dateien');
        req.result.createObjectStore('outbox');
      };
      req.onsuccess = () => {
        Speicher.dauerhaft = true;
        resolve(req.result);
      };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
    return dbPromise;
  }

  function lesen(bereich, key){
    return oeffnen().then(db => {
      if(!db) return ersatz[bereich][key];
      return new Promise((resolve, reject) => {
        const req = db.transaction(bereich, 'readonly').objectStore(bereich).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    });
  }

  function schreiben(bereich, key, wert){
    return oeffnen().then(db => {
      if(!db){
        ersatz[bereich][key] = wert;
        return;
      }
      return new Promise((resolve, reject) => {
        const tx = db.transaction(bereich, 'readwrite');
        if(wert === undefined) tx.objectStore(bereich).delete(key);
        else tx.objectStore(bereich).put(wert, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    });
  }

  function alleWerte(bereich){
    return oeffnen().then(db => {
      if(!db) return Object.keys(ersatz[bereich]).map(k => ersatz[bereich][k]);
      return new Promise((resolve, reject) => {
        const req = db.transaction(bereich, 'readonly').objectStore(bereich).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    });
  }

  function neueId(){
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    return Array.prototype.map.call(bytes, b => ('0' + b.toString(16)).slice(-2)).join('');
  }

  const Speicher = {
    dauerhaft: false,
    bereit: oeffnen,
    neueId: neueId,
    lesen: key => lesen('werte', key),
    schreiben: (key, wert) => schreiben('werte', key, wert),
    alle: () => alleWerte('werte'),
    // Fotos als ArrayBuffer + Typ: Blobs in IndexedDB sind auf alten iPads unzuverlässig
    dateiLesen: key => lesen('dateien', key),
    dateiSchreiben: (key, datei) => schreiben('dateien', key, datei),
    outboxSchreiben: (key, eintrag) => schreiben('outbox', key, eintrag),
    outboxAlle: () => alleWerte('outbox'),
    dateiAlsUrl: key => lesen('dateien', key).then(d => d ? URL.createObjectURL(new Blob([d.daten], { type: d.typ })) : null)
  };
  window.Speicher = Speicher;
})();
