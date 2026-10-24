// ---- Fotos verkleinern ----
// iPad-Fotos haben bis zu 12 Megapixel. In voller Größe sprengen sie auf älteren
// iPads den Speicher (Absturz). Darum wird jedes Foto sofort auf höchstens
// MAX_SEITE px verkleinert und nur diese Kopie gespeichert (wie in stencil.html).
(function(){
  const MAX_SEITE = 1024;
  const JPEG_QUALITAET = 0.85;

  function bildLaden(datei){
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(datei);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Foto lässt sich nicht öffnen')); };
      img.src = url;
    });
  }

  function verkleinern(img){
    const scale = Math.min(1, MAX_SEITE / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  function dataUrlZuBuffer(dataUrl){
    const b64 = atob(dataUrl.split(',')[1]);
    const bytes = new Uint8Array(b64.length);
    for(let i = 0; i < b64.length; i++) bytes[i] = b64.charCodeAt(i);
    return bytes.buffer;
  }

  // Ergebnis: { daten: ArrayBuffer, typ: 'image/jpeg', breite, hoehe }
  function alsJpeg(canvas){
    // toDataURL statt toBlob/arrayBuffer: läuft auch auf alten iPads
    const daten = dataUrlZuBuffer(canvas.toDataURL('image/jpeg', JPEG_QUALITAET));
    return { daten: daten, typ: 'image/jpeg', breite: canvas.width, hoehe: canvas.height };
  }

  window.Bild = {
    MAX_SEITE: MAX_SEITE,
    fotoVerkleinern: datei => bildLaden(datei).then(img => alsJpeg(verkleinern(img)))
  };
})();
