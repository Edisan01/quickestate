# Schritt 4 Inventar (Phase 3): alle roten Linien (Art: voll / strichliert / strichpunktiert), Maßpfeile (offene „V“ an Linien), Texte – ohne Deutung.
# Ausgabe je Planausschnitt: dict(linien=[…], pfeile=[…], texte=[…]); Overlay-Bild zur Sichtprüfung.
import sys, os, math, cv2, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from leser2 import rot_mask, glyphen
MPX = 0.2986 * math.cos(math.radians(48.21))   # m je Pixel bei Zoom 19

def textmaske(m, T, rand=3):
    tb = np.zeros_like(m)
    for t in T:
        cv2.fillPoly(tb, [cv2.boxPoints(((t['x'], t['y']), (t['w'] + 2 * rand, t['h'] + 2 * rand), t['ang'])).astype(np.int32)], 1)
    return tb

# ---------- Maßpfeile: offenes V, Spitze an einer Linie, Schenkel ~2–8 px, Innenraum leer, Schenkel enden kurz ----------
ALPHA = math.radians(27)
def _kern(theta, pts):
    K = np.zeros((25, 25), np.float32)
    for x, y in pts:
        X, Y = int(round(12 + x)), int(round(12 + y))
        if 0 <= X < 25 and 0 <= Y < 25: K[Y, X] = 1
    return K / max(1, K.sum())
def pfeile(m, schwelle=0.8, nms=True):
    f = (m > 0).astype(np.float32); fd = cv2.dilate(f, np.ones((3, 3), np.uint8)); kand = []   # Schenkel 1 px tolerant (fd), Innenraum/Außen streng (f)
    for k in range(36):
        th = math.radians(k * 10); ox, oy = -math.cos(th), -math.sin(th)   # Öffnung zeigt weg von der Spitze
        def strahl(a, t0, t1):
            c, s = math.cos(a), math.sin(a); dx, dy = ox * c - oy * s, ox * s + oy * c
            return [(dx * t, dy * t) for t in np.arange(t0, t1, 0.7)]
        L_ = cv2.filter2D(fd, -1, _kern(th, strahl(ALPHA, 1.5, 7)), borderType=cv2.BORDER_CONSTANT)
        R_ = cv2.filter2D(fd, -1, _kern(th, strahl(-ALPHA, 1.5, 7)), borderType=cv2.BORDER_CONSTANT)
        I_ = cv2.filter2D(f, -1, _kern(th, strahl(0, 3.5, 7)), borderType=cv2.BORDER_CONSTANT)
        A_ = cv2.filter2D(f, -1, _kern(th, strahl(ALPHA, 9.5, 12) + strahl(-ALPHA, 9.5, 12)), borderType=cv2.BORDER_CONSTANT)
        L2 = cv2.filter2D(f, -1, _kern(th, strahl(ALPHA, 1.5, 7)), borderType=cv2.BORDER_CONSTANT); R2 = cv2.filter2D(f, -1, _kern(th, strahl(-ALPHA, 1.5, 7)), borderType=cv2.BORDER_CONSTANT)
        s = np.minimum(L_, R_) + 0.5 * (L2 + R2) - I_ - A_   # Gleichstand (dilatiert = 1,0) über die strenge Trefferquote auflösen
        ys, xs = np.nonzero((L_ >= schwelle) & (R_ >= schwelle) & (I_ <= 0.2) & (A_ <= 0.3))
        kand += [(float(s[y, x]), x, y, k * 10) for y, x in zip(ys, xs)]
    kand.sort(reverse=True)
    if not nms: return [dict(x=int(x), y=int(y), richtung=a, s=round(sc, 2)) for sc, x, y, a in kand]
    out = []
    for sc, x, y, a in kand:
        if all(math.hypot(x - p['x'], y - p['y']) > 6 for p in out): out.append(dict(x=int(x), y=int(y), richtung=a, s=round(sc, 2)))
    return out

# ---------- Linien: Skelett → Hough-Segmente → gerade Linien zusammenfassen → Art aus dem Muster entlang der Linie ----------
def segmente(lin):
    sk = cv2.ximgproc.thinning((lin > 0).astype(np.uint8) * 255)
    ls = cv2.HoughLinesP(sk, 1, np.pi / 360, 8, minLineLength=6, maxLineGap=14)
    return [] if ls is None else ls.reshape(-1, 4).astype(float).tolist()
def zusammen(S, dwink=2.5, dquer=2.5):
    # kollineare Segmente (Winkel < 2,5°, Abstand quer < 2,5 px, Lücke < 30 px) zu einer Linie
    G = []
    for x1, y1, x2, y2 in sorted(S, key=lambda s: -math.hypot(s[2] - s[0], s[3] - s[1])):
        a = math.atan2(y2 - y1, x2 - x1) % math.pi
        for g in G:
            da = abs(a - g['a']); da = min(da, math.pi - da)
            if da > math.radians(dwink): continue
            ux, uy = math.cos(g['a']), math.sin(g['a'])
            q = [(-(px - g['p'][0]) * uy + (py - g['p'][1]) * ux) for px, py in ((x1, y1), (x2, y2))]
            if max(abs(v) for v in q) > dquer: continue
            t = sorted(((px - g['p'][0]) * ux + (py - g['p'][1]) * uy) for px, py in ((x1, y1), (x2, y2)))
            if t[0] > g['t1'] + 30 or t[1] < g['t0'] - 30: continue
            g['t0'], g['t1'] = min(g['t0'], t[0]), max(g['t1'], t[1]); break
        else:
            ux, uy = math.cos(a), math.sin(a); t = sorted([0.0, (x2 - x1) * ux + (y2 - y1) * uy])
            G.append(dict(a=a, p=(x1, y1), t0=t[0], t1=t[1]))
    return G
