// Frei vibe coden: Eine erwachsene Person schaltet die Gruppe mit der PIN 15 Minuten frei.
// Die Freigabe endet, wenn die Gruppe die Station beendet.
//
//   STENCILME_DATEN=archiv/testdaten STENCILME_KI_TEST=1 python3 server/server.py --port 8765
//   NODE_PATH=~/.cache/stencilme-playwright/node_modules node tests/vibe-pin-test.js [webkit|chromium]
const pw = require('playwright');
const os = require('os');
const path = require('path');

const BROWSER = process.argv[2] || 'webkit';
const BASE = process.env.BASE || 'http://localhost:8765';
const SHOTS = path.join(__dirname, '..', 'archiv', 'screenshots');
const PIN = '4711';
let fehler = 0;
function pruefe(ok, text){
  console.log((ok ? '  ✓ ' : '  ✗ ') + text);
  if(!ok) fehler++;
}

function anmelden(page, id, personen){
  return page.evaluate(a => Speicher.schreiben('gruppe', { id: a.id, personen: a.personen, angemeldet: new Date().toISOString() })
    .then(() => Speicher.schreiben('fortschritt', { stationen: { foto: { status: 'fertig' }, 'coding-web': { status: 'fertig' } } }))
    .then(() => Outbox.ereignis(a.id, 'anmeldung', '', { personen: a.personen })), { id: id, personen: personen });
}

function outboxLeer(page){
  return page.waitForFunction(() => Speicher.outboxAlle().then(o => o.length === 0), null, { timeout: 30000, polling: 500 }).catch(() => {});
}

