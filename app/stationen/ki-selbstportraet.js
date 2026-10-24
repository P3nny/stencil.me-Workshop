// ---- Station „Selbstporträts mit KI neu erschaffen“ ----
// Die Kinder bauen den Prompt aus Bausteinen (kein freier Text). Das iPad schickt nur
// die Auswahl an den Laptop, der Laptop fragt Claude und gibt ein SVG zurück
// (server/ki_bild.py). Der API-Schlüssel bleibt auf dem Laptop.
// Ohne Laptop oder Internet zeigt die Station vorher erzeugte Beispiele.
(function(){
  const BEREIT_TIMEOUT_MS = 4000;
  const ERZEUGEN_TIMEOUT_MS = 100000;

  // Gleiche Regeln wie prompt_bauen() in server/ki_bild.py
  function satz(ki, auswahl){
    const texte = {};
    ki.baukasten.forEach(b => {
      const o = b.optionen.filter(x => x.id === auswahl[b.id])[0];
      texte[b.id] = o ? o.text : '…';
    });
    let s = ki.satz;
    for(let i = 0; i < 2; i++) s = s.replace(/\{([a-z]+)\}/g, (m, k) => texte[k] !== undefined ? texte[k] : m);
    return s;
  }

  function svgBild(svg, alt){
    const img = document.createElement('img');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    img.alt = alt || 'KI-Bild';
    return img;
  }

  function mitZeitlimit(promise, ms){
    return Promise.race([promise, new Promise((resolve, reject) => setTimeout(() => reject(new Error('Zeitüberschreitung')), ms))]);
  }

  Rahmen.eigeneArt('ki-selbstportraet', {
    anzeigen: (station, api) => {
      const el = api.el;
      const ki = station.ki;
      const eintrag = api.eintrag;
      eintrag.auswahl = eintrag.auswahl || Object.assign({}, ki.start);
      eintrag.bilder = eintrag.bilder || [];

      const promptBox = el('blockquote', { klasse: 'ki-prompt' });
      const erzeugenKnopf = el('button', { type: 'button', klasse: 'gross', text: '🎨 Bild erzeugen' });
      const status = el('p', { klasse: 'hinweis' });
      const rest = el('p', { klasse: 'hinweis' });
      const galerie = el('div', { klasse: 'ki-galerie' });
      const hinweisOffline = el('div', { klasse: 'ki-offline' });
      hinweisOffline.hidden = true;

      function promptZeigen(){
        promptBox.textContent = satz(ki, eintrag.auswahl);
      }

      // ---- Baukasten ----
      const baukasten = el('div', { klasse: 'ki-baukasten' }, ki.baukasten.map(b => {
        const gruppe = el('div', { klasse: 'auswahl' }, b.optionen.map(o => el('button', {
          type: 'button', klasse: 'wahl' + (eintrag.auswahl[b.id] === o.id ? ' an' : ''), text: o.name,
          onclick: ev => {
            eintrag.auswahl[b.id] = o.id;
            Array.prototype.forEach.call(ev.target.parentNode.children, k => k.classList.toggle('an', k === ev.target));
            promptZeigen();
            api.speichern();
          }
        })));
        return el('div', { klasse: 'ki-baustein' }, [el('p', { klasse: 'regel-titel', text: b.frage }), gruppe]);
      }));

      // ---- Galerie ----
      function karte(bild, beispiel){
        const fig = el('figure', { klasse: 'ki-karte' + (beispiel ? ' beispiel' : '') });
        const quelle = bild.svg ? Promise.resolve(svgBild(bild.svg)) : Promise.resolve(el('img', { src: '/stationen/' + bild.bild, alt: 'Beispielbild' }));
        quelle.then(img => fig.insertBefore(img, fig.firstChild));
        fig.appendChild(el('figcaption', {}, [
          el('strong', { text: beispiel ? 'Beispiel (vorher erzeugt)' : 'Bild ' + bild.nr }),
          el('span', { text: ' „' + bild.prompt + '“' })
        ]));
        return fig;
      }
      function galerieZeigen(){
        galerie.innerHTML = '';
        eintrag.bilder.slice().reverse().forEach(b => galerie.appendChild(karte(b, false)));
        const genutzt = eintrag.bilder.length;
        rest.textContent = genutzt ? 'Ihr habt ' + genutzt + ' von ' + ki.proGruppe + ' Bildern erzeugt.' : 'Ihr könnt bis zu ' + ki.proGruppe + ' Bilder erzeugen.';
        erzeugenKnopf.disabled = genutzt >= ki.proGruppe || eintrag.ohneKi;
      }

      function ohneKi(text){
        eintrag.ohneKi = true;
        hinweisOffline.hidden = false;
        hinweisOffline.innerHTML = '';
        hinweisOffline.appendChild(el('p', { klasse: 'rand-warnung', text: text + ' Hier seht ihr Bilder, die vorher mit derselben KI erzeugt wurden. Vergleicht die Prompts mit den Bildern.' }));
        hinweisOffline.appendChild(el('div', { klasse: 'ki-galerie' }, (ki.beispiele || []).map(b => karte(b, true))));
        erzeugenKnopf.disabled = true;
        api.speichern().then(() => api.pruefen());
      }

      // ---- Bild erzeugen ----
      erzeugenKnopf.addEventListener('click', () => {
        erzeugenKnopf.disabled = true;
        const start = Date.now();
        const uhr = setInterval(() => {
          status.textContent = 'Die KI zeichnet … ' + Math.round((Date.now() - start) / 1000) + ' Sekunden (meist etwa 15)';
        }, 1000);
        status.textContent = 'Die KI zeichnet …';
        mitZeitlimit(fetch('/api/ki-bild', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gruppe: api.gruppe.id, auswahl: eintrag.auswahl })
        }).then(res => res.json().then(daten => ({ ok: res.ok, status: res.status, daten: daten }))), ERZEUGEN_TIMEOUT_MS)
          .then(antwort => {
            if(!antwort.ok){
              status.textContent = '';
              if(antwort.status === 503) return ohneKi(antwort.daten.fehler || 'Die KI ist gerade nicht erreichbar.');
              status.textContent = '⚠ ' + (antwort.daten.fehler || 'Das hat nicht geklappt.');
              return;
            }
            eintrag.bilder.push({ nr: antwort.daten.nr, prompt: antwort.daten.prompt, stil: eintrag.auswahl.stil, svg: antwort.daten.svg });
            status.textContent = '✓ Fertig nach ' + Math.round((Date.now() - start) / 1000) + ' Sekunden.';
            return api.speichern().then(() => api.pruefen());
          })
          .catch(err => {
            console.error(err);
            ohneKi('Der Laptop antwortet nicht.');
          })
          .then(() => {
            clearInterval(uhr);
            galerieZeigen();
          });
      });

      // Ist die KI auf dem Laptop eingerichtet? Sonst gleich Beispiele zeigen
      mitZeitlimit(fetch('/api/ki-bereit').then(r => r.json()), BEREIT_TIMEOUT_MS)
        .then(d => {
          if(!d.eingerichtet) return ohneKi('Die KI ist auf dem Laptop nicht eingerichtet.');
          // KI ist (wieder) da: richtig erzeugen statt nur Beispiele
          if(eintrag.ohneKi){
            eintrag.ohneKi = false;
            galerieZeigen();
            api.speichern().then(() => api.pruefen());
          }
        })
        .catch(() => ohneKi('Ohne Laptop gibt es keine KI-Bilder.'));

      promptZeigen();
      galerieZeigen();
      return el('div', { klasse: 'ki-station' }, [
        el('h2', { text: 'Euer Prompt' }),
        promptBox,
        baukasten,
        erzeugenKnopf, status, rest,
        hinweisOffline,
        el('h2', { text: 'Eure Bilder' }),
        galerie
      ]);
    },
    erfuellt: (eintrag, gruppe, station) => {
      if(eintrag.ohneKi) return true;
      const bilder = eintrag.bilder || [];
      const stile = bilder.map(b => b.stil).filter((s, i, a) => a.indexOf(s) === i);
      return bilder.length >= (station.ki.mindestBilder || 1) && stile.length >= (station.ki.mindestStile || 1);
    }
  });
})();
