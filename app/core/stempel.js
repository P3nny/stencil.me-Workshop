// ---- Stempel: vom Foto zur Lasercut-Datei (Computerprogramm) ----
// Gemeinsamer Kern für die Station „Bild bearbeiten“. Die Rechenschritte sind aus
// stencil.html übernommen (gleiche Werte wie im Pflichtweg Negativ-Stempel):
// quadratisch zuschneiden, Graustufen, Otsu-Schwelle innerhalb der Person,
// Krümel entfernen, Konturen als Vektor-Pfade, Schnittrand um die Silhouette.
// stencil.html behält bis nach dem Test am 02.11.2026 seine eigene Kopie (Rückfallebene).
(function(){
const WORK_SIZE = 480; // px Arbeitsraster (quadratisch)
const STEMPEL_MM = 50;
const DESPECKLE_PASSES = 2;
const ENGRAVE_COLOR = '#1e4fd6'; // Blau = Gravieren
const CUT_COLOR = '#d6291e';     // Rot = Schneiden
// Unter diesem Anteil gilt die Personenmaske als leer (wie MIN_PERSON_COVERAGE in stencil.html)
const MIN_PERSON_COVERAGE = 0.02;

function traceContours(mask, size){
  function isFg(x, y){
    if(x<0||y<0||x>=size||y>=size) return 0;
    return mask[y*size+x];
  }
  const edges = [];
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      if(!isFg(x,y)) continue;
      if(!isFg(x,y-1)) edges.push([[x,y],[x+1,y]]);       // oben
      if(!isFg(x,y+1)) edges.push([[x,y+1],[x+1,y+1]]);   // unten
      if(!isFg(x-1,y)) edges.push([[x,y],[x,y+1]]);       // links
      if(!isFg(x+1,y)) edges.push([[x+1,y],[x+1,y+1]]);   // rechts
    }
  }
  const key = p => p[0] + ',' + p[1];
  const adj = new Map();
  edges.forEach((e, idx) => {
    [0,1].forEach(k => {
      const kk = key(e[k]);
      if(!adj.has(kk)) adj.set(kk, []);
      adj.get(kk).push(idx);
    });
  });
  const used = new Array(edges.length).fill(false);
  const loops = [];
  for(let i=0;i<edges.length;i++){
    if(used[i]) continue;
    const startPoint = edges[i][0];
    let currentPoint = edges[i][0];
    let nextPoint = edges[i][1];
    used[i] = true;
    const loop = [currentPoint];
    let safety = 0;
    while(!(nextPoint[0]===startPoint[0] && nextPoint[1]===startPoint[1]) && safety < edges.length + 5){
      loop.push(nextPoint);
      currentPoint = nextPoint;
      const candidates = (adj.get(key(currentPoint)) || []).filter(idx => !used[idx]);
      if(candidates.length === 0) break;
      const nextIdx = candidates[0];
      used[nextIdx] = true;
      const e = edges[nextIdx];
      nextPoint = (e[0][0]===currentPoint[0] && e[0][1]===currentPoint[1]) ? e[1] : e[0];
      safety++;
    }
    if(loop.length >= 3) loops.push(loop);
  }
  return loops;
}

function simplifyLoop(loop){
  const n = loop.length;
  if(n < 3) return loop;
  const result = [];
  for(let i=0;i<n;i++){
    const prev = loop[(i-1+n)%n];
    const cur = loop[i];
    const next = loop[(i+1)%n];
    const dx1 = cur[0]-prev[0], dy1 = cur[1]-prev[1];
    const dx2 = next[0]-cur[0], dy2 = next[1]-cur[1];
    if(dx1*dy2 - dy1*dx2 !== 0) result.push(cur);
  }
  return result.length >= 3 ? result : loop;
}

function loopsToPathD(loops, scale){
  return loops.map(loop => {
    const simplified = simplifyLoop(loop);
    const pts = simplified.map(p => (p[0]*scale).toFixed(3) + ',' + (p[1]*scale).toFixed(3));
    return 'M' + pts.join('L') + 'Z';
  }).join(' ');
}

