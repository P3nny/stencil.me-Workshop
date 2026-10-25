// ---- Station „Bild-App vibe coden“ ----
// Lückentext statt freiem Auftrag: Effekt, Farben, Regler zur Auswahl, nur App-Name und
// Knopf-Text frei (kurz, geprüft auf dem Laptop). Das iPad schickt den Lückentext an den
// Laptop, Claude schreibt die App, der Code erscheint Stück für Stück (server/ki_app.py).
// Die fertige App läuft abgeschottet: sandbox ohne allow-same-origin und eine
// Content-Security-Policy ohne Netz. Das Foto geht nur per postMessage in diese App.
(function(){
  const FEHLER_MARKE = '\u0000FEHLER:';
  const BEREIT_TIMEOUT_MS = 4000;
  const CSP = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; ' +
    'style-src \'unsafe-inline\'; img-src data: blob:; media-src data: blob:; connect-src \'none\'; form-action \'none\'; base-uri \'none\'">';

  function htmlHerausziehen(text){
    const m = /<!DOCTYPE html[\s\S]*<\/html>|<html[\s\S]*<\/html>/i.exec(text);
    return m ? m[0] : '';
  }

  // Doppelt abgesichert: 1. alle Adressen nach außen entfernen (Chromium lädt Bilder
  // sonst vor, bevor die CSP aus dem <meta> greift), 2. CSP vorne in den <head>
  function abgeschottet(html){
    const ohneAdressen = html
      .replace(/\b(src|href|action|poster|srcset|data)\s*=\s*(["']?)\s*(https?:)?\/\/[^"'\s>]*\2/gi, '$1="#"')
      .replace(/url\(\s*(["']?)\s*(https?:)?\/\/[^)]*\)/gi, 'url()')
      .replace(/@import[^;]*;/gi, '');
    return /<head[^>]*>/i.test(ohneAdressen) ? ohneAdressen.replace(/<head[^>]*>/i, m => m + CSP) : CSP + ohneAdressen;
  }

  // Gleiche Regeln wie prompt_bauen() in server/ki_bild.py (Freitext dort in „…“)
  function satz(ki, auswahl){
    let s = ki.satz;
    ki.baukasten.forEach(b => {
      let text = '…';
      if(b.art === 'text') text = '„' + (auswahl[b.id] || '') + '“';
      else {
        const o = b.optionen.filter(x => x.id === auswahl[b.id])[0];
        if(o) text = o.text;
      }
      s = s.replace('{' + b.id + '}', text);
    });
    return s.trim();
  }

  function fotoAlsDataUrl(){
    return Speicher.lesen('foto-key:0')
      .then(key => key ? Speicher.dateiLesen(key) : null)
      .then(d => {
        if(!d) return null;
        return new Promise(resolve => {
          const leser = new FileReader();
          leser.onload = () => resolve(leser.result);
          leser.readAsDataURL(new Blob([d.daten], { type: d.typ }));
        });
      });
  }

  Rahmen.eigeneArt('vibe-coding', {
    anzeigen: (station, api) => {
      const el = api.el;
      const ki = station.ki;
      const eintrag = api.eintrag;
      eintrag.auswahl = eintrag.auswahl || {};
      ki.baukasten.forEach(b => {
        if(eintrag.auswahl[b.id] === undefined) eintrag.auswahl[b.id] = b.art === 'text' ? (b.start || '') : (ki.start || {})[b.id];
      });
      eintrag.apps = eintrag.apps || [];

      // ---- Lückentext: der Satz mit Auswahlfeldern und kurzen Textfeldern ----
      const lueckentext = el('p', { klasse: 'vibe-auftrag' });
      ki.satz.split(/(\{[a-z]+\})/).forEach(teil => {
        const m = /^\{([a-z]+)\}$/.exec(teil);
        const b = m && ki.baukasten.filter(x => x.id === m[1])[0];
        if(!b){ lueckentext.appendChild(document.createTextNode(teil)); return; }
        let feld;
        if(b.art === 'text'){
          feld = el('input', { type: 'text', maxlength: String(b.maxLaenge || 24), 'aria-label': b.frage, klasse: 'vibe-luecke' });
          feld.value = eintrag.auswahl[b.id] || '';
          feld.size = Math.max(6, feld.value.length + 1);
        }else{
          feld = el('select', { 'aria-label': b.frage, klasse: 'vibe-luecke' }, b.optionen.map(o => {
            const opt = el('option', { value: o.id, text: o.name });
            return opt;
          }));
          feld.value = eintrag.auswahl[b.id];
        }
        feld.addEventListener(b.art === 'text' ? 'input' : 'change', () => {
          eintrag.auswahl[b.id] = feld.value;
          if(b.art === 'text') feld.size = Math.max(6, feld.value.length + 1);
          api.speichern();
        });
        lueckentext.appendChild(feld);
      });

      const knopf = el('button', { type: 'button', klasse: 'gross', text: '🤖 App bauen lassen' });
      const status = el('p', { klasse: 'hinweis' });
      const zaehler = el('p', { klasse: 'hinweis' });
      const code = el('pre', { klasse: 'vibe-code' });
      code.hidden = true;
      const apps = el('div', { klasse: 'vibe-apps' });
      const offline = el('div');
      offline.hidden = true;

      function appKarte(app, beispiel){
        const rahmen = el('iframe', { sandbox: 'allow-scripts', klasse: 'vibe-rahmen', title: 'Eure App' });
        rahmen.srcdoc = abgeschottet(app.html);
        const fotoKnopf = el('button', { type: 'button', klasse: 'secondary', text: '📷 Euer Foto in die App schicken', onclick: () => {
          fotoAlsDataUrl().then(url => {
            if(!url) return api.fehler('Kein Foto gefunden. Ihr könnt auch in der App selbst ein Foto wählen.');
            rahmen.contentWindow.postMessage({ bild: url }, '*'); // App hat keinen eigenen Ursprung (sandbox)
          });
        } });
        const quelltext = el('pre', { klasse: 'vibe-code', text: app.html });
        quelltext.hidden = true;
        const codeKnopf = el('button', { type: 'button', klasse: 'secondary klein', text: 'Code ansehen', onclick: () => { quelltext.hidden = !quelltext.hidden; } });
        return el('figure', { klasse: 'vibe-karte' }, [
          el('figcaption', {}, [el('strong', { text: beispiel ? 'Beispiel-App (vorher erzeugt)' : 'App ' + app.nr }), el('span', { text: ' „' + app.auftrag + '“' })]),
          rahmen, fotoKnopf, codeKnopf, quelltext
        ]);
      }

      function appsZeigen(){
        apps.innerHTML = '';
        eintrag.apps.slice().reverse().forEach(a => apps.appendChild(appKarte(a, false)));
        knopf.disabled = eintrag.apps.length >= ki.proGruppe || !!eintrag.ohneKi;
        zaehler.textContent = eintrag.apps.length ? 'Ihr habt ' + eintrag.apps.length + ' von höchstens ' + ki.proGruppe + ' Apps bauen lassen.' : '';
      }

      function ohneKi(text){
        eintrag.ohneKi = true;
        offline.hidden = false;
        offline.innerHTML = '';
        offline.appendChild(el('p', { klasse: 'rand-warnung', text: text + ' Hier seht ihr eine App, die vorher mit derselben KI gebaut wurde.' }));
        (ki.beispiele || []).forEach(b => fetch('/stationen/' + b.datei).then(r => r.text()).then(html => {
          offline.appendChild(appKarte({ html: html, auftrag: b.prompt || '' }, true));
        }).catch(() => {}));
        knopf.disabled = true;
        api.speichern().then(() => api.pruefen());
      }

      knopf.addEventListener('click', () => {
        knopf.disabled = true;
        code.hidden = false;
        code.textContent = '';
        const auftrag = satz(ki, eintrag.auswahl);
        const start = Date.now();
        status.textContent = 'Die KI schreibt eure App … Schaut zu, wie der Code entsteht.';
        let text = '';
        fetch('/api/ki-app', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gruppe: api.gruppe.id, auswahl: eintrag.auswahl })
        }).then(res => {
          if(!res.ok){
            return res.json().then(d => {
              code.hidden = true;
              if(res.status === 503 || res.status === 403) return ohneKi(d.fehler || 'Die KI ist gerade nicht erreichbar.');
              status.textContent = '⚠ ' + (d.fehler || 'Das hat nicht geklappt.');
            });
          }
          // Stück für Stück lesen; ältere Safari ohne Datenstrom: alles auf einmal
          const fertig = () => {
            const fehler = text.indexOf(FEHLER_MARKE);
            if(fehler >= 0){
              status.textContent = '⚠ ' + text.slice(fehler + FEHLER_MARKE.length);
              return;
            }
            const html = htmlHerausziehen(text);
            if(!html){ status.textContent = '⚠ Die KI hat keine fertige App geliefert. Bitte nochmal versuchen.'; return; }
            eintrag.apps.push({ nr: eintrag.apps.length + 1, auftrag: auftrag, html: html });
            eintrag.antworten = eintrag.antworten || {};
            eintrag.antworten.auftraege = eintrag.apps.map(a => a.auftrag);
            code.hidden = true;
            status.textContent = '✓ Fertig nach ' + Math.round((Date.now() - start) / 1000) + ' Sekunden. Testet eure App!';
            return api.speichern().then(() => api.pruefen());
          };
          if(!res.body || !res.body.getReader) return res.text().then(t => { text = t; code.textContent = t; return fertig(); });
          const leser = res.body.getReader();
          const dekoder = new TextDecoder();
          const weiter = () => leser.read().then(stueck => {
            if(stueck.done) return fertig();
            text += dekoder.decode(stueck.value, { stream: true });
            code.textContent = text.replace(FEHLER_MARKE, '\n⚠ ');
            code.scrollTop = code.scrollHeight;
            return weiter();
          });
          return weiter();
        }).catch(err => {
          console.error(err);
          ohneKi('Der Laptop antwortet nicht.');
        }).then(appsZeigen);
      });

      fetch('/api/ki-bereit?gruppe=' + api.gruppe.id).then(r => r.json())
        .then(d => {
          // Opt-out der Eltern (Liste auf dem Laptop): nur Beispiele, der Laptop fragt die KI nicht
          if(d.ohneKi) return ohneKi('Diese Station macht ihr heute mit Beispielen.');
          if(!d.eingerichtet) return ohneKi('Die KI ist auf dem Laptop nicht eingerichtet.');
          if(eintrag.ohneKi){ eintrag.ohneKi = false; appsZeigen(); api.speichern().then(() => api.pruefen()); }
        })
        .catch(() => ohneKi('Ohne Laptop gibt es keine KI-Apps.'));

      appsZeigen();
      return el('div', { klasse: 'vibe-station' }, [
        el('h2', { text: 'Euer Auftrag an die KI' }),
        el('p', { klasse: 'hinweis', text: 'Wählt aus und tippt in die hellen Felder. Ihr sprecht mit einer KI (Claude), nicht mit einem Menschen.' }),
        lueckentext, knopf, status, zaehler, code, offline,
        el('h2', { text: 'Eure Apps' }), apps
      ]);
    },
    erfuellt: (eintrag, gruppe, station) => !!eintrag.ohneKi || (eintrag.apps || []).length >= (station.ki.mindestApps || 1)
  });
})();
