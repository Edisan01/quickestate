#!/usr/bin/env python3
"""Abdeckungskarte PD vs. Prüfadressen (Befund-Werkzeug, Leser bleibt unverändert).

Liest alle Prüfadressen aus soll.json, holt für ihre Umgebung die Widmungsflächen
(GENFLWIDMUNGOGD, EPSG:31256) und zeichnet eine Karte. Jede Prüfadresse wird mit
ihrer verwendeten PD-Nummer beschriftet; markiert ob plan_<PD>.pdf lokal vorliegt.
Hinweis: OGD liefert heute keine PD-Nr pro Widmungsfläche – die Zuordnung „welches
PD gilt dort?" muss im Fachportal geprüft werden. Dieses Werkzeug ersetzt das nicht.

Nutzung: python3 tools/pruefung/pd_abdeckung.py
Schreibt ~/qe_planbilder/pd_abdeckung.png und gibt Tabelle auf stdout.
"""
import os, json, math, sys, urllib.request, urllib.parse, time
import cv2, numpy as np
from pyproj import Transformer

UA = 'quickestate.at Pruefstand (eb@quickestate.at)'
QE = os.path.expanduser('~/qe_planbilder')
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

def geocode(adr):
    url = 'https://data.wien.gv.at/daten/OGDAddressService.svc/GetAddressInfo?' + urllib.parse.urlencode({'Address': adr, 'crs': 'EPSG:4326'})
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    d = json.loads(urllib.request.urlopen(req, timeout=20).read())
    if d.get('features'): return tuple(d['features'][0]['geometry']['coordinates'])
    return None

def adresse_zu_lonlat(name):
    # 1) flwbplmzk-Metadaten im qe_planbilder/*.json durchsuchen
    import glob
    for jf in glob.glob(f'{QE}/*.json'):
        if jf.endswith('_tabelle.txt') or os.path.basename(jf).startswith('_'): continue
        try:
            d = json.load(open(jf))
            if d.get('name', '').startswith(name.split(',')[0]):
                return tuple(d['punkt'])
        except Exception: pass
    # 2) OGDAddressService
    return geocode(name)

def wfs_widmung(bb31256):
    url = (f'https://data.wien.gv.at/daten/geo?service=WFS&request=GetFeature&version=1.0.0'
           f'&typeName=ogdwien:GENFLWIDMUNGOGD&outputFormat=json'
           f'&bbox={bb31256[0]:.2f},{bb31256[1]:.2f},{bb31256[2]:.2f},{bb31256[3]:.2f},EPSG:31256')
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    return json.loads(urllib.request.urlopen(req, timeout=60).read())

FARBEN = {  # grobe Widmungs-Kategorien
    'W':  (170, 220, 160),  # Wohngebiet – grün-pastell
    'WG': (200, 200, 100),  # Wohn-Geschäft – gelb
    'WGV':(170, 190, 100),
    'G':  (180, 170, 200),  # Gemischt – lila
    'GB': (200, 150, 180),  # Gemischt BG
    'GBG':(190, 140, 170),
    'GBGV':(180, 130, 160),
    'EKZ':(150, 120, 200),
    'SO': (120, 160, 200),
    'IG': (100, 140, 200),
    'ES': (100, 180, 160),
}
def farbe(code):
    if not code: return (230, 230, 230)
    for pref in ('GBGV','GBG','GB','WGV','WG','EKZ','SO','IG','ES','W','G'):
        if code.startswith(pref): return FARBEN.get(pref, (200,200,200))
    return (200, 200, 200)

def main():
    s = json.load(open(f'{REPO}/tools/pruefung/soll.json'))
    tr = Transformer.from_crs('EPSG:4326', 'EPSG:31256', always_xy=True)
    adressen = []
    for a in s['adressen']:
        n = a['adresse']
        pd = a.get('plandokument') or ''
        lonlat = adresse_zu_lonlat(n)
        if lonlat is None: continue
        wx, wy = tr.transform(*lonlat)
        pdf_lokal = os.path.isfile(f'{QE}/plan_{pd}.pdf') if pd else False
        adressen.append({'name': n, 'pd': pd, 'lonlat': lonlat, 'welt31256': (wx, wy), 'pdf_lokal': pdf_lokal})
        time.sleep(0.5)  # falls geocode-Fallback
    # Bbox ± 400 m um jede Adresse
    buf = 400
    xs = [a['welt31256'][0] for a in adressen]
    ys = [a['welt31256'][1] for a in adressen]
    x1, y1 = min(xs)-buf, min(ys)-buf; x2, y2 = max(xs)+buf, max(ys)+buf
    print(f'BBox EPSG:31256 ({x1:.0f},{y1:.0f})-({x2:.0f},{y2:.0f})  = {int(x2-x1)}m × {int(y2-y1)}m')
    print(f'Hole Widmungsflächen …', flush=True)
    wd = wfs_widmung((x1, y1, x2, y2))
    feats = wd.get('features', [])
    print(f'Widmungs-Features: {len(feats)}')
    # Bild: 1 Welt-m = 2 Pixel
    skala = 2.0
    W = int((x2 - x1) * skala); H = int((y2 - y1) * skala)
    img = np.ones((H, W, 3), dtype=np.uint8) * 255
    def w_zu_px(x, y): return int((x - x1) * skala), int(H - (y - y1) * skala)
    # Widmungsflächen zeichnen
    from shapely.geometry import shape
    for f in feats:
        try:
            g = shape(f['geometry']); p = f['properties']
            col = farbe(p.get('WIDMUNG'))
            if g.geom_type == 'Polygon': gs = [g]
            elif g.geom_type == 'MultiPolygon': gs = list(g.geoms)
            else: continue
            for gg in gs:
                xy = [w_zu_px(x, y) for x, y in gg.exterior.coords]
                cv2.fillPoly(img, [np.array(xy, dtype=np.int32)], col)
                cv2.polylines(img, [np.array(xy, dtype=np.int32)], True, (100,100,100), 1)
        except Exception: pass
    # Adressen als Punkte + Label
    print(f'\\n{"Adresse":30} {"PD":>6} {"PDF":4} {"EPSG:31256"}')
    for a in adressen:
        px, py = w_zu_px(*a['welt31256'])
        col = (0, 180, 0) if a['pdf_lokal'] else (100, 100, 100)
        cv2.circle(img, (px, py), 10, col, -1)
        cv2.circle(img, (px, py), 10, (0,0,0), 2)
        label = f"{a['name'].split(',')[0]} PD{a['pd'] or '?'}"
        cv2.putText(img, label, (px+14, py+4), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0,0,0), 1)
        print(f"{a['name']:30} {a['pd']:>6} {('ja' if a['pdf_lokal'] else 'NEIN'):4} ({a['welt31256'][0]:7.1f}, {a['welt31256'][1]:9.1f})")
    # Legende + Titel
    cv2.rectangle(img, (0,0), (W, 50), (240,240,240), -1)
    cv2.putText(img, 'Abdeckungskarte: Pruefadressen + verwendete PD-Nr (Legende: Farbe=Widmung, gruen=PDF lokal, grau=fehlt).', (15, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,0), 1)
    out = f'{QE}/pd_abdeckung.png'
    cv2.imwrite(out, img)
    print(f'\\nKarte: {out}')
    return adressen

if __name__ == '__main__': main()
