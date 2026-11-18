# Schritt 5 (Phase 4): Maßzahl → Maßlinie. Je Maßzahl zwei Maßpfeile auf der Achse quer zur Schrift, Spitzen an zwei Linien, nach außen zeigend.
# Messwert = Abstand der beiden Linien entlang der Achse; Art aus den Linienarten an den Enden; Gültigkeit = Stelle der Pfeile.
# Ohne Pfeilpaar: Abstand der nächsten Linien beidseits (nur Hinweis „ohne Pfeile“). Planzahl gewinnt, Messung bestätigt (± 0,6 m).
import math, re, numpy as np
from inventar import MPX
MASS = re.compile(r'^(\d{1,2})[,.](\d\d)$')
TOL = 0.6

def _schnitt(p, d, l, frei=False):
    # Strahl p + s·d mit Gerade durch l['a'], l['b'] → s (px) oder None
    ax, ay = l['a']; bx, by = l['b']; ex, ey = bx - ax, by - ay
    den = d[0] * ey - d[1] * ex
    if abs(den) < 1e-6: return None
    s = ((ax - p[0]) * ey - (ay - p[1]) * ex) / den
    u = ((ax - p[0]) * d[1] - (ay - p[1]) * d[0]) / den
    return s if frei or -0.05 <= u <= 1.05 else None   # frei: Pfeil sitzt nachweislich auf dieser Linie
def masszahlen(inv, rmax=70):
    out = []
    for t in inv['texte']:
        m = MASS.match(t['t'].replace(' ', ''))
        if not m: continue
        v = float(m.group(1) + '.' + m.group(2)); c = np.array([t['x'], t['y']], float)
        a = math.radians(t['ang']); s_ = np.array([math.cos(a), math.sin(a)]); n = np.array([-s_[1], s_[0]])   # n = Maßrichtung (quer zur Schrift)
        r = dict(v=v, x=t['x'], y=t['y'], ang=t['ang'])
        # Pfeile beidseits: Richtung ∥ ±n (± 20°), zeigt von der Zahl weg, liegt nahe der Achse
        seiten = {1: [], -1: []}
        for i, p in enumerate(inv['pfeile']):
            q = np.array([p['x'], p['y']], float) - c; along = q @ n; quer = q @ s_
            if abs(along) > rmax or abs(quer) > max(25, t['w']): continue
            th = math.radians(p['richtung']); d = np.array([math.cos(th), math.sin(th)])
            sg = 1 if along > 0 else -1
            if d @ (sg * n) < math.cos(math.radians(20)): continue
            seiten[sg].append((abs(along), i, p))
        if seiten[1] and seiten[-1]:
            (_, i1, p1), (_, i2, p2) = min(seiten[1], key=lambda x: x[0]), min(seiten[-1], key=lambda x: x[0])
            mid = (np.array([p1['x'], p1['y']]) + np.array([p2['x'], p2['y']])) / 2
            l1, l2 = inv['linien'][p1['linie']], inv['linien'][p2['linie']]
            s1, s2 = _schnitt(mid, n, l1, True), _schnitt(mid, n, l2, True)
            if s1 is not None and s2 is not None:
                gem = abs(s1 - s2) * MPX
                r.update(pfeile=[i1, i2], linien=[p1['linie'], p2['linie']], arten=sorted([l1['art'], l2['art']]), gem=round(gem, 2), ok=abs(gem - v) <= TOL,
                         a=(mid + n * s1).round(1).tolist(), b=(mid + n * s2).round(1).tolist(), quelle='pfeile')
        if 'gem' not in r:
            # ohne Pfeilpaar: nächste Linie beidseits entlang n durch die Zahl
            best = {1: None, -1: None}
            for k, l in enumerate(inv['linien']):
                s = _schnitt(c, n, l)
                if s is None or abs(s) < t['h'] / 2 or abs(s) > 400: continue
                sg = 1 if s > 0 else -1
                if best[sg] is None or abs(s) < abs(best[sg][0]): best[sg] = (s, k)
            if best[1] and best[-1]:
                gem = (best[1][0] - best[-1][0]) * MPX
                r.update(linien=[best[1][1], best[-1][1]], arten=sorted([inv['linien'][best[1][1]]['art'], inv['linien'][best[-1][1]]['art']]), gem=round(gem, 2),
                         ok=abs(gem - v) <= TOL, a=(c + n * best[1][0]).round(1).tolist(), b=(c + n * best[-1][0]).round(1).tolist(), quelle='ohne Pfeile')
            else: r.update(ok=False, grund='keine Linien beidseits')
        if 'gem' in r and not r['ok']: r['grund'] = f"Messung {r['gem']} ≠ Planzahl {v} (± {TOL})"
        out.append(r)
    return out
