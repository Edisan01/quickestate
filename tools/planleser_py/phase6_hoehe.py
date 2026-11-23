"""Phase 6 / P1: Höhe in m je Planbereich (Eduard 23.11., Linzer Straße 22). Stadt-Daten liefern sie nie.
Je Netz-Teilfläche: Planbeschriftungen in der Teilfläche (+3 m); fehlt dort die Widmung (P3), entlang des Streifens: Korridor = Tiefenband der Teilfläche (quer zur Front, je 1 m eingerückt),
längs der Front bis 60 m beidseitig; nächste Widmungs-Beschriftung + Nachbartexte (≤ 6 m) gelten.
Verworfen (Test 23.11.): Stadt-Zone (W3 umfasst ganzen Block samt G) und Liniennetz-Flächen im großen Ausschnitt (Linien schließen nicht).
Ergebnis je Teil: hoehe (Zahl) · 'keine' (Beschriftung mit Widmung gefunden, aber ohne m-Angabe) · None (keine Beschriftung → offen, P3).
Aufruf: python3 phase6_hoehe.py <planbild-ordner>  → planleser/hoehen.json"""
import sys, os, re, json, glob, cv2, numpy as np
H = os.path.dirname(os.path.abspath(__file__)); R = os.path.abspath(os.path.join(H, '..', '..')); sys.path.insert(0, H)
import kat, zonen as Z, inventar as I
from shapely.geometry import Polygon, Point, LineString, box
from shapely.ops import unary_union, polygonize
RAND_M = 3

def lauf(pb):
    tf = json.load(open(os.path.join(R, 'planleser', 'teilflaechen.json'))); out = {}
    for f in sorted(glob.glob(os.path.join(pb, '*.json'))):
        k = os.path.basename(f)[:-5]
        if k not in tf: continue
        m = json.load(open(f)); rgb = cv2.imread(f[:-5] + '.png')[:, :, ::-1]
        lonlat = [pg for g in m['gnr'].split('+') for p in kat.finde(*m['punkt'], m['kg'], g) for pg in p['polys']]
        P = np.vstack([np.array([kat.px(m, *q) for q in pg[0]]) for pg in lonlat]); x0, y0 = np.maximum(0, P.min(0) - 150).astype(int); x1, y1 = (P.max(0) + 150).astype(int)
        T, _, _ = Z.tokens(rgb[y0:y1, x0:x1].copy(), 0, [P - [x0, y0]])
        bx0, by0 = np.maximum(0, P.min(0) - 400).astype(int); bx1, by1 = np.minimum(rgb.shape[1::-1], P.max(0) + 400).astype(int)
        gross = None  # (Tokens, Planbereiche) im großen Ausschnitt, nur bei Bedarf (P3)
        teile = tf[k].get('abschnitte') or tf[k]['netz']; res = []
        for t in teile:
            g = Polygon([np.array(kat.px(m, *q)) - [x0, y0] for q in t['ring_ll']]).buffer(RAND_M / I.MPX)
            drin = [x for x in T if g.contains(Point(x['x'], x['y']))]
            a = Z.attrs(drin) if drin else {}
            bereich = None
            if not a.get('widmung'):
                if gross is None:
                    c = rgb[by0:by1, bx0:bx1].copy(); TG, _, _ = Z.tokens(c, 0, [P - [bx0, by0]]); gross = TG
                TG = gross
                e = json.load(open(os.path.join(R, 'planleser', 'ergebnis.json')))
                e = e.get(k) or e.get(k.replace('-', '/'))
                f0, f1 = [np.array(kat.px(m, *q)) - [bx0, by0] for q in e['front']]; u = (f1 - f0) / np.hypot(*(f1 - f0)); n = np.array([-u[1], u[0]])
                ring = np.array([np.array(kat.px(m, *q)) - [bx0, by0] for q in t['ring_ll']])
                su, sn = (ring - f0) @ u, (ring - f0) @ n; ein = 1 / I.MPX; weit = 60 / I.MPX
                kand = []
                for x in TG:
                    q = np.array([x['x'], x['y']]) - f0; qu, qn = q @ u, q @ n
                    if min(sn) + ein <= qn <= max(sn) - ein and min(su) - weit <= qu <= max(su) + weit and re.match(r'^(GBGV|GB|WGV|W|G)', x['t'].replace('[', 'I')) and x['h'] >= 15:  # F/FW = Rauschen
                        kand.append((0 if min(su) <= qu <= max(su) else min(abs(qu - min(su)), abs(qu - max(su))), x))
                if kand:
                    _, w = min(kand, key=lambda z: z[0])
                    drin = [x for x in TG if np.hypot(x['x'] - w['x'], x['y'] - w['y']) <= 6 / I.MPX]; a = Z.attrs(drin); bereich = 'streifen'
            h = None
            if a.get('hoehe'):
                try: h = float(a['hoehe'].replace(' m', '').replace(',', '.'))
                except ValueError: h = None
                if h is not None and not 2.5 <= h <= 40: h = None
            elif a.get('widmung') == 'G': h = 'trifft nicht zu'
            elif a.get('widmung'): h = 'keine'
            elif not a:  # keine Beschriftung gefunden: G aus dem bisherigen Leser (2. Quelle) → keine Höhe nötig, sonst offen (P3)
                e_ = json.load(open(os.path.join(R, 'planleser', 'ergebnis.json'))); e_ = e_.get(k) or e_.get(k.replace('-', '/'))
                if t['leser_teil'] is not None and e_['teile'][t['leser_teil']]['plan'].get('widmung') == 'G': h = 'trifft nicht zu'; bereich = 'G laut Leser'
            res.append(dict(leser_teil=t['leser_teil'], hoehe=h, bereich=bereich, texte=[x['t'] for x in drin], attrs={kk: v for kk, v in a.items() if kk in ('widmung', 'bauklasse', 'bauweise', 'hoehe')}))
        out[k] = res
        print(f"{tf[k]['name'][:22]:22} " + ' | '.join(f"L{r['leser_teil']} {r['hoehe']} {r['texte']}" for r in res))
    json.dump(out, open(os.path.join(R, 'planleser', 'hoehen.json'), 'w'), ensure_ascii=False)

if __name__ == '__main__': lauf(sys.argv[1])