// BodyPix-Ergebnis -> quadratische Maske im Arbeitsraster (wie computePersonMaskWork in stencil.html)
function personMaskFromSegmentation(segmentation){
  const w = segmentation.width, h = segmentation.height;
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = w; maskCanvas.height = h;
  const mctx = maskCanvas.getContext('2d');
  const md = mctx.createImageData(w, h);
  for(let i=0;i<segmentation.data.length;i++){
    const v = segmentation.data[i] ? 255 : 0;
    md.data[i*4]=v; md.data[i*4+1]=v; md.data[i*4+2]=v; md.data[i*4+3]=255;
  }
  mctx.putImageData(md,0,0);

  // same center-crop-to-square logic as toSquareGrayscale, then scale to WORK_SIZE
  const side = Math.min(w, h);
  const sx = (w - side) / 2;
  const sy = (h - side) / 2;
  const out = document.createElement('canvas');
  out.width = WORK_SIZE; out.height = WORK_SIZE;
  const octx = out.getContext('2d');
  octx.drawImage(maskCanvas, sx, sy, side, side, 0, 0, WORK_SIZE, WORK_SIZE);
  const outData = octx.getImageData(0,0,WORK_SIZE,WORK_SIZE).data;
  const result = new Uint8Array(WORK_SIZE*WORK_SIZE);
  for(let i=0, p=0; i<outData.length; i+=4, p++){
    result[p] = outData[i] > 127 ? 1 : 0;
  }
  return refinePersonMask(result, WORK_SIZE);
}

// BodyPix untersegmentiert dunkle Kleidung (z.B. schwarzes Jacket) häufig und lässt Löcher/
// ausgefranste Ränder. Nachbearbeitung: Closing (Lücken schließen), Löcher füllen,
// kleine Dilatation (Ränder zurückholen), winzige Inseln entfernen.
function refinePersonMask(mask, size){
  const grow = (m, r) => { const d = distanceTransform2D(m, size); const o = new Uint8Array(m.length); const r2=r*r; for(let i=0;i<o.length;i++) o[i] = d[i] <= r2 ? 1 : 0; return o; };
  const shrink = (m, r) => { const inv = new Uint8Array(m.length); for(let i=0;i<m.length;i++) inv[i] = m[i] ? 0 : 1; const d = distanceTransform2D(inv, size); const o = new Uint8Array(m.length); const r2=r*r; for(let i=0;i<o.length;i++) o[i] = d[i] > r2 ? 1 : 0; return o; };
  let m = shrink(grow(mask, 10), 10);   // Closing
  m = fillHoles(m, size);
  m = grow(m, 6);                       // Rand leicht nach außen
  // Inseln < 2 % der Fläche entfernen
  const lab = new Int32Array(m.length); const sizes = [0]; let n = 0;
  for(let i=0;i<m.length;i++){
    if(!m[i] || lab[i]) continue;
    n++; let cnt = 0; const st = [i]; lab[i] = n;
    while(st.length){
      const j = st.pop(); cnt++;
      const x = j % size, y = (j / size) | 0;
      if(x>0 && m[j-1] && !lab[j-1]){ lab[j-1]=n; st.push(j-1); }
      if(x<size-1 && m[j+1] && !lab[j+1]){ lab[j+1]=n; st.push(j+1); }
      if(y>0 && m[j-size] && !lab[j-size]){ lab[j-size]=n; st.push(j-size); }
      if(y<size-1 && m[j+size] && !lab[j+size]){ lab[j+size]=n; st.push(j+size); }
    }
    sizes[n] = cnt;
  }
  const minPx = size*size*0.02;
  for(let i=0;i<m.length;i++) if(m[i] && sizes[lab[i]] < minPx) m[i] = 0;
  return m;
}

function toSquareGrayscale(img, contrastPct){
  const c = document.createElement('canvas');
  c.width = WORK_SIZE; c.height = WORK_SIZE;
  const ctx = c.getContext('2d');
  // center-crop to square
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, WORK_SIZE, WORK_SIZE);
  const imgData = ctx.getImageData(0,0,WORK_SIZE,WORK_SIZE);
  const d = imgData.data;
  const contrast = contrastPct/100;
  const gray = new Float32Array(WORK_SIZE*WORK_SIZE);
  for(let i=0, p=0; i<d.length; i+=4, p++){
    let g = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
    g = (g - 128) * contrast + 128;
    gray[p] = Math.max(0, Math.min(255, g));
  }
  return gray;
}

