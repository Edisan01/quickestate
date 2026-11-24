#!/usr/bin/env python3
"""P5 BB-Marken: PD-Plankarte → flwbplmzk-Georef, BB-Nummer je Teilfläche.
Nutzung: bb_marke.py <pd> <kg_gnr>  z. B. 7208 01514_430-18
Schreibt planleser/bb_marken.json und ~/qe_planbilder/plan_<pd>_overlay.png
(nur wenn Georef bestätigt).
"""
import sys, os, json, time
import cv2
import numpy as np
import pymupdf as fitz
from pyproj import Transformer
import kat as K

QE = os.path.expanduser('~/qe_planbilder')
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PDF_MM_PRO_PX = 25.4 / 200  # 200 dpi

def kataster_template(lon, lat, massstab, bereich_m=200):
    """Rastert lokale Katastergrenzen (./kataster/16/*.json) um (lon,lat) als s/w Linienbild
    im PDF-Maßstab. Keine Beschriftung, nur Grundstücksringe. Rückgabe: (Bild, Welt-Zentrum EPSG:31256)."""
    pdf_px_pro_m = 1000 / massstab / PDF_MM_PRO_PX   # Welt-m → PDF-px
    n = int(round(2 * bereich_m * pdf_px_pro_m))
    img = np.zeros((n, n), dtype=np.uint8)
    tr = Transformer.from_crs('EPSG:4326', 'EPSG:31256', always_xy=True)  # Lambert Austria, real-m
    cx, cy = tr.transform(lon, lat)
    anz = 0
    for p in K.parzellen(lon, lat):
        for poly in p['polys']:
            for ring in poly:
                if not ring: continue
                pts = np.array([tr.transform(l, la) for l, la in ring])
                xs = (pts[:,0] - cx) * pdf_px_pro_m + n/2
                ys = -(pts[:,1] - cy) * pdf_px_pro_m + n/2  # EPSG-Y nordwärts → Bild-Y südwärts
                if not (xs.min() > -50 and xs.max() < n+50 and ys.min() > -50 and ys.max() < n+50): continue
                xy = np.column_stack([xs, ys]).astype(np.int32)
                cv2.polylines(img, [xy], True, 255, 1)
                anz += 1
    return img, (cx, cy), anz

def skala_aus_titelblock(pdf_bgr, log):
    # Titelblock oben rechts, bei PD 7208 geprüft: keine Maßstabsangabe (nur 42+1,+2 / 43+1,+2).
    # Für andere PDs später Glyph-OCR einbauen. Fallback 1:2000 + Vermerk.
    log['skala_quelle'] = 'Fallback 1:2000 (Titelblock ohne Maßstabsangabe, PD 7208)'
    return 2000

def rastern(pdf_pfad, dpi=200):
    d = fitz.open(pdf_pfad); p = d[0]
    pix = p.get_pixmap(dpi=dpi)
    a = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    if pix.n == 4: bgr = cv2.cvtColor(a, cv2.COLOR_RGBA2BGR)
    elif pix.n == 1: bgr = cv2.cvtColor(a, cv2.COLOR_GRAY2BGR)
    else: bgr = cv2.cvtColor(a, cv2.COLOR_RGB2BGR)
    return bgr

def linien_flwbplmzk(bgr, schwelle=75):
    g = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    return (g < schwelle).astype(np.uint8) * 255

def linien_pdf(bgr, schwelle=140, dilate=1):
    """Schwarze Linien (Kataster-Grenzen) auf weißem PDF-Grund. Beschriftung + feine Signaturen
    bleiben als Rauschen drin, aber die 48 % Canny-Dichte entfällt."""
    g = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    m = (g < schwelle).astype(np.uint8) * 255
    if dilate > 0:
        kn = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (dilate*2+1, dilate*2+1))
        m = cv2.dilate(m, kn)
    return m

def dicker(mask, r=2):
    kn = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (r*2+1, r*2+1))
    return cv2.dilate(mask, kn)

def rotiere(mask, grad):
    if abs(grad) < 1e-6: return mask
    h, w = mask.shape
    M = cv2.getRotationMatrix2D((w/2, h/2), grad, 1.0)
    return cv2.warpAffine(mask, M, (w, h), flags=cv2.INTER_NEAREST, borderValue=0)

def best_mit_zweitbestem(res, sup_radius=50):
    _, mv, _, ml = cv2.minMaxLoc(res)
    res2 = res.copy()
    yy, xx = np.ogrid[:res.shape[0], :res.shape[1]]
    rr = (yy - ml[1])**2 + (xx - ml[0])**2
    res2[rr < sup_radius * sup_radius] = -1
    _, mv2, _, _ = cv2.minMaxLoc(res2)
    return mv, ml, mv2

def grobsuche(pdf_c, tpl_c):
    best = None  # (score, grad, loc, second)
    for grad in range(0, 360, 5):
        t = rotiere(tpl_c, grad)
        res = cv2.matchTemplate(pdf_c, t, cv2.TM_CCOEFF_NORMED)
        mv, ml, mv2 = best_mit_zweitbestem(res, sup_radius=12)
        if best is None or mv > best[0]: best = (mv, grad, ml, mv2)
    return best

