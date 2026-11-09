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

  console.log('Frei nach Foto und Bild bearbeiten (Patricia, 02.11.2026)');
  const frei = await page.evaluate(() => Stationen.laden().then(liste => {
    const f = { stationen: { foto: { status: 'fertig' }, stencilme: { status: 'fertig' } } };
    const offen = st => Stationen.voraussetzungen(liste, st).every(b => Stationen.istFertig(f, b));
    return {
      zu: liste.filter(st => !st.bonus && st.id !== 'foto' && st.id !== 'stencilme' && !offen(st)).map(st => st.id),
      bonusOffen: liste.filter(st => st.bonus && offen(st) && !Stationen.fehlenBisBonus(liste, f, st) && !Stationen.wartetAufFreigabe(st)).map(st => st.id),
      nurFotoOffen: liste.filter(st => !st.bonus && st.id !== 'foto' && st.id !== 'stencilme' && Stationen.voraussetzungen(liste, st).every(b => b === 'foto')).map(st => st.id)
    };
  }));
  // Seit 09.11.: Sticker kommt nach dem Lasercutter, Stempeldruck (optional) nach der optionalen Station „Stempel“
  pruefe(frei.zu.join() === 'sticker,druck-stempel', 'alle anderen Stationen offen, Sticker wartet auf den Lasercutter, Stempeldruck auf „Stempel“ (gesperrt: ' + frei.zu.join(', ') + ')');
  pruefe(!frei.bonusOffen.length, 'Bonus bleibt gesperrt' + (frei.bonusOffen.length ? ': ' + frei.bonusOffen.join(', ') : ''));
  pruefe(!frei.nurFotoOffen.length, 'ohne Bild bearbeiten ist nur stencil.me offen' + (frei.nurFotoOffen.length ? ', auch: ' + frei.nurFotoOffen.join(', ') : ''));

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

  console.log('Reihenfolge ab Dezember: Lasercutter → Sticker → KI 1 → KI 2 (Patricia, 09.11.2026)');
  const reihe = await page.evaluate(() => Stationen.laden().then(liste => {
    const f = ids => { const st = {}; ids.forEach(id => { st[id] = { status: 'fertig' }; }); return { stationen: st }; };
    const mal = (stand, beleg) => { const ids = {}; for(let i = 0; i < 30; i++) ids[Stationen.naechste(liste, f(stand), beleg).id] = 1; return Object.keys(ids).sort().join(); };
    const basis = ['foto', 'stencilme', 'lasercutter'];
    return {
      nachLaser: mal(basis, {}),
      stickerVoll: mal(basis, { sticker: 3 }),
      nachSticker: mal(basis.concat(['sticker']), {}),
      nachKi1: mal(basis.concat(['sticker', 'ki-selbstportraet']), {}),
      vibeVoll: mal(basis.concat(['sticker', 'ki-selbstportraet']), { 'vibe-coding': 1 }),
      laserVollKi: mal(['foto', 'stencilme'], { lasercutter: 2 })
    };
  }));
  pruefe(reihe.nachLaser === 'sticker', 'nach dem Lasercutter: Sticker (' + reihe.nachLaser + ')');
  pruefe(reihe.stickerVoll === 'ki-selbstportraet', 'Sticker voll: KI-Selbstporträt (' + reihe.stickerVoll + ')');
  pruefe(reihe.nachSticker === 'ki-selbstportraet', 'nach dem Sticker: KI-Selbstporträt (' + reihe.nachSticker + ')');
  pruefe(reihe.nachKi1 === 'vibe-coding', 'danach: Eure eigene Bild-App (' + reihe.nachKi1 + ')');
  pruefe(reihe.vibeVoll.split(',').indexOf('vibe-coding') < 0 && reihe.vibeVoll.length > 0, 'Vibe Coding besetzt: eine andere Station (' + reihe.vibeVoll + ')');
  pruefe(reihe.laserVollKi === 'ki-selbstportraet', 'Lasercutter voll: gleich weiter zur KI (' + reihe.laserVollKi + ')');

  console.log('Station gerade voll: Hinweis, aber keine Sperre');
  await ereignis(api, 'b1b1b1b1b1b1', 'checkin', 'druck-linol', '04');
  await anmelden(page, 'a1a1a1a1a1a1', fertig(['foto', 'stencilme']));
  await page.goto(BASE + '/app/station.html?id=druck-linol');
  await page.waitForSelector('text=Hier ist gerade eine andere Gruppe.');
  await page.waitForSelector('text=Wartet kurz oder geht zu:');
  pruefe((await page.locator('.gross-text strong').textContent()) === 'Lasercutter', 'Ausweg: Lasercutter (Vorrang)');
  await page.screenshot({ path: path.join(SHOTS, BROWSER + '-ablauf-voll.png'), fullPage: true });
  await page.click('text=Wir sind trotzdem dran');
  await page.waitForSelector('text=Foto von der Postkarte');
  pruefe(true, '„Wir sind trotzdem dran“ öffnet die Station');
  const st = await page.evaluate(() => Stationen.fortschritt());
  pruefe(st.aktuell === 'druck-linol' && st.stationen['druck-linol'].status === 'begonnen', 'Check-in gespeichert');

  console.log('Kein Wettrennen: „Station beendet“ frühestens 2 Minuten nach dem Check-in');
  await page.locator('input[type=file]').first().setInputFiles(require('path').join(__dirname, '..', 'docs', 'test-foto.jpg'));
  await page.waitForSelector('text=Kein Wettrennen');
  pruefe(await page.locator('button:has-text("Station beendet")').isDisabled(), 'Foto da, aber „Station beendet“ noch gesperrt');
  pruefe(/In [12]:\d\d könnt ihr die Station beenden/.test(await page.locator('#inhalt').textContent()), 'Countdown sichtbar');
  // Check-in liegt 2 Minuten zurück: dann geht es (ohne 2 Minuten zu warten)
  await page.evaluate(() => Stationen.fortschritt().then(f => { f.stationen['druck-linol'].start = new Date(Date.now() - 121000).toISOString(); return Stationen.fortschrittSpeichern(f); }));
  await page.reload();
  await page.waitForSelector('button:has-text("Station beendet")');
  await page.waitForFunction(() => Array.prototype.some.call(document.querySelectorAll('button'), b => b.textContent === 'Station beendet' && !b.disabled), null, { timeout: 15000 });
  pruefe(await page.locator('text=Kein Wettrennen').count() === 0, 'nach 2 Minuten: „Station beendet“ geht');

  console.log('Erinnerung: Station seit 15 Minuten offen');
  const vorMinuten = m => page.evaluate(m => Stationen.fortschritt().then(f => { f.stationen['druck-linol'].start = new Date(Date.now() - m * 60000).toISOString(); return Stationen.fortschrittSpeichern(f); }), m);
  pruefe(await page.locator('.erinnerung:visible').count() === 0, 'nach 2 Minuten noch keine Erinnerung');
  await vorMinuten(16);
  await page.reload();
  await page.waitForSelector('.erinnerung:visible');
  pruefe(/Ihr seid schon 16 Minuten an dieser Station\. Seid ihr fertig\?/.test(await page.locator('.erinnerung').textContent()), 'nach 15 Minuten: „Ihr seid schon 16 Minuten an dieser Station. Seid ihr fertig?“');
  await page.screenshot({ path: path.join(SHOTS, BROWSER + '-erinnerung.png') });
  await page.click('.erinnerung button:has-text("Wir brauchen noch Zeit")');
  await page.waitForFunction(() => Stationen.fortschritt().then(f => f.stationen['druck-linol'].erinnert === 1));
  await page.reload();
  await page.waitForSelector('button:has-text("Station beendet")');
  await page.waitForTimeout(500);
  pruefe(await page.locator('.erinnerung:visible').count() === 0, '„Wir brauchen noch Zeit“: bis zur nächsten Viertelstunde Ruhe, auch nach Neuladen');
  await vorMinuten(31);
  await page.reload();
  await page.waitForSelector('.erinnerung:visible');
  pruefe(/31 Minuten/.test(await page.locator('.erinnerung').textContent()), 'nach 30 Minuten wieder');
  await page.click('.erinnerung button:has-text("Station beendet")');
  pruefe(await page.locator('.erinnerung:visible').count() === 0, '„Zu Station beendet“ schließt die Erinnerung');

  console.log('Laptop-Seite: seit wann an der Station');
  await api.post('/api/ereignis', { data: { id: 'f0f0f0f0f0f0', gruppe: 'b2b2b2b2b2b2', art: 'checkin', station: 'berufe', zeit: new Date(Date.now() - 20 * 60000).toISOString(), daten: {} } });
  const laptop = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await laptop.goto(BASE + '/laptop');
  await laptop.waitForSelector('#groups .seit');
  const seitTexte = await laptop.locator('#groups .seit').allTextContents();
  pruefe(seitTexte.some(t => /^seit 20 Min\. ⏰$/.test(t)), 'Gruppe seit 20 Minuten an „Berufe“: rot mit ⏰ (' + seitTexte.join(' | ') + ')');
  pruefe(await laptop.locator('#groups .seit.lange').count() >= 1, 'ab 15 Minuten markiert');
  await laptop.close();

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
