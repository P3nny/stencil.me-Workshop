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
  // Für „Ist eine Person drauf?“ reicht ein kleines Bild: spart Rechenzeit und Speicher
  const PRUEF_PX = 400;
  // Zwei Modelle: „genau“ für Foto, Stempel und Hintergrund (wie stencil.html),
  // „leicht“ (halb so groß, deutlich schneller) für das Video in der Körpererkennung.
  // Pro Seite wird nur eines geladen.
  const MODELLE = {
    genau: { multiplier: 0.75, modelUrl: '/vendor/body-pix/model/model-stride16.json' },
    leicht: { multiplier: 0.50, modelUrl: '/vendor/body-pix/model-050/model-stride16.json' }
  };
  // Grafikspeicher sofort freigeben statt sammeln: etwas langsamer, aber alte iPads
  // stürzen vor allem wegen vollem Speicher ab
  const TEXTUR_SCHWELLE_BYTES = 0;
  // Der erste Aufruf auf einer Seite ist sehr langsam (Grafikchip wird vorbereitet, auf einem
  // iPad 14 s gemessen, danach ein Bruchteil). Darum gleich nach dem Laden einmal mit einem
  // winzigen leeren Bild rechnen, dann wartet nicht das Kind beim ersten Foto.
  const AUFWAERM_PX = 64;
  let netzPromise = null;
  let netzArt = null;

  function skriptLaden(src){
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(src + ' lässt sich nicht laden'));
      document.head.appendChild(s);
    });
  }

  function netz(art){
    art = MODELLE[art] ? art : 'genau';
    if(netzPromise && netzArt === art) return netzPromise;
    netzArt = art;
    netzPromise = (window.tf ? Promise.resolve() : skriptLaden('/vendor/tfjs/tf.min.js'))
      .then(() => {
        try{ tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', TEXTUR_SCHWELLE_BYTES); }catch(err){ console.error(err); }
        return window.bodyPix ? null : skriptLaden('/vendor/body-pix/body-pix.min.js');
      })
      .then(() => bodyPix.load({
        architecture: 'MobileNetV1',
        outputStride: 16,
        multiplier: MODELLE[art].multiplier,
        quantBytes: 2,
        modelUrl: MODELLE[art].modelUrl
      }))
      .then(net => aufwaermen(net).then(() => net))
      .catch(err => {
        netzPromise = null; // beim nächsten Foto nochmal versuchen
        throw err;
      });
    return netzPromise;
  }

  function aufwaermen(net){
    const c = document.createElement('canvas');
    c.width = c.height = AUFWAERM_PX;
    return net.segmentPerson(c, { internalResolution: 'medium', segmentationThreshold: 0.4 })
      .catch(err => console.error(err)); // ohne Aufwärmen geht es auch, nur langsamer
  }

  function bildAusUrl(url){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Foto lässt sich nicht öffnen'));
      img.src = url;
    });
  }

  function mitZeitlimit(promise){
    const limit = new Promise((resolve, reject) => setTimeout(() => reject(new Error('Zeitüberschreitung')), ZEITLIMIT_MS));
    return Promise.race([promise, limit]);
  }

  // BodyPix-Ergebnis für ein Bild oder Canvas (data: 1 = Person). Fehler werden weitergegeben.
  function segmentieren(bild){
    return mitZeitlimit(netz().then(net => net.segmentPerson(bild, { internalResolution: 'medium', segmentationThreshold: 0.4 })));
  }

  // Ergebnis: { status: 'ok' | 'klein' | 'keine' | 'fehler', anteil }
  // 'fehler' heißt: Die KI konnte nicht prüfen (zu langsam, kein Speicher). Dann
  // gilt das Foto trotzdem, der Workshop darf daran nicht hängen bleiben.
  function verkleinert(img, maxPx){
    const scale = Math.min(1, maxPx / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
    c.height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  function pruefen(url){
    return bildAusUrl(url)
      .then(img => segmentieren(verkleinert(img, PRUEF_PX)))
      .then(seg => {
        let summe = 0;
        for(let i = 0; i < seg.data.length; i++) summe += seg.data[i];
        const anteil = summe / seg.data.length;
        return { status: anteil < MIN_ANTEIL ? 'keine' : anteil < KLEIN_ANTEIL ? 'klein' : 'ok', anteil: anteil };
      })
      .catch(err => {
        console.error(err);
        return { status: 'fehler', anteil: 0 };
      });
  }

  window.Personen = {
    netz: netz,
    pruefen: pruefen,
    segmentieren: segmentieren,
    bildAusUrl: bildAusUrl,
    verkleinert: verkleinert,
    vorladen: art => netz(art).catch(err => console.error(err))
  };
})();
