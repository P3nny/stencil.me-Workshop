// Gruppe auf der Laptop-Seite löschen (z. B. Testgruppen vor dem Start): Daten weg,
// andere Gruppen bleiben, was das iPad danach noch schickt, kommt nicht zurück.
//
//   STENCILME_DATEN=archiv/testdaten STENCILME_KI_TEST=1 python3 server/server.py --port 8765
//   NODE_PATH=~/.cache/stencilme-playwright/node_modules node tests/gruppe-loeschen-test.js [webkit|chromium]
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
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="10mm" height="10mm"><path d="M0,0L10,0L10,10Z" fill="#1e4fd6"/></svg>';
let n = 0;
const id = () => ('00000000000' + (++n).toString(16)).slice(-12);

function ereignis(api, gruppe, art, station, daten){
  return api.post('/api/ereignis', { data: { id: id(), gruppe: gruppe, art: art, station: station || '', zeit: new Date().toISOString(), daten: daten || {} } });
}
function stempel(api, gruppe, name, art){
  return api.post('/api/stempel?id=' + id() + '&name=' + name + '&gruppe=' + gruppe + (art ? '&art=' + art : ''), { headers: { 'Content-Type': 'image/svg+xml' }, data: SVG });
}

(async () => {
  const api = await pw.request.newContext({ baseURL: BASE });
  await api.post('/api/alle-loeschen');
  const TEST = 'aaaaaaaaaaaa', KIND = 'bbbbbbbbbbbb';

  console.log('Zwei Gruppen mit Stempel, Sticker, Porträt und Nachricht');
  for(const [g, name] of [[TEST, 'Penny'], [KIND, 'Mia']]){
    await ereignis(api, g, 'anmeldung', '', { personen: [name] });
    await ereignis(api, g, 'checkin', 'foto');
    await ereignis(api, g, 'beendet', 'foto', { sterne: 3 });
    await stempel(api, g, name);
    await stempel(api, g, name, 'sticker');
    await stempel(api, g, name, 'portraet');
  }
  await api.post('/api/nachricht', { data: { gruppen: [TEST, KIND], text: 'Wird gelasert' } });
  let gruppen = (await (await api.get('/api/gruppen')).json()).gruppen;
  pruefe(gruppen.length === 2, '2 Gruppen angemeldet');

  console.log('Laptop-Seite: Testgruppe löschen');
  const browser = await pw[BROWSER].launch();
  const laptop = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await laptop.goto(BASE + '/laptop');
  await laptop.waitForSelector('#groups tr:has-text("Penny")');
  laptop.once('dialog', d => { pruefe(d.message().indexOf('Penny') >= 0, 'Rückfrage nennt die Gruppe'); d.accept(); });
  await laptop.locator('#groups tr:has-text("Penny") button:has-text("Löschen")').click();
  await laptop.waitForFunction(() => !/Penny/.test(document.getElementById('groups').textContent));
  pruefe(await laptop.locator('#groups tr:has-text("Mia")').count() === 1, 'Mia steht noch in der Tabelle');
  await laptop.screenshot({ path: path.join(SHOTS, BROWSER + '-gruppe-loeschen.png') });

  gruppen = (await (await api.get('/api/gruppen')).json()).gruppen;
  pruefe(gruppen.length === 1 && gruppen[0].gruppe === KIND, 'Server: nur noch Mias Gruppe');
  const stempelListe = JSON.stringify(await (await api.get('/api/liste')).json());
  const stickerListe = JSON.stringify(await (await api.get('/api/sticker')).json());
  pruefe(stempelListe.indexOf(TEST) < 0 && stempelListe.indexOf('Penny') < 0, 'Stempel und Porträt der Testgruppe weg');
  pruefe(stempelListe.indexOf('Mia') >= 0 && stickerListe.indexOf('Mia') >= 0, 'Mias Stempel und Sticker bleiben');
  pruefe(stickerListe.indexOf('Penny') < 0, 'Sticker der Testgruppe weg');
  const nachrichten = await (await api.get('/api/nachrichten?gruppe=' + TEST)).json();
  pruefe(JSON.stringify(nachrichten).indexOf('gelasert') < 0, 'Nachrichten der Testgruppe weg');

  console.log('iPad der gelöschten Gruppe schickt weiter');
  const r1 = await (await ereignis(api, TEST, 'checkin', 'stencilme')).json();
  const r2 = await (await stempel(api, TEST, 'Penny')).json();
  pruefe(r1.ok && r1.geloescht && r2.ok && r2.geloescht, 'Server nimmt an (Outbox hört auf), verwirft aber');
  gruppen = (await (await api.get('/api/gruppen')).json()).gruppen;
  pruefe(gruppen.length === 1, 'Gruppe kommt nicht zurück');
  pruefe(JSON.stringify(await (await api.get('/api/liste')).json()).indexOf('Penny') < 0, 'kein neuer Stempel');
  const ki = await api.post('/api/ki-bild', { data: { gruppe: TEST, auswahl: {} } });
  pruefe(ki.status() === 410, 'KI-Anfrage abgelehnt mit Hinweis „neu anmelden“');

  console.log('Nur am Laptop');
  const ip = Object.values(os.networkInterfaces()).reduce((a, b) => a.concat(b), []).filter(i => i.family === 'IPv4' && !i.internal)[0];
  if(ip){
    const fremd = await (await pw.request.newContext()).post(BASE.replace('localhost', ip.address) + '/api/gruppe-loeschen', { data: { gruppe: KIND } });
    pruefe(fremd.status() === 403, 'iPad darf keine Gruppe löschen');
  }else{
    console.log('  – keine Netzwerk-Adresse: Zugriff von außen nicht getestet');
  }
  pruefe((await api.post('/api/gruppe-loeschen', { data: { gruppe: '../x' } })).status() === 400, 'ungültige Gruppe abgelehnt');

  console.log('„Alle Daten löschen“ vergisst auch die gelöschten Gruppen');
  await api.post('/api/alle-loeschen');
  await ereignis(api, TEST, 'anmeldung', '', { personen: ['Penny'] });
  gruppen = (await (await api.get('/api/gruppen')).json()).gruppen;
  pruefe(gruppen.length === 1, 'dieselbe ID darf im nächsten Workshop wieder');
  await api.post('/api/alle-loeschen');

  await browser.close();
  console.log(fehler ? '\n' + fehler + ' Fehler' : '\nAlles ok');
  process.exit(fehler ? 1 : 0);
})();