def muster(lin, g):
    ux, uy = math.cos(g['a']), math.sin(g['a']); H, W = lin.shape; r = []
    for t in np.arange(g['t0'], g['t1'] + 1, 1.0):
        x, y = g['p'][0] + ux * t, g['p'][1] + uy * t; v = 0
        for q in (-1.5, -0.5, 0.5, 1.5):
            X, Y = int(round(x - uy * q)), int(round(y + ux * q))
            if 0 <= X < W and 0 <= Y < H and lin[Y, X]: v = 1; break
        r.append(v)
    laeufe = []; cur = r[0] if r else 0; n = 0
    for v in r:
        if v == cur: n += 1
        else: laeufe.append((cur, n)); cur, n = v, 1
    laeufe.append((cur, n))
    an = [n for v, n in laeufe if v == 1]; aus = [n for v, n in laeufe[1:-1] if v == 0]
    dichte = sum(r) / max(1, len(r))
    if dichte > 0.93 or not aus: art = 'voll'
    elif an and sum(1 for n in an if n <= 4) >= 0.3 * len(an) and sum(1 for n in an if n > 6) >= 0.3 * len(an): art = 'strichpunkt'
    elif aus and np.median(aus) <= 16: art = 'strich'
    else: art = 'lueckig'
    return art, round(dichte, 2), (int(np.median(an)) if an else 0, int(np.median(aus)) if aus else 0)

def inventar(crop, T):
    m = rot_mask(crop); tm = textmaske(m, T)
    lin = m.copy(); lin[tm > 0] = 0
    L = []
    for g in zusammen(segmente(lin)):
        laenge = g['t1'] - g['t0']
        if laenge < 8: continue
        art, dichte, (an, aus) = muster(lin, g)
        ux, uy = math.cos(g['a']), math.sin(g['a'])
        a = (g['p'][0] + ux * g['t0'], g['p'][1] + uy * g['t0']); b = (g['p'][0] + ux * g['t1'], g['p'][1] + uy * g['t1'])
        L.append(dict(a=[round(a[0], 1), round(a[1], 1)], b=[round(b[0], 1), round(b[1], 1)], laenge_m=round(laenge * MPX, 2), winkel=round(math.degrees(g['a']), 1), art=art, dichte=dichte, strich=an, luecke=aus))
    # Pfeil-Schenkel sind dünn (1–2 px), Linien 3 px: V nur im dünnen Rest suchen; Spitze ≤ 5 px an einer Linie, Achse ⟂ Linie (± 20°),
    # Öffnung zeigt von der Linie weg, wenig Fremdpixel rundum (Textreste)
    dick = cv2.morphologyEx(lin, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)); duenn = lin & (1 - dick)
    P = []
    for p in pfeile(duenn, nms=False):
        th = math.radians(p['richtung']); best = None
        for k, l in enumerate(L):
            ax, ay = l['a']; bx, by = l['b']; vx, vy = bx - ax, by - ay; LL = math.hypot(vx, vy); ux, uy = vx / LL, vy / LL
            t = (p['x'] - ax) * ux + (p['y'] - ay) * uy
            if not -3 <= t <= LL + 3: continue
            q = (p['x'] - ax) * -uy + (p['y'] - ay) * ux
            if abs(q) > 5: continue
            d = abs(math.degrees(math.atan2(math.sin(th), math.cos(th)) - math.atan2(-ux, uy))) % 180   # Achse gegen Normale
            if min(d, 180 - d) > 20: continue
            if abs(q - 5 * (math.cos(th) * -uy + math.sin(th) * ux)) < abs(q) + 2: continue   # Schenkel-Enden weiter weg von der Linie als die Spitze
            if best is None or abs(q) < best[1]: best = (k, abs(q))
        if best is None: continue
        w = duenn[max(0, p['y'] - 9):p['y'] + 10, max(0, p['x'] - 9):p['x'] + 10]
        if w.sum() > 40: continue
        if all(math.hypot(p['x'] - o['x'], p['y'] - o['y']) > 6 for o in P): P.append(dict(p, linie=best[0]))   # erst prüfen, dann Doppelte weg
    return dict(linien=L, pfeile=P, texte=[dict(t=t['t'], x=t['x'], y=t['y'], ang=t['ang'], w=t['w'], h=t['h']) for t in T])

FARBE = {'voll': (200, 0, 0), 'strich': (0, 140, 0), 'strichpunkt': (160, 0, 200), 'lueckig': (0, 160, 200)}
def overlay(crop, inv, pfad, ring=None):
    im = (crop * 0.35 + 165).astype(np.uint8).copy()
    if ring is not None: cv2.polylines(im, [np.round(ring).astype(np.int32)], True, (0, 0, 0), 1)
    for l in inv['linien']:
        cv2.line(im, tuple(int(v) for v in l['a']), tuple(int(v) for v in l['b']), FARBE[l['art']][::-1], 2)
    for p in inv['pfeile']:
        th = math.radians(p['richtung']); x, y = p['x'], p['y']
        cv2.circle(im, (x, y), 5, (0, 120, 255), 2); cv2.line(im, (int(x - 10 * math.cos(th)), int(y - 10 * math.sin(th))), (x, y), (0, 120, 255), 1)
    for t in inv['texte']:
        cv2.polylines(im, [cv2.boxPoints(((t['x'], t['y']), (t['w'] + 4, t['h'] + 4), t['ang'])).astype(np.int32)], True, (255, 0, 0), 1)
        cv2.putText(im, t['t'], (int(t['x'] + t['w'] / 2 + 3), int(t['y'])), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 0, 0), 1)
    cv2.imwrite(pfad, im)
