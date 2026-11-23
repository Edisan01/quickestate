"""Schritt 5b: Abschnitte am Sprung.
Regel: Wo die Grenze Straßentrakt/Hof quer zur Front springt (Segment ⟂ Front ±20°, ≥ 1 m), wird das Grundstück
mit einem Lot zur Front durch dieses Segment geteilt. Jede Teilfläche zerfällt so in Abschnitte mit eigener Breite/Tiefe.
Ein = planleser/teilflaechen.json (netz) + planleser/ergebnis.json (front). Aus = Feld 'abschnitte' je Grundstück."""
import json, os, math
from pyproj import Transformer
from shapely.geometry import Polygon, LineString
from shapely.ops import split, unary_union, linemerge
R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TM = Transformer.from_crs(4326, 31256, always_xy=True).transform
ZURUECK = Transformer.from_crs(31256, 4326, always_xy=True).transform
QUER, MIN_SPRUNG, VEREINF = 20, 1.0, 0.3

def poly(ring): return Polygon([TM(*p) for p in ring]).buffer(0)

def sprunglinien(teile, u, n):
    """Lote zur Front durch Sprung-Segmente der inneren Grenzen (zwischen Teilen verschiedener Leser-Teile)."""
    lagen = []
    for i, a in enumerate(teile):
        for b in teile[i + 1:]:
            if a['leser_teil'] == b['leser_teil']: continue
            g = a['geo'].boundary.intersection(b['geo'].buffer(0.2))  # gemeinsame Grenze, Netz-Teile berühren sich nicht immer exakt
            if g.is_empty: continue
            teil = [g] if g.geom_type == 'LineString' else [x for x in getattr(g, 'geoms', []) if x.geom_type == 'LineString']
            if not teil: continue
            m = linemerge(teil); linien = [m] if m.geom_type == 'LineString' else list(m.geoms)
            for l in linien:
                c = list(l.simplify(VEREINF).coords)
                for p, q in zip(c, c[1:]):
                    d = (q[0] - p[0], q[1] - p[1]); L = math.hypot(*d)
                    if L < MIN_SPRUNG: continue
                    w = math.degrees(math.acos(min(1, abs(d[0] * n[0] + d[1] * n[1]) / L)))
                    if w <= QUER: lagen.append(((p[0] + q[0]) / 2 * u[0] + (p[1] + q[1]) / 2 * u[1], L))
    # gleiche Lage (≤ 0,6 m) nur einmal
    out = []
    for s, L in sorted(lagen):
        if not out or abs(s - out[-1]) > 0.6: out.append(s)
    return out

def masse(g, u, n):
    xs = [x * u[0] + y * u[1] for x, y in g.exterior.coords]; ys = [x * n[0] + y * n[1] for x, y in g.exterior.coords]
    return round(max(xs) - min(xs), 2), round(max(ys) - min(ys), 2)

def lauf():
    tf = json.load(open(os.path.join(R, 'planleser', 'teilflaechen.json')))
    erg = json.load(open(os.path.join(R, 'planleser', 'ergebnis.json')))
    for k, v in tf.items():
        e = erg.get(k) or erg.get(k.replace('-', '/')) or next((x for x in erg.values() if x.get('name') == v['name']), None)
        if not e or not e.get('front'): v['abschnitte'] = []; continue
        f0, f1 = TM(*e['front'][0]), TM(*e['front'][1]); L = math.hypot(f1[0] - f0[0], f1[1] - f0[1])
        u = ((f1[0] - f0[0]) / L, (f1[1] - f0[1]) / L); n = (-u[1], u[0])
        teile = [dict(t, geo=poly(t['ring_ll'])) for t in v['netz']]
        ganz = unary_union([t['geo'] for t in teile])
        if (ganz.centroid.x - f0[0]) * n[0] + (ganz.centroid.y - f0[1]) * n[1] < 0: n = (-n[0], -n[1])
        lagen = sprunglinien(teile, u, n)
        ab = []
        for t in teile:
            stuecke = [t['geo']]
            for s in lagen:
                cn = ganz.centroid.x * n[0] + ganz.centroid.y * n[1]; p = (u[0] * s + n[0] * cn, u[1] * s + n[1] * cn); a = (p[0] - n[0] * 500, p[1] - n[1] * 500); b = (p[0] + n[0] * 500, p[1] + n[1] * 500)
                neu = []
                for g in stuecke: neu += [x for x in split(g, LineString([a, b])).geoms if x.area > 0.5]
                stuecke = neu
            for g in sorted(stuecke, key=lambda g: g.centroid.x * u[0] + g.centroid.y * u[1]):
                br, ti = masse(g, u, n)
                ab.append(dict(leser_teil=t['leser_teil'], netz_nr=t['nummer'], m2=round(g.area, 2), breite_m=br, tiefe_m=ti,
                               lage_m=round(g.centroid.x * u[0] + g.centroid.y * u[1] - (f0[0] * u[0] + f0[1] * u[1]), 2),
                               ring_ll=[list(map(lambda z: round(z, 7), ZURUECK(*c))) for c in g.exterior.coords]))
        v['abschnitte'] = ab; v['sprung_lote'] = len(lagen)
        print(f"{v['name'][:22]:22} Lote {len(lagen)}: " + ' | '.join(f"L{a['leser_teil']} {a['breite_m']}×{a['tiefe_m']}={a['m2']}" for a in ab))
    json.dump(tf, open(os.path.join(R, 'planleser', 'teilflaechen.json'), 'w'), ensure_ascii=False)

if __name__ == '__main__': lauf()
