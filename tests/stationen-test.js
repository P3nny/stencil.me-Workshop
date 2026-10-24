// Klickt die Workshop-App automatisch durch (Anmeldung → Foto → stencil.me → Lasercutter).
//
// Voraussetzung: Server läuft (python3 server/server.py --port 8765) und Playwright
// ist außerhalb des Repos installiert (~/.cache/stencilme-playwright).
//
//   NODE_PATH=~/.cache/stencilme-playwright/node_modules node tests/stationen-test.js [webkit|chromium] [Screenshot-Ordner]
//
// Legt auf dem Server eine Test-Gruppe an. Danach auf der Laptop-Seite löschen.
const path = require('path');
const pw = require('playwright');

const BROWSER = process.argv[2] || 'webkit';
const SHOTS = process.argv[3] || '.';
const BASE = process.env.BASE || 'http://localhost:8765';
const FOTO = path.join(__dirname, '..', 'docs', 'test-foto.jpg');

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
  page.on('pageerror', e => konsolenFehler.push(e.message));
  page.on('console', m => { if(m.type() === 'error') konsolenFehler.push(m.text()); });

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
  await inputs.nth(0).setInputFiles(FOTO);
  await page.locator('.foto-vorschau').nth(0).waitFor({ state: 'visible' });
  pruefe(await beenden.isDisabled(), 'nach einem Foto noch gesperrt');
  await inputs.nth(1).setInputFiles(FOTO);
  await page.locator('.foto-vorschau').nth(1).waitFor({ state: 'visible' });
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
  pruefe(['Bild bearbeiten', 'Greenscreen'].indexOf(naechste) >= 0, 'nächste Station vorgeschlagen: ' + naechste);
  pruefe((await page.locator('.zaehler').textContent()).indexOf('1 von 4') >= 0, 'Zähler steht auf 1 von 4');
  pruefe(await page.locator('.puzzle').first().locator('.puzzle-teil.da').count() === 1, 'ein Puzzleteil sichtbar');
  await page.screenshot({ path: path.join(SHOTS, BROWSER + '-3-weiter.png'), fullPage: true });

  console.log('Reihenfolge');
  await page.goto(BASE + '/app/station.html?id=lasercutter&test');
  await page.waitForSelector('text=noch nicht');
  pruefe(await page.locator('text=Bild bearbeiten').count() > 0, 'Lasercutter verlangt zuerst „Bild bearbeiten“');

  console.log('Station stencil.me (Platzhalter)');
  await page.goto(BASE + '/app/station.html?id=stencilme&test');
  await page.waitForSelector('h1:has-text("Bild bearbeiten")');
  await page.check('#erledigt');
  pruefe(await page.locator('button:has-text("Station beendet")').isDisabled(), 'gesperrt ohne Antwort zu den Farben');
  await page.fill('#eingabe-farben', 'Rot schneidet, Blau graviert');
  await abschliessen(page, 5);
  pruefe(true, 'stencil.me abgeschlossen');

  console.log('Station Lasercutter');
  await page.goto(BASE + '/app/station.html?id=lasercutter&test');
  await page.waitForSelector('h1:has-text("Lasercutter")');
  await page.fill('#eingabe-frage', 'Wie heiß wird der Laser?');
  await page.fill('#eingabe-antwort', 'Sehr heiß');
  await page.locator('input[type=file]').setInputFiles(FOTO);
  await page.locator('.foto-vorschau').waitFor({ state: 'visible' });
  await abschliessen(page, 3);
  pruefe((await page.locator('.zaehler').textContent()).indexOf('3 von 4') >= 0, 'Zähler steht auf 3 von 4');

  console.log('Neu laden: Fortschritt bleibt');
  await page.reload();
  await page.waitForSelector('text=schon erledigt');
  pruefe((await page.locator('.zaehler').textContent()).indexOf('3 von 4') >= 0, 'Fortschritt nach Neuladen erhalten');

  console.log('Startseite nach drei Stationen');
  await page.goto(BASE + '/');
  await page.waitForSelector('text=3 von 4 Stationen geschafft');
  pruefe(true, 'Startseite zeigt den Stand');
  await page.goto(BASE + '/app/station.html?id=lasercutter');

  console.log('Laptop');
  await page.waitForFunction(() => document.getElementById('sync').textContent.indexOf('Gesichert auf dem Laptop') >= 0, null, { timeout: 20000 });
  pruefe(true, 'Outbox leer: „Gesichert auf dem Laptop“');
  const gruppen = await (await page.request.get(BASE + '/api/gruppen')).json();
  const g = gruppen.gruppen.filter(x => x.personen.join() === 'Ada,Bo').pop();
  pruefe(!!g, 'Gruppe Ada & Bo auf dem Laptop');
  if(g){
    pruefe(g.fertig.join() === 'foto,stencilme,lasercutter', 'fertige Stationen: ' + g.fertig.join(', '));
    pruefe(g.dateien.length === 1 && g.dateien[0].indexOf('lasercutter_') >= 0, 'nur das Laser-Foto hochgeladen, Rohfotos nicht');
    pruefe(g.antworten.lasercutter && g.antworten.lasercutter.antworten.frage === 'Wie heiß wird der Laser?', 'Antwort angekommen');
  }
  const laptop = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await laptop.goto(BASE + '/laptop');
  await laptop.waitForSelector('td:has-text("Ada & Bo")');
  await laptop.screenshot({ path: path.join(SHOTS, BROWSER + '-4-laptop.png'), fullPage: true });

  pruefe(konsolenFehler.length === 0, 'keine JavaScript-Fehler' + (konsolenFehler.length ? ': ' + konsolenFehler.join(' | ') : ''));
  await browser.close();
  console.log(fehler ? fehler + ' Fehler' : 'Alles in Ordnung');
  process.exit(fehler ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
