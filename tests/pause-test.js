// Pause für alle iPads: Knopf auf der Laptop-Seite, Vollbild mit Countdown auf dem iPad,
// „Pause beenden“ kommt schnell an.
//
//   STENCILME_DATEN=archiv/testdaten python3 server/server.py --port 8765
//   NODE_PATH=~/.cache/stencilme-playwright/node_modules node tests/pause-test.js [webkit|chromium]
const pw = require('playwright');
const os = require('os');
const path = require('path');

const BROWSER = process.argv[2] || 'webkit';
const BASE = process.env.BASE || 'http://localhost:8765';
const SHOTS = path.join(__dirname, '..', 'archiv', 'screenshots');
let fehler = 0;
function pruefe(ok, text){
  console.log((ok ? '  ✓ ' : '  ✗ ') + text);
  if(!ok) fehler++;
}

(async () => {
  const api = await pw.request.newContext({ baseURL: BASE });
  await api.post('/api/alle-loeschen');
  const browser = await pw[BROWSER].launch();
  const konsolenFehler = [];

  console.log('Laptop: Pause starten');
  const laptop = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  laptop.on('pageerror', e => konsolenFehler.push(e.message));
  await laptop.goto(BASE + '/laptop');
  await laptop.waitForSelector('text=Keine Pause.');
  pruefe(await laptop.locator('#pauseEnde').isHidden(), 'ohne Pause kein „Pause beenden“');
  await laptop.click('#pause10');
  await laptop.waitForSelector('text=Pause läuft bis');
  pruefe(/noch 10 Min\./.test(await laptop.locator('#pauseState').textContent()), 'Laptop zeigt: Pause läuft, noch 10 Min.');
  await laptop.screenshot({ path: path.join(SHOTS, BROWSER + '-pause-laptop.png') });

  console.log('iPad: Vollbild mit Countdown');
  const ipad = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  ipad.on('pageerror', e => konsolenFehler.push(e.message));
  await ipad.goto(BASE + '/index.html');
  await ipad.evaluate(() => Speicher.schreiben('gruppe', { id: 'e5e5e5e5e5e5', personen: ['Ada'], angemeldet: new Date().toISOString() })
    .then(() => Speicher.schreiben('fortschritt', { stationen: { foto: { status: 'fertig' }, stencilme: { status: 'fertig' } } })));
  await ipad.goto(BASE + '/app/station.html?id=berufe');
  await ipad.waitForSelector('.pause:not([hidden])', { timeout: 10000 });
  const text = await ipad.locator('.pause').textContent();
  pruefe(/Pause/.test(text) && /bis \d{1,2}:\d\d Uhr/.test(text), 'iPad zeigt „Pause bis … Uhr“');
  pruefe(/noch (9:[0-5]\d|10:00)/.test(text), 'Countdown läuft (' + (text.match(/noch \S+/) || [''])[0] + ')');
  const verdeckt = await ipad.evaluate(() => document.elementFromPoint(590, 410).closest('.pause') !== null);
  pruefe(verdeckt, 'Vollbild liegt über der Station (nichts antippbar)');
  await ipad.screenshot({ path: path.join(SHOTS, BROWSER + '-pause-ipad.png') });

  console.log('Laptop: Pause beenden');
  await laptop.click('#pauseEnde');
  await laptop.waitForSelector('text=Keine Pause.');
  await ipad.waitForSelector('.pause[hidden]', { state: 'attached', timeout: 25000 });
  pruefe(true, 'iPad gibt die Station spätestens nach 15 Sekunden wieder frei');

  console.log('Eingaben prüfen');
  pruefe((await api.post('/api/einstellungen', { data: { pauseMinuten: 0 } })).status() === 400, '0 Minuten abgelehnt');
  pruefe((await api.post('/api/einstellungen', { data: { pauseMinuten: 120 } })).status() === 400, '120 Minuten abgelehnt');
  pruefe((await api.post('/api/einstellungen', { data: { pauseUhr: '25:00' } })).status() === 400, 'Uhrzeit 25:00 abgelehnt');
  const bald = new Date(Date.now() + 20 * 60000);
  const uhr = ('0' + bald.getHours()).slice(-2) + ':' + ('0' + bald.getMinutes()).slice(-2);
  const s = await (await api.post('/api/einstellungen', { data: { pauseUhr: uhr } })).json();
  pruefe(s.pauseBis > Date.now() / 1000 + 18 * 60, 'Pause bis ' + uhr + ' gespeichert');
  const nachrichten = await (await api.get('/api/nachrichten?gruppe=e5e5e5e5e5e5')).json();
  pruefe(nachrichten.pauseRest > 18 * 60 && nachrichten.pauseRest <= 20 * 60, 'iPads bekommen die Restzeit vom Laptop (' + nachrichten.pauseRest + ' s)');
  const ip = Object.values(os.networkInterfaces()).reduce((a, b) => a.concat(b), []).filter(i => i.family === 'IPv4' && !i.internal)[0];
  if(ip){
    const fremd = await (await pw.request.newContext()).post(BASE.replace('localhost', ip.address) + '/api/einstellungen', { data: { pauseEnde: true } });
    pruefe(fremd.status() === 403, 'iPad kann die Pause nicht beenden');
  }
  await api.post('/api/alle-loeschen');
  const nachLoeschen = await (await api.get('/api/nachrichten?gruppe=e5e5e5e5e5e5')).json();
  pruefe(nachLoeschen.pauseRest === 0, '„Alle Daten löschen“ beendet auch die Pause');

  pruefe(!konsolenFehler.length, 'keine JavaScript-Fehler' + (konsolenFehler.length ? ': ' + konsolenFehler.join(' | ') : ''));
  await browser.close();
  console.log(fehler ? '\n' + fehler + ' Fehler' : '\nAlles in Ordnung');
  process.exit(fehler ? 1 : 0);
})();
