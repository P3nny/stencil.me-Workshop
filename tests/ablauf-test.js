// Ablauf: Welche Station schlägt die App als Nächstes vor?
// Voraussetzungen, Plätze, Vorrang für stencil.me und Lasercutter, Gruppen unterwegs, kein Weg in die Sackgasse.
//
//   STENCILME_DATEN=archiv/testdaten python3 server/server.py --port 8765
//   NODE_PATH=~/.cache/stencilme-playwright/node_modules node tests/ablauf-test.js [webkit|chromium]
const pw = require('playwright');
const path = require('path');

const BROWSER = process.argv[2] || 'webkit';
const BASE = process.env.BASE || 'http://localhost:8765';
const SHOTS = path.join(__dirname, '..', 'archiv', 'screenshots');
let fehler = 0;
function pruefe(ok, text){
  console.log((ok ? '  ✓ ' : '  ✗ ') + text);
  if(!ok) fehler++;
}

function fertig(ids){
  const st = {};
  ids.forEach(id => { st[id] = { status: 'fertig' }; });
  return { stationen: st };
}

function anmelden(page, id, f){
  return page.evaluate(a => Speicher.schreiben('gruppe', { id: a.id, personen: ['Ada'], angemeldet: new Date().toISOString() })
    .then(() => Speicher.schreiben('fortschritt', a.f))
    .then(() => Outbox.ereignis(a.id, 'anmeldung', '', { personen: ['Ada'] })), { id: id, f: f });
}

function ereignis(api, gruppe, art, station, nr){
  return api.post('/api/ereignis', { data: { id: 'e0e0e0e0e0' + nr, gruppe: gruppe, art: art, station: station, zeit: new Date().toISOString(), daten: art === 'anmeldung' ? { personen: ['Cem'] } : {} } });
}