function otsuThreshold(gray, mask){
  const hist = new Array(256).fill(0);
  let total = 0;
  for(let i=0;i<gray.length;i++){
    if(mask && !mask[i]) continue; // nur Personenfläche berücksichtigen, falls Maske vorhanden
    hist[Math.round(gray[i])]++;
    total++;
  }
  if(total === 0){
    // Fallback: keine Maske / leere Maske -> ganzes Bild verwenden
    for(let i=0;i<gray.length;i++) hist[Math.round(gray[i])]++;
    total = gray.length;
  }
  let sum = 0;
  for(let t=0;t<256;t++) sum += t*hist[t];
  let sumB=0, wB=0, wF=0, varMax=0, threshold=128;
  for(let t=0;t<256;t++){
    wB += hist[t];
    if(wB===0) continue;
    wF = total - wB;
    if(wF===0) break;
    sumB += t*hist[t];
    const mB = sumB/wB;
    const mF = (sum-sumB)/wF;
    const varBetween = wB*wF*(mB-mF)*(mB-mF);
    if(varBetween > varMax){ varMax = varBetween; threshold = t; }
  }
  return threshold;
}

function despeckle(mask, size, passes){
  // simple morphological open/close via neighbor majority, 'passes' iterations
  let cur = mask;
  for(let p=0; p<passes; p++){
    const next = new Uint8Array(cur.length);
    for(let y=0;y<size;y++){
      for(let x=0;x<size;x++){
        let count=0, total=0;
        for(let dy=-1;dy<=1;dy++){
          for(let dx=-1;dx<=1;dx++){
            const ny=y+dy, nx=x+dx;
            if(ny>=0&&ny<size&&nx>=0&&nx<size){
              total++;
              if(cur[ny*size+nx]) count++;
            }
          }
        }
        next[y*size+x] = count > total/2 ? 1 : 0;
      }
    }
    cur = next;
  }
  return cur;
}

function detectThinStructures(mask, size){
  // crude heuristic: count isolated single-pixel-wide foreground runs
  let thinCount = 0;
  for(let y=1;y<size-1;y++){
    for(let x=1;x<size-1;x++){
      if(mask[y*size+x]){
        const left = mask[y*size+x-1], right = mask[y*size+x+1];
        const up = mask[(y-1)*size+x], down = mask[(y+1)*size+x];
        if((!left && !right) || (!up && !down)) thinCount++;
      }
    }
  }
  return thinCount > (size*size*0.01);
}

// ---- Distanztransformation (für echten konturfolgenden Offset/Stanzschnitt) ----
// 1D quadratische Distanztransformation nach Felzenszwalt/Huttenlocher — exakt, O(n).
function dt1d(f){
  const n = f.length;
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n+1);
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for(let q=1;q<n;q++){
    let s = ((f[q]+q*q) - (f[v[k]]+v[k]*v[k])) / (2*q - 2*v[k]);
    while(s <= z[k]){
      k--;
      s = ((f[q]+q*q) - (f[v[k]]+v[k]*v[k])) / (2*q - 2*v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k+1] = Infinity;
  }
  k = 0;
  for(let q=0;q<n;q++){
    while(z[k+1] < q) k++;
    d[q] = (q-v[k])*(q-v[k]) + f[v[k]];
  }
  return d;
}
// 2D separierbare quadratische Distanztransformation: liefert für jedes Pixel den
// quadrierten Abstand zum nächsten Vordergrund-Pixel (mask=1).
function distanceTransform2D(mask, size){
  const INF = 1e12;
  const f = new Float64Array(size*size);
  for(let i=0;i<mask.length;i++) f[i] = mask[i] ? 0 : INF;
  const tmp = new Float64Array(size*size);
  let col = new Float64Array(size);
  for(let x=0;x<size;x++){
    for(let y=0;y<size;y++) col[y] = f[y*size+x];
    const d = dt1d(col);
    for(let y=0;y<size;y++) tmp[y*size+x] = d[y];
  }
  const out = new Float64Array(size*size);
  let row = new Float64Array(size);
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++) row[x] = tmp[y*size+x];
    const d = dt1d(row);
    for(let x=0;x<size;x++) out[y*size+x] = d[x];
  }
  return out;
}
// Löcher innerhalb der Maske schließen (Flood-Fill vom Rand aus), damit die äußere
// Stanzschnitt-Kontur keine unerwünschten inneren Umrisse enthält.
function fillHoles(mask, size){
  const outside = new Uint8Array(size*size);
  const stack = [];
  const mark = (idx) => { if(!mask[idx] && !outside[idx]){ outside[idx]=1; stack.push(idx); } };
  for(let x=0;x<size;x++){ mark(x); mark((size-1)*size+x); }
  for(let y=0;y<size;y++){ mark(y*size); mark(y*size+size-1); }
  while(stack.length){
    const idx = stack.pop();
    const x = idx % size, y = (idx / size) | 0;
    if(x>0) mark(idx-1);
    if(x<size-1) mark(idx+1);
    if(y>0) mark(idx-size);
    if(y<size-1) mark(idx+size);
  }
  const filled = new Uint8Array(size*size);
  for(let i=0;i<mask.length;i++) filled[i] = (mask[i] || !outside[i]) ? 1 : 0;
  return filled;
}
// Bounding-Box aller gesetzten Pixel einer Maske (oder null, wenn leer).
function maskBBox(mask, size){
  let minX=size, minY=size, maxX=-1, maxY=-1;
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      if(mask[y*size+x]){
        if(x<minX) minX=x;
        if(x>maxX) maxX=x;
        if(y<minY) minY=y;
        if(y>maxY) maxY=y;
      }
    }
  }
  return maxX < 0 ? null : {minX,minY,maxX,maxY};
}

