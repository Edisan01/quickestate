// Teilflächen eines Grundstücks aus dem Widmungsplan messen (Eduard 28.10.2026, Am Spitz 5: „wenn der Rechner eine Fläche misst, muss er sie
// auch so darstellen können“). Eingabe: Raster des Planbilds um das Grundstück – je Pixel die Nummer der roten-Linien-Fläche (0 = Linie/Schrift)
// und ob das Pixel im Grundstück liegt. Ablauf:
//  1. Linien- und Schriftpixel im Grundstück der nächstgelegenen Fläche zuteilen (Breitensuche) → die Teile decken das Grundstück zu 100 %.
//     Ohne das fehlen ~35 % (Am Spitz: 869 + 445 statt 1.361 + 733 m²).
//  2. Je Teil der Umriss (Kanten zwischen innen/außen verketten, Douglas-Peucker vereinfacht) – beliebig viele Ecken (L, U, Trapez).
// Reine Rechnung ohne Browser: testbar mit tests/formeln/planflaechen.test.js.

// lab: Int32Array (W*H) Flächennummer ≥ 1 oder 0; ins: Uint8Array (W*H) 1 = im Grundstück; behalten(nr) → true: Fläche bleibt eigener Teil
export function flaechenFuellen(W, H, lab, ins, behalten = () => true) {
  const L = new Int32Array(W * H), q = new Int32Array(W * H); let a = 0, e = 0;
  for (let i = 0; i < W * H; i++) if (ins[i] && lab[i] > 0 && behalten(lab[i])) { L[i] = lab[i]; q[e++] = i; }
  while (a < e) { const p = q[a++], x = p % W, v = L[p];
    for (const n of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) { if (n < 0 || n >= W * H || !ins[n] || L[n]) continue; L[n] = v; q[e++] = n; } }
  const zahl = {}; for (let i = 0; i < W * H; i++) if (L[i]) zahl[L[i]] = (zahl[L[i]] || 0) + 1;
  return { L, zahl };
}

// Umriss einer Fläche (größter Ring) in Pixelkoordinaten, vereinfacht mit Toleranz tol (Pixel)
export function umriss(W, H, L, nr, tol = 2) {
  const nb = new Map(), key = (x, y) => y * (W + 1) + x, add = (x1, y1, x2, y2) => { const k = key(x1, y1); (nb.get(k) || nb.set(k, []).get(k)).push([x2, y2]); };
  const in_ = (x, y) => x >= 0 && y >= 0 && x < W && y < H && L[y * W + x] === nr;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (!in_(x, y)) continue;   // Kanten so, dass die Fläche links liegt (Uhrzeigersinn im Bild)
    if (!in_(x, y - 1)) add(x, y, x + 1, y); if (!in_(x + 1, y)) add(x + 1, y, x + 1, y + 1); if (!in_(x, y + 1)) add(x + 1, y + 1, x, y + 1); if (!in_(x - 1, y)) add(x, y + 1, x, y); }
  const ringe = [];
  for (const [k0, l0] of nb) while (l0.length) { const st = [k0 % (W + 1), Math.floor(k0 / (W + 1))], r = [st]; let [cx, cy] = l0.pop();
    for (let g = 0; g < 4 * W * H && !(cx === st[0] && cy === st[1]); g++) { r.push([cx, cy]); const l = nb.get(key(cx, cy)); if (!l?.length) break; [cx, cy] = l.pop(); }
    if (r.length > 3) ringe.push(r); }
  if (!ringe.length) return [];
  const fl = r => { let s = 0; for (let i = 0; i < r.length; i++) { const [a, b] = r[i], [c, d] = r[(i + 1) % r.length]; s += a * d - c * b; } return Math.abs(s) / 2; };
  const R = ringe.sort((a, b) => fl(b) - fl(a))[0];
  return vereinfachen(R, tol);
}

// Douglas-Peucker für einen geschlossenen Ring (Start = am weitesten vom Schwerpunkt entfernte Ecke)
export function vereinfachen(R, tol) {
  if (R.length < 4) return R;
  const cx = R.reduce((s, p) => s + p[0], 0) / R.length, cy = R.reduce((s, p) => s + p[1], 0) / R.length;
  let i0 = 0, d0 = -1; R.forEach((p, i) => { const d = (p[0] - cx) ** 2 + (p[1] - cy) ** 2; if (d > d0) { d0 = d; i0 = i; } });
  const P = [...R.slice(i0), ...R.slice(0, i0), R[i0]];
  const dp = (a, b) => { let m = -1, mi = -1; const [x1, y1] = P[a], [x2, y2] = P[b], L2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    for (let i = a + 1; i < b; i++) { const [x, y] = P[i], t = L2 ? Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / L2)) : 0, d = Math.hypot(x - x1 - t * (x2 - x1), y - y1 - t * (y2 - y1)); if (d > m) { m = d; mi = i; } }
    return m > tol ? [...dp(a, mi).slice(0, -1), ...dp(mi, b)] : [P[a], P[b]]; };
  const far = P.reduce((bi, p, i) => (p[0] - P[0][0]) ** 2 + (p[1] - P[0][1]) ** 2 > (P[bi][0] - P[0][0]) ** 2 + (P[bi][1] - P[0][1]) ** 2 ? i : bi, 0);
  return [...dp(0, far).slice(0, -1), ...dp(far, P.length - 1).slice(0, -1)];
}

