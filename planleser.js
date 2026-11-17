/* Zonen-Leser für das Planbild (aus Rechner v204 übernommen: planTeil + bbBildLesen, Eduard 26.–28.10.2026, Am Spitz 5 nachgemessen).
   Zerlegt das Grundstück entlang der roten Linien in Flächen, liest die rote Schrift (Tesseract, selbst gehostet unter /vendor/tess, Apache-2.0)
   in den Richtungen der Grundstücksseiten und ordnet jede Beschriftung ihrer Fläche zu → je Teil Widmung, Bauklasse, Höhe, Bauweise; dazu BB, %, Höhen.
   Reines Rechnen im Browser, keine KI. */
import { flaechenFuellen, umriss, zusammenlegen, begradigen, polySeiten, vereinfachen, polyFlaeche } from './planflaechen.js?v=1';
const BR = { flaechenFuellen, umriss, zusammenlegen, begradigen, polySeiten, vereinfachen, polyFlaeche };
const PLAN_Z = 19;
let planKachel = null, PL_W = null;
const TESS_OPT = { workerPath: '/vendor/tess/worker.min.js', corePath: '/vendor/tess', langPath: '/vendor/tess', workerBlobURL: false };
const ladeTess = () => window.Tesseract ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement('script'); s.src = '/vendor/tess/tesseract.min.js'; s.onload = ok; s.onerror = () => no(new Error('Texterkennung nicht ladbar')); document.head.append(s); });
const planOcr = async c => { await ladeTess(); PL_W ||= window.Tesseract.createWorker('deu', 1, TESS_OPT).then(async w => { await w.setParameters({ tessedit_pageseg_mode: '11' }); return w; }); return (await (await PL_W).recognize(c)).data.words; };
function planTeil(T){ const r = {}, bwN = {};
 for (const x of T || []) { const w = String(x.t).replace(/^GB[a@6]v$/i, 'GBGV').replace(/^GBGv/i, 'GBGV').replace(/[|\]]/g, 'I').replace(/^[(\[]|[)\].,:]$/g, '');
  const m = w.match(/^(GBGV|WGV|GB|GS|W|G|E)?(VI|IV|V|III|II|I)?(?:(\d{1,2})[.,]?(\d)?m)?(gk|g|o)?$/); if (!m || !m[0]) continue;
  if (m[1] && !r.widm && x.c >= 50) r.widm = m[1].replace(/^GBGV$/, 'GB GV').replace(/^WGV$/, 'W GV');
  if (m[2] && !r.bk && x.c >= 60 && (m[1] || w.length > 1 || x.c >= 80)) r.bk = m[2];
  if (m[3] && !r.h) { const h = m[4] != null ? +(m[3] + '.' + m[4]) : +m[3] >= 10 && +m[3] < 100 && +m[3] % 10 ? +m[3] / 10 : null; if (h >= 2.5 && h <= 40 && (m[4] != null || /m$/.test(w))) r.h = h; }
  if (m[5] && x.c >= 60) bwN[m[5]] = (bwN[m[5]] || 0) + 1; }
 const bw = Object.entries(bwN).sort((a, b) => b[1] - a[1])[0]?.[0]; if (bw && (r.widm || r.bk)) r.bw = bw; return r; }