function computeOffsetCutPath(baseMask, baseSize, scale, offsetMm){
  const radiusPx = offsetMm / scale;
  const padPx = Math.ceil(radiusPx) + 3;
  const paddedSize = baseSize + 2*padPx;
  const paddedMask = new Uint8Array(paddedSize*paddedSize);
  for(let y=0;y<baseSize;y++){
    const srcRow = y*baseSize;
    const dstRow = (y+padPx)*paddedSize + padPx;
    for(let x=0;x<baseSize;x++) paddedMask[dstRow+x] = baseMask[srcRow+x];
  }

  const motifLoops = traceContours(paddedMask, paddedSize);
  const motifPathD = loopsToPathD(motifLoops, scale);

  const filledMask = fillHoles(paddedMask, paddedSize);
  const dist2 = distanceTransform2D(filledMask, paddedSize);
  const r2 = radiusPx*radiusPx;
  const dilatedMask = new Uint8Array(paddedSize*paddedSize);
  for(let i=0;i<dist2.length;i++) dilatedMask[i] = dist2[i] <= r2 ? 1 : 0;
  const cutLoops = traceContours(dilatedMask, paddedSize);
  const cutPathD = loopsToPathD(cutLoops, scale);

  const bbox = maskBBox(dilatedMask, paddedSize) || {minX:0,minY:0,maxX:paddedSize-1,maxY:paddedSize-1};
  const marginPx = 3;
  const x0 = Math.max(0, bbox.minX - marginPx);
  const y0 = Math.max(0, bbox.minY - marginPx);
  const x1 = Math.min(paddedSize, bbox.maxX + marginPx);
  const y1 = Math.min(paddedSize, bbox.maxY + marginPx);
  const widthMm = (x1 - x0) * scale;
  const heightMm = (y1 - y0) * scale;
  const dxMm = -x0 * scale;
  const dyMm = -y0 * scale;

  return {
    paddedMask, paddedSize, dilatedMask,
    motifLoops, motifPathD, cutLoops, cutPathD,
    widthMm, heightMm, dxMm, dyMm
  };
}

// ---- Ab hier nur für den Pflichtweg Negativ-Stempel ----

// Schwarz-Weiß: dunkle Pixel innerhalb der Person = Motiv (1). Ohne Personenmaske: ganzes Bild.
function stampMask(gray, personMask, threshold){
  let mask = new Uint8Array(WORK_SIZE*WORK_SIZE);
  for(let i=0;i<gray.length;i++){
    const dark = gray[i] < threshold ? 1 : 0;
    mask[i] = personMask ? (dark & personMask[i]) : dark;
  }
  return despeckle(mask, WORK_SIZE, DESPECKLE_PASSES);
}

