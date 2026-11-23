# Phase 3+4 für die Prüfadressen: Planausschnitt (+40 m) → Inventar → Pfeilpaare mit Zahl → Zuordnung zum Grundstück.
# Aufruf: python3 phase4.py <planbild-ordner> [--overlay <ordner>]   → planleser/masse.json
# Zuordnung (nur was am eigenen Grundstück steht – Planzahl gilt nur dort, wo ihre Pfeile stehen):
#   Straßenbreite = Paar voll–voll, Mitte außerhalb des Grundstücks vor der Front, Achse quer zur Front (± 15°), Fußpunkt innerhalb der Frontlänge (+ 2 m)
#   Trakttiefe    = Paar strich–voll, Mitte im Grundstück, Achse quer zur Front (± 15°)
import sys, os, json, glob, math, cv2, numpy as np
H = os.path.dirname(os.path.abspath(__file__)); R = os.path.abspath(os.path.join(H, '..', '..')); sys.path.insert(0, H)
import kat, zonen as Z, inventar as I, masse as M
from shapely.geometry import Polygon, Point
RAND = int(40 / I.MPX)
def lauf(pb, ov=None):
    erg = json.load(open(os.path.join(R, 'planleser', 'ergebnis.json'))); out = {}
    for f in sorted(glob.glob(os.path.join(pb, '*.json'))):
        m = json.load(open(f)); k = os.path.basename(f)[:-5]; im = cv2.imread(f[:-5] + '.png')[:, :, ::-1]
        rings = [np.array([kat.px(m, *q) for q in pg[0]]) for g in m['gnr'].split('+') for p in kat.finde(*m['punkt'], m['kg'], g) for pg in p['polys']]
        Pp = np.vstack(rings); x0, y0 = np.maximum(0, Pp.min(0) - RAND).astype(int); x1, y1 = (Pp.max(0) + RAND).astype(int)
        crop = im[y0:y1, x0:x1].copy(); rr = [r - [x0, y0] for r in rings]
        T, _, _ = Z.tokens(crop, 0, rr); inv = I.inventar(crop, T); paare = M.paare(inv, crop)
        if ov: I.overlay(crop, inv, os.path.join(ov, k + '.png'), rr[0])
        gs = Polygon(rr[0]).buffer(0)
        for r in rr[1:]: gs = gs.union(Polygon(r).buffer(0))
        e = erg.get(k) or erg.get(k.replace('-', '/')) or {}; fr = e.get('front')
        res = dict(name=m['name'], strassenbreite=[], trakttiefe=[], andere=[])
        if fr:
            a = np.array(kat.px(m, *fr[0])) - [x0, y0]; b = np.array(kat.px(m, *fr[1])) - [x0, y0]; FL = np.hypot(*(b - a)); fu = (b - a) / FL
            for p in paare:
                if not p['ok']: continue
                ax = np.array(p['b']) - np.array(p['a']); ax = ax / np.hypot(*ax)
                quer = abs(ax @ fu) < math.sin(math.radians(15))
                mid = np.array(p['mitte']); t = (mid - a) @ fu
                im_gs = gs.buffer(2 / I.MPX).contains(Point(*mid)); an_front = -2 / I.MPX <= t <= FL + 2 / I.MPX
                eintrag = dict(v=p['v'], gem=p['gem'], arten=p['arten'], mitte=[round(mid[0] + x0, 1), round(mid[1] + y0, 1)])
                # Übertragung: steht das Paar beim Nachbarn, gilt die Zahl hier nur, wenn dieselben zwei Linien auch vor/auf der eigenen Front
                # durchlaufen und dort gemessen dieselbe Zahl ergeben (± 0,6 m) – sonst verworfen (Tigergasse: Baulinie springt vor)
                hier = None
                if quer and not (an_front and (im_gs or p['arten'] == ['voll', 'voll'])):
                    fm = (a + b) / 2; la, lb = inv['linien'][p['linien'][0]], inv['linien'][p['linien'][1]]
                    sa, sb = M._schnitt(fm, ax, la), M._schnitt(fm, ax, lb)
                    if sa is not None and sb is not None and abs(abs(sa - sb) * I.MPX - p['v']) <= M.TOL: hier = round(abs(sa - sb) * I.MPX, 2)
                if hier is not None: eintrag.update(gem_hier=hier, uebertragen=True)
                if quer and (an_front or hier is not None) and p['arten'] == ['voll', 'voll'] and not gs.contains(Point(*mid)): res['strassenbreite'].append(eintrag)
                elif quer and (im_gs or hier is not None) and p['arten'] == ['strich', 'voll']: res['trakttiefe'].append(eintrag)
                else: res['andere'].append(dict(eintrag, grund=f"quer={quer} Front-Lage={t * I.MPX:.1f}/{FL * I.MPX:.1f} m im_Grundstück={im_gs}"))
        else: res['grund'] = 'keine Straßenkante vom Leser'
        out[k] = res
        print(m['name'][:22], 'SB', [x['v'] for x in res['strassenbreite']], 'TT', [x['v'] for x in res['trakttiefe']], 'andere', [(x['v'], x['grund']) for x in res['andere']], flush=True)
    json.dump(out, open(os.path.join(R, 'planleser', 'masse.json'), 'w'), ensure_ascii=False, indent=1, default=float)
if __name__ == '__main__':
    lauf(sys.argv[1], sys.argv[sys.argv.index('--overlay') + 1] if '--overlay' in sys.argv else None)
