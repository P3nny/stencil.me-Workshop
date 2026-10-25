// Ohne Foto-Einwilligung und ohne generative KI (Rückmeldezettel der Eltern):
// Namen auf der Laptop-Seite, Porträt-Auswahl in der Foto-Station, KI-Stationen nur mit Beispielen.
//
//   STENCILME_DATEN=archiv/testdaten STENCILME_KI_TEST=1 python3 server/server.py --port 8765
//   NODE_PATH=~/.cache/stencilme-playwright/node_modules node tests/einwilligung-test.js [webkit|chromium]
const pw = require('playwright');
const os = require('os');
const path = require('path');

const BROWSER = process.argv[2] || 'webkit';
const BASE = process.env.BASE || 'http://localhost:8765';
const FOTO = path.join(__dirname, '..', 'docs', 'test-foto.jpg');
const SHOTS = path.join(__dirname, '..', 'archiv', 'screenshots');
let fehler = 0;
function pruefe(ok, text){
  console.log((ok ? '  ✓ ' : '  ✗ ') + text);
  if(!ok) fehler++;
}

// Anmeldung wie auf der Startseite, aber ohne Klicks: Gruppe speichern und an den Laptop melden
function anmelden(page, id, personen, fortschritt){
  return page.evaluate(a => Speicher.schreiben('gruppe', { id: a.id, personen: a.personen, angemeldet: new Date().toISOString() })
    .then(() => Speicher.schreiben('fortschritt', a.fortschritt || { stationen: {} }))
    .then(() => Outbox.ereignis(a.id, 'anmeldung', '', { personen: a.personen })), { id: id, personen: personen, fortschritt: fortschritt });
}

