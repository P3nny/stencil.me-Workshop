// ---- Was hat eine KI-Anfrage verbraucht? ----
// Token und Kosten kommen vom Laptop (genau, aus der Antwort von Claude). Der Strom ist
// nur grob geschätzt (server/ki_bild.py, STROM_WH_PRO_1000): Anthropic veröffentlicht
// dazu keine Zahlen. Die Anzeige soll zum Nachdenken anregen, nicht messen.
(function(){
  const LED_W = 5; // LED-Lampe

  function zahl(n){ return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function komma(n, stellen){ return n.toFixed(stellen).replace('.', ','); }

  function ledDauer(wh){
    const min = wh / LED_W * 60;
    return min < 90 ? Math.max(1, Math.round(min)) + ' Min.' : komma(min / 60, 1) + ' Std.';
  }

  window.KiVerbrauch = {
    // v: { eingabe, ausgabe, kostenUsd, stromWh: [von, bis] }
    zeile: (el, v) => {
      if(!v) return null;
      const cent = v.kostenUsd * 100;
      return el('div', { klasse: 'ki-verbrauch' }, [
        el('p', { text: '🔢 ' + zahl(v.eingabe) + ' Token rein, ' + zahl(v.ausgabe) + ' Token raus · 💶 ca. ' + komma(cent, cent < 1 ? 2 : 1) + ' US-Cent' }),
        el('p', { text: '⚡ Strom, grob geschätzt: ' + komma(v.stromWh[0], 1) + ' bis ' + komma(v.stromWh[1], 1) + ' Wh. Damit leuchtet eine LED-Lampe (5 W) ' + ledDauer(v.stromWh[0]) + ' bis ' + ledDauer(v.stromWh[1]) }),
        el('details', {}, [
          el('summary', { text: 'Was ist ein Token? Wie wird geschätzt?' }),
          el('p', { text: 'Ein Token ist ein Wortstück, etwa eine Silbe. Claude liest euren Auftrag als Token und schreibt seine Antwort Token für Token. Bezahlt wird pro Token.' }),
          el('p', { text: 'Wie viel Strom eine Anfrage im Rechenzentrum braucht, sagt Anthropic nicht. Forschende schätzen für große KI-Modelle 0,3 bis 3 Wh für eine kurze Antwort. Darum steht hier eine große Spanne.' })
        ])
      ]);
    }
  };
})();
