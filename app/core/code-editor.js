// ---- Code-Editor für iPads (SVG, HTML/CSS/JavaScript) ----
// Gebaut für die Bildschirm-Tastatur (im KOMEZ gibt es keine Tastaturen):
// - Lückentext: Der Code ist zu sehen, ändern lassen sich nur die Lücken {{id}}.
//   Bausteine [[id]] setzt „Baustein einfügen“ automatisch an die richtige Stelle.
// - Eine Aufgabe nach der anderen, mit Haken und Rückmeldung.
// - Ist die Tastatur offen, rückt alles in den sichtbaren Bereich darüber:
//   aktuelle Aufgabe und kleine Vorschau oben, Code in der Mitte, Zeichenleiste unten.
// - Profi-Modus: den ganzen Code frei bearbeiten. Mit optionen.profiNachAufgaben erst,
//   wenn alle Pflicht-Aufgaben geschafft sind (Pixel vs. Vektor, Patricia 25.10.).
// Geprüft wird immer der fertige Code (auch im Profi-Modus), siehe optionen.pruefen.
(function(){
  const PRUEF_PAUSE_MS = 300;
  const ZEICHEN = ['<', '>', '/', '"', '=', '{', '}', ';', ':', '(', ')', "'", '#'];
  const TASTATUR_MIN_PX = 150; // so viel muss der sichtbare Bereich schrumpfen, damit die Tastatur als offen gilt
  const TEIL_RE = /(\{\{[a-z0-9-]+\}\}|\[\[[a-z0-9-]+\]\])/;

  // iPad-Tastaturen machen aus " gern „ “ ” (typografische Anführungszeichen)
  function normalisieren(code){
    return code.replace(/[„“”″]/g, '"').replace(/[‚‘’′]/g, "'");
  }

  function el(tag, attrs, kinder){ return Rahmen.el(tag, attrs, kinder); }

  // Vorlage + Werte + eingefügte Bausteine -> fertiger Code
  function zusammensetzen(text, opt, z){
    return text.split(TEIL_RE).map(teil => {
      let m = /^\{\{([a-z0-9-]+)\}\}$/.exec(teil);
      if(m) return z.werte[m[1]] !== undefined ? z.werte[m[1]] : (opt.luecken[m[1]] || {}).wert || '';
      m = /^\[\[([a-z0-9-]+)\]\]$/.exec(teil);
      if(m) return z.eingefuegt[m[1]] ? zusammensetzen(opt.bausteine[m[1]].code, opt, z) : '';
      return teil;
    }).join('').replace(/\n{3,}/g, '\n\n');
  }

  function erstellen(opt){
    const z = opt.zustand;
    z.werte = z.werte || {};
    z.eingefuegt = z.eingefuegt || {};
    const aufgaben = opt.aufgaben;
    let erledigt = {};
    let hinweise = {};
    let fokusLuecke = null;

    // ---- Bausteine des Editors ----
    const wurzel = el('div', { klasse: 'ce' });
    const aufgabenPunkte = el('div', { klasse: 'ce-punkte' });
    const aufgabeKarte = el('div', { klasse: 'ce-aufgabe' });
    const vorschau = el('div', { klasse: 'ce-vorschau' });
    const lueckentext = el('pre', { klasse: 'ce-lueckentext' });
    const profiFeld = el('textarea', { klasse: 'ce-profi', rows: '12', spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off', 'aria-label': 'Code' });
    const syntaxBox = el('p', { klasse: 'ce-syntax' });
    syntaxBox.hidden = true;
    const zeichenleiste = el('div', { klasse: 'ce-zeichen' }, ZEICHEN.map(c => el('button', { type: 'button', text: c, 'data-zeichen': c })));
    const profiKnopf = el('button', { type: 'button', klasse: 'secondary klein' });
    const fertigKnopf = el('button', { type: 'button', klasse: 'ce-fertig', text: 'Tastatur zu' });

    // ---- Code ----
    function code(){
      return normalisieren(z.profi ? (z.profiCode || '') : zusammensetzen(opt.vorlage, opt, z));
    }

    // ---- Lückentext zeichnen ----
    function aktiveAufgabe(){
      return aufgaben.filter(a => !a.freiwillig && !erledigt[a.id])[0] || aufgaben.filter(a => !erledigt[a.id])[0] || null;
    }

    function luecke(id){
      const def = opt.luecken[id] || {};
      const wert = z.werte[id] !== undefined ? z.werte[id] : (def.wert || '');
      const input = el('input', {
        type: 'text', klasse: 'ce-luecke', 'data-luecke': id, 'aria-label': def.name || id,
        autocapitalize: def.text ? 'sentences' : 'off', autocorrect: 'off', autocomplete: 'off', spellcheck: 'false'
      });
      input.value = wert;
      input.size = Math.max(3, wert.length + 1);
      input.addEventListener('input', () => {
        z.werte[id] = input.value;
        input.size = Math.max(3, input.value.length + 1);
        geaendert();
      });
      input.addEventListener('focus', () => { fokusLuecke = id; });
      return input;
    }

    function lueckentextZeichnen(){
      const aktiv = aktiveAufgabe();
      lueckentext.innerHTML = '';
      function teile(text, ziel){
        text.split(TEIL_RE).forEach(teil => {
          let m = /^\{\{([a-z0-9-]+)\}\}$/.exec(teil);
          if(m){
            const input = luecke(m[1]);
            if(aktiv && aktiv.luecke === m[1]) input.classList.add('aktiv');
            ziel.appendChild(input);
            return;
          }
          m = /^\[\[([a-z0-9-]+)\]\]$/.exec(teil);
          if(m){
            const b = opt.bausteine[m[1]];
            if(z.eingefuegt[m[1]]){
              const span = el('span', { klasse: 'ce-baustein-drin' });
              teile(b.code, span);
              ziel.appendChild(span);
            }else if(aktiv && aktiv.baustein === m[1]){
              // Nur der Baustein der aktuellen Aufgabe zeigt, wo er hinkommt
              ziel.appendChild(el('button', { type: 'button', klasse: 'ce-platzhalter', text: '＋ ' + (b.name || 'Baustein') + ' hier einfügen', onclick: () => einfuegen(m[1]) }));
            }
            return;
          }
          ziel.appendChild(document.createTextNode(teil));
        });
      }
      teile(opt.vorlage, lueckentext);
    }

    function einfuegen(id){
      z.eingefuegt[id] = true;
      if(z.profi){
        // Im Profi-Modus ans Ende des passenden Bereichs: einfach anhängen
        z.profiCode = (z.profiCode || '').replace(/\s*$/, '') + '\n' + zusammensetzen(opt.bausteine[id].code, opt, z) + '\n';
        profiFeld.value = z.profiCode;
      }
      if(!z.profi) lueckentextZeichnen();
      geaendert(true);
    }

    // ---- Aufgaben: eine nach der anderen ----
    function aufgabenZeichnen(){
      const aktiv = aktiveAufgabe();
      aufgabenPunkte.innerHTML = '';
      aufgaben.forEach((a, i) => aufgabenPunkte.appendChild(el('span', {
        klasse: 'ce-punkt' + (erledigt[a.id] ? ' ok' : '') + (aktiv === a ? ' aktiv' : '') + (a.freiwillig ? ' frei' : ''),
        text: erledigt[a.id] ? '✓' : String(i + 1), title: a.text
      })));
      aufgabeKarte.innerHTML = '';
      const pflichtFertig = aufgaben.every(a => a.freiwillig || erledigt[a.id]);
      profiKnopf.hidden = !!opt.profiNachAufgaben && !pflichtFertig && !z.profi;
      const profiFrei = opt.profiNachAufgaben && pflichtFertig && !z.profi ? ' Jetzt ist auch der Profi-Modus frei.' : '';
      if(!aktiv){
        aufgabeKarte.appendChild(el('p', { klasse: 'ce-geschafft', text: '🎉 Alle Aufgaben geschafft! Ihr könnt weiter ausprobieren.' + profiFrei }));
        return;
      }
      if(pflichtFertig && aktiv.freiwillig){
        aufgabeKarte.appendChild(el('p', { klasse: 'ce-geschafft', text: '✓ Alle Pflicht-Aufgaben geschafft! Wenn ihr wollt: Bonus.' + profiFrei }));
      }
      const nr = aufgaben.indexOf(aktiv) + 1;
      aufgabeKarte.appendChild(el('p', { klasse: 'ce-aufgabe-text' }, [
        el('strong', { text: (aktiv.freiwillig ? 'Bonus' : 'Aufgabe ' + nr) + ': ' }),
        el('span', { text: aktiv.text })
      ]));
      if(hinweise[aktiv.id]) aufgabeKarte.appendChild(el('p', { klasse: 'ce-hinweis', text: hinweise[aktiv.id] }));
      if(aktiv.baustein && !z.eingefuegt[aktiv.baustein]){
        aufgabeKarte.appendChild(el('pre', { klasse: 'ce-baustein', text: zusammensetzen(opt.bausteine[aktiv.baustein].code, opt, z).trim() }));
        aufgabeKarte.appendChild(el('button', { type: 'button', klasse: 'klein', text: 'Baustein einfügen', onclick: () => einfuegen(aktiv.baustein) }));
      }
      if(aktiv.luecke && !z.profi){
        aufgabeKarte.appendChild(el('button', { type: 'button', klasse: 'secondary klein', text: 'Zur Lücke', onclick: () => {
          const input = lueckentext.querySelector('[data-luecke="' + aktiv.luecke + '"]');
          if(input){ input.focus(); input.select(); }
        } }));
      }
    }

    // ---- Prüfen und Vorschau ----
    let timer = null;
    function geaendert(sofort){
      clearTimeout(timer);
      timer = setTimeout(pruefenUndZeigen, sofort ? 0 : PRUEF_PAUSE_MS);
    }

    function pruefenUndZeigen(){
      const vorher = aktiveAufgabe();
      const c = code();
      const ergebnis = opt.pruefen(c, z);
      erledigt = ergebnis.erledigt;
      hinweise = ergebnis.hinweise || {};
      syntaxBox.hidden = !ergebnis.syntax;
      syntaxBox.textContent = ergebnis.syntax || '';
      opt.vorschau(c, vorschau);
      aufgabenZeichnen();
      // Neu zeichnen nur, wenn sich die Aufgabe geändert hat: sonst springt beim Tippen der Fokus weg
      if(!z.profi && (vorher !== aktiveAufgabe() || !lueckentext.childNodes.length)){
        const fokus = fokusLuecke;
        lueckentextZeichnen();
        const input = fokus && lueckentext.querySelector('[data-luecke="' + fokus + '"]');
        if(input && document.activeElement !== input && wurzel.classList.contains('kompakt')) input.focus();
      }
      opt.beiAenderung(c, erledigt);
    }

    // ---- Profi-Modus ----
    function modusZeichnen(){
      lueckentext.hidden = !!z.profi;
      profiFeld.hidden = !z.profi;
      profiKnopf.textContent = z.profi ? 'Zurück zum Lückentext' : 'Profi-Modus: ganzen Code bearbeiten';
    }
    profiKnopf.addEventListener('click', () => {
      if(z.profi){
        if(!confirm('Zurück zum Lückentext? Was ihr im Profi-Modus geändert habt, geht verloren.')) return;
        z.profi = false;
        z.profiCode = '';
        lueckentextZeichnen();
      }else{
        z.profiCode = zusammensetzen(opt.vorlage, opt, z);
        profiFeld.value = z.profiCode;
        z.profi = true;
      }
      modusZeichnen();
      geaendert(true);
    });
    profiFeld.addEventListener('input', () => {
      z.profiCode = profiFeld.value;
      geaendert();
    });

    // ---- Zeichenleiste: Zeichen an der Cursor-Stelle einfügen, ohne die Tastatur zu schließen ----
    function zeichenEinfuegen(c){
      const feld = document.activeElement;
      if(!feld || !wurzel.contains(feld) || (feld.tagName !== 'INPUT' && feld.tagName !== 'TEXTAREA')) return;
      const start = feld.selectionStart, ende = feld.selectionEnd;
      feld.value = feld.value.slice(0, start) + c + feld.value.slice(ende);
      feld.selectionStart = feld.selectionEnd = start + c.length;
      feld.dispatchEvent(new Event('input', { bubbles: true }));
    }
    ['touchstart', 'mousedown'].forEach(ereignis => zeichenleiste.addEventListener(ereignis, ev => {
      const knopf = ev.target.closest('[data-zeichen]');
      if(!knopf) return;
      ev.preventDefault(); // Fokus bleibt im Eingabefeld, die Tastatur bleibt offen
      zeichenEinfuegen(knopf.getAttribute('data-zeichen'));
    }));
    fertigKnopf.addEventListener('click', () => { if(document.activeElement) document.activeElement.blur(); });

    // ---- Kompakter Modus, solange die Tastatur offen ist ----
    const erzwungen = /[?&]tastatur\b/.test(location.search); // nur zum Testen am Rechner
    function anpassen(){
      const vv = window.visualViewport;
      const offen = erzwungen || (!!vv && wurzel.contains(document.activeElement) && window.innerHeight - vv.height > TASTATUR_MIN_PX);
      wurzel.classList.toggle('kompakt', offen);
      document.body.classList.toggle('ce-kompakt', offen);
      if(offen && vv && !erzwungen){
        wurzel.style.top = vv.offsetTop + 'px';
        wurzel.style.height = vv.height + 'px';
      }else if(offen){
        wurzel.style.top = '0px';
        wurzel.style.height = Math.round(window.innerHeight * 0.55) + 'px';
      }else{
        wurzel.style.top = '';
        wurzel.style.height = '';
      }
      if(offen){
        const aktivFeld = document.activeElement;
        if(aktivFeld && aktivFeld.scrollIntoView && wurzel.contains(aktivFeld)) aktivFeld.scrollIntoView({ block: 'center' });
      }
    }
    if(window.visualViewport){
      window.visualViewport.addEventListener('resize', anpassen);
      window.visualViewport.addEventListener('scroll', anpassen);
    }
    wurzel.addEventListener('focusin', () => setTimeout(anpassen, 300));
    wurzel.addEventListener('focusout', () => setTimeout(anpassen, 300));

    // ---- Zusammenbauen ----
    wurzel.appendChild(el('div', { klasse: 'ce-kopf' }, [
      el('div', { klasse: 'ce-kopf-links' }, [aufgabenPunkte, aufgabeKarte]),
      el('div', { klasse: 'ce-kopf-rechts' }, [el('p', { klasse: 'ce-label', text: 'Ergebnis' }), vorschau])
    ]));
    wurzel.appendChild(el('div', { klasse: 'ce-code' }, [lueckentext, profiFeld, syntaxBox]));
    wurzel.appendChild(el('div', { klasse: 'ce-fuss' }, [zeichenleiste, fertigKnopf]));
    wurzel.appendChild(el('div', { klasse: 'ce-modus' }, [profiKnopf]));
    if(z.profi) profiFeld.value = z.profiCode || '';
    modusZeichnen();
    lueckentextZeichnen();
    pruefenUndZeigen();
    if(erzwungen) setTimeout(anpassen, 0);
    // Für Stationen, die von außen etwas melden (z. B. Klick in der Vorschau)
    wurzel.neuPruefen = () => geaendert(true);
    return wurzel;
  }

  window.CodeEditor = { erstellen: erstellen, normalisieren: normalisieren };
})();
