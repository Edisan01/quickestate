# Phase 5 (Schritt 6): Teilflächen = Kataster außen + sichtbare rote Planlinien innen (kataster_detail.py aus ChatGPT-Stand 10360f8),
# Nummerierung Front = 1, dann Uhrzeigersinn. Läuft auf den Planbildern der Prüfadressen.
# Aufruf: python3 phase5.py <planbild-ordner> [--overlay <ordner>]  → planleser/teilflaechen.json
import sys, os, json, glob, cv2, numpy as np
H = os.path.dirname(os.path.abspath(__file__)); R = os.path.abspath(os.path.join(H, '..', '..')); sys.path.insert(0, H)
import kat, inventar as I, zonen as Z, netz, math
from shapely.geometry import Polygon as SP, shape
from shapely.ops import transform as STR
from pyproj import Transformer
TM = Transformer.from_crs(4326, 31256, always_xy=True).transform
def ll(m, x, y):
    fx, fy = x / 256 + m['x0'], y / 256 + m['y0']; n = 2 ** 19
    return fx / n * 360 - 180, math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * fy / n))))
from kataster_detail import untersuchen, pixelrahmen
from nummerierung import nummerieren
def lauf(pb, ov=None):
    erg = json.load(open(os.path.join(R, 'planleser', 'ergebnis.json'))); out = {}
    for f in sorted(glob.glob(os.path.join(pb, '*.json'))):
        m = json.load(open(f)); k = os.path.basename(f)[:-5]; rgb = cv2.imread(f[:-5] + '.png')[:, :, ::-1]
        lonlat = [pg for g in m['gnr'].split('+') for p in kat.finde(*m['punkt'], m['kg'], g) for pg in p['polys']]
        polys_px = [[[kat.px(m, *q) for q in ring] for ring in pg] for pg in lonlat]
        basis = dict(zoom=19, x0=m['x0'] * 256, y0=m['y0'] * 256, grund=dict(polys=lonlat))
        r = untersuchen(rgb, polys_px, I.MPX, pixelrahmen(basis))
        e = erg.get(k) or erg.get(k.replace('-', '/')) or {}
        front = [kat.px(m, *q) for q in e['front']] if e.get('front') else None
        r = nummerieren(r, front)
        # Weg 2 (Hauptweg ab 23.11.): Liniennetz aus dem Inventar – erkennt Sprünge (Leitermayergasse)
        P = np.vstack([np.array(p[0]) for p in polys_px]); cx0, cy0 = np.maximum(0, P.min(0) - 200).astype(int); cx1, cy1 = (P.max(0) + 200).astype(int)
        crop = rgb[cy0:cy1, cx0:cx1].copy(); T, _, _ = Z.tokens(crop, 0, [np.array(polys_px[0][0]) - [cx0, cy0]]); inv = I.inventar(crop, T)
        _, nf = netz.teile(inv, polys_px, (cx0, cy0))
        nt = {'teilflaechen': [dict(ring_px=[(x + cx0, y + cy0) for x, y in f['poly'].exterior.coords], loecher_px=[], flaeche_m2=f['m2']) for f in nf]}
        nt = nummerieren(nt, front)
        for t in nt['teilflaechen']:
            ring_ll = [ll(m, x, y) for x, y in t['ring_px']]; t['ring_ll'] = [[round(a, 7), round(b, 7)] for a, b in ring_ll]
            t['m2'] = round(STR(TM, SP(ring_ll)).area, 2)
            # Zuordnung zum Teil des bisherigen Lesers (größte Überdeckung)
            best = None
            for j, et in enumerate(e.get('teile', [])):
                try: ueb = STR(TM, SP(ring_ll)).intersection(STR(TM, shape({'type': 'MultiPolygon' if isinstance(et['poly'][0][0][0], list) else 'Polygon', 'coordinates': et['poly']}).buffer(0))).area
                except Exception: ueb = 0
                if best is None or ueb > best[1]: best = (j, ueb)
            t['leser_teil'] = best[0] if best and best[1] > 0.3 * t['m2'] else None
        if ov:
            im = (rgb[:, :, ::-1] * 0.45 + 140).astype(np.uint8).copy(); P = np.vstack([np.array(p[0]) for p in polys_px]); x0, y0 = np.maximum(0, P.min(0) - 60).astype(int); x1, y1 = (P.max(0) + 60).astype(int)
            for t in r['teilflaechen']:
                ring = np.round(np.array(t['ring_px'])).astype(np.int32); cv2.polylines(im, [ring], True, (40, 40, 200), 2)
                c = ring.mean(0).astype(int); cv2.putText(im, str(t.get('nummer', '?')), tuple(c), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 0), 2)
            cv2.imwrite(os.path.join(ov, k + '_teile.png'), im[y0:y1, x0:x1])
        out[k] = dict(netz=[dict(nummer=t.get('nummer'), m2=t['m2'], leser_teil=t['leser_teil'], ring_ll=t['ring_ll']) for t in nt['teilflaechen']], netz_nummerierung=nt['nummerierung'].get('zustand'), name=m['name'], teile=[dict(nummer=t.get('nummer'), frontteil=t.get('frontteil'), flaeche_m2=round(t['flaeche_m2'], 2), ring_px=[[round(a, 1), round(b, 1)] for a, b in t['ring_px']]) for t in r['teilflaechen']],
                      kontrolle={k2: round(v, 2) for k2, v in r['kontrolle'].items()}, linien=len(r['linien']), verworfen=len(r['verworfen']), nummerierung=r['nummerierung'].get('zustand'))
        print(f"{m['name'][:22]:22} Netz {len(nt['teilflaechen'])}: " + ' | '.join(f"{t.get('nummer')}:{t['m2']:.0f}→L{t['leser_teil']}" for t in nt['teilflaechen']) + f"   KD {len(r['teilflaechen'])}: " + ' | '.join(f"{t.get('nummer')}:{t['flaeche_m2']:.0f}" for t in r['teilflaechen']) + f"  Summe {r['kontrolle']['summe_m2']:.0f}/{r['kontrolle']['kataster_m2']:.0f}  Nr:{r['nummerierung'].get('zustand')}", flush=True)
    json.dump(out, open(os.path.join(R, 'planleser', 'teilflaechen.json'), 'w'), ensure_ascii=False)
if __name__ == '__main__':
    lauf(sys.argv[1], sys.argv[sys.argv.index('--overlay') + 1] if '--overlay' in sys.argv else None)
