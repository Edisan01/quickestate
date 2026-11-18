# Schritt 1 Grundstück: Grundbuchfläche (BEV-Verzeichnis), Geometrie (BEV-Kataster-Kacheln /kataster/16), mehrere GNR zusammenlegen,
# Seiten (vereinfachtes Polygon), Straßenfront (Kataster-Kante auf der Leser-Straßenkante), Grenzkataster.
import json, math, os, sys
from shapely.geometry import Polygon, Point, LineString
from shapely.ops import unary_union
from pyproj import Transformer
H = os.path.dirname(os.path.abspath(__file__)); R = os.path.abspath(os.path.join(H, '..', '..'))
sys.path.insert(0, os.path.join(R, 'tools', 'planleser_py')); import kat
TM = Transformer.from_crs(4326, 31256, always_xy=True).transform
FL = json.load(open(os.path.join(R, 'kataster', 'flaeche.json')))
TOL_P = 2.0   # Geometrie gegen Grundbuch (pruefschema: summe_gegen_grundbuch_prozent)
def _poly(pg): return Polygon([TM(*q) for q in pg[0]], [[TM(*q) for q in h] for h in pg[1:]])
def punkt(kg, gnr):
    f = os.path.join(R, 'kataster', 'kg', kg + '.json')
    return json.load(open(f)).get(gnr) if os.path.exists(f) else None
def parzellen_um(lon, lat):
    out = {}
    for p in kat.parzellen(lon, lat):
        k = (str(p['kg']).zfill(5), p['gnr'])
        if k not in out: out[k] = unary_union([_poly(pg) for pg in p['polys']])
    return out
def grundstueck(kg, gnrs):
    pt = punkt(kg, gnrs[0])
    if not pt: return None
    P = parzellen_um(*pt); teile = [P[(kg, g)] for g in gnrs if (kg, g) in P]
    if len(teile) != len(gnrs): return None
    u = unary_union(teile).buffer(0.05, join_style=2).buffer(-0.05, join_style=2)
    if u.geom_type != 'Polygon': return None
    return dict(poly=u, nachbarn={k: v for k, v in P.items() if k[0] != kg or k[1] not in gnrs})
def seiten(poly, tol=0.15):
    # vereinfachtes Polygon: Kanten < 0,5 m weg, gleichgerichtete Kanten (< 4°) zusammenlegen
    c = list(poly.simplify(tol).exterior.coords)[:-1]
    if Polygon(c).exterior.is_ccw: c = c[::-1]
    return [(c[i], c[(i + 1) % len(c)]) for i in range(len(c)) if math.dist(c[i], c[(i + 1) % len(c)]) >= 0.5]
def frontseiten(g, front):
    # Straßenfront: Kataster-Kanten, die auf der vom Leser gefundenen Straßenkante liegen (parallel < 8°, Mitte ≤ 3 m von der Linie)
    if not front: return []
    F = LineString([TM(*q) for q in front])
    (x1, y1), (x2, y2) = F.coords; L = math.dist((x1, y1), (x2, y2)); ux, uy = (x2 - x1) / L, (y2 - y1) / L
    Lang = LineString([(x1 - ux * 200, y1 - uy * 200), (x2 + ux * 200, y2 + uy * 200)])
    def par(a, b):
        d = abs(richtung(a, b) - richtung((x1, y1), (x2, y2))); return min(d, 180 - d) < 8
    # ≤ 3 m: Leser-Kante kann die Baulinie hinter einer Grundabtretung sein (Gartengasse 8: 2 m)
    return [(a, b, round(math.dist(a, b), 2)) for a, b in seiten(g['poly']) if par(a, b) and Lang.distance(Point((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)) <= 3]
def richtung(a, b): return math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])) % 180
def ergaenzen(gs, e, adr):
    from pruefstand import feld
    kg = e['kg']; gnrs = e['gnr'].split('+')
    gs['kg_gnr'] = feld(f"{kg} {e['gnr']}", quelle='kataster')
    gs['mehrere_gnr'] = feld(len(gnrs) > 1, quelle='kataster')
    fb = [FL['kg'].get(kg, {}).get(g) for g in gnrs]
    g = grundstueck(kg, gnrs)
    if None in fb: return
    fb = round(sum(fb), 2)
    if g is None:
        gs['flaeche_grundbuch'] = feld(fb, 'offen', 'BEV-Verzeichnis', 'Geometrie fehlt'); return
    fg = round(g['poly'].area, 2); ok = abs(fg - fb) <= fb * TOL_P / 100
    gs['flaeche_grundbuch'] = feld(fb, 'bestaetigt' if ok else 'offen', f'BEV-Verzeichnis {fb} + Geometrie {fg}', None if ok else f'Geometrie weicht {100 * (fg - fb) / fb:+.1f} % ab')
    gs['seiten_m'] = feld([round(math.dist(a, b), 2) for a, b in seiten(g['poly'])], 'offen', 'kataster (digital, nicht Grenzkataster)')
    ss = frontseiten(g, e.get('front'))
    # Straßenseiten mit gleicher Richtung (< 8°) = eine Front
    fronten = []
    for a, b, L in ss:
        for f in fronten:
            d = abs(richtung(a, b) - f['r']); d = min(d, 180 - d)
            if d < 8: f['L'] += L; break
        else: fronten.append(dict(r=richtung(a, b), L=L))
    gs['fronten_m'] = feld([round(f['L'], 2) for f in fronten], 'offen', 'kataster-Kanten auf Leser-Straßenkante (Stadt-Zonen)')
    gs['eckgrundstueck'] = feld(None, 'offen', grund='Leser speichert nur die längste Straßenkante → Phase 2 (alle Straßenkanten aus Stadt-Zonen)')
    gs['grenzkataster'] = feld(None, 'offen', grund='Kennzeichen nicht in den Kataster-Daten (BEV-Kacheln/GPKG prüfen)')
