// ---- Station „Bild-App vibe coden“ ----
// Lückentext statt freiem Auftrag: Effekt, Farben, Regler zur Auswahl, nur App-Name und
// Knopf-Text frei (kurz, geprüft auf dem Laptop). Das iPad schickt den Lückentext an den
// Laptop, Claude schreibt die App, der Code erscheint Stück für Stück (server/ki_app.py).
// Die fertige App läuft abgeschottet: sandbox ohne allow-same-origin und eine
// Content-Security-Policy ohne Netz. Das Foto geht nur per postMessage in diese App.
// Freier Auftrag: Eine erwachsene Person schaltet die Gruppe mit der PIN 15 Minuten frei
// (/api/ki-freigabe). Dann geht ein freier Text an Claude, auch „Letzte App ändern“.
// Beim Beenden der Station endet die Freigabe (Laptop und iPad).
(function(){
  const FEHLER_MARKE = '\u0000FEHLER:';
  const INFO_MARKE = '\u0000INFO:'; // am Ende: Token, Kosten, Strom (server/ki_app.py)
  // Fortschritt beim Bauen: Claude plant große Apps oft 20 bis 60 Sekunden, bevor Code kommt
  const PHASEN = ['Auftrag geht an den Laptop', 'Claude plant eure App', 'Claude schreibt den Code', 'App wird gestartet'];
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

      // Euer gespeichertes Foto geht automatisch in die App (kein Datei-Feld, keine Foto-Mediathek):
      // beim Laden und wenn die App per postMessage({ fotoBitte: true }) danach fragt
      function appKarte(app, beispiel){
        const rahmen = el('iframe', { sandbox: 'allow-scripts', klasse: 'vibe-rahmen', title: 'Eure App' });
        function fotoSchicken(){
          fotoAlsDataUrl().then(url => {
            if(url && rahmen.contentWindow) rahmen.contentWindow.postMessage({ bild: url }, '*'); // App hat keinen eigenen Ursprung (sandbox)
          });
        }
        function bitte(e){
          if(!document.body.contains(rahmen)){ window.removeEventListener('message', bitte); return; }
          if(e.source === rahmen.contentWindow && e.data && e.data.fotoBitte) fotoSchicken();
        }
        window.addEventListener('message', bitte);
        rahmen.addEventListener('load', fotoSchicken);
        rahmen.srcdoc = abgeschottet(app.html);
        const quelltext = el('pre', { klasse: 'vibe-code', text: app.html });
        quelltext.hidden = true;
        const codeKnopf = el('button', { type: 'button', klasse: 'secondary klein', text: 'Code ansehen', onclick: () => { quelltext.hidden = !quelltext.hidden; } });
        return el('figure', { klasse: 'vibe-karte' }, [
          el('figcaption', {}, [el('strong', { text: beispiel ? 'Beispiel-App (vorher erzeugt)' : 'App ' + app.nr }), el('span', { text: ' „' + app.auftrag + '“' })]),
          rahmen, KiVerbrauch.zeile(el, app.verbrauch), codeKnopf, quelltext
        ]);
      }

      // ---- Freier Auftrag mit erwachsener Person ----
      const proGruppeFrei = ki.proGruppeFrei || ki.proGruppe;
      let freiBis = 0; // nur im Arbeitsspeicher: nach Neuladen fragt das iPad den Laptop
      let uhr = null;
      let laeuft = false;
      const freiTeil = el('div', { klasse: 'vibe-frei' });
      freiTeil.hidden = true;
      const pinFeld = el('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: '6', 'aria-label': 'PIN', klasse: 'vibe-pin' });
      const pinStatus = el('p', { klasse: 'hinweis' });
      const pinKnopf = el('button', { type: 'button', text: 'Freischalten' });
      const pinBox = el('div', { klasse: 'vibe-pin-box' }, [el('label', { text: 'PIN: ' }, [pinFeld]), pinKnopf]);
      pinBox.hidden = true;
      const oeffnen = el('button', { type: 'button', klasse: 'secondary', text: '🔓 Erwachsene Person: frei vibe coden freischalten', onclick: () => {
        pinBox.hidden = false;
        oeffnen.hidden = true;
        pinFeld.focus();
      } });
      const freiText = el('textarea', { maxlength: '1000', rows: '5', klasse: 'vibe-frei-text',
        placeholder: 'Zum Beispiel: Eine App, die Katzenohren auf mein Foto setzt. Mit Knöpfen für verschiedene Ohren und einem Glitzer-Regler.' });
      const freiUhr = el('p', { klasse: 'hinweis' });
      const neuKnopf = el('button', { type: 'button', klasse: 'gross', text: '✨ Neue App bauen' });
      const aendernKnopf = el('button', { type: 'button', klasse: 'gross secondary', text: '🔧 Letzte App ändern' });
      const freiOffen = el('div', {}, [
        el('label', { klasse: 'eingabe' }, [el('span', { text: 'Eure Idee (die erwachsene Person tippt):' }), freiText]),
        el('p', { klasse: 'rand-warnung', text: 'Keine Namen, nichts über euch. Nur, was die App können soll.' }),
        freiUhr, neuKnopf, aendernKnopf
      ]);
      freiOffen.hidden = true;
      freiTeil.appendChild(el('h2', { text: 'Frei vibe coden' }));
      freiTeil.appendChild(el('p', { klasse: 'hinweis', text: 'Mit einer erwachsenen Person dürft ihr euren Auftrag frei formulieren und eure App weiterbauen lassen, wie im echten Leben.' }));
      [oeffnen, pinBox, pinStatus, freiOffen].forEach(k => freiTeil.appendChild(k));

      function freiZeigen(){
        const rest = Math.max(0, Math.round((freiBis - Date.now()) / 1000));
        const offen = rest > 0 && !eintrag.ohneKi && eintrag.status !== 'fertig';
        freiOffen.hidden = !offen;
        oeffnen.hidden = offen || !pinBox.hidden;
        if(offen){
          freiUhr.textContent = '🔓 Freigeschaltet: noch ' + Math.ceil(rest / 60) + ' Min.';
          neuKnopf.disabled = laeuft || eintrag.apps.length >= proGruppeFrei;
          aendernKnopf.disabled = laeuft || !eintrag.apps.length || eintrag.apps.length >= proGruppeFrei;
          if(eintrag.apps.length >= proGruppeFrei) freiUhr.textContent += ' Ihr habt alle ' + proGruppeFrei + ' Apps bauen lassen.';
        }else if(uhr){
          clearInterval(uhr);
          uhr = null;
          freiBis = 0;
        }
      }

      function freiStarten(sekunden){
        freiBis = Date.now() + sekunden * 1000;
        pinBox.hidden = true;
        clearInterval(uhr);
        uhr = setInterval(freiZeigen, 5000);
        freiZeigen();
      }

      pinKnopf.addEventListener('click', () => {
        pinKnopf.disabled = true;
        pinStatus.textContent = '';
        fetch('/api/ki-freigabe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gruppe: api.gruppe.id, pin: pinFeld.value }) })
          .then(r => r.json())
          .then(d => {
            pinFeld.value = '';
            if(!d.ok){ pinStatus.textContent = '⚠ ' + (d.fehler || 'Das hat nicht geklappt.'); return; }
            pinStatus.textContent = '';
            freiStarten(d.restSekunden);
          })
          .catch(() => { pinStatus.textContent = '⚠ Der Laptop antwortet nicht.'; })
          .then(() => { pinKnopf.disabled = false; });
      });

      neuKnopf.addEventListener('click', () => bauen({ frei: freiText.value }, freiText.value.trim()));
      aendernKnopf.addEventListener('click', () => {
        const letzte = eintrag.apps[eintrag.apps.length - 1];
        bauen({ frei: freiText.value, basis: letzte.html }, 'Änderung an App ' + letzte.nr + ': ' + freiText.value.trim());
      });

      function appsZeigen(){
        apps.innerHTML = '';
        eintrag.apps.slice().reverse().forEach(a => apps.appendChild(appKarte(a, false)));
        knopf.disabled = laeuft || eintrag.apps.length >= ki.proGruppe || !!eintrag.ohneKi;
        zaehler.textContent = eintrag.apps.length ? 'Ihr habt ' + eintrag.apps.length + ' von höchstens ' + ki.proGruppe + ' Apps bauen lassen' +
          (freiBis ? ' (frei: ' + proGruppeFrei + ').' : '.') : '';
        freiZeigen();
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
        freiTeil.hidden = true;
        api.speichern().then(() => api.pruefen());
      }

      // Baukasten: extra = {} ; frei: extra = { frei, basis? }
      function bauen(extra, auftrag){
        laeuft = true;
        appsZeigen();
        code.hidden = true;
        code.textContent = '';
        const start = Date.now();
        let phase = 0;
        let text = '';
        // Schritte mit ✓ und Sekunden, damit niemand denkt, es hängt
        function fortschritt(){
          const sek = Math.round((Date.now() - start) / 1000);
          status.innerHTML = '';
          status.appendChild(el('ol', { klasse: 'vibe-phasen' }, PHASEN.map((p, i) => el('li', {
            klasse: i < phase ? 'fertig' : (i === phase ? 'jetzt' : ''),
            text: (i < phase ? '✓ ' : (i === phase ? '⏳ ' : '')) + p + (i === phase ? ' … ' + sek + ' s' + (i === 2 ? ' (' + text.split('\n').length + ' Zeilen)' : '') : '')
          }))));
          if(phase === 1 && sek > 20) status.appendChild(el('p', { klasse: 'hinweis', text: 'Bei großen Apps denkt Claude manchmal eine Minute nach, bevor die erste Zeile kommt. Das ist normal.' }));
        }
        const uhr = setInterval(fortschritt, 1000);
        fortschritt();
        fetch('/api/ki-app', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.assign({ gruppe: api.gruppe.id, auswahl: eintrag.auswahl }, extra))
        }).then(res => {
          phase = 1;
          fortschritt();
          if(!res.ok){
            clearInterval(uhr);
            status.textContent = '';
            return res.json().then(d => {
              code.hidden = true;
              if(d.freiAbgelaufen){ freiBis = 0; status.textContent = '⚠ ' + d.fehler; return; }
              if(res.status === 503 || res.status === 403) return ohneKi(d.fehler || 'Die KI ist gerade nicht erreichbar.');
              status.textContent = '⚠ ' + (d.fehler || 'Das hat nicht geklappt.');
            });
          }
          // Stück für Stück lesen; ältere Safari ohne Datenstrom: alles auf einmal
          const fertig = () => {
            clearInterval(uhr);
            const fehler = text.indexOf(FEHLER_MARKE);
            if(fehler >= 0){
              status.textContent = '⚠ ' + text.slice(fehler + FEHLER_MARKE.length);
              return;
            }
            let verbrauch = null;
            const info = text.indexOf(INFO_MARKE);
            if(info >= 0){
              try { verbrauch = JSON.parse(text.slice(info + INFO_MARKE.length)); } catch(e){ verbrauch = null; }
              text = text.slice(0, info);
            }
            const html = htmlHerausziehen(text);
            if(!html){ status.textContent = '⚠ Die KI hat keine fertige App geliefert. Bitte nochmal versuchen.'; return; }
            phase = 3;
            fortschritt();
            eintrag.apps.push({ nr: eintrag.apps.length + 1, auftrag: auftrag, html: html, verbrauch: verbrauch });
            eintrag.antworten = eintrag.antworten || {};
            eintrag.antworten.auftraege = eintrag.apps.map(a => a.auftrag);
            code.hidden = true;
            status.textContent = '✓ Fertig nach ' + Math.round((Date.now() - start) / 1000) + ' Sekunden. Testet eure App!';
            return api.speichern().then(() => api.pruefen());
          };
          if(!res.body || !res.body.getReader) return res.text().then(t => { text = t; code.textContent = t.split(INFO_MARKE)[0]; return fertig(); });
          const leser = res.body.getReader();
          const dekoder = new TextDecoder();
          const weiter = () => leser.read().then(stueck => {
            if(stueck.done) return fertig();
            text += dekoder.decode(stueck.value, { stream: true });
            if(phase < 2){ phase = 2; code.hidden = false; }
            code.textContent = text.split(INFO_MARKE)[0].replace(FEHLER_MARKE, '\n⚠ ');
            code.scrollTop = code.scrollHeight;
            return weiter();
          });
          return weiter();
        }).catch(err => {
          console.error(err);
          ohneKi('Der Laptop antwortet nicht.');
        }).then(() => {
          clearInterval(uhr);
          laeuft = false;
          appsZeigen();
        });
      }

      knopf.addEventListener('click', () => bauen({}, satz(ki, eintrag.auswahl)));

      fetch('/api/ki-bereit?gruppe=' + api.gruppe.id).then(r => r.json())
        .then(d => {
          // Opt-out der Eltern (Liste auf dem Laptop): nur Beispiele, der Laptop fragt die KI nicht
          if(d.ohneKi) return ohneKi('Diese Station macht ihr heute mit Beispielen.');
          if(!d.eingerichtet) return ohneKi('Die KI ist auf dem Laptop nicht eingerichtet.');
          if(eintrag.ohneKi){ eintrag.ohneKi = false; appsZeigen(); api.speichern().then(() => api.pruefen()); }
          // Freier Modus nur, wenn auf dem Laptop eine PIN eingerichtet ist
          freiTeil.hidden = !d.pinEingerichtet;
          if(d.freiRest) freiStarten(d.freiRest);
        })
        .catch(() => ohneKi('Ohne Laptop gibt es keine KI-Apps.'));

      appsZeigen();
      return el('div', { klasse: 'vibe-station' }, [
        el('h2', { text: 'Euer Auftrag an die KI' }),
        el('p', { klasse: 'hinweis', text: 'Wählt aus und tippt in die hellen Felder. Ihr sprecht mit einer KI (Claude), nicht mit einem Menschen.' }),
        lueckentext, knopf, freiTeil, status, zaehler, code, offline,
        el('h2', { text: 'Eure Apps' }), apps
      ]);
    },
    erfuellt: (eintrag, gruppe, station) => !!eintrag.ohneKi || (eintrag.apps || []).length >= (station.ki.mindestApps || 1)
  });
})();
