// ---- Station „Coding: HTML, CSS und JavaScript“ ----
// Übungen von den Stationenkarten (wie w3schools) im Code-Editor (app/core/code-editor.js).
// Die Vorschau ist eine echte kleine Webseite in einem abgeschirmten Rahmen
// (sandbox ohne allow-same-origin): Der Code der Kinder darf JavaScript ausführen
// und alert() zeigen, kommt aber nicht an die Daten der App.
(function(){
  const START = { ueberschrift: 'My First Heading', absatz: 'My first paragraph.', textfarbe: 'pink', hintergrundfarbe: 'purple', nachricht: 'Hallo!', knopftext: 'Klick mich' };
  const PFLICHT = ['ueberschrift', 'absatz', 'style', 'farben', 'button', 'nachricht', 'klick'];
  // Meldet Klicks auf Buttons an die App, damit „Klickt auf den Button“ abgehakt werden kann
  const KLICK_MELDER = '<script>document.addEventListener("click",function(e){var b=e.target;while(b&&b.tagName!=="BUTTON")b=b.parentNode;if(b)parent.postMessage({stencilKlick:true},"*");},true);<\/script>';

  function istFarbe(wert){
    try{
      return !!(window.CSS && CSS.supports && CSS.supports('color', wert));
    }catch(err){
      return true;
    }
  }

  function cssWert(css, eigenschaft){
    const m = new RegExp('(^|[;{\\s])' + eigenschaft + '\\s*:\\s*([^;}]+)', 'i').exec(css);
    return m ? m[2].trim() : null;
  }

  function pruefen(code, z){
    const doc = new DOMParser().parseFromString(code, 'text/html');
    const erledigt = {}, hinweise = {};
    const h1 = doc.querySelector('h1');
    const p = doc.querySelector('p');
    const ueberschrift = h1 ? h1.textContent.trim() : '';
    const absatz = p ? p.textContent.trim() : '';
    erledigt.ueberschrift = ueberschrift !== '' && ueberschrift !== START.ueberschrift;
    if(!h1) hinweise.ueberschrift = 'Die Überschrift (<h1>…</h1>) ist verschwunden.';
    erledigt.absatz = absatz !== '' && absatz !== START.absatz;

    const css = Array.prototype.map.call(doc.querySelectorAll('style'), s => s.textContent).join('\n');
    erledigt.style = /h1\s*\{[^}]*color\s*:/i.test(css);
    const farbe = cssWert(css, 'color');
    const hintergrund = cssWert(css, 'background-color');
    const falsch = [farbe, hintergrund].filter(f => f && !istFarbe(f));
    erledigt.farben = erledigt.style && !falsch.length && ((farbe || '').toLowerCase() !== START.textfarbe || (hintergrund || '').toLowerCase() !== START.hintergrundfarbe);
    if(falsch.length) hinweise.farben = '„' + falsch[0] + '“ kennt der Browser nicht als Farbe. Probiert red, blue oder orange.';
    if((css.match(/\{/g) || []).length !== (css.match(/\}/g) || []).length) hinweise.farben = 'Im <style>-Block fehlt eine Klammer { oder }.';

    const knopf = doc.querySelector('button');
    const onclick = knopf ? (knopf.getAttribute('onclick') || '') : '';
    erledigt.button = /alert\s*\(/.test(onclick);
    const nachricht = /alert\s*\(\s*'([^']*)'\s*\)/.exec(onclick);
    erledigt.nachricht = !!nachricht && nachricht[1].trim() !== '' && nachricht[1] !== START.nachricht;
    if(erledigt.button && !nachricht) hinweise.nachricht = 'Die Nachricht muss zwischen zwei \' stehen, so: alert(\'Hallo\'). Ein \' mitten in der Nachricht beendet sie zu früh.';
    erledigt.klick = erledigt.button && !!z.geklickt;
    erledigt.bonus = !!knopf && knopf.textContent.trim() !== '' && knopf.textContent.trim() !== START.knopftext;
    return { erledigt: erledigt, hinweise: hinweise, syntax: !doc.body || !doc.body.children.length ? 'Die Seite ist leer. Fehlt <body>?' : null };
  }

  Rahmen.eigeneArt('coding-web', {
    anzeigen: (station, api) => {
      const eintrag = api.eintrag;
      eintrag.editor = eintrag.editor || {};
      eintrag.antworten = eintrag.antworten || {};
      const uebung = station.uebung;
      let rahmen = null;
      let speicherTimer = null;

      const editor = CodeEditor.erstellen({
        vorlage: uebung.vorlage,
        luecken: uebung.luecken,
        bausteine: uebung.bausteine,
        aufgaben: uebung.aufgaben,
        zustand: eintrag.editor,
        pruefen: pruefen,
        vorschau: (code, box) => {
          if(!rahmen){
            rahmen = document.createElement('iframe');
            rahmen.setAttribute('sandbox', 'allow-scripts allow-modals');
            rahmen.setAttribute('title', 'Eure Webseite');
            box.innerHTML = '';
            box.appendChild(rahmen);
          }
          rahmen.srcdoc = /<\/body>/i.test(code) ? code.replace(/<\/body>/i, KLICK_MELDER + '</body>') : code + KLICK_MELDER;
        },
        beiAenderung: (code, erledigt) => {
          eintrag.uebung = erledigt;
          eintrag.antworten['html-code'] = code;
          clearTimeout(speicherTimer);
          speicherTimer = setTimeout(() => { api.speichern(); }, 400);
          api.pruefen();
        }
      });

      window.addEventListener('message', ev => {
        if(!rahmen || ev.source !== rahmen.contentWindow || !ev.data || !ev.data.stencilKlick) return;
        if(!eintrag.editor.geklickt){
          eintrag.editor.geklickt = true;
          editor.neuPruefen();
        }
      });

      return api.el('div', { klasse: 'cw-station' }, [editor]);
    },
    erfuellt: (eintrag) => PFLICHT.every(id => eintrag.uebung && eintrag.uebung[id])
  });
})();
