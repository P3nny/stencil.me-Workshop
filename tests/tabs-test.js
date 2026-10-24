// Zwei Tabs auf demselben iPad (jeder QR-Scan öffnet in Safari einen neuen Tab):
// Ein älterer Tab darf beim Speichern keine Station löschen, die ein anderer Tab
// inzwischen abgeschlossen hat, und zeigt beim Zurückkehren den neuen Stand.
//
//   STENCILME_DATEN=archiv/testdaten python3 server/server.py --port 8765
//   NODE_PATH=~/.cache/stencilme-playwright/node_modules node tests/tabs-test.js [webkit|chromium]
const pw = require('playwright');

const BROWSER = process.argv[2] || 'webkit';
const BASE = process.env.BASE || 'http://localhost:8765';
let fehler = 0;
function pruefe(ok, text){
  console.log((ok ? '  ✓ ' : '  ✗ ') + text);
  if(!ok) fehler++;
}

(async () => {
  const browser = await pw[BROWSER].launch();
  const context = await browser.newContext();
  const tabB = await context.newPage();
  await tabB.goto(BASE + '/index.html');
  await tabB.evaluate(() => Speicher.schreiben('gruppe', { id: 'abcdefabcdef', personen: ['Ada'], angemeldet: new Date().toISOString() })
    .then(() => Speicher.schreiben('fortschritt', { stationen: { foto: { status: 'fertig' }, stencilme: { status: 'fertig' } } })));

  console.log('Älterer Tab speichert nach einem anderen Tab');
  const tabA = await context.newPage();
  await tabA.goto(BASE + '/app/station.html?id=lasercutter');
  await tabA.waitForSelector('.eingabe input, .eingabe textarea');
  pruefe((await tabA.locator('.zaehler').textContent()).indexOf('2 von') >= 0, 'Tab A zeigt 2 Stationen');

  // Tab B schließt inzwischen „Coding“ ab
  await tabB.evaluate(() => Speicher.lesen('fortschritt').then(f => {
    f.stationen['coding-web'] = { status: 'fertig' };
    return Speicher.schreiben('fortschritt', f);
  }));

  // Tab A speichert eine Antwort mit seinem alten Stand
  await tabA.locator('.eingabe input, .eingabe textarea').first().fill('Wie heiß wird der Laser?');
  await tabA.waitForTimeout(500);
  const f = await tabB.evaluate(() => Speicher.lesen('fortschritt'));
  pruefe(f.stationen['coding-web'] && f.stationen['coding-web'].status === 'fertig', 'Coding bleibt fertig');
  pruefe(f.stationen.lasercutter && f.stationen.lasercutter.status === 'begonnen', 'Lasercutter ist begonnen');
  pruefe(f.aktuell === 'lasercutter', 'aktuelle Station: Lasercutter');

  console.log('Zurück in den älteren Tab');
  await tabA.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await tabA.waitForTimeout(500);
  pruefe((await tabA.locator('.zaehler').textContent()).indexOf('3 von') >= 0, 'Tab A zeigt jetzt 3 Stationen');

  console.log('Abschluss: Löschen auf dem iPad (anderer Tab bleibt offen)');
  await tabB.request.post(BASE + '/api/einstellungen', { data: { freigaben: ['loeschen'] } });
  await tabA.goto(BASE + '/app/station.html?id=lasercutter');
  await tabA.waitForSelector('text=Der Workshop ist vorbei', { timeout: 10000 });
  pruefe(true, 'Station zeigt den Abschluss-Hinweis mit „Meine Daten“');
  await tabB.goto(BASE + '/app/meine-daten.html');
  await tabB.waitForSelector('button:has-text("Jetzt alles löschen")');
  // Laptop nimmt nichts an: Die Prüfung darf nicht hängen bleiben
  await tabB.route('**/api/ereignis', r => r.fulfill({ status: 500, body: '{}' }));
  await tabB.evaluate(() => Outbox.ereignis('abcdefabcdef', 'checkin', 'berufe', {}));
  await tabB.click('button:has-text("Jetzt alles löschen")');
  await tabB.waitForSelector('text=noch nicht beim Laptop', { timeout: 30000 });
  pruefe(/Sache ist noch nicht beim Laptop \(checkin berufe\)/.test(await tabB.locator('.hinweis').last().textContent()), 'offener Eintrag wird genannt, nichts hängt');
  pruefe(await tabB.locator('button:has-text("Trotzdem löschen")').isVisible(), 'Ausweg „Trotzdem löschen“');
  tabB.once('dialog', d => d.accept());
  await tabB.click('button:has-text("Trotzdem löschen")');
  await tabB.waitForSelector('h1:has-text("✓ Gelöscht")', { timeout: 15000 });
  pruefe(true, 'Löschen klappt, obwohl ein anderer Tab offen ist');
  const rest = await tabB.evaluate(() => Speicher.lesen('gruppe'));
  pruefe(rest === undefined || rest === null, 'Gruppe ist vom iPad gelöscht (' + JSON.stringify(rest) + ')');
  await tabB.request.post(BASE + '/api/einstellungen', { data: { freigaben: [] } });

  await browser.close();
  console.log(fehler ? fehler + ' Fehler' : 'Alles in Ordnung');
  process.exit(fehler ? 1 : 0);
})();
