# Zählt die Planbild-Kacheln (WMTS flwbplmzk/rot, google3857, Stufe 19), die der Planleser für ganz Wien braucht.
# Quelle: Widmungszonen GENFLWIDMUNGOGD (Stadt Wien, CC BY 4.0) – seitenweise, mit Pause (MA 21: kein Massen-Abruf).
import json, math, sys, time, gzip, urllib.request, collections
OUT = sys.argv[1]; Z = 19; N = 2 ** Z
def holen(start):
    u = ('https://data.wien.gv.at/daten/geo?service=WFS&request=GetFeature&version=1.1.0&typeName=ogdwien:GENFLWIDMUNGOGD'
         '&srsName=EPSG:4326&outputFormat=json&maxFeatures=5000&startIndex=%d' % start)
    for v in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'quickestate.at Kachelzaehlung (eb@quickestate.at)'}), timeout=120) as r: return json.load(r)['features']
        except Exception as e: print('Fehler', start, e, flush=True); time.sleep(20 * (v + 1))
    raise SystemExit('WFS nicht erreichbar')
F, s = [], 0
while True:
    f = holen(s); F += f; print('Zonen', len(F), flush=True)
    if len(f) < 5000: break
    s += 5000; time.sleep(3)
ids = set(); F = [f for f in F if not (f['properties'].get('OBJECTID') in ids or ids.add(f['properties'].get('OBJECTID')))]
def kx(lon): return (lon + 180) / 360 * N
def ky(lat): r = math.radians(lat); return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * N
def drin(x, y, ringe):
    c = False
    for r in ringe:
        for i in range(len(r)):
            (x1, y1), (x2, y2) = r[i], r[i - 1]
            if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c
def kacheln(geo):
    polys = geo['coordinates'] if geo['type'] == 'MultiPolygon' else [geo['coordinates']]
    out = set()
    for pg in polys:
        R = [[(kx(a), ky(b)) for a, b, *_ in r] for r in pg]
        xs = [p[0] for p in R[0]]; ys = [p[1] for p in R[0]]
        for p in R[0]: out.add((int(p[0]), int(p[1])))
        for tx in range(int(min(xs)), int(max(xs)) + 1):
            for ty in range(int(min(ys)), int(max(ys)) + 1):
                if drin(tx + .5, ty + .5, R): out.add((tx, ty))
    return out
KL = collections.defaultdict(set); ALLE = set()
for f in F:
    k = str(f['properties'].get('WIDMUNGSKLASSE') or '?'); t = kacheln(f['geometry']); KL[k] |= t; ALLE |= t
BAU = {'WO', 'WOGV', 'WOGF', 'WOGFGV', 'GB', 'GBGV', 'GBGF', 'GBGFGV', 'GBBG', 'GBBGGV', 'GS', 'IG', 'SO', 'BG'}
bau = set().union(*[v for k, v in KL.items() if k in BAU])
puffer = set((x + dx, y + dy) for x, y in bau for dx in (-2, -1, 0, 1, 2) for dy in (-2, -1, 0, 1, 2))   # ±2 Kacheln ≈ ±100 m (G BB kann ~110 m weiter stehen)
erg = {'zonen': len(F), 'klassen': {k: {'zonen': sum(1 for f in F if str(f['properties'].get('WIDMUNGSKLASSE') or '?') == k), 'kacheln': len(v)} for k, v in sorted(KL.items(), key=lambda x: -len(x[1]))},
       'kacheln_alle_zonen': len(ALLE), 'kacheln_bauland': len(bau), 'kacheln_bauland_puffer2': len(puffer), 'bauland_klassen': sorted(BAU),
       'stunden_bei_1_pro_s': {'bauland': round(len(bau) / 3600, 1), 'bauland_puffer2': round(len(puffer) / 3600, 1), 'alle': round(len(ALLE) / 3600, 1)}}
json.dump(erg, open(OUT + '/kacheln_zaehlung.json', 'w'), indent=1, ensure_ascii=False)
with gzip.open(OUT + '/kacheln_bauland_puffer2.txt.gz', 'wt') as g: g.write('\n'.join('%d/%d' % p for p in sorted(puffer)))
print(json.dumps({k: v for k, v in erg.items() if k != 'klassen'}, ensure_ascii=False))