def feinsuche(pdf_edges, tpl_full, grad_mitte, schritte=np.arange(-2.5, 2.5 + 1e-6, 0.5)):
    best = None
    for off in schritte:
        g = grad_mitte + off
        t = rotiere(tpl_full, g)
        res = cv2.matchTemplate(pdf_edges, t, cv2.TM_CCOEFF_NORMED)
        mv, ml, mv2 = best_mit_zweitbestem(res, sup_radius=50)
        if best is None or mv > best[0]: best = (mv, g, ml, mv2)
    am_rand = abs(best[1] - (grad_mitte - 2.5)) < 1e-6 or abs(best[1] - (grad_mitte + 2.5)) < 1e-6
    return best, am_rand

def flw_px_zu_welt(pts_flw, mitte_px, cx, cy, mpp=0.2):
    """flwbplmzk-Pixel → EPSG:31256 (m)."""
    pts = np.asarray(pts_flw, dtype=np.float64)
    mx = (pts[:,0] - mitte_px) * mpp + cx
    my = -(pts[:,1] - mitte_px) * mpp + cy
    return np.column_stack([mx, my])

def welt_zu_pdf(pts_welt, cx, cy, loc, tpl_shape, winkel_grad, pdf_px_pro_m):
    nh, nw = tpl_shape
    pts = np.asarray(pts_welt, dtype=np.float64)
    dx = (pts[:,0] - cx) * pdf_px_pro_m
    dy = -(pts[:,1] - cy) * pdf_px_pro_m
    a = np.radians(winkel_grad); c, s = np.cos(a), np.sin(a)
    rx = c*dx - s*dy; ry = s*dx + c*dy
    px = loc[0] + nw/2 + rx; py = loc[1] + nh/2 + ry
    return np.column_stack([px, py])

def medianabweichung_template(pdf_bgr, tpl_bild, cx, cy, loc, winkel, pdf_px_pro_m):
    pdf_edges = linien_pdf(pdf_bgr)
    ys, xs = np.nonzero(tpl_bild)
    if len(xs) == 0: return None
    dist = cv2.distanceTransform((255 - pdf_edges).astype(np.uint8), cv2.DIST_L2, 3)
    N = min(len(xs), 3000)
    idx = np.linspace(0, len(xs)-1, N, dtype=int)
    pts_tpl = np.column_stack([xs[idx], ys[idx]])
    # Template-Px → Welt-m → PDF-Px
    nh, nw = tpl_bild.shape
    # Template-Px (im nicht-rotierten Bild) entsprechen Welt-m relativ zum Template-Zentrum
    mx = cx + (pts_tpl[:,0] - nw/2) / pdf_px_pro_m
    my = cy - (pts_tpl[:,1] - nh/2) / pdf_px_pro_m
    pts_pdf = welt_zu_pdf(np.column_stack([mx, my]), cx, cy, loc, (nh, nw), winkel, pdf_px_pro_m)
    Hpdf, Wpdf = pdf_edges.shape
    g = (pts_pdf[:,0] >= 0) & (pts_pdf[:,0] < Wpdf) & (pts_pdf[:,1] >= 0) & (pts_pdf[:,1] < Hpdf)
    pts_pdf = pts_pdf[g]
    if len(pts_pdf) < 20: return None
    d_px = dist[pts_pdf[:,1].astype(int), pts_pdf[:,0].astype(int)]
    return float(np.median(d_px / pdf_px_pro_m))

