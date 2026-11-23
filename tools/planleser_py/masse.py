# Schritt 5 (Phase 4): Maßzahl → Maßlinie. Je Maßzahl zwei Maßpfeile auf der Achse quer zur Schrift, Spitzen an zwei Linien, nach außen zeigend.
# Messwert = Abstand der beiden Linien entlang der Achse; Art aus den Linienarten an den Enden; Gültigkeit = Stelle der Pfeile.
# Ohne Pfeilpaar: Abstand der nächsten Linien beidseits (nur Hinweis „ohne Pfeile“). Planzahl gewinnt, Messung bestätigt (± 0,6 m).
import math, re, numpy as np
from inventar import MPX
MASS = re.compile(r'^(\d{1,2})[,.](\d\d)$')
TOL = 0.6

RAND_PX = 6   # endlicher Linienkontakt: Schnitt darf höchstens 6 px (~1,2 m) über das Liniensegment hinaus liegen (ChatGPT-Befund 20.11.)
def _schnitt(p, d, l, frei=False):
    # Strahl p + s·d mit Gerade durch l['a'], l['b'] → s (px) oder None
    ax, ay = l['a']; bx, by = l['b']; ex, ey = bx - ax, by - ay
    den = d[0] * ey - d[1] * ex
    if abs(den) < 1e-6: return None
    s = ((ax - p[0]) * ey - (ay - p[1]) * ex) / den
    u = ((ax - p[0]) * d[1] - (ay - p[1]) * d[0]) / den
    L = math.hypot(ex, ey); r = RAND_PX / max(L, 1e-6)
    return s if frei or -r <= u <= 1 + r else None   # frei: unbegrenzt (nur noch für Altpfad masszahlen)
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

# ---------- Weg 2: vom Pfeilpaar zur Zahl (Zahl wird zwischen den Pfeilen gelesen, Messung muss passen) ----------
# Zwei Pfeile auf einer Achse, zeigen voneinander weg, Spitzen an zwei Linien → Maßlinie. Die Zahl steht dazwischen, quer zur Achse geschrieben.
# Lesen: Ausschnitt drehen, Ziffern-Schrifterkennung (nur 0-9 , .) in beiden Leserichtungen; gilt nur, wenn |Zahl − Messung| ≤ 0,6 m.
import cv2, subprocess, tempfile, os
def _ocr_ziffern(img):
    f = tempfile.mktemp(suffix='.png'); cv2.imwrite(f, img)
    r = subprocess.run(['tesseract', f, '-', '--psm', '7', '-l', 'eng', '-c', 'tessedit_char_whitelist=0123456789,.'], capture_output=True, text=True).stdout.strip()
    os.remove(f); return r.replace(' ', '')
def paare(inv, crop, maxm=40):
    from leser2 import rot_mask
    P = inv['pfeile']; out = []
    im_ = crop.astype(np.float32)
    BILDER = [np.clip((im_[..., 0] - np.maximum(im_[..., 1], im_[..., 2]) - 30) * 2.2, 0, 255).astype(np.uint8),   # Rot-Stärke: dünne Ziffern bleiben ganz
              rot_mask(crop) * 255]                                                                               # harte Maske: hilft bei Ziffern nahe an Linien
    for i in range(len(P)):
        for j in range(i + 1, len(P)):
            a, b = P[i], P[j]; da = np.array([math.cos(math.radians(a['richtung'])), math.sin(math.radians(a['richtung']))]); db = np.array([math.cos(math.radians(b['richtung'])), math.sin(math.radians(b['richtung']))])
            if da @ db > -0.94: continue
            v = np.array([b['x'] - a['x'], b['y'] - a['y']], float); L = np.hypot(*v)
            if L < 2 / MPX or L > maxm / MPX: continue
            u = v / L
            if abs(u @ da) < 0.94 or da @ -u < 0.9: continue          # a zeigt von b weg, beide auf der Achse
            mid = (np.array([a['x'], a['y']], float) + np.array([b['x'], b['y']], float)) / 2
            la, lb = inv['linien'][a['linie']], inv['linien'][b['linie']]
            s1, s2 = _schnitt(mid, u, la), _schnitt(mid, u, lb)   # endlich: Maßachse muss die gezeichneten Liniensegmente treffen
            if s1 is None or s2 is None: continue
            # Pfeilspitzen müssen auf der gemeinsamen Maßachse an den Schnittpunkten sitzen (seitlich versetzte Pfeile ergeben sonst Scheinmaße)
            if max(np.hypot(*(mid + u * s1 - [a['x'], a['y']])), np.hypot(*(mid + u * s2 - [b['x'], b['y']]))) > 5: continue
            gem = abs(s1 - s2) * MPX
            # Ausschnitt um die Mitte, so gedreht, dass die Schrift (quer zur Achse) waagrecht liegt
            ang = math.degrees(math.atan2(u[1], u[0])) + 90; w, h = int(L * 0.9) + 40, 26
            res = None
            for m, zus in [(m, z) for m in BILDER for z in (0, 180)]:
                M_ = cv2.getRotationMatrix2D((float(mid[0]), float(mid[1])), ang + zus, 1.0); M_[0, 2] += w / 2 - mid[0]; M_[1, 2] += h / 2 - mid[1]
                c = cv2.warpAffine(m, M_, (w, h)); c = 255 - cv2.resize(c, None, fx=6, fy=6, interpolation=cv2.INTER_CUBIC)
                c = cv2.copyMakeBorder(c, 30, 30, 30, 30, cv2.BORDER_CONSTANT, value=255)
                if os.environ.get('MASSE_DEBUG'): cv2.imwrite(f"/tmp/md_{i}_{j}_{zus}.png", c)
                t = _ocr_ziffern(c); mm = re.search(r'(\d{1,2})[.,](\d\d)', t)
                if mm:
                    vv = float(mm.group(1) + '.' + mm.group(2))
                    if abs(vv - gem) <= TOL: res = vv; break
            out.append(dict(v=res, gem=round(gem, 2), ok=res is not None, pfeile=[i, j], linien=[a['linie'], b['linie']], arten=sorted([la['art'], lb['art']]),
                            mitte=mid.round(1).tolist(), a=(mid + u * s1).round(1).tolist(), b=(mid + u * s2).round(1).tolist(), quelle='pfeilpaar',
                            grund=None if res is not None else 'keine passende Zahl zwischen den Pfeilen'))
    return out
