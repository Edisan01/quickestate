# Phase 5 Weg 2: Teilflächen aus dem Liniennetz (Inventar-Linien voll/strich/strichpunkt) innerhalb des Katasterrahmens.
# Linienenden werden höchstens 1,5 m verlängert (Anschluss an Nachbarlinie oder Grundgrenze), dann Flächen bilden (polygonize).
# Für Sprünge (Leitermayergasse 50): ein Strich-Linienzug mit Versatz trennt als Ganzes, auch wenn kein Einzelstück durchläuft.
import math, numpy as np
from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union, polygonize
from inventar import MPX
VERL_M = 1.5; MIN_M2 = 2.0; MIN_BREITE_M = 0.8
def teile(inv, polys_px, off=(0, 0)):
    gs = unary_union([Polygon(np.array(p[0]) - off, [np.array(h) - off for h in p[1:]]).buffer(0) for p in polys_px])
    rand = gs.buffer(VERL_M / MPX)
    linien = []
    for l in inv['linien']:
        if l['art'] not in ('voll', 'strich', 'strichpunkt'): continue
        a, b = np.array(l['a']), np.array(l['b']); L = np.hypot(*(b - a))
        if L < 2 / MPX: continue
        u = (b - a) / L; e = VERL_M / MPX
        g = LineString([a - u * e, b + u * e]).intersection(rand)
        if not g.is_empty: linien.append(g)
    netz = unary_union(linien + [gs.boundary])
    flaechen = []
    for f in polygonize(netz):
        f = f.intersection(gs)
        if f.is_empty: continue
        for p in (f.geoms if hasattr(f, 'geoms') else [f]):
            if p.geom_type != 'Polygon' or p.area * MPX * MPX < MIN_M2: continue
            r = p.minimum_rotated_rectangle.exterior.coords; br = min(math.dist(r[i], r[i + 1]) for i in range(4)) * MPX
            flaechen.append(dict(poly=p, m2=p.area * MPX * MPX, breite_min=br))
    # Scheinstreifen (schmaler als ~ Linienbreite) mit dem längsten Nachbarn vereinigen
    flaechen.sort(key=lambda f: f['m2'])
    ok = [f for f in flaechen if f['breite_min'] >= MIN_BREITE_M]
    for f in [f for f in flaechen if f['breite_min'] < MIN_BREITE_M]:
        if not ok: ok.append(f); continue
        n = max(ok, key=lambda o: o['poly'].buffer(0.5).intersection(f['poly'].buffer(0.5)).area)
        n['poly'] = unary_union([n['poly'], f['poly']]).buffer(0.3).buffer(-0.3); n['m2'] = n['poly'].area * MPX * MPX
    return gs, ok