(async () => {
  const browser = await pw[BROWSER].launch();
  const api = await pw.request.newContext({ baseURL: BASE });
  await api.post('/api/alle-loeschen');

  console.log('Laptop: Namen eintragen');
  let s = await (await api.post('/api/einstellungen', { data: { ohneFoto: ['Mia', ' '], ohneKi: ['Lea'] } })).json();
  pruefe(s.ohneFoto.join() === 'Mia' && s.ohneKi.join() === 'Lea', 'Listen gespeichert, leere Namen weg');

  // Von einem anderen Gerät im WLAN (nicht localhost): keine Namenslisten
  const ip = Object.values(os.networkInterfaces()).reduce((a, b) => a.concat(b), []).filter(i => i.family === 'IPv4' && !i.internal)[0];
  if(ip){
    const fremd = await (await pw.request.newContext()).get(BASE.replace('localhost', ip.address) + '/api/einstellungen');
    const daten = await fremd.json();
    pruefe(!('ohneFoto' in daten) && !('ohneKi' in daten) && 'schueler' in daten, 'iPads sehen die Namenslisten nicht');
  }else{
    console.log('  – keine Netzwerk-Adresse: Zugriff von außen nicht getestet');
  }

  console.log('Foto-Station: Mia ohne Foto, Ben mit Foto');
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  const konsolenFehler = [];
  page.on('pageerror', e => konsolenFehler.push(e.message));
  await page.goto(BASE + '/index.html');
  await anmelden(page, 'a1a1a1a1a1a1', ['Mia B.', 'Ben']);
  await page.goto(BASE + '/app/station.html?id=foto');
  await page.waitForSelector('.foto-feld');
  const felder = page.locator('.foto-feld');
  pruefe(await felder.nth(0).locator('.ersatz-wahl').count() === 9, 'Mia: Auswahl mit 9 Porträts statt Kamera');
  pruefe(await felder.nth(0).locator('input[type=file]').count() === 0, 'Mia: keine Kamera');
  pruefe(await felder.nth(1).locator('input[type=file]').count() === 1, 'Ben: Kamera wie immer');
  await felder.nth(0).locator('.ersatz-wahl:has-text("Taylor Swift")').click();
  await page.waitForSelector('text=✓ Porträt gespeichert');
  pruefe((await felder.nth(0).locator('.bild-quelle').textContent()).indexOf('Glenn Francis, CC BY-SA 4.0') >= 0, 'Quelle steht unter dem Bild');
  await felder.nth(1).locator('input[type=file]').setInputFiles(FOTO);
  await page.waitForSelector('.foto-feld:nth-child(2) .ki-pruefung.ok', { timeout: 60000 });
  const beenden = page.locator('button:has-text("Station beendet")');
  await page.waitForFunction(() => {
    const b = Array.prototype.filter.call(document.querySelectorAll('button'), x => x.textContent === 'Station beendet')[0];
    return b && !b.disabled;
  }, null, { timeout: 5000 }).catch(() => {});
  pruefe(!(await beenden.isDisabled()), 'Station lässt sich beenden');
  await page.screenshot({ path: path.join(SHOTS, BROWSER + '-einwilligung-foto.png'), fullPage: true });
  await beenden.click();
  await page.locator('.wahl:has-text("Bildbearbeitungs-KI")').click();
  await page.locator('.stern').nth(3).click();
  await page.click('button:has-text("Fertig")');
  await page.waitForSelector('text=Super, geschafft!');
  // Porträt fürs Puzzle und spätere Stationen
  const key = await page.evaluate(() => Speicher.lesen('foto-key:0'));
  pruefe(/^foto:0:/.test(key || ''), 'Porträt liegt als Foto von Mia auf dem iPad');

  // Outbox sendet nach; kurz warten, bis alles beim Laptop ist
  await page.waitForFunction(() => Speicher.outboxAlle().then(o => o.length === 0), null, { timeout: 30000, polling: 500 }).catch(() => {});
  const regeln = await (await api.get('/api/regeln?gruppe=a1a1a1a1a1a1')).json();
  pruefe(regeln.ohneFoto.join() === 'true,false' && regeln.ohneKi === false && !('ohneKiPersonen' in regeln), '/api/regeln: „Mia B.“ ohne Foto (erstes Wort), keine Namen');
  const meine = await (await api.get('/api/meine-daten?gruppe=a1a1a1a1a1a1')).json();
  pruefe(!!((meine.antworten.foto || {}).antworten || {}).quelle, '„Meine Daten“ nennen die Quelle des Porträts');

  console.log('KI-Station: Lea hat ein Opt-out');
  const page2 = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  page2.on('pageerror', e => konsolenFehler.push(e.message));
  await page2.goto(BASE + '/index.html');
  await anmelden(page2, 'b2b2b2b2b2b2', ['Lea', 'Tom'], { stationen: { foto: { status: 'fertig' } } });
  await page2.waitForFunction(() => Speicher.outboxAlle().then(o => o.length === 0), null, { timeout: 30000, polling: 500 }).catch(() => {});
  await page2.goto(BASE + '/app/station.html?id=ki-selbstportraet');
  await page2.waitForSelector('text=Diese Station macht ihr heute mit Beispielen.', { timeout: 10000 });
  pruefe(true, 'Station zeigt nur Beispiele');
  pruefe(await page2.locator('button:has-text("Bild erzeugen")').isDisabled(), '„Bild erzeugen“ ist gesperrt');
  const texte = page2.locator('.eingabe textarea, .eingabe input');
  for(let i = 0; i < await texte.count(); i++) await texte.nth(i).fill('Testantwort');
  await page2.waitForTimeout(600);
  pruefe(!(await page2.locator('button:has-text("Station beendet")').isDisabled()), 'Station zählt trotzdem (nach den Textfragen)');
  await page2.screenshot({ path: path.join(SHOTS, BROWSER + '-einwilligung-ki.png'), fullPage: true });
  const abgelehnt = await api.post('/api/ki-bild', { data: { gruppe: 'b2b2b2b2b2b2', auswahl: { stil: 'comic' } } });
  pruefe(abgelehnt.status() === 403, 'Laptop lehnt KI-Bild ab (' + abgelehnt.status() + ')');
  const app = await api.post('/api/ki-app', { data: { gruppe: 'b2b2b2b2b2b2', auswahl: {} } });
  pruefe(app.status() === 403, 'Laptop lehnt KI-App ab (' + app.status() + ')');
  const bereitAndere = await (await api.get('/api/ki-bereit?gruppe=a1a1a1a1a1a1')).json();
  pruefe(bereitAndere.ohneKi === false, 'andere Gruppe darf die KI nutzen');

  console.log('Laptop-Seite: Schalter pro Person');
  const laptop = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  laptop.on('pageerror', e => konsolenFehler.push(e.message));
  await laptop.goto(BASE + '/laptop');
  await laptop.waitForSelector('button.schalter:has-text("📷 Mia B.: ohne Foto")');
  pruefe(await laptop.locator('button.schalter.aus').count() === 2, 'gelb: Mia ohne Foto, Lea ohne KI');
  pruefe(await laptop.inputValue('#ohneFoto') === 'Mia', 'Feld zeigt die Liste');
  await laptop.click('button.schalter:has-text("📷 Ben: Foto ok")');
  await laptop.waitForSelector('button.schalter:has-text("📷 Ben: ohne Foto")');
  pruefe(await laptop.inputValue('#ohneFoto') === 'Ben, Mia', 'Umschalten trägt Ben ein');
  await laptop.click('button.schalter:has-text("📷 Mia B.: ohne Foto")');
  await laptop.waitForSelector('button.schalter:has-text("📷 Mia B.: Foto ok")');
  pruefe(await laptop.inputValue('#ohneFoto') === 'Ben', 'Umschalten nimmt Mia wieder raus');
  await laptop.screenshot({ path: path.join(SHOTS, BROWSER + '-einwilligung-laptop.png'), fullPage: true });

  console.log('Alle Daten löschen leert die Listen');
  await api.post('/api/alle-loeschen');
  s = await (await api.get('/api/einstellungen')).json();
  pruefe(!s.ohneFoto.length && !s.ohneKi.length, 'Namenslisten leer');

  pruefe(!konsolenFehler.length, 'keine JavaScript-Fehler' + (konsolenFehler.length ? ': ' + konsolenFehler.join(' | ') : ''));
  await browser.close();
  console.log(fehler ? fehler + ' Fehler' : 'Alles in Ordnung');
  process.exit(fehler ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