// Polygon-Fläche und Seitenlängen in Metern (Punkte in m)
export const polyFlaeche = P => { let s = 0; for (let i = 0; i < P.length; i++) { const [a, b] = P[i], [c, d] = P[(i + 1) % P.length]; s += a * d - c * b; } return Math.abs(s) / 2; };
export const polySeiten = P => P.map((p, i) => { const q = P[(i + 1) % P.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]); });

// Gegenprüfung (Eduard 28.10.): Summe der Teile = Grundstück laut Kataster (±2 %), sonst „prüfen“
export function summenPruefung(teile, kataster, tol = 0.02) {
  const s = teile.reduce((a, t) => a + (+t.m2 || 0), 0), abw = kataster > 0 ? s / kataster - 1 : null;
  return { summe: Math.round(s * 10) / 10, kataster, abw, ok: abw != null && Math.abs(abw) <= tol };
}

// Bauteile (Eduard 28.10.): aneinandergrenzende Flächen mit gleichen Bestimmungen (Widmung, Bauklasse, Höhe, Bauweise) sind EIN Bauteil –
// Straßentrakt + Flügel GB IV g = eine L-Form. schluessel(nr) → gleicher Text = zusammenlegen; null = nie zusammenlegen.
// Liefert neues Raster, Flächen je Bauteil und die Nachbarschaften verschiedener Bauteile (für die Prüfung „höhere Bauklasse grenzt an niedrigere“).
export function zusammenlegen(W, H, L, schluessel) {
  const vater = new Map(), f = a => { while (vater.get(a) !== a) { vater.set(a, vater.get(vater.get(a))); a = vater.get(a); } return a; };
  const nachbar = new Set();
  for (let i = 0; i < W * H; i++) if (L[i] && !vater.has(L[i])) vater.set(L[i], L[i]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const a = L[y * W + x]; if (!a) continue;
    for (const b of [x < W - 1 ? L[y * W + x + 1] : 0, y < H - 1 ? L[(y + 1) * W + x] : 0]) { if (!b || b === a) continue;
      const ka = schluessel(a), kb = schluessel(b); if (ka != null && ka === kb) { const ra = f(a), rb = f(b); if (ra !== rb) vater.set(rb, ra); } else nachbar.add(a < b ? a + '|' + b : b + '|' + a); } }
  const N = new Int32Array(W * H), zahl = {}, gruppen = {};
  for (let i = 0; i < W * H; i++) if (L[i]) { const r = f(L[i]); N[i] = r; zahl[r] = (zahl[r] || 0) + 1; }
  for (const k of vater.keys()) (gruppen[f(k)] ||= []).push(k);
  const grenzen = [...new Set([...nachbar].map(s => s.split('|').map(Number).map(f).sort((a, b) => a - b).join('|')))].filter(s => { const [a, b] = s.split('|'); return a !== b; }).map(s => s.split('|').map(Number));
  return { L: N, zahl, gruppen, grenzen };
}

// Für Anzeige und Skizze (Eduard 28.10.): Ecken, die kaum abknicken (< grad), entfernen – Schrift auf einer Linie macht sonst kleine Zacken.
// Die Fläche bleibt die gezählte (genau), der Umriss zeigt die Form wie im Plan (Am Spitz 5: L mit 6 Ecken, Hof Rechteck).
export function begradigen(P, grad = 15, minSeite = 0) {
  let Q = [...P], geaendert = true;
  while (geaendert && Q.length > 3) { geaendert = false;
    for (let i = 0; i < Q.length && Q.length > 3; i++) { const a = Q[(i - 1 + Q.length) % Q.length], b = Q[i], c = Q[(i + 1) % Q.length];
      const w1 = Math.atan2(b[1] - a[1], b[0] - a[0]), w2 = Math.atan2(c[1] - b[1], c[0] - b[0]); let d = Math.abs(w2 - w1) * 180 / Math.PI; if (d > 180) d = 360 - d;
      const kurz = minSeite > 0 && (Math.hypot(b[0] - a[0], b[1] - a[1]) < minSeite || Math.hypot(c[0] - b[0], c[1] - b[1]) < minSeite) && d < 60;
      if (d < grad || kurz) { Q.splice(i, 1); geaendert = true; i--; } } }
  return Q;
}
