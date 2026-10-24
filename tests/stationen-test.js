// Klickt die Workshop-App automatisch durch (Anmeldung → Foto → stencil.me → Lasercutter).
//
// Voraussetzung: Test-Server läuft mit eigenem Datenordner (echte Stempel bleiben unberührt)
// und KI im Testmodus (kein Aufruf bei Claude, keine Kosten):
//   STENCILME_DATEN=archiv/testdaten STENCILME_KI_TEST=1 python3 server/server.py --port 8765
// und Playwright
// ist außerhalb des Repos installiert (~/.cache/stencilme-playwright).
//
//   NODE_PATH=~/.cache/stencilme-playwright/node_modules node tests/stationen-test.js [webkit|chromium] [Screenshot-Ordner, sonst archiv/screenshots]
//
// Legt im Testordner eine Test-Gruppe und Test-Stempel an (archiv/testdaten, nicht im Repo).
const path = require('path');
const pw = require('playwright');

const BROWSER = process.argv[2] || 'webkit';
const SHOTS = process.argv[3] || path.join(__dirname, '..', 'archiv', 'screenshots');
const BASE = process.env.BASE || 'http://localhost:8765';
const FOTO = path.join(__dirname, '..', 'docs', 'test-foto.jpg');
// Testvideo (nicht im Repo): ffmpeg -loop 1 -i docs/test-foto.jpg -t 3 … archiv/testdateien/test-video.webm
const VIDEO = process.env.VIDEO || path.join(__dirname, '..', 'archiv', 'testdateien', 'test-video.webm');

let fehler = 0;
function pruefe(ok, text){
  console.log((ok ? '  ✓ ' : '  ✗ ') + text);
  if(!ok) fehler++;
}

async function abschliessen(page, sterne){
  await page.click('button:has-text("Station beendet")');
  await page.click('button.wahl:has-text("Bildbearbeitungs-KI")');
  await page.locator('button.stern').nth(sterne - 1).click();
  await page.click('button:has-text("Fertig")');
  await page.waitForSelector('text=Super, geschafft!');
}

