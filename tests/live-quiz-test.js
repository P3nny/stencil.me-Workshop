// Live-Quiz: Beamer-Seite (/quiz) steuert, zwei iPads (/app/quiz.html) wählen ein Tier und antworten.
//
//   STENCILME_DATEN=archiv/testdaten python3 server/server.py --port 8765
//   NODE_PATH=~/.cache/stencilme-playwright/node_modules node tests/live-quiz-test.js [webkit|chromium]
const pw = require('playwright');
const os = require('os');
const fs = require('fs');
const path = require('path');

const BROWSER = process.argv[2] || 'webkit';
const BASE = process.env.BASE || 'http://localhost:8765';
const SHOTS = path.join(__dirname, '..', 'archiv', 'screenshots');
const FRAGEN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'server', 'quiz-fragen.json'), 'utf8'));
let fehler = 0;
function pruefe(ok, text){
  console.log((ok ? '  ✓ ' : '  ✗ ') + text);
  if(!ok) fehler++;
}

(async () => {
  const api = await pw.request.newContext({ baseURL: BASE });
  await api.post('/api/alle-loeschen');
  await api.post('/api/einstellungen', { data: { quizPin: '' } });
  const browser = await pw[BROWSER].launch();
  const konsolenFehler = [];
  const A = 'a7a7a7a7a7a7', B = 'b7b7b7b7b7b7';

  async function ipad(id, name){
    const p = await browser.newPage({ viewport: { width: 1180, height: 820 } });
    p.on('pageerror', e => konsolenFehler.push(e.message));
    await p.goto(BASE + '/index.html');
    await p.evaluate(a => Speicher.schreiben('gruppe', { id: a.id, personen: [a.name], angemeldet: new Date().toISOString() })
      .then(() => Outbox.ereignis(a.id, 'anmeldung', '', { personen: [a.name] })), { id: id, name: name });
    await p.goto(BASE + '/app/quiz.html');
    return p;
  }

  console.log('Vor dem Start');
  const ipadA = await ipad(A, 'Ada');
  const ipadB = await ipad(B, 'Bo');
  await ipadA.waitForSelector('text=Gerade läuft kein Quiz');
  pruefe(true, 'iPad: „Gerade läuft kein Quiz“');
  pruefe((await api.get('/server/quiz-fragen.json')).status() === 404, 'Fragen mit Lösungen sind nicht abrufbar');

  console.log('Beamer: Teil 1 starten');
  const beamer = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  beamer.on('pageerror', e => konsolenFehler.push(e.message));
  await beamer.goto(BASE + '/quiz');
  await beamer.click('button:has-text("Teil 1 starten")');
  await beamer.waitForSelector('.qr svg');
  const qrAdresse = await beamer.locator('.qr-adresse').textContent();
  pruefe(/^\d+\.\d+\.\d+\.\d+:\d+\/app\/quiz\.html$/.test(qrAdresse), 'QR-Code mit der WLAN-Adresse des Laptops, nicht localhost (' + qrAdresse + ')');

  console.log('iPads: Tier aussuchen');
  await ipadA.waitForSelector('.lq-tier');
  await ipadA.click('.lq-tier:has-text("Fuchs")');
  await ipadA.waitForSelector('text=Ihr seid dabei!');
  await ipadB.waitForSelector('.lq-tier');
  await ipadB.waitForFunction(() => Array.prototype.some.call(document.querySelectorAll('.lq-tier'), b => /Fuchs/.test(b.textContent) && b.disabled), null, { timeout: 5000 });
  pruefe(true, 'Fuchs ist für die andere Gruppe gesperrt');
  await ipadB.click('.lq-tier:has-text("Panda")');
  await ipadB.waitForSelector('text=Ihr seid dabei!');
  await beamer.waitForSelector('text=2 Teams sind dabei');
  pruefe(true, 'Beamer: „2 Teams sind dabei“');
  pruefe(!/Ada|Bo/.test(await beamer.locator('#buehne').textContent()), 'keine Vornamen auf dem Beamer');
  await beamer.screenshot({ path: path.join(SHOTS, BROWSER + '-quiz-lobby.png') });

  console.log('Frage 1');
  await beamer.keyboard.press('ArrowRight'); // Presenter: nächster Schritt
  await beamer.waitForSelector('.antwort');
  const f1 = FRAGEN.teile['1'][0];
  pruefe((await beamer.locator('.frage').textContent()) === f1.frage, 'Beamer zeigt Frage 1');
  await ipadA.waitForSelector('.lq-antwort');
  const status = await (await api.get('/api/quiz/status?gruppe=' + A)).json();
  pruefe(status.frage && status.frage.richtig === undefined, 'iPad bekommt die Lösung nicht vor dem Auflösen');
  await ipadA.click('.lq-antwort.f' + f1.richtig);
  await ipadA.waitForSelector('text=Antwort gespeichert');
  pruefe((await (await api.get('/api/quiz/status?gruppe=' + A)).json()).punkte === 0, 'Punkte verraten die Lösung nicht vor dem Auflösen');
  const falsch = (f1.richtig + 1) % 4;
  await ipadB.waitForSelector('.lq-antwort');
  await ipadB.click('.lq-antwort.f' + falsch);
  await ipadB.waitForSelector('text=Antwort gespeichert');
  await beamer.waitForSelector('text=2 von 2 Teams haben geantwortet', { timeout: 5000 });
  pruefe(true, 'Beamer: „2 von 2 Teams haben geantwortet“');
  await ipadA.screenshot({ path: path.join(SHOTS, BROWSER + '-quiz-ipad-frage.png') });
  await beamer.screenshot({ path: path.join(SHOTS, BROWSER + '-quiz-frage.png') });

  console.log('Auflösen');
  await beamer.click('button:has-text("Auflösen")');
  await beamer.waitForSelector('.antwort.richtig');
  pruefe(/Teil 1/.test(await beamer.locator('.info').first().textContent()) && (await beamer.locator('.antwort .zahl').allTextContents()).join() !== '', 'Beamer zeigt richtige Antwort und Verteilung');
  await ipadA.waitForSelector('text=Richtig!');
  await ipadB.waitForSelector('text=Leider falsch');
  pruefe(true, 'iPads: „Richtig!“ bzw. „Leider falsch“');
  pruefe((await (await api.post('/api/quiz/antwort', { data: { gruppe: B, teil: 1, nr: 0, wahl: f1.richtig } })).json()).ok === false, 'nach dem Auflösen keine Antwort mehr');

  console.log('Bis zum Ende von Teil 1');
  for(let i = 1; i < FRAGEN.teile['1'].length; i++){
    await api.post('/api/quiz/steuern', { data: { aktion: 'weiter' } });
    await api.post('/api/quiz/steuern', { data: { aktion: 'aufloesen' } });
  }
  await api.post('/api/quiz/steuern', { data: { aktion: 'weiter' } });
  await beamer.waitForSelector('text=Siegerehrung');
  pruefe((await beamer.locator('.p1 .tiere').textContent()) === '🦊' && (await beamer.locator('.p2 .tiere').textContent()) === '🐼', 'Siegerehrung: Fuchs Platz 1, Panda Platz 2');
  await beamer.screenshot({ path: path.join(SHOTS, BROWSER + '-quiz-sieger.png') });
  await ipadA.waitForSelector('text=Platz 1');
  await ipadB.waitForSelector('text=Platz 2');
  pruefe(true, 'iPads zeigen ihren Platz');
  await beamer.click('button:has-text("Ganze Liste")');
  await beamer.waitForSelector('text=Alle Teams');
  pruefe(/1\. 🦊 Fuchs · 1 Punkt/.test(await beamer.locator('.liste').textContent()), 'ganze Liste mit Punkten');

  console.log('Teil 2: Punkte zählen zusammen, gleiche Punkte = gleicher Platz');
  beamer.once('dialog', d => d.accept());
  await beamer.click('button:has-text("Teil 2 starten")');
  await ipadB.waitForSelector('text=Ihr seid dabei!');
  pruefe(true, 'Teams bleiben, kein neues Tier nötig');
  await api.post('/api/quiz/steuern', { data: { aktion: 'weiter' } });
  const f2 = FRAGEN.teile['2'][0];
  pruefe((await (await api.post('/api/quiz/antwort', { data: { gruppe: B, teil: 2, nr: 0, wahl: f2.richtig } })).json()).ok, 'Panda antwortet richtig');
  await api.post('/api/quiz/steuern', { data: { aktion: 'ende' } });
  const ende = await (await api.get('/api/quiz/beamer')).json();
  pruefe(ende.rangliste.length === 2 && ende.rangliste.every(e => e.platz === 1 && e.punkte === 1), 'beide 1 Punkt, beide Platz 1');

  console.log('PIN am Präsentationslaptop');
  const ip = Object.values(os.networkInterfaces()).reduce((a, b) => a.concat(b), []).filter(i => i.family === 'IPv4' && !i.internal)[0];
  if(ip){
    const fremd = await pw.request.newContext();
    const url = BASE.replace('localhost', ip.address);
    pruefe((await fremd.get(url + '/api/quiz/beamer')).status() === 409, 'ohne eingetragene PIN: Hinweis „Quiz-PIN eintragen“');
    await api.post('/api/einstellungen', { data: { quizPin: '4711' } });
    pruefe((await fremd.get(url + '/api/quiz/beamer?pin=1234')).status() === 401, 'falsche PIN abgelehnt');
    pruefe((await fremd.get(url + '/api/quiz/beamer?pin=4711')).ok(), 'richtige PIN geht');
    pruefe((await fremd.post(url + '/api/quiz/steuern', { data: { aktion: 'aus' } })).status() === 401, 'iPad kann ohne PIN nicht steuern');
    pruefe((await fremd.get(url + '/quiz')).ok(), 'Beamer-Seite ist im WLAN erreichbar');
    const s = await (await fremd.get(url + '/api/einstellungen')).json();
    pruefe(!('quizPin' in s), 'iPads sehen die Quiz-PIN nicht');
  }else{
    console.log('  – keine Netzwerk-Adresse: PIN von außen nicht getestet');
  }

  console.log('Meine Daten, Gruppe löschen, alles löschen');
  const meine = await (await api.get('/api/meine-daten?gruppe=' + A)).json();
  pruefe(meine.quiz && meine.quiz.team.name === 'Fuchs' && meine.quiz.punkte === 1, 'Meine Daten zeigen Tier, Antworten und Punkte');
  await api.post('/api/gruppe-loeschen', { data: { gruppe: B } });
  pruefe((await (await api.get('/api/quiz/beamer')).json()).teams.length === 1, 'gelöschte Gruppe ist aus dem Quiz raus');
  await api.post('/api/alle-loeschen');
  pruefe((await (await api.get('/api/quiz/beamer')).json()).phase === 'aus', '„Alle Daten löschen“ setzt das Quiz zurück');
  await api.post('/api/einstellungen', { data: { quizPin: '' } });

  pruefe(!konsolenFehler.length, 'keine JavaScript-Fehler' + (konsolenFehler.length ? ': ' + konsolenFehler.join(' | ') : ''));
  await browser.close();
  console.log(fehler ? '\n' + fehler + ' Fehler' : '\nAlles in Ordnung');
  process.exit(fehler ? 1 : 0);
})();