(async () => {
  const browser = await pw[BROWSER].launch();
  const api = await pw.request.newContext({ baseURL: BASE });
  await api.post('/api/alle-loeschen');
  const konsolenFehler = [];
  const kontext = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await kontext.newPage();
  page.on('pageerror', e => konsolenFehler.push(e.message));
  await page.goto(BASE + '/index.html');

  console.log('Zufallsdurchläufe: nie eine gesperrte oder fertige Station');
  const ergebnis = await page.evaluate(() => Stationen.laden().then(liste => {
    const falsch = [];
    for(let i = 0; i < 200; i++){
      const f = { stationen: {} };
      liste.forEach(s => { if(Math.random() < 0.5) f.stationen[s.id] = { status: 'fertig' }; });
      const beleg = {};
      liste.forEach(s => { beleg[s.id] = Math.floor(Math.random() * 4); });
      const st = Stationen.naechste(liste, f, Math.random() < 0.2 ? null : beleg);
      if(!st) continue;
      if(Stationen.istFertig(f, st.id)) falsch.push(st.id + ' schon fertig');
      if(!Stationen.voraussetzungen(liste, st).every(b => Stationen.istFertig(f, b))) falsch.push(st.id + ' gesperrt');
      if(Stationen.fehlenBisBonus(liste, f, st)) falsch.push(st.id + ' Bonus zu früh');
    }
    return falsch;
  }));
  pruefe(!ergebnis.length, '200 Stände geprüft' + (ergebnis.length ? ': ' + ergebnis.slice(0, 5).join(', ') : ''));

  console.log('Vorrang: alle fangen mit Foto, stencil.me, Lasercutter an');
  const vorrang = await page.evaluate(() => Stationen.laden().then(liste => {
    const f = ids => { const st = {}; ids.forEach(id => { st[id] = { status: 'fertig' }; }); return { stationen: st }; };
    const mal = (stand, beleg) => { const ids = {}; for(let i = 0; i < 30; i++) ids[Stationen.naechste(liste, f(stand), beleg).id] = 1; return Object.keys(ids); };
    return {
      start: mal([], {}),
      nachFoto: mal(['foto'], {}),
      nachStencil: mal(['foto', 'stencilme'], {}),
      laserVoll: mal(['foto', 'stencilme'], { lasercutter: 2 })
    };
  }));
  pruefe(vorrang.start.join() === 'foto', 'zuerst Foto (' + vorrang.start + ')');
  pruefe(vorrang.nachFoto.join() === 'stencilme', 'nach dem Foto immer stencil.me (' + vorrang.nachFoto + ')');
  pruefe(vorrang.nachStencil.join() === 'lasercutter', 'danach immer Lasercutter (' + vorrang.nachStencil + ')');
  pruefe(vorrang.laserVoll.indexOf('lasercutter') < 0 && vorrang.laserVoll.length > 0, 'Lasercutter voll (2 Paare): andere Station (' + vorrang.laserVoll.length + ' verschiedene)');

  console.log('Unterwegs: zwei Gruppen, Linoldruck hat einen Platz');
  const liste = await page.evaluate(() => Stationen.laden().then(l => l.map(s => s.id)));
  const ausser = keep => liste.filter(id => keep.indexOf(id) < 0);
  await ereignis(api, 'b1b1b1b1b1b1', 'anmeldung', '', '01');
  await ereignis(api, 'b2b2b2b2b2b2', 'anmeldung', '', '02');
  const g1 = await page.evaluate(a => Stationen.laden().then(l => Stationen.vorschlagen(l, a.f, 'b1b1b1b1b1b1')).then(s => s.id), { f: fertig(ausser(['druck-linol'])) });
  pruefe(g1 === 'druck-linol', 'Gruppe 1 geht zum Linoldruck (' + g1 + ')');
  let beleg = await (await api.get('/api/belegung?gruppe=b2b2b2b2b2b2')).json();
  pruefe(beleg.stationen['druck-linol'] === 1, 'Laptop zählt Gruppe 1 als unterwegs');
  beleg = await (await api.get('/api/belegung?gruppe=b1b1b1b1b1b1')).json();
  pruefe(!beleg.stationen['druck-linol'], 'Gruppe 1 zählt nicht gegen sich selbst');
  const g2 = await page.evaluate(a => Stationen.laden().then(l => {
    const ids = {};
    let kette = Promise.resolve();
    for(let i = 0; i < 10; i++) kette = kette.then(() => Stationen.vorschlagen(l, a.f, 'b2b2b2b2b2b2')).then(s => { ids[s.id] = 1; });
    return kette.then(() => Object.keys(ids));
  }), { f: fertig(ausser(['druck-linol', 'berufe'])) });
  pruefe(g2.join() === 'berufe', 'Gruppe 2 bekommt nicht den Linoldruck (' + g2 + ')');
  await ereignis(api, 'b1b1b1b1b1b1', 'checkin', 'berufe', '03');
  beleg = await (await api.get('/api/belegung?gruppe=b2b2b2b2b2b2')).json();
  pruefe(!beleg.stationen['druck-linol'], 'Gruppe 1 checkt woanders ein: Linoldruck wieder frei');

  console.log('Stempel drucken erst nach „Fertig, abholen“');
  const vorFertig = await page.evaluate(a => Stationen.laden().then(l => Stationen.vorschlagen(l, a.f, 'b2b2b2b2b2b2')).then(s => s && s.id), { f: fertig(ausser(['druck-stempel'])) });
  pruefe(vorFertig !== 'druck-stempel', 'ohne Nachricht kein Stempeldruck (' + vorFertig + ')');
  await api.post('/api/nachricht', { data: { gruppen: ['b2b2b2b2b2b2'], text: 'Der Stempel von Cem wird jetzt gelasert.', art: 'platte-laser' } });
  const nachLaser = await page.evaluate(a => Stationen.laden().then(l => Stationen.vorschlagen(l, a.f, 'b2b2b2b2b2b2')).then(s => s && s.id), { f: fertig(ausser(['druck-stempel'])) });
  pruefe(nachLaser !== 'druck-stempel', '„Wird gelasert“ reicht nicht (' + nachLaser + ')');
  await api.post('/api/nachricht', { data: { gruppen: ['b2b2b2b2b2b2'], text: 'Der Stempel von Cem ist fertig!', art: 'platte-fertig' } });
  const nachFertig = await page.evaluate(a => Stationen.laden().then(l => Stationen.vorschlagen(l, a.f, 'b2b2b2b2b2b2')).then(s => s && s.id), { f: fertig(ausser(['druck-stempel'])) });
  pruefe(nachFertig === 'druck-stempel', 'nach „Fertig, abholen“: Stempel drucken (' + nachFertig + ')');

  console.log('Vibe Coding sofort nach „Wird gelasert“');
  await ereignis(api, 'b3b3b3b3b3b3', 'anmeldung', '', '05');
  const stand3 = { f: fertig(['foto', 'stencilme', 'lasercutter']) };
  const vorLaser = await page.evaluate(a => Stationen.laden().then(l => {
    const ids = {};
    let kette = Promise.resolve();
    for(let i = 0; i < 10; i++) kette = kette.then(() => Stationen.vorschlagen(l, a.f, 'b3b3b3b3b3b3')).then(s => { ids[s.id] = 1; });
    return kette.then(() => Object.keys(ids));
  }), stand3);
  pruefe(vorLaser.indexOf('vibe-coding') < 0, 'vorher: kein Vibe Coding (optional, andere frei)');
  await api.post('/api/nachricht', { data: { gruppen: ['b3b3b3b3b3b3'], text: 'Der Stempel von Dua wird jetzt gelasert.', art: 'platte-laser' } });
  const nachLaser3 = await page.evaluate(a => Stationen.laden().then(l => Stationen.vorschlagen(l, a.f, 'b3b3b3b3b3b3')).then(s => s && s.id), stand3);
  pruefe(nachLaser3 === 'vibe-coding', 'nach „Wird gelasert“: Vibe Coding (' + nachLaser3 + ')');
  beleg = await (await api.get('/api/belegung?gruppe=b2b2b2b2b2b2')).json();
  pruefe(beleg.stationen['vibe-coding'] === 1, 'Vibe Coding (1 iPad) ist damit besetzt');

  console.log('Station gerade voll: Hinweis, aber keine Sperre');
  await ereignis(api, 'b1b1b1b1b1b1', 'checkin', 'druck-linol', '04');
  await anmelden(page, 'a1a1a1a1a1a1', fertig(['foto']));
  await page.goto(BASE + '/app/station.html?id=druck-linol');
  await page.waitForSelector('text=Hier ist gerade eine andere Gruppe.');
  await page.waitForSelector('text=Wartet kurz oder geht zu:');
  pruefe((await page.locator('.gross-text strong').textContent()) === 'Bild bearbeiten', 'Ausweg: Bild bearbeiten (stencil.me, Vorrang)');
  await page.screenshot({ path: path.join(SHOTS, BROWSER + '-ablauf-voll.png'), fullPage: true });
  await page.click('text=Wir sind trotzdem dran');
  await page.waitForSelector('text=Foto von der Postkarte');
  pruefe(true, '„Wir sind trotzdem dran“ öffnet die Station');
  const st = await page.evaluate(() => Stationen.fortschritt());
  pruefe(st.aktuell === 'druck-linol' && st.stationen['druck-linol'].status === 'begonnen', 'Check-in gespeichert');

  console.log('Sackgasse: Station noch gesperrt');
  await page.evaluate(() => Speicher.schreiben('fortschritt', { stationen: { foto: { status: 'fertig' } } }));
  await page.goto(BASE + '/app/station.html?id=lasercutter');
  await page.waitForSelector('text=Geht stattdessen jetzt zu:');
  pruefe((await page.locator('.gross-text strong').textContent()) === 'Bild bearbeiten', 'Lasercutter gesperrt: „Geht stattdessen jetzt zu: Bild bearbeiten“');
  await page.screenshot({ path: path.join(SHOTS, BROWSER + '-ablauf-sackgasse.png'), fullPage: true });

  console.log('Veralteter Tab: Vorschlag nimmt den frischen Stand');
  await page.evaluate(() => Speicher.schreiben('fortschritt', { stationen: { foto: { status: 'fertig' }, stencilme: { status: 'fertig' } } }));
  await page.goto(BASE + '/app/station.html?id=foto');
  await page.waitForSelector('text=Weiter geht es an der Station');
  pruefe((await page.locator('.gross-text strong').textContent()) === 'Lasercutter', 'vorher: Lasercutter');
  const tabB = await kontext.newPage();
  await tabB.goto(BASE + '/index.html');
  await tabB.evaluate(() => Speicher.schreiben('fortschritt', { stationen: { foto: { status: 'fertig' } } }));
  await tabB.close();
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(() => { const s = document.querySelector('.gross-text strong'); return s && s.textContent === 'Bild bearbeiten'; }, null, { timeout: 10000 }).catch(() => {});
  pruefe((await page.locator('.gross-text strong').textContent()) === 'Bild bearbeiten', 'nach Zurücksetzen in Tab B: Bild bearbeiten statt Lasercutter');

  console.log('Ohne Laptop');
  await page.route('**/api/belegung**', r => r.abort());
  await page.route('**/api/unterwegs', r => r.abort());
  const ohne = await page.evaluate(() => Stationen.laden().then(l => Stationen.vorschlagen(l, { stationen: { foto: { status: 'fertig' } } }, 'a1a1a1a1a1a1')).then(s => s && s.id));
  pruefe(ohne === 'stencilme', 'Vorschlag kommt trotzdem (' + ohne + ')');
  await page.unroute('**/api/belegung**');
  await page.unroute('**/api/unterwegs');

  await api.post('/api/alle-loeschen');
  pruefe(!konsolenFehler.length, 'keine JavaScript-Fehler' + (konsolenFehler.length ? ': ' + konsolenFehler.join(' | ') : ''));
  await browser.close();
  console.log(fehler ? fehler + ' Fehler' : 'Alles in Ordnung');
  process.exit(fehler ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