async function bbBildLesen(ringe, rand = 40){
 const n = 2 ** PLAN_Z * 256, P = ([lo, la]) => { const r = la * Math.PI / 180; return [(lo + 180) / 360 * n, (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n]; };
 const Q = ringe.map(r => r.map(P)), A = Q.flat(), mpp = 156543.03 * Math.cos(ringe[0][0][1] * Math.PI / 180) / 2 ** PLAN_Z, m = rand / mpp;
 const x0 = Math.floor(Math.min(...A.map(p => p[0])) - m), y0 = Math.floor(Math.min(...A.map(p => p[1])) - m), W = Math.ceil(Math.max(...A.map(p => p[0])) + m) - x0, H = Math.ceil(Math.max(...A.map(p => p[1])) + m) - y0;
 const rot = new Uint8Array(W * H), txt = new Uint8Array(W * H);   /* rot = Linien (weich), txt = Schrift (kräftiges Rot, sonst liest die Texterkennung „BB“ nicht) */
 for (let ty = Math.floor(y0 / 256); ty <= Math.floor((y0 + H - 1) / 256); ty++) for (let tx = Math.floor(x0 / 256); tx <= Math.floor((x0 + W - 1) / 256); tx++) { const d = await planKachel(tx, ty);
  for (let j = 0; j < 256; j++) { const py = ty * 256 + j - y0; if (py < 0 || py >= H) continue; for (let i = 0; i < 256; i++) { const px = tx * 256 + i - x0; if (px < 0 || px >= W) continue; const k = (j * 256 + i) * 4, r = d[k]; if (r > 140 && r - d[k + 1] > 50 && r - d[k + 2] > 50) rot[py * W + px] = 1; if (r > 170 && d[k + 1] < 120 && d[k + 2] < 120) txt[py * W + px] = 1; } } }
 /* Linien schließen: Strichlücken der Baufluchtlinien (~1,1 m) → rot um 4 px verdicken */
 const rd = 4, dick = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rot[y * W + x]) for (let dy = -rd; dy <= rd; dy++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dy * dy > rd * rd) continue; const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) dick[Y * W + X] = 1; }
 const innen = (x, y) => Q.some(q => { let ins = false; for (let i = 0, j = q.length - 1; i < q.length; j = i++) if ((q[i][1] > y) !== (q[j][1] > y) && x < (q[j][0] - q[i][0]) * (y - q[i][1]) / (q[j][1] - q[i][1]) + q[i][0]) ins = !ins; return ins; });
 const reg = new Int32Array(W * H), fl = []; let nr = 0;
 for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) { const i = y * W + x; if (dick[i] || reg[i] || !innen(x + x0 + 0.5, y + y0 + 0.5)) continue; nr++; const st = [i]; let cnt = 0; reg[i] = nr;
  while (st.length) { const p = st.pop(); cnt++; const px = p % W; for (const q of [px > 0 ? p - 1 : -1, px < W - 1 ? p + 1 : -1, p - W, p + W]) { if (q < 0 || q >= W * H || reg[q] || dick[q]) continue; reg[q] = nr; st.push(q); } } fl.push({ nr, m2: cnt * mpp * mpp, imGst: 0, t: [] }); }
 let gst = 0; for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (innen(x + x0 + 0.5, y + y0 + 0.5)) { gst++; const f = fl[reg[y * W + x] - 1]; if (f) f.imGst += 4 * mpp * mpp; }
 gst *= 4 * mpp * mpp;
 if (window.__qeDebug) { const dc = document.createElement('canvas'); dc.width = W; dc.height = H; const dx = dc.getContext('2d'), di = dx.createImageData(W, H), farb = k => [(k * 97) % 255, (k * 57 + 80) % 255, (k * 151 + 40) % 255];
   for (let i = 0; i < W * H; i++) { const x = i % W, y = (i / W) | 0, k = reg[i], c = dick[i] ? [200, 0, 0] : k ? farb(k) : [255, 255, 255], inn = innen(x + x0 + 0.5, y + y0 + 0.5); di.data[i * 4] = c[0]; di.data[i * 4 + 1] = c[1]; di.data[i * 4 + 2] = c[2]; di.data[i * 4 + 3] = inn ? 255 : 90; }
   dx.putImageData(di, 0, 0); dc.id = 'qeDbg'; dc.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99999;width:' + Math.min(700, W * 2) + 'px;border:2px solid #000;background:#fff;image-rendering:pixelated'; document.getElementById('qeDbg')?.remove(); document.body.append(dc); window.__qeDbgInfo = { W, H, regionen: nr, flaechen: fl.map(f => Math.round(f.imGst)) }; }
 const c = document.createElement('canvas'); c.width = W; c.height = H; const cx = c.getContext('2d'), id = cx.createImageData(W, H); for (let i = 0; i < W * H; i++) { const v = txt[i] ? 0 : 255; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; } cx.putImageData(id, 0, 0);
 /* Schrift läuft parallel zu Straßen und Fluchtlinien: waagrecht + die längsten Grundstücksseiten, je beide Leserichtungen */
 const WALL = [], R = []; for (const q of Q) for (let i = 0; i + 1 < q.length; i++) { const dx = q[i + 1][0] - q[i][0], dy = q[i + 1][1] - q[i][1], l = Math.hypot(dx, dy) * mpp; if (l > 4) R.push([((Math.atan2(dy, dx) * 180 / Math.PI) % 180 + 180) % 180, l]); }
 const dirs = [0]; for (const [a] of R.sort((x, y) => y[1] - x[1])) if (dirs.every(b => Math.min(Math.abs(a - b), 180 - Math.abs(a - b)) > 12)) dirs.push(a);
 const winkel = [...new Set(dirs.slice(0, 3).flatMap(a => [-a, 180 - a]).map(a => Math.round(((a % 360) + 360) % 360)))].map(w => [w, 2]);
 winkel.push(...winkel.slice(dirs.length > 1 ? 2 : 0, dirs.length > 1 ? 4 : 2).map(([w]) => [w, 3]));   /* Eduard 28.10. (Am Spitz 5): kleine Höhenzahl „4,5m“ – entlang der längsten Seite nochmal größer lesen */
 for (const [w, sk] of winkel) { const D = Math.ceil(Math.hypot(W, H)) * sk, r2 = document.createElement('canvas'); r2.width = r2.height = D; const g = r2.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, D, D); g.translate(D / 2, D / 2); g.rotate(w * Math.PI / 180); g.drawImage(c, -W * sk / 2, -H * sk / 2, W * sk, H * sk);
  for (const t of await planOcr(r2) || []) { if (!(t.confidence >= 45) || !/[A-Za-z0-9%]/.test(t.text || '')) continue; const cxp = (t.bbox.x0 + t.bbox.x1) / 2 - D / 2, cyp = (t.bbox.y0 + t.bbox.y1) / 2 - D / 2, a = -w * Math.PI / 180, ox = (cxp * Math.cos(a) - cyp * Math.sin(a)) / sk + W / 2, oy = (cxp * Math.sin(a) + cyp * Math.cos(a)) / sk + H / 2;
   const z = {}; for (let r = 2; r <= 16; r += 2) for (let k = 0; k < 16; k++) { const X = Math.round(ox + r * Math.cos(k * Math.PI / 8)), Y = Math.round(oy + r * Math.sin(k * Math.PI / 8)); if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const v = reg[Y * W + X]; if (v) z[v] = (z[v] || 0) + 1; }   /* Schrift ist ein Loch in ihrer Fläche: Pixel rundherum entscheiden */
   const best = Object.entries(z).sort((p, q) => q[1] - p[1])[0]; if (best) fl[+best[0] - 1].t.push({ t: String(t.text).trim(), c: t.confidence }); WALL.push({ t: String(t.text).trim(), c: t.confidence }); } }
 const im = fl.filter(f => f.imGst >= Math.min(10, gst * 0.03)), alle = im.flatMap(f => f.t);
 /* Eduard 28.10. (Am Spitz 5, nachgemessen 1.361 + 733 m²): Linien- und Schriftpixel der nächsten Fläche zuteilen → Teile decken das Grundstück ganz ab; je Teil der echte Umriss */
 const ins = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (innen(x + x0 + 0.5, y + y0 + 0.5)) ins[y * W + x] = 1;
 const info = {}; for (const f of fl) { const pt = planTeil(f.t); info[f.nr] = { pt, text: !!(pt.widm || pt.bk || pt.h), gross: f.imGst >= gst * 0.15 }; }
 const { L: LF } = BR.flaechenFuellen(W, H, reg, ins, nr => info[nr] && (info[nr].text || info[nr].gross));
 /* gleiche Bestimmungen nebeneinander = ein Bauteil (Straßentrakt + Flügel GB IV g = L-Form), verschiedene bleiben getrennt */
 const key = nr => { const q = info[nr]; if (!q?.text) return null; const t = q.pt; return [t.widm || '', t.bk || '', t.h || '', t.bw || ''].join('|'); };
 const { L: LL, zahl, gruppen, grenzen } = BR.zusammenlegen(W, H, LF, key);
 for (const [r, g] of Object.entries(gruppen)) { const tx = g.map(nr => info[nr]).find(q => q?.text); if (tx && !info[r]?.text) info[r] = tx; }
 const ll = ([px, py]) => { const X = px + x0, Y = py + y0; return [X / n * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * Y / n))) * 180 / Math.PI]; };
 const teile = Object.entries(zahl).map(([nr, z]) => { const P = BR.begradigen(BR.umriss(W, H, LL, +nr, 3 / mpp), 20, 7 / mpp);   /* Form wie im Plan: Zacken von Schrift auf Linien weg (Am Spitz: L 6 Ecken, Hof 4) – Fläche bleibt die gezählte */ return { nr: +nr, nachbarn: grenzen.filter(g => g.includes(+nr)).map(g => g[0] === +nr ? g[1] : g[0]), m2: Math.round(z * mpp * mpp), ...info[nr].pt, ...(info[nr].text ? {} : { ohneSchrift: true }), poly: P.map(ll), seiten: BR.polySeiten(P).map(d => Math.round(d * mpp * 10) / 10) }; }).filter(t => t.m2 >= 10).sort((a, b) => b.m2 - a.m2);   /* Eduard 28.10. (Am Spitz 5): jede Fläche mit eigener Widmung, Bauklasse, Höhe, Bauweise */
 const istBB = x => x.c >= 70 && /^[[(|]?B\s?B\s?\d{0,2}[\])|.,:]?$/.test(x.t);
 return { gst: Math.round(gst), bb: Math.round(im.filter(f => f.t.some(istBB)).reduce((s, f) => s + f.imGst, 0)), prozent: alle.filter(x => x.c >= 70 && /^\d{1,3}\s?%$/.test(x.t)).map(x => x.t), hoehen: [...new Set(alle.filter(x => x.c >= 60).map(x => (String(x.t).match(/(?:^|[^\d,.])(\d{1,2})[,.](\d{1,2})\s?(?:m|rn)/i) || []).slice(1)).filter(m => m.length).map(m => +(m[0] + '.' + m[1])).filter(v => v >= 2.5 && v <= 40))], hoehenOhne: [...new Set(alle.filter(x => x.c >= 45).map(x => (String(x.t).match(/(?:^|[^\d,.])(\d{2,3})\s?(?:m|rn)(?![a-np-z])/i) || [])[1]).filter(Boolean))],   /* echte Kachel Sommerschuhgasse 3: senkrecht gelesen „65m“ (Komma verloren) */ buchst: [...new Set(alle.filter(x => x.c >= 85 && /^[A-Z]$/.test(x.t)).map(x => x.t))], teile, wAll: WALL.filter(x => x.c >= 50).map(x => x.t).slice(0, 400), ak: WALL.some(x => x.c >= 50 && /^(A[kK]\.?|[oöÖ0][DO][gq9]\.?|A[kK][oöÖ0]?D[gq9])$/.test(String(x.t).trim())), bw: (() => { const b = [...new Set(teile.filter(t => t.bw && t.widm).map(t => t.bw))]; return b.length === 1 ? b[0] : null; })(), belege: alle.filter(x => x.c >= 80).length, flaechen: im.map(f => ({ m2: Math.round(f.imGst), bb: f.t.some(istBB), w: f.t.filter(x => x.c >= 45).map(x => x.t) })) }; }

export async function zonenLesen(ringe, kachel, rand) { planKachel = kachel; return bbBildLesen(ringe, rand); }
export { planTeil };