(async () => {
  const browser = await pw[BROWSER].launch();
  // iPad-Größe im Querformat
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  const konsolenFehler = [];
  page.on('pageerror', e => { if(!/access control checks/.test(e.message)) konsolenFehler.push(e.message); });
  // Zählen nicht: Fehler von YouTube selbst und Anfragen, die WebKit abbricht, weil der
  // Test zur nächsten Seite springt („due to access control checks“ bei eigener Adresse)
  page.on('console', m => {
    const text = m.text() + (m.location().url || '');
    if(m.type() === 'error' && !/youtube|ytimg|google/i.test(text) && !/access control checks/.test(text)) konsolenFehler.push(m.text());
  });
  const youtubeAnfragen = [];
  page.on('request', r => { if(/youtube|ytimg|googlevideo/.test(r.url())) youtubeAnfragen.push(r.url()); });

  console.log('Station ohne Anmeldung');
  await page.goto(BASE + '/app/station.html?id=foto');
  await page.waitForSelector('text=Erst anmelden');
  pruefe(await page.locator('a:has-text("Zur Startseite")').count() === 1, 'Station verweist auf die Startseite');

  console.log('Screen 1: Anmeldung allein');
  await page.goto(BASE + '/');
  await page.click('text=Los geht');
  await page.click('button[data-anzahl="1"]');
  pruefe(await page.locator('#feld2').isHidden(), 'allein: nur ein Namensfeld');
  await page.fill('#name1', 'Cem');
  await page.click('#namenWeiter');
  await page.waitForSelector('text=Hallo Cem!');
  pruefe(await page.locator('text=Als Erstes machst du ein Foto von dir.').count() === 1, 'allein: „Mach ein Foto von dir“');
  page.once('dialog', d => d.accept());
  await page.click('#neu');
  await page.waitForSelector('#los');

  console.log('Screen 1: Anmeldung zu zweit');
  await page.click('text=Los geht');
  await page.screenshot({ path: path.join(SHOTS, BROWSER + '-0a-anzahl.png') });
  await page.click('button[data-anzahl="2"]');
  await page.fill('#name1', 'Ada');
  pruefe(await page.locator('#namenWeiter').isDisabled(), 'zu zweit: gesperrt mit nur einem Namen');
  await page.fill('#name2', 'ada');
  pruefe(await page.locator('#namenWeiter').isDisabled(), 'zu zweit: gesperrt bei gleichen Namen');
  await page.fill('#name2', 'Bo');
  await page.screenshot({ path: path.join(SHOTS, BROWSER + '-0b-namen.png') });
  await page.click('#namenWeiter');
  await page.waitForSelector('text=Hallo Ada und Bo!');
  pruefe(await page.locator('text=Als Erstes macht ihr nacheinander ein Foto von euch.').count() === 1, 'zu zweit: „Macht nacheinander ein Foto“');
  await page.screenshot({ path: path.join(SHOTS, BROWSER + '-0c-weiter.png') });
  await page.reload();
  await page.waitForSelector('text=Hallo Ada und Bo!');
  pruefe(true, 'nach Neuladen weiter angemeldet');
  await page.click('#weiterLink');
  await page.waitForSelector('h1:has-text("Foto machen")');
  pruefe(true, 'weiter zur Foto-Station');

  console.log('Station Foto');
  const beenden = page.locator('button:has-text("Station beendet")');
  pruefe(await beenden.isDisabled(), '„Station beendet“ gesperrt ohne Fotos');
  const inputs = page.locator('input[type=file]');
  pruefe(await inputs.count() === 2, 'ein Foto-Feld pro Person');
  pruefe(await page.locator('.beispiele figure').count() === 4, 'vier Beispielbilder');
  // Foto ohne Person: eine leere Fläche
  const leer = await browser.newPage({ viewport: { width: 600, height: 800 } });
  await leer.setContent('<body style="margin:0;background:#c9a97f"></body>');
  const leerJpeg = await leer.screenshot({ type: 'jpeg' });
  await leer.close();
  await inputs.nth(0).setInputFiles({ name: 'leer.jpg', mimeType: 'image/jpeg', buffer: leerJpeg });
  await page.waitForSelector('.ki-pruefung.keine', { timeout: 60000 });
  pruefe(true, 'Foto ohne Person: „Die KI findet hier keine Person“');
  await page.screenshot({ path: path.join(SHOTS, BROWSER + '-1a-keine-person.png'), fullPage: true });
  await inputs.nth(0).setInputFiles(FOTO);
  await page.waitForSelector('.foto-feld:nth-child(1) .ki-pruefung.ok', { timeout: 60000 });
  pruefe(true, 'Foto mit Person: „Die KI hat dich erkannt“');
  pruefe(await beenden.isDisabled(), 'nach einem Foto noch gesperrt');
  await inputs.nth(1).setInputFiles({ name: 'leer.jpg', mimeType: 'image/jpeg', buffer: leerJpeg });
  await page.waitForSelector('.foto-feld:nth-child(2) .ki-pruefung.keine', { timeout: 60000 });
  pruefe(await beenden.isDisabled(), 'gesperrt, solange keine Person erkannt ist');
  await page.click('.foto-feld:nth-child(2) button:has-text("Trotzdem nehmen")');
  pruefe(await page.locator('.foto-feld:nth-child(2) .ki-pruefung.trotzdem').count() === 1, '„Trotzdem nehmen“ geht');
  await inputs.nth(1).setInputFiles(FOTO);
  await page.waitForSelector('.foto-feld:nth-child(2) .ki-pruefung.ok', { timeout: 60000 });
  // WebKit gibt den Knopf ein paar Millisekunden nach der Vorschau frei
  pruefe(await page.waitForFunction(() => {
    const b = Array.prototype.filter.call(document.querySelectorAll('button'), x => x.textContent === 'Station beendet')[0];
    return b && !b.disabled;
  }, null, { timeout: 3000 }).then(() => true, () => false), 'nach zwei Fotos frei');
  await page.screenshot({ path: path.join(SHOTS, BROWSER + '-1-foto.png'), fullPage: true });
  await page.click('button:has-text("Station beendet")');
  pruefe(await page.locator('button:has-text("Fertig")').isDisabled(), '„Fertig“ gesperrt ohne Antworten');
  await page.click('button.wahl:has-text("Keine KI")');
  pruefe(await page.locator('.aufloesung .etikett').count() === 1, 'Auflösung erscheint nach der Antwort');
  await page.locator('button.stern').nth(3).click();
  await page.screenshot({ path: path.join(SHOTS, BROWSER + '-2-abschluss.png'), fullPage: true });
  await page.click('button:has-text("Fertig")');
  await page.waitForSelector('text=Super, geschafft!');
  await page.waitForSelector('text=Weiter geht es');
  const naechste = await page.locator('.gross-text strong').textContent();
  pruefe(['Bild bearbeiten', 'Hintergrund ändern', 'Körpererkennung testen', 'Pixel vs. Vektor', 'Coding: HTML, CSS und JavaScript', 'Selbstporträts mit KI neu erschaffen', 'Mit der Hand drucken: Linolplatten'].indexOf(naechste) >= 0, 'nächste Station vorgeschlagen: ' + naechste);
  pruefe((await page.locator('.zaehler').textContent()).indexOf('1 von 12') >= 0, 'Zähler steht auf 1 von 12');
  pruefe(await page.locator('.puzzle').first().locator('.puzzle-teil.da').count() === 1, 'ein Puzzleteil sichtbar');
  await page.screenshot({ path: path.join(SHOTS, BROWSER + '-3-weiter.png'), fullPage: true });

  console.log('Reihenfolge');
  await page.goto(BASE + '/app/station.html?id=sticker&test');
  await page.waitForSelector('text=Bonus-Station');
  pruefe(/noch 7/.test(await page.locator('#inhalt').textContent()), 'Bonus-Sticker gesperrt: „noch 7“');
  await page.goto(BASE + '/app/station.html?id=lasercutter&test');
  await page.waitForSelector('text=noch nicht');
  pruefe(await page.locator('text=Bild bearbeiten').count() > 0, 'Lasercutter verlangt zuerst „Bild bearbeiten“');

  console.log('Station Bild bearbeiten (stencil.me)');
  const stempelVorher = (await (await page.request.get(BASE + '/api/liste')).json()).stempel.length;
  await page.goto(BASE + '/app/station.html?id=stencilme&test');
  await page.waitForSelector('h1:has-text("Bild bearbeiten")');
  pruefe(await page.locator('.stempel-person').count() === 2, 'ein Bereich pro Person');
  // Beide Personen nacheinander: warten, bis beide Stempel fertig gerechnet sind
  await page.waitForFunction(() => document.querySelectorAll('.stempel-person .schritt-bild svg').length === 2, null, { timeout: 120000 });
  pruefe(await page.locator('.stempel-person').first().locator('.schritt-bild.leer').count() === 0, 'alle fünf Schritte als Bild sichtbar');
  pruefe((await page.locator('.stempel-person').first().locator('.schritt-notiz').nth(2).textContent()).indexOf('Pink = Person') === 0, 'KI hat die Person gefunden');
  const randText = await page.locator('.rand strong').first().textContent();
  pruefe(/mm/.test(randText), 'Schnittrand automatisch gewählt: ' + randText);
  pruefe(await page.locator('.rand-warnung:visible').count() === 0, 'roter Rand in einem Stück');
  await page.screenshot({ path: path.join(SHOTS, BROWSER + '-6-stencilme.png'), fullPage: true });
  pruefe(await page.locator('button:has-text("Station beendet")').isDisabled(), 'gesperrt, bevor die Stempel abgeschickt sind');
  await page.locator('button:has-text("Stempel an den Laptop schicken")').first().click();
  await page.waitForSelector('button:has-text("Stempel ist abgeschickt")');
  // Regler ändern: Stempel kann neu geschickt werden
  await page.locator('.rand input').first().fill('12');
  await page.waitForSelector('button:has-text("Geänderten Stempel neu schicken")');
  pruefe(true, 'nach Änderung am Rand: „neu schicken“');
  await page.locator('.rand input').first().fill(String(parseFloat(randText.replace(',', '.'))));
  await page.waitForFunction(() => document.querySelectorAll('button').length && Array.prototype.some.call(document.querySelectorAll('.stempel-person:first-of-type button'), b => b.textContent.indexOf('abgeschickt') >= 0));
  await page.locator('button:has-text("Stempel an den Laptop schicken")').first().click();
  await page.waitForFunction(() => Array.prototype.filter.call(document.querySelectorAll('button'), b => b.textContent.indexOf('Stempel ist abgeschickt') >= 0).length === 2);
  pruefe(await page.locator('button:has-text("Station beendet")').isDisabled(), 'gesperrt ohne Antwort zu den Farben');
  await page.fill('#eingabe-farben', 'Rot schneidet, Blau graviert');
  await page.click('button:has-text("Station beendet")');
  pruefe(await page.locator('.aufloesung-text').count() === 1, 'Auflösung zu den Farben im Abschluss');
  await page.screenshot({ path: path.join(SHOTS, BROWSER + '-7-stencilme-abschluss.png'), fullPage: true });
  await page.click('button.wahl:has-text("Bildbearbeitungs-KI")');
  await page.locator('button.stern').nth(4).click();
  await page.click('button:has-text("Fertig")');
  await page.waitForSelector('text=Super, geschafft!');
  pruefe(await page.locator('.puzzle').first().locator('.puzzle-teil.da').count() === 2, 'Puzzle: zwei Teile mit Stempel-Porträt');
  await page.waitForFunction(() => document.getElementById('sync').textContent.indexOf('Gesichert auf dem Laptop') >= 0, null, { timeout: 20000 });
  const stempelNachher = (await (await page.request.get(BASE + '/api/liste')).json()).stempel;
  const neu = stempelNachher.slice(0, stempelNachher.length - stempelVorher).map(x => x.name).sort().join(',');
  pruefe(neu === 'Ada,Bo', 'zwei Stempel auf dem Laptop: ' + neu);

  console.log('Station Lasercutter');
  await page.goto(BASE + '/app/station.html?id=lasercutter&test');
  await page.waitForSelector('h1:has-text("Lasercutter")');
  pruefe(youtubeAnfragen.length === 0 && await page.locator('.video iframe').count() === 0, 'Video: vor dem Antippen nichts von YouTube geladen');
  await page.click('button:has-text("Video laden")');
  pruefe((await page.locator('.video iframe').getAttribute('src')).indexOf('https://www.youtube-nocookie.com/embed/VKd2WsdRPvY') === 0, 'Video nach Antippen eingebettet (youtube-nocookie)');
  await page.fill('#eingabe-frage', 'Wie heiß wird der Laser?');
  await page.fill('#eingabe-antwort', 'Sehr heiß');
  await page.locator('input[type=file]').setInputFiles(FOTO);
  await page.locator('.foto-vorschau').waitFor({ state: 'visible' });
  await abschliessen(page, 3);
  pruefe((await page.locator('.zaehler').textContent()).indexOf('3 von 12') >= 0, 'Zähler steht auf 3 von 12');

  console.log('Neu laden: Fortschritt bleibt');
  await page.reload();
  await page.waitForSelector('text=schon erledigt');
  pruefe((await page.locator('.zaehler').textContent()).indexOf('3 von 12') >= 0, 'Fortschritt nach Neuladen erhalten');

  console.log('Startseite nach drei Stationen');
  await page.goto(BASE + '/');
  await page.waitForSelector('text=3 von 12 Stationen geschafft');
  pruefe(true, 'Startseite zeigt den Stand');
  await page.goto(BASE + '/app/station.html?id=lasercutter');

  console.log('Station Körpererkennung testen');
  await page.goto(BASE + '/app/station.html?id=koerpererkennung&test');
  await page.waitForSelector('h1:has-text("Körpererkennung")');
  pruefe(await page.locator('.aufgabe').count() === 6, 'sechs Aufgaben zum Abhaken');
  await page.locator('input[type=file]').setInputFiles(VIDEO);
  await page.waitForFunction(() => Array.prototype.some.call(document.querySelectorAll('button'), b => b.textContent.indexOf('Bild der KI-Ansicht speichern') >= 0 && !b.disabled), null, { timeout: 120000 });
  pruefe(true, 'Video läuft, die KI rechnet');
  for(const ansicht of ['Körperteile', 'Hintergrund unscharf', 'Person']){
    await page.click('.ki-regelung button:has-text("' + ansicht + '")');
    await page.waitForTimeout(1500);
  }
  await page.waitForFunction(() => /Bilder pro Sekunde/.test(document.querySelector('.tempo').textContent), null, { timeout: 30000 });
  pruefe(true, 'Tempo: ' + await page.locator('.tempo').textContent());
  await page.click('.ki-regelung button:has-text("Körperteile")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS, BROWSER + '-10-koerpererkennung.png'), fullPage: true });
  await page.click('button:has-text("Bild der KI-Ansicht speichern")');
  await page.waitForSelector('.ki-bild:visible');
  for(const i of [0, 3, 5]) await page.check('#aufgabe-' + i);
  await page.fill('#eingabe-gleich-gut', 'Bei Haaren unsicher');
  pruefe(await page.locator('button:has-text("Station beendet")').isDisabled(), 'gesperrt ohne zweite Ethik-Frage');
  await page.fill('#eingabe-folgen', 'Manche werden benachteiligt');
  await abschliessen(page, 5);
  pruefe(true, 'Körpererkennung abgeschlossen');

  console.log('Station Hintergrund ändern');
  await page.goto(BASE + '/app/station.html?id=hintergrund&test');
  await page.waitForSelector('h1:has-text("Hintergrund ändern")');
  await page.waitForFunction(() => document.querySelectorAll('.frei-bild canvas').length === 2, null, { timeout: 120000 });
  pruefe(true, 'beide Fotos freigestellt');
  pruefe(await page.locator('.hintergrund-person').first().locator('button.hintergrund-wahl').count() === 6, 'sechs Hintergründe zur Auswahl');
  pruefe(await page.locator('button:has-text("Station beendet")').isDisabled(), 'gesperrt, bevor die Bilder abgeschickt sind');
  await page.locator('.hintergrund-person').nth(0).locator('button.hintergrund-wahl').nth(2).click();
  await page.locator('.hintergrund-person').nth(1).locator('button.hintergrund-wahl').nth(0).click();
  await page.waitForFunction(() => document.querySelectorAll('.ergebnis-bild canvas').length === 2);
  await page.screenshot({ path: path.join(SHOTS, BROWSER + '-9-hintergrund.png'), fullPage: true });
  await page.locator('.hintergrund-person').nth(0).locator('button:has-text("Bild an den Laptop schicken")').click();
  await page.locator('.hintergrund-person').nth(1).locator('button:has-text("Bild an den Laptop schicken")').click();
  await page.waitForFunction(() => Array.prototype.filter.call(document.querySelectorAll('button'), b => b.textContent.indexOf('Bild ist abgeschickt') >= 0).length === 2);
  await abschliessen(page, 4);
  pruefe((await page.locator('.zaehler').textContent()).indexOf('5 von 12') >= 0, 'Zähler steht auf 5 von 12');

  console.log('Station Pixel vs. Vektor');
  await page.goto(BASE + '/app/station.html?id=pixel-vektor&test');
  await page.waitForSelector('h1:has-text("Pixel vs. Vektor")');
  pruefe(await page.locator('.pv-infografik img').evaluate(img => img.complete && img.naturalWidth > 0), 'Infografik aus der Stationenkarte geladen');
  pruefe(await page.locator('.pv-teil').nth(1).isHidden(), 'SVG-Übung erst nach den Fragen');
  await page.click('.pv-frage:nth-of-type(1) button:has-text("Aus mathematischen Pfaden")');
  pruefe(await page.locator('.pv-rueckmeldung.falsch').count() === 1, 'falsche Antwort: „Noch nicht“');
  await page.click('.pv-frage:nth-of-type(1) button:has-text("Aus einzelnen Bildpunkten")');
  await page.click('button:has-text("Die Kanten werden unscharf")');
  await page.click('button:has-text("Weil er Pfaden folgt")');
  pruefe(await page.locator('.pv-teil').nth(1).isVisible(), 'alle Fragen richtig: SVG-Übung erscheint');
  const luecke = id => page.locator('.ce-luecke[data-luecke="' + id + '"]');
  const punktOk = async n => ((await page.locator('.ce-punkt').nth(n).getAttribute('class')) || '').indexOf('ok') >= 0;
  pruefe(await page.locator('.ce-punkt').count() === 5, 'fünf Aufgaben, eine nach der anderen');
  pruefe((await luecke('farbe').getAttribute('class')).indexOf('aktiv') >= 0, 'Aufgabe 1: Lücke für die Farbe ist markiert');
  await luecke('farbe').fill('gelbgrün');
  await page.waitForTimeout(500);
  pruefe(/kennt der Browser nicht/.test(await page.locator('.ce-hinweis').textContent()), 'ungültige Farbe: Hinweis');
  await luecke('farbe').fill('pink');
  await page.waitForTimeout(500);
  pruefe(await punktOk(0), 'Farbe geändert: Haken');
  await luecke('radius').fill('20');
  await page.waitForTimeout(500);
  pruefe(await punktOk(1), 'Radius geändert: Haken');
  pruefe(await page.locator('button.ce-platzhalter').count() === 1, 'Platzhalter zeigt, wo das Dreieck hinkommt');
  await page.click('.ce-aufgabe button:has-text("Baustein einfügen")');
  await page.waitForTimeout(400);
  pruefe(await punktOk(2), 'Dreieck eingefügt: Haken');
  await page.click('.ce-aufgabe button:has-text("Baustein einfügen")');
  await page.waitForTimeout(400);
  pruefe(await punktOk(3), 'Stern eingefügt: Haken');
  pruefe(await page.locator('.ce-geschafft').count() === 1, '„Alle Pflicht-Aufgaben geschafft“, Bonus angeboten');
  await page.click('.ce-aufgabe button:has-text("Baustein einfügen")');
  await luecke('stern2-farbe').fill('blue');
  await page.waitForTimeout(500);
  pruefe(await punktOk(4), 'Bonus: zweiter Stern in Blau');
  pruefe(await page.locator('.ce-vorschau img').count() === 4, 'Vorschau zeigt Kreis, Dreieck, zwei Sterne');
  await page.screenshot({ path: path.join(SHOTS, BROWSER + '-11-pixel-vektor.png'), fullPage: true });
  // Profi-Modus: freier Code, auch mit den Anführungszeichen der iPad-Tastatur
  await page.click('button:has-text("Profi-Modus")');
  const profiCode = await page.locator('.ce-profi').inputValue();
  pruefe(profiCode.indexOf('fill="pink"') > 0 && profiCode.indexOf('r="20"') > 0, 'Profi-Modus zeigt den fertigen Code');
  await page.locator('.ce-profi').fill(profiCode.replace('fill="pink"', 'fill=„orange“'));
  await page.waitForTimeout(500);
  pruefe(await punktOk(0), 'Profi-Modus: „orange“ mit iPad-Anführungszeichen erkannt');
  // Ansicht bei offener Tastatur (am Rechner erzwungen)
  await page.goto(BASE + '/app/station.html?id=pixel-vektor&tastatur');
  await page.waitForSelector('.ce.kompakt');
  await page.screenshot({ path: path.join(SHOTS, BROWSER + '-11b-pixel-vektor-tastatur.png') });
  pruefe(await page.locator('.ce.kompakt .ce-zeichen button').count() > 5, 'Tastatur offen: Zeichenleiste sichtbar');
  await page.goto(BASE + '/app/station.html?id=pixel-vektor&test');
  await page.waitForSelector('.ce-vorschau img');
  await abschliessen(page, 5);
  pruefe((await page.locator('.zaehler').textContent()).indexOf('6 von 12') >= 0, 'Zähler steht auf 6 von 12');

  console.log('Station Coding: HTML, CSS und JavaScript');
  await page.goto(BASE + '/app/station.html?id=coding-web&test');
  await page.waitForSelector('h1:has-text("Coding")');
  await page.waitForSelector('.ce-vorschau iframe');
  pruefe(await page.locator('.ce-punkt').count() === 8, 'acht Aufgaben (eine Bonus)');
  await luecke('ueberschrift').fill('Ada und Bo');
  await luecke('absatz').fill('Wir lernen HTML.');
  await page.waitForTimeout(500);
  pruefe(await punktOk(0) && await punktOk(1), 'HTML: Überschrift und Absatz geändert');
  const vorschauText = await page.frameLocator('.ce-vorschau iframe').locator('h1').textContent();
  pruefe(vorschauText === 'Ada und Bo', 'Vorschau zeigt die neue Überschrift');
  await page.click('.ce-aufgabe button:has-text("Baustein einfügen")');
  await page.waitForTimeout(400);
  pruefe(await punktOk(2), 'CSS: <style>-Block eingefügt');
  await luecke('textfarbe').fill('orangee');
  await page.waitForTimeout(500);
  pruefe(/kennt der Browser nicht/.test(await page.locator('.ce-hinweis').textContent()), 'CSS: falsche Farbe gibt Hinweis');
  await luecke('textfarbe').fill('orange');
  await page.waitForTimeout(500);
  pruefe(await punktOk(3), 'CSS: Farbe geändert');
  await page.click('.ce-aufgabe button:has-text("Baustein einfügen")');
  await page.waitForTimeout(400);
  pruefe(await punktOk(4), 'JavaScript: Button eingefügt');
  await luecke('nachricht').fill("Wir sind's");
  await page.waitForTimeout(500);
  pruefe(/zwischen zwei/.test(await page.locator('.ce-hinweis').textContent()), "JavaScript: ' in der Nachricht gibt Hinweis");
  await luecke('nachricht').fill('Wir sind da!');
  await page.waitForTimeout(500);
  pruefe(await punktOk(5), 'JavaScript: eigene Nachricht');
  let dialogText = '';
  page.once('dialog', d => { dialogText = d.message(); d.dismiss().catch(() => {}); });
  await page.frameLocator('.ce-vorschau iframe').locator('button').click();
  await page.waitForTimeout(800);
  pruefe(await punktOk(6), 'Klick auf den Button in der Vorschau erkannt');
  pruefe(dialogText === 'Wir sind da!', 'alert zeigt die eigene Nachricht: ' + dialogText);
  await page.screenshot({ path: path.join(SHOTS, BROWSER + '-12-coding-web.png'), fullPage: true });
  await page.fill('#eingabe-regler', 'JavaScript');
  await page.click('button:has-text("Station beendet")');
  pruefe(await page.locator('.aufloesung-text').count() === 1, 'Auflösung zur Regler-Frage');
  await page.click('button.wahl:has-text("Keine KI")');
  await page.locator('button.stern').nth(4).click();
  await page.click('button:has-text("Fertig")');
  await page.waitForSelector('text=Super, geschafft!');
  pruefe((await page.locator('.zaehler').textContent()).indexOf('7 von 12') >= 0, 'Zähler steht auf 7 von 12');

  console.log('Station Selbstporträts mit KI (Server im Testmodus, ohne Claude)');
  await page.goto(BASE + '/app/station.html?id=ki-selbstportraet&test');
  await page.waitForSelector('.ki-prompt');
  pruefe((await page.locator('.ki-prompt').textContent()).indexOf('im Stil von Frida Kahlo. Es zeigt einen 14-jährigen Jungen') > 0, 'Prompt-Satz aus den Start-Bausteinen');
  await page.click('.ki-baustein:has-text("Person") button:has-text("Mädchen")');
  await page.click('.ki-baustein:has-text("Alter") button:has-text("13")');
  pruefe((await page.locator('.ki-prompt').textContent()).indexOf('ein 13-jähriges Mädchen') > 0, 'Prompt passt sich an (ein 13-jähriges Mädchen)');
  await page.click('button:has-text("Bild erzeugen")');
  await page.waitForSelector('.ki-karte img');
  pruefe(await page.locator('.ki-karte').count() === 1, 'erstes Bild in der Galerie');
  pruefe(await page.locator('button:has-text("Station beendet")').isDisabled(), 'gesperrt nach einem Bild');
  pruefe(/Noch 1 Bild/.test(await page.locator('text=Ihr habt').textContent()), 'Hinweis „Noch 1 Bild“');
  // Zweites Bild im selben Stil reicht (Patricia, 24.10.)
  await page.click('button:has-text("Bild erzeugen")');
  await page.waitForFunction(() => document.querySelectorAll('.ki-karte').length === 2);
  pruefe(/2 von höchstens 6/.test(await page.locator('text=Ihr habt').textContent()), 'Zähler „2 von höchstens 6 Bildern“');
  await page.screenshot({ path: path.join(SHOTS, BROWSER + '-13-ki-selbstportraet.png'), fullPage: true });
  await page.fill('#eingabe-unterschied', 'stencil.me verändert nur mein Foto');
  await page.fill('#eingabe-ethik', 'Schwierig');
  await page.click('button:has-text("Station beendet")');
  pruefe(await page.locator('.aufloesung-text').count() === 1, 'Auflösung zur Unterschied-Frage');
  await page.click('button.wahl:has-text("Generative KI")');
  pruefe((await page.locator('.aufloesung .etikett').textContent()) === 'Generative KI', 'Auflösung: Generative KI');
  await page.locator('button.stern').nth(4).click();
  await page.click('button:has-text("Fertig")');
  await page.waitForSelector('text=Super, geschafft!');
  pruefe((await page.locator('.zaehler').textContent()).indexOf('8 von 12') >= 0, 'Zähler steht auf 8 von 12');

  for(const druck of [['druck-linol', 'Linolplatten'], ['druck-stempel', 'Lasercut-Stempel']]){
    console.log('Station Mit der Hand drucken: ' + druck[1]);
    await page.goto(BASE + '/app/station.html?id=' + druck[0] + '&test');
    await page.waitForSelector('h1:has-text("Mit der Hand drucken")');
    pruefe(await page.locator('.beispiele img').evaluate(img => img.complete && img.naturalWidth > 0), 'Beispiel-Postkarte von der Karte geladen');
    const karten = page.locator('input[type=file]');
    pruefe(await karten.count() === 2, 'ein Postkarten-Foto pro Person');
    await karten.nth(0).setInputFiles(FOTO);
    await karten.nth(1).setInputFiles(FOTO);
    await page.waitForFunction(() => document.querySelectorAll('.foto-vorschau:not([hidden])').length === 2);
    await abschliessen(page, 5);
    pruefe(true, 'Station abgeschlossen');
  }
  pruefe((await page.locator('.zaehler').textContent()).indexOf('10 von 12') >= 0, 'Zähler steht auf 10 von 12');

  // Quiz in der Station durchspielen: immer die obere Antwort, dann weiter
  async function quizSpielen(){
    const quiz = page.frameLocator('.quiz-rahmen');
    await quiz.locator('.startbtn:has-text("Los geht")').click();
    for(let i = 0; i < 20; i++){
      if(await page.locator('.quiz-status.fertig').count()) break;
      await quiz.locator('#choiceA').click();
      await quiz.locator('#nextBtn:not([disabled])').click();
      await page.waitForTimeout(150);
    }
  }

  console.log('Station Code-Erklärung interaktiv');
  await page.goto(BASE + '/app/station.html?id=code-quiz&test');
  await page.waitForSelector('.quiz-rahmen');
  await page.frameLocator('.quiz-rahmen').locator('.startbtn:has-text("Los geht")').waitFor();
  // Direkt im Rahmen nachsehen (frameLocator wertet das in Chromium nicht verlässlich aus)
  const quizRahmen = page.frames().filter(fr => /code-quiz\.html/.test(fr.url()))[0];
  await quizRahmen.waitForFunction(() => typeof buildDots === 'function');
  const zurueck = await quizRahmen.evaluate(() => Array.prototype.map.call(document.querySelectorAll('.backlink'), a => a.hidden));
  pruefe(zurueck.length > 0 && zurueck.every(Boolean), 'eingebettetes Quiz ohne „Zurück zum Workshop“');
  pruefe(await page.locator('button:has-text("Station beendet")').isDisabled(), 'gesperrt, bevor das Quiz fertig ist');
  await quizSpielen();
  const codeErgebnis = await page.locator('.quiz-status').textContent();
  pruefe(/von 9 richtig/.test(codeErgebnis), 'Quiz meldet Ergebnis: ' + codeErgebnis);
  await page.screenshot({ path: path.join(SHOTS, BROWSER + '-14-code-quiz.png'), fullPage: true });
  await abschliessen(page, 4);

  console.log('Station Kunst-Quiz');
  await page.goto(BASE + '/app/station.html?id=kunst-quiz&test');
  await page.waitForSelector('.quiz-rahmen');
  await quizSpielen();
  pruefe(/richtig/.test(await page.locator('.quiz-status').textContent()), 'Kunst-Quiz abgehakt');
  pruefe(await page.locator('button:has-text("Station beendet")').isDisabled(), 'gesperrt ohne Fotos vom Lieblings-Streetart');
  const lieblinge = page.locator('input[type=file]');
  await lieblinge.nth(0).setInputFiles(FOTO);
  await lieblinge.nth(1).setInputFiles(FOTO);
  await page.waitForFunction(() => document.querySelectorAll('.foto-vorschau:not([hidden])').length === 2);
  await abschliessen(page, 5);
  pruefe((await page.locator('.zaehler').textContent()).indexOf('12 von 12') >= 0, 'Zähler steht auf 12 von 12');
  pruefe(await page.locator('text=Bonus: Sticker').count() === 1, 'danach wird der Bonus-Sticker vorgeschlagen');

  console.log('Bonus-Station Sticker');
  await page.goto(BASE + '/app/station.html?id=sticker&test');
  await page.waitForFunction(() => document.querySelectorAll('.stempel-person .schritt-bild svg').length === 2, null, { timeout: 120000 });
  pruefe(await page.locator('.legende').textContent().then(t => /Plotter/.test(t)), 'Sticker-Legende: Schwarz und Rot');
  pruefe(/nicht gespiegelt/.test(await page.locator('.schritt-notiz').nth(4).textContent()), 'Sticker ist nicht gespiegelt');
  await page.screenshot({ path: path.join(SHOTS, BROWSER + '-15-sticker.png'), fullPage: true });
  await page.locator('button:has-text("Sticker an den Laptop schicken")').first().click();
  await page.waitForSelector('button:has-text("Sticker ist abgeschickt")');
  await page.locator('button:has-text("Sticker an den Laptop schicken")').first().click();
  await page.waitForFunction(() => Array.prototype.filter.call(document.querySelectorAll('button'), b => b.textContent.indexOf('Sticker ist abgeschickt') >= 0).length === 2);
  await abschliessen(page, 5);
  pruefe((await page.locator('.zaehler').textContent()).indexOf('12 von 12') >= 0, 'Bonus zählt nicht mit: weiter 12 von 12');
  pruefe(await page.locator('text=alle Stationen geschafft').count() === 1, '„Du hast alle Stationen geschafft!“');
  await page.waitForFunction(() => document.getElementById('sync').textContent.indexOf('Gesichert auf dem Laptop') >= 0, null, { timeout: 20000 });
  const sticker = (await (await page.request.get(BASE + '/api/sticker')).json()).stempel.map(x => x.name).sort().join(',');
  pruefe(sticker === 'Ada,Bo', 'zwei Sticker im Sticker-Ordner des Laptops: ' + sticker);

  console.log('Laptop');
  await page.waitForFunction(() => document.getElementById('sync').textContent.indexOf('Gesichert auf dem Laptop') >= 0, null, { timeout: 20000 });
  pruefe(true, 'Outbox leer: „Gesichert auf dem Laptop“');
  const gruppen = await (await page.request.get(BASE + '/api/gruppen')).json();
  const g = gruppen.gruppen.filter(x => x.personen.join() === 'Ada,Bo').pop();
  pruefe(!!g, 'Gruppe Ada & Bo auf dem Laptop');
  if(g){
    pruefe(g.fertig.join() === 'foto,stencilme,lasercutter,koerpererkennung,hintergrund,pixel-vektor,coding-web,ki-selbstportraet,druck-linol,druck-stempel,code-quiz,kunst-quiz,sticker', 'fertige Stationen: ' + g.fertig.join(', '));
    const arten = g.dateien.map(d => d.split('/').pop().split('_')[0]).sort().join(',');
    pruefe(arten === 'druck-linol,druck-linol,druck-stempel,druck-stempel,foto,foto,foto,foto,hintergrund,hintergrund,ki-selbstportraet,ki-selbstportraet,koerpererkennung,kunst-quiz,kunst-quiz,lasercutter', 'auf dem Laptop: alle Fotos inkl. Ausgangsfotos (auch verworfene Versuche), Laser-Foto, KI-Ansicht, Hintergrund-, KI-, Postkarten- und Streetart-Bilder (' + arten + ')');
    pruefe(g.antworten.lasercutter && g.antworten.lasercutter.antworten.frage === 'Wie heiß wird der Laser?', 'Antwort angekommen');
    const svgCode = g.antworten['pixel-vektor'] && g.antworten['pixel-vektor'].antworten['svg-code'];
    pruefe(!!svgCode && svgCode.indexOf('polygon') > 0, 'SVG-Code auf dem Laptop gespeichert');
    const htmlCode = g.antworten['coding-web'] && g.antworten['coding-web'].antworten['html-code'];
    pruefe(!!htmlCode && htmlCode.indexOf("alert('Wir sind da!')") > 0, 'HTML-Code auf dem Laptop gespeichert');
  }
  const laptop = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await laptop.goto(BASE + '/laptop');
  await laptop.waitForSelector('td:has-text("Ada & Bo")');
  await laptop.screenshot({ path: path.join(SHOTS, BROWSER + '-4-laptop.png'), fullPage: true });

  console.log('A4-Platte');
  await laptop.click('#buildPlate');
  await laptop.waitForSelector('#platePreview svg g');
  const platte = await laptop.evaluate(() => {
    const svg = document.querySelector('#platePreview svg');
    const ids = Array.prototype.map.call(svg.querySelectorAll('[id]'), e => e.id);
    return { gruppen: svg.children.length, ids: ids.length, eindeutig: new Set(ids).size === ids.length, breite: svg.getAttribute('width') };
  });
  pruefe(platte.gruppen >= 2, 'Stempel auf der Platte: ' + platte.gruppen);
  pruefe(platte.eindeutig && platte.ids === platte.gruppen, 'jede Schnittkontur hat eine eigene ID');
  pruefe(platte.breite === '210mm', 'Platte ist A4 (210 mm breit)');
  await laptop.screenshot({ path: path.join(SHOTS, BROWSER + '-8-platte.png'), fullPage: true });
  const [download] = await Promise.all([laptop.waitForEvent('download'), laptop.click('#downloadPlate')]);
  pruefe(/^platte-.*\.svg$/.test(download.suggestedFilename()), 'Download: ' + download.suggestedFilename());
  await laptop.waitForSelector('.stamp.placed');
  pruefe(true, 'Stempel danach grau markiert');

  console.log('Nachricht vom Laptop an die Gruppe');
  await laptop.waitForSelector('.history-row');
  await laptop.click('.history-row button:has-text("Wird gelasert")');
  await laptop.waitForSelector('.history-row .sent');
  await page.goto(BASE + '/app/station.html?id=lasercutter');
  await page.waitForSelector('.nachricht', { timeout: 20000 });
  const nachricht = await page.locator('.nachricht p').first().textContent();
  pruefe(/Der Stempel von Ada und Bo wird jetzt gelasert/.test(nachricht), 'iPad zeigt: ' + nachricht);
  await page.click('.nachricht button:has-text("OK")');
  await page.waitForFunction(() => !document.querySelector('.nachricht'));
  await page.reload();
  await page.waitForSelector('h1');
  await page.waitForTimeout(1500);
  pruefe(await page.locator('.nachricht').count() === 0, 'nach OK bleibt die Nachricht weg');

  pruefe(konsolenFehler.length === 0, 'keine JavaScript-Fehler' + (konsolenFehler.length ? ': ' + konsolenFehler.join(' | ') : ''));
  await browser.close();
  console.log(fehler ? fehler + ' Fehler' : 'Alles in Ordnung');
  process.exit(fehler ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