def main():
    if len(sys.argv) < 3: print(__doc__); sys.exit(2)
    pd, kg_gnr = sys.argv[1], sys.argv[2]
    pdf = os.path.join(QE, f'plan_{pd}.pdf')
    flw = os.path.join(QE, f'{kg_gnr}.png')
    assert os.path.isfile(pdf), f'PDF fehlt: {pdf}'
    assert os.path.isfile(flw), f'flwbplmzk fehlt: {flw}'
    log = {}
    massstab = skala_aus_titelblock(None, log)
    # Skala flwbplmzk-Px (0,2 m/Px) → PDF-Px (bei 200 dpi und 1:massstab)
    # 1 Welt-m = PDF-mm × massstab/1000 → PDF-mm = 1000/massstab → PDF-px = 1000/massstab / PDF_MM_PRO_PX
    pdf_px_pro_m = 1000 / massstab / PDF_MM_PRO_PX
    skala = 0.2 * pdf_px_pro_m
    log['massstab'] = massstab; log['skala_faktor'] = skala
    print(f'PD {pd}  Grundstück {kg_gnr}  Maßstab 1:{massstab} ({log["skala_quelle"]})  Skala {skala:.4f}')
    t0 = time.time()
    pdf_bgr = rastern(pdf, 200)
    flw_bgr = cv2.imread(flw)
    print(f'  PDF {pdf_bgr.shape[:2]}  flwbplmzk {flw_bgr.shape[:2]}')
    pdf_edges = linien_pdf(pdf_bgr)
    # DKM-Vektoren aus lokalem Kataster rastern – ohne Text/Beschriftung.
    meta = json.load(open(os.path.join(QE, f'{kg_gnr}.json')))
    lon, lat = meta['punkt']
    tpl_full, welt_zentrum, anz_ringe = kataster_template(lon, lat, massstab, bereich_m=200)
    tpl_full = dicker(tpl_full, r=2)
    log['kataster_quelle'] = f'./kataster/16/*.json ({anz_ringe} Parzellen-Ringe im ±200 m-Fenster)'
    print(f'  Kataster-Template {tpl_full.shape} aus {anz_ringe} Ringen (EPSG:31256)')
    nh, nw = tpl_full.shape
    # flwbplmzk-shape nur für spätere Teilflächen-Übertragung; Welt→PDF-Transform ist weltzentriert.
    H_f, W_f = cv2.imread(flw).shape[:2]
    # Grobsuche auf 1/4 Auflösung
    k = 4
    tpl_c = cv2.resize(tpl_full, (nw//k, nh//k), interpolation=cv2.INTER_AREA)
    pdf_c = cv2.resize(pdf_edges, (pdf_edges.shape[1]//k, pdf_edges.shape[0]//k), interpolation=cv2.INTER_AREA)
    print(f'  Grobsuche 0-355° in 5°-Schritten ({len(range(0,360,5))} Winkel)…', end='', flush=True)
    bc = grobsuche(pdf_c, tpl_c); print(f' best {bc[0]:.3f} bei {bc[1]}°')
    print(f'  Feinsuche ±2,5° in 0,5°-Schritten um {bc[1]}°…', end='', flush=True)
    bf, am_rand = feinsuche(pdf_edges, tpl_full, bc[1]); print(f' best {bf[0]:.3f} bei {bf[1]}°')
    score, winkel, loc, second = bf
    delta = score - second
    cx, cy = welt_zentrum
    abw = medianabweichung_template(pdf_bgr, tpl_full, cx, cy, loc, winkel, pdf_px_pro_m)
    abw_txt = f'{abw:.2f} m' if abw is not None else 'n/a'
    print(f'  Score {score:.3f}  Δ-Zweitbest {delta:.3f}  Winkel {winkel:+.2f}°  Median {abw_txt}  randgefunden {am_rand}  ({time.time()-t0:.0f}s)')
    ok = (not am_rand) and (delta >= 0.02) and (abw is not None and abw < 0.6)
    print(f'  Erfolg Georef: {"ja" if ok else "NEIN"}  (randfein={am_rand}, delta≥0,02={delta>=0.02}, median<0,6={abw is not None and abw<0.6})')
    # Overlay: Teilflächen flwbplmzk-Px → Welt → PDF-Px
    tf = json.load(open(os.path.join(REPO, 'planleser', 'teilflaechen.json')))[kg_gnr]
    out = pdf_bgr.copy()
    mitte_flw = flw_bgr.shape[0] / 2
    for i, t in enumerate(tf['teile']):
        ring_flw = np.array(t['ring_px'], dtype=np.float32)
        ring_welt = flw_px_zu_welt(ring_flw, mitte_flw, cx, cy)
        ring_pdf = welt_zu_pdf(ring_welt, cx, cy, loc, (nh, nw), winkel, pdf_px_pro_m).astype(int)
        cv2.polylines(out, [ring_pdf], True, (0, 0, 255), 3)
        c = ring_pdf.mean(axis=0).astype(int)
        cv2.putText(out, f'tf{i}', tuple(c), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 3)
    # Template-Rahmen (= ±200 m Welt) im PDF einzeichnen
    ecken_welt = np.array([[cx-200,cy-200],[cx+200,cy-200],[cx+200,cy+200],[cx-200,cy+200]])
    ecken_pdf = welt_zu_pdf(ecken_welt, cx, cy, loc, (nh, nw), winkel, pdf_px_pro_m).astype(int)
    cv2.polylines(out, [ecken_pdf], True, (255, 128, 0), 3)
    overlay = os.path.join(QE, f'plan_{pd}_overlay.png')
    cv2.imwrite(overlay, out)
    print(f'  Overlay: {overlay}')
    if ok:
        out_json = os.path.join(REPO, 'planleser', 'bb_marken.json')
        alt = json.load(open(out_json)) if os.path.isfile(out_json) else {}
        alt[kg_gnr] = {'pd': pd, 'georef': {'massstab': massstab, 'skala_quelle': log['skala_quelle'],
            'winkel_grad': winkel, 'loc_pdf': list(loc), 'tpl_shape': [nh, nw],
            'score': score, 'delta_zweitbest': delta, 'median_abweichung_m': abw}, 'marken': []}
        json.dump(alt, open(out_json, 'w'), ensure_ascii=False, indent=2)
        print(f'  bb_marken.json geschrieben')
    else:
        print(f'  bb_marken.json NICHT geschrieben (Georef unreif)')
    sys.exit(0 if ok else 1)

if __name__ == '__main__': main()