// Negativ-Stempel wie buildLaserSvg(variant, 'positive') in stencil.html mit
// Vektor, Spiegeln und konturfolgendem Schnittrand: Blau = alles innerhalb des
// roten Rands außer dem Motiv wird graviert, das Motiv bleibt stehen und druckt.
// cutLoops > 1 heißt: Der rote Rand zerfällt in mehrere Teile (Stempel fällt auseinander).
function buildStampSvg(mask, offsetMm){
  const scale = STEMPEL_MM / WORK_SIZE;
  const off = computeOffsetCutPath(mask, WORK_SIZE, scale, offsetMm);
  const w = off.widthMm.toFixed(3), h = off.heightMm.toFixed(3);
  const engraveLayer = `<clipPath id="cutClip"><path d="${off.cutPathD}" clip-rule="evenodd"/></clipPath>` +
    `<path d="${off.cutPathD} ${off.motifPathD}" fill="${ENGRAVE_COLOR}" fill-rule="evenodd" stroke="none" clip-path="url(#cutClip)"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}mm" height="${h}mm">` +
    `<g transform="translate(${w},0) scale(-1,1)">` +
    `<g transform="translate(${off.dxMm.toFixed(3)},${off.dyMm.toFixed(3)})">` +
    engraveLayer +
    `<path d="${off.cutPathD}" fill="none" stroke="${CUT_COLOR}" stroke-width="0.15" stroke-linejoin="round"/>` +
    `</g></g></svg>`;
  return { svg: svg, cutLoops: off.cutLoops.length, widthMm: off.widthMm, heightMm: off.heightMm };
}

// Kleinster Schnittrand (ganze mm), bei dem der rote Rand in einem Stück außen herumläuft
const OFFSET_MIN = 2, OFFSET_MAX = 15, OFFSET_START = 4;
function autoOffset(mask){
  for(let mm = OFFSET_START; mm <= OFFSET_MAX; mm++){
    const scale = STEMPEL_MM / WORK_SIZE;
    if(computeOffsetCutPath(mask, WORK_SIZE, scale, mm).cutLoops.length <= 1) return mm;
  }
  return OFFSET_MAX;
}

// ---- Zwischenbilder für die Anzeige ----
function canvasFromPixels(fill){
  const c = document.createElement('canvas');
  c.width = WORK_SIZE; c.height = WORK_SIZE;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(WORK_SIZE, WORK_SIZE);
  for(let p=0, i=0; p<WORK_SIZE*WORK_SIZE; p++, i+=4){
    const rgb = fill(p);
    img.data[i] = rgb[0]; img.data[i+1] = rgb[1]; img.data[i+2] = rgb[2]; img.data[i+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function squareCanvas(img){
  const c = document.createElement('canvas');
  c.width = WORK_SIZE; c.height = WORK_SIZE;
  const side = Math.min(img.width, img.height);
  c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, WORK_SIZE, WORK_SIZE);
  return c;
}

const grayCanvas = gray => canvasFromPixels(p => { const g = gray[p]; return [g, g, g]; });
// Person in Pink, Hintergrund blass: so sieht man, was die KI erkannt hat
const personCanvas = (gray, personMask) => canvasFromPixels(p => {
  const g = gray[p];
  return personMask && personMask[p] ? [255, 45 + g * 0.3, 149 + g * 0.3] : [220 + g * 0.1, 220 + g * 0.1, 220 + g * 0.1];
});
const maskCanvas = mask => canvasFromPixels(p => mask[p] ? [17, 17, 17] : [255, 255, 255]);

// Alle Schritte für ein Foto (img: Bild oder Canvas, segmentation: BodyPix-Ergebnis oder null)
function berechnen(img, segmentation){
  let personMask = segmentation ? personMaskFromSegmentation(segmentation) : null;
  let personAnteil = 0;
  if(personMask){
    personAnteil = personMask.reduce((a, b) => a + b, 0) / personMask.length;
    // Leere Maske würde einen leeren Stempel ergeben -> ganzes Bild verwenden (wie stencil.html)
    if(personAnteil < MIN_PERSON_COVERAGE) personMask = null;
  }
  const gray = toSquareGrayscale(img, 100);
  const schwelle = otsuThreshold(gray, personMask);
  const mask = stampMask(gray, personMask, schwelle);
  return { gray: gray, personMask: personMask, personAnteil: personAnteil, schwelle: schwelle, mask: mask, duenn: detectThinStructures(mask, WORK_SIZE) };
}

window.Stempel = {
  WORK_SIZE: WORK_SIZE,
  OFFSET_MIN: OFFSET_MIN,
  OFFSET_MAX: OFFSET_MAX,
  berechnen: berechnen,
  svg: buildStampSvg,
  autoOffset: autoOffset,
  bilder: {
    roh: squareCanvas,
    grau: grayCanvas,
    person: personCanvas,
    maske: maskCanvas
  }
};
})();
