// Misst die rechenintensiven Schritte mit gebremster CPU (Annäherung an alte iPads).
// Nur Chromium: Die Bremse (CPU-Throttling) gibt es nur dort.
//
//   STENCILME_DATEN=archiv/testdaten python3 server/server.py --port 8765
//   NODE_PATH=~/.cache/stencilme-playwright/node_modules node tests/leistung-test.js [Bremsfaktor, Standard 4]
//
// Ergebnis in Sekunden bzw. Bildern pro Sekunde. Ein echtes altes iPad kann schneller
// oder langsamer sein: Die Zahlen sind zum Vergleichen vorher/nachher gedacht.
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:8765';
const BREMSE = parseFloat(process.argv[2] || '4');
const FOTO = path.join(__dirname, '..', 'docs', 'test-foto.jpg');
const VIDEO = process.env.VIDEO || path.join(__dirname, '..', 'archiv', 'testdateien', 'test-video.webm');

async function zeit(fn){
  const t = Date.now();
  await fn();
  return ((Date.now() - t) / 1000).toFixed(1) + ' s';
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: BREMSE });
  const ergebnis = { bremse: BREMSE + 'x' };

  await page.goto(BASE + '/');
  await page.click('text=Los geht');
  await page.click('button[data-anzahl="1"]');
  await page.fill('#name1', 'Mess');
  await page.click('#namenWeiter');
  await page.click('#weiterLink');
  await page.waitForSelector('h1:has-text("Foto machen")');

  ergebnis.fotoPruefung = await zeit(async () => {
    await page.locator('input[type=file]').setInputFiles(FOTO);
    await page.waitForSelector('.ki-pruefung.ok, .ki-pruefung.klein, .ki-pruefung.fehler', { timeout: 300000 });
  });
  // Station Foto abschließen, ohne Messung
  await page.evaluate(() => Stationen.fortschritt().then(f => {
    f.stationen.foto = { status: 'fertig' };
    return Stationen.fortschrittSpeichern(f);
  }));

  await page.goto(BASE + '/app/station.html?id=stencilme');
  ergebnis.stempel = await zeit(() => page.waitForSelector('.schritt-bild svg', { timeout: 300000 }));

  await page.goto(BASE + '/app/station.html?id=koerpererkennung');
  await page.locator('input[type=file]').setInputFiles(VIDEO);
  ergebnis.videoStart = await zeit(() => page.waitForFunction(() => /Bilder pro Sekunde/.test((document.querySelector('.tempo') || {}).textContent || ''), null, { timeout: 300000 }));
  await page.waitForTimeout(6000);
  ergebnis.videoTempo = await page.locator('.tempo').textContent();

  await page.evaluate(() => Stationen.fortschritt().then(f => {
    f.stationen.koerpererkennung = { status: 'fertig' };
    return Stationen.fortschrittSpeichern(f);
  }));
  await page.goto(BASE + '/app/station.html?id=hintergrund');
  ergebnis.freistellen = await zeit(() => page.waitForSelector('.frei-bild canvas', { timeout: 300000 }));
  ergebnis.zusammensetzen = await zeit(async () => {
    await page.locator('button.hintergrund-wahl').first().click();
    await page.waitForSelector('.ergebnis-bild canvas', { timeout: 300000 });
  });

  console.log(JSON.stringify(ergebnis, null, 1));
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
