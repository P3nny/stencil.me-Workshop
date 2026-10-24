// ---- Personenerkennung (BodyPix, KI) ----
// Läuft komplett auf dem iPad. TF.js und das Modell kommen aus /vendor (vom Laptop
// oder von Netlify), nichts geht an Google. Die Skripte werden erst geladen, wenn
// eine Station sie braucht: Sie sind groß und alte iPads haben wenig Speicher.
// Gleiche Einstellungen wie in stencil.html (getBodyPixNet, computePersonMaskWork).
(function(){
  const ZEITLIMIT_MS = 30000;
  // Unter diesem Anteil gilt das Foto als „keine Person“ (wie MIN_PERSON_COVERAGE in stencil.html)
  const MIN_ANTEIL = 0.02;
  // Darunter ist die Person sehr klein im Bild: Hinweis, aber kein Fehler
  const KLEIN_ANTEIL = 0.12;
  let netzPromise = null;

  function skriptLaden(src){
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(src + ' lässt sich nicht laden'));
      document.head.appendChild(s);
    });
  }

  function netz(){
    if(netzPromise) return netzPromise;
    netzPromise = (window.tf ? Promise.resolve() : skriptLaden('/vendor/tfjs/tf.min.js'))
      .then(() => window.bodyPix ? null : skriptLaden('/vendor/body-pix/body-pix.min.js'))
      .then(() => bodyPix.load({
        architecture: 'MobileNetV1',
        outputStride: 16,
        multiplier: 0.75,
        quantBytes: 2,
        modelUrl: '/vendor/body-pix/model/model-stride16.json'
      }))
      .catch(err => {
        netzPromise = null; // beim nächsten Foto nochmal versuchen
        throw err;
      });
    return netzPromise;
  }

  function bildAusUrl(url){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Foto lässt sich nicht öffnen'));
      img.src = url;
    });
  }

  // Ergebnis: { status: 'ok' | 'klein' | 'keine' | 'fehler', anteil }
  // 'fehler' heißt: Die KI konnte nicht prüfen (zu langsam, kein Speicher). Dann
  // gilt das Foto trotzdem, der Workshop darf daran nicht hängen bleiben.
  function pruefen(url){
    const arbeit = Promise.all([netz(), bildAusUrl(url)])
      .then(werte => werte[0].segmentPerson(werte[1], { internalResolution: 'medium', segmentationThreshold: 0.4 }))
      .then(seg => {
        let summe = 0;
        for(let i = 0; i < seg.data.length; i++) summe += seg.data[i];
        const anteil = summe / seg.data.length;
        return { status: anteil < MIN_ANTEIL ? 'keine' : anteil < KLEIN_ANTEIL ? 'klein' : 'ok', anteil: anteil };
      });
    const limit = new Promise((resolve, reject) => setTimeout(() => reject(new Error('Zeitüberschreitung')), ZEITLIMIT_MS));
    return Promise.race([arbeit, limit]).catch(err => {
      console.error(err);
      return { status: 'fehler', anteil: 0 };
    });
  }

  window.Personen = { pruefen: pruefen, vorladen: () => netz().catch(err => console.error(err)) };
})();