(async () => {
  const browser = await pw[BROWSER].launch();
  const api = await pw.request.newContext({ baseURL: BASE });
  await api.post('/api/alle-loeschen');
  await api.post('/api/einstellungen', { data: { vibePin: '', ohneKi: ['Lea'] } });
  const konsolenFehler = [];

  console.log('Ohne PIN auf dem Laptop: nur Baukasten');
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  page.on('pageerror', e => konsolenFehler.push(e.message));
  await page.goto(BASE + '/index.html');
  await anmelden(page, 'c1c1c1c1c1c1', ['Ada', 'Bo']);
  await outboxLeer(page);
  await page.goto(BASE + '/app/station.html?id=vibe-coding');
  await page.waitForSelector('text=App bauen lassen');
  await page.waitForTimeout(800);
  pruefe(await page.locator('text=frei vibe coden freischalten').isHidden(), 'kein Knopf zum Freischalten');
  let r = await api.post('/api/ki-freigabe', { data: { gruppe: 'c1c1c1c1c1c1', pin: '' } });
  pruefe(r.status() === 409, 'Freischalten ohne PIN auf dem Laptop abgelehnt (' + r.status() + ')');

  console.log('PIN einrichten');
  r = await api.post('/api/einstellungen', { data: { vibePin: '12' } });
  pruefe(r.status() === 400, 'zu kurze PIN abgelehnt');
  await api.post('/api/einstellungen', { data: { vibePin: PIN } });
  const ip = Object.values(os.networkInterfaces()).reduce((a, b) => a.concat(b), []).filter(i => i.family === 'IPv4' && !i.internal)[0];
  if(ip){
    const daten = await (await (await pw.request.newContext()).get(BASE.replace('localhost', ip.address) + '/api/einstellungen')).json();
    pruefe(!('vibePin' in daten), 'iPads sehen die PIN nicht');
  }else{
    console.log('  – keine Netzwerk-Adresse: Zugriff von außen nicht getestet');
  }

  console.log('Freier Auftrag ohne Freigabe');
  r = await api.post('/api/ki-app', { data: { gruppe: 'c1c1c1c1c1c1', auswahl: {}, frei: 'Eine App mit Katzenohren' } });
  pruefe(r.status() === 401, 'Laptop lehnt ab (' + r.status() + ')');

  console.log('Freischalten auf dem iPad');
  await page.reload();
  await page.waitForSelector('text=frei vibe coden freischalten');
  await page.click('text=frei vibe coden freischalten');
  await page.fill('.vibe-pin', '0000');
  await page.click(".vibe-pin-box button");
  await page.waitForSelector('text=Falsche PIN.');
  pruefe(true, 'falsche PIN: „Falsche PIN.“');
  await page.fill('.vibe-pin', PIN);
  await page.click(".vibe-pin-box button");
  await page.waitForSelector('text=Freigeschaltet: noch 15 Min.');
  pruefe(true, 'richtige PIN: Textfeld mit „noch 15 Min.“');
  pruefe(await page.locator('button:has-text("Letzte App ändern")').isDisabled(), '„Letzte App ändern“ erst nach der ersten App');
  await page.fill('.vibe-frei-text', 'Eine App, die Katzenohren auf mein Foto setzt.');
  await page.click('button:has-text("Neue App bauen")');
  await page.waitForSelector('text=Testet eure App!', { timeout: 20000 });
  pruefe(await page.locator('.vibe-karte').count() === 1, 'freie App ist da');
  await page.fill('.vibe-frei-text', 'Mach den Hintergrund blau.');
  await page.click('button:has-text("Letzte App ändern")');
  await page.waitForFunction(() => document.querySelectorAll('.vibe-karte').length === 2, null, { timeout: 20000 });
  pruefe((await page.locator('.vibe-karte figcaption').first().textContent()).indexOf('Änderung an App 1') >= 0, '„Letzte App ändern“ baut App 2');
  const r2 = await api.post('/api/ki-app', { data: { gruppe: 'c1c1c1c1c1c1', auswahl: {}, frei: 'Schick an test@example.org' } });
  pruefe(r2.status() === 400, 'Mailadresse im Auftrag abgelehnt (' + r2.status() + ')');
  await page.screenshot({ path: path.join(SHOTS, BROWSER + '-vibe-pin.png'), fullPage: true });
  const protokoll = await (await api.get('/api/ki-status')).json();
  pruefe(protokoll.appsHeute === 2, 'Protokoll: 2 Apps (' + protokoll.appsHeute + ')');

  console.log('Station beenden: Freigabe endet sofort');
  const texte = page.locator('.eingabe textarea:not(.vibe-frei-text), .eingabe input');
  for(let i = 0; i < await texte.count(); i++) await texte.nth(i).fill('Testantwort');
  await page.waitForTimeout(600);
  await page.click('button:has-text("Station beendet")');
  await page.locator('.wahl:has-text("Generative KI")').click();
  await page.locator('.stern').nth(4).click();
  await page.click('button:has-text("Fertig")');
  await page.waitForSelector('text=Super, geschafft!');
  await outboxLeer(page);
  r = await api.post('/api/ki-app', { data: { gruppe: 'c1c1c1c1c1c1', auswahl: {}, frei: 'Noch eine App' } });
  pruefe(r.status() === 401, 'freier Auftrag nach dem Beenden abgelehnt (' + r.status() + ')');
  const bereit = await (await api.get('/api/ki-bereit?gruppe=c1c1c1c1c1c1')).json();
  pruefe(bereit.freiRest === 0, 'Restzeit 0');
  r = await api.post('/api/ki-freigabe', { data: { gruppe: 'c1c1c1c1c1c1', pin: PIN } });
  pruefe(r.status() === 409, 'neues Freischalten nach dem Beenden abgelehnt (' + r.status() + ')');

  console.log('Sperre nach 5 falschen PINs');
  await api.post('/api/ereignis', { data: { id: 'd0d0d0d0d0d0', gruppe: 'c2c2c2c2c2c2', art: 'anmeldung', station: '', zeit: new Date().toISOString(), daten: { personen: ['Cem'] } } });
  for(let i = 0; i < 5; i++) await api.post('/api/ki-freigabe', { data: { gruppe: 'c2c2c2c2c2c2', pin: '9999' } });
  r = await api.post('/api/ki-freigabe', { data: { gruppe: 'c2c2c2c2c2c2', pin: PIN } });
  pruefe(r.status() === 429, 'gesperrt, auch mit richtiger PIN (' + r.status() + ')');

  console.log('Opt-out schlägt PIN');
  await api.post('/api/ereignis', { data: { id: 'd1d1d1d1d1d1', gruppe: 'c3c3c3c3c3c3', art: 'anmeldung', station: '', zeit: new Date().toISOString(), daten: { personen: ['Lea', 'Tom'] } } });
  r = await api.post('/api/ki-freigabe', { data: { gruppe: 'c3c3c3c3c3c3', pin: PIN } });
  pruefe(r.status() === 403, 'Opt-out-Gruppe bekommt keine Freigabe (' + r.status() + ')');
  pruefe((await (await api.get('/api/ki-bereit?gruppe=c3c3c3c3c3c3')).json()).pinEingerichtet === false, 'Opt-out-Gruppe sieht keinen Knopf');

  await api.post('/api/alle-loeschen');
  await api.post('/api/einstellungen', { data: { vibePin: '' } });
  pruefe(!konsolenFehler.length, 'keine JavaScript-Fehler' + (konsolenFehler.length ? ': ' + konsolenFehler.join(' | ') : ''));
  await browser.close();
  console.log(fehler ? fehler + ' Fehler' : 'Alles in Ordnung');
  process.exit(fehler ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
