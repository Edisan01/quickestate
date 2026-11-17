#!/usr/bin/env python3
"""Plandokumente der Stadt Wien sammeln (läuft als GitHub Action, nicht im Browser).

1. Liste: für jeden Baublock (OGD BAUBLOCKOGD) per WMS SCHNITTMUSTEROGD nachfragen, welches Plandokument gilt
   → plandokumente/liste.json  {nr: {"kund": "TT.MM.JJJJ", "art": "Festsetzung"}}
2. Text: je Plandokument „Gesamten Text“ (GetPlanDok.aspx?pnr=…&isPlan=false) laden, Text auslesen
   (pdftotext; gescannte Seiten per Texterkennung tesseract deu) → plandokumente/text/<nr>.txt
3. Verzeichnis: plandokumente/index.json  {nr: {"kund", "art", "seiten", "ocr", "zeichen", "geholt"}}
Nur neue oder geänderte Plandokumente werden geholt; Zeitbudget je Lauf begrenzt, Rest beim nächsten Lauf.
Quelle: Stadt Wien – wien.gv.at / data.wien.gv.at (amtliche Dokumente).
"""
import json, os, re, subprocess, sys, tempfile, time, datetime, urllib.request, urllib.parse

WURZEL = os.path.join(os.path.dirname(__file__), '..', 'plandokumente')
TEXT = os.path.join(WURZEL, 'text')
UA = {'User-Agent': 'quickestate.at Plandokument-Sammler (Kontakt eb@quickestate.at)'}
BUDGET = float(os.environ.get('PD_BUDGET_MIN', '300')) * 60
START = time.time()
NUR = [n.strip().upper() for n in os.environ.get('PD_NUR', '').split(',') if n.strip()]


def hole(url, versuche=3, warte=1.5):
    for i in range(versuche):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except Exception as e:
            if i == versuche - 1:
                print('  Fehler', url[:90], e, flush=True)
                return None
            time.sleep(warte * (i + 1))


def lade_json(pfad, leer):
    try:
        with open(pfad, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return leer


def schreibe_json(pfad, daten):
    with open(pfad, 'w', encoding='utf-8') as f:
        json.dump(daten, f, ensure_ascii=False, indent=0, sort_keys=True)


def pd_am_punkt(lon, lat):
    u = ('https://data.wien.gv.at/daten/wms?service=WMS&request=GetFeatureInfo&version=1.1.1&layers=SCHNITTMUSTEROGD'
         '&query_layers=SCHNITTMUSTEROGD&styles=&srs=EPSG:4326&bbox=%.6f,%.6f,%.6f,%.6f&width=101&height=101&x=50&y=50'
         '&info_format=text/xml&feature_count=10') % (lon - 0.0005, lat - 0.0002, lon + 0.0005, lat + 0.0002)
    x = hole(u)
    if not x:
        return []
    L = []
    for m in re.finditer(r'<FIELDS\b([^>]*)>', x.decode('utf-8', 'replace')):
        a = lambda k: (re.search(r'\b%s="([^"]*)"' % k, m.group(1)) or [None, ''])[1]
        nr = a('PLANNUMMER').strip().upper()
        if re.fullmatch(r'\d{3,5}[A-Z0-9]{0,3}', nr):
            L.append((nr, a('KUNDMACHUNG'), a('PLANTYP_TXT')))
    return L


def innenpunkt(ring):
    xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
    return sum(xs) / len(xs), sum(ys) / len(ys)


def liste_erstellen():
    """Alle Baublöcke abfragen → Plandokument-Nummern. Blöcke seitenweise (WFS startIndex)."""
    liste = {}
    start, seite = 0, 1000
    while True:
        u = ('https://data.wien.gv.at/daten/geo?service=WFS&request=GetFeature&version=2.0.0&typeNames=ogdwien:BAUBLOCKOGD'
             '&srsName=EPSG:4326&outputFormat=json&count=%d&startIndex=%d&sortBy=OBJECTID') % (seite, start)
        roh = hole(u)
        if not roh:
            break
        fs = json.loads(roh).get('features', [])
        if not fs:
            break
        for f in fs:
            g = f.get('geometry') or {}
            ring = g.get('coordinates', [[]])[0] if g.get('type') == 'Polygon' else (g.get('coordinates', [[[]]])[0][0] if g.get('type') == 'MultiPolygon' else [])
            if len(ring) < 3:
                continue
            lon, lat = innenpunkt(ring)
            for nr, kund, art in pd_am_punkt(lon, lat):
                liste.setdefault(nr, {'kund': kund, 'art': art})
            time.sleep(0.05)
        print('Baublöcke', start + len(fs), '→ Plandokumente bisher', len(liste), flush=True)
        start += len(fs)
        if time.time() - START > BUDGET * 0.4:
            print('Zeitbudget für die Liste erreicht – Rest beim nächsten Lauf', flush=True)
            break
    return liste


def text_auslesen(pdf):
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, 'pd.pdf')
        open(p, 'wb').write(pdf)
        seiten = int((re.search(r'Pages:\s+(\d+)', subprocess.run(['pdfinfo', p], capture_output=True, text=True).stdout) or [0, 0])[1])
        txt = subprocess.run(['pdftotext', '-layout', p, '-'], capture_output=True, text=True).stdout
        ocr = False
        if len(re.sub(r'\s', '', txt)) < 200 * max(1, seiten):          # zu wenig Text → gescannt → Texterkennung
            subprocess.run(['pdftoppm', '-r', '300', '-gray', p, os.path.join(d, 's')], check=False)
            teile = []
            for b in sorted(x for x in os.listdir(d) if x.startswith('s')):
                teile.append(subprocess.run(['tesseract', os.path.join(d, b), '-', '-l', 'deu', '--psm', '6'], capture_output=True, text=True).stdout)
            txt, ocr = '\n\f'.join(teile), True
        return txt, seiten, ocr


def main():
    os.makedirs(TEXT, exist_ok=True)
    liste = lade_json(os.path.join(WURZEL, 'liste.json'), {})
    index = lade_json(os.path.join(WURZEL, 'index.json'), {})
    if NUR:
        ziel = {n: liste.get(n, {'kund': '', 'art': ''}) for n in NUR}
    else:
        neu = liste_erstellen()
        if neu:
            liste.update(neu)
            schreibe_json(os.path.join(WURZEL, 'liste.json'), liste)
        ziel = liste
    offen = [n for n, v in sorted(ziel.items()) if NUR or n not in index or index[n].get('kund') != v.get('kund')]
    print('Plandokumente gesamt', len(ziel), '– zu holen', len(offen), flush=True)
    for i, nr in enumerate(offen):
        if time.time() - START > BUDGET:
            print('Zeitbudget erreicht – Rest beim nächsten Lauf', flush=True)
            break
        pdf = hole('https://www.wien.gv.at/BauplatzWebservice/public/GetPlanDok.aspx?pnr=%s&planDpi=0&isPlan=false' % urllib.parse.quote(nr))
        if not pdf or not pdf.startswith(b'%PDF'):
            print('  ', nr, 'kein PDF', flush=True)
            continue
        txt, seiten, ocr = text_auslesen(pdf)
        open(os.path.join(TEXT, nr + '.txt'), 'w', encoding='utf-8').write(txt)
        index[nr] = {'kund': ziel[nr].get('kund', ''), 'art': ziel[nr].get('art', ''), 'seiten': seiten, 'ocr': ocr,
                     'zeichen': len(txt), 'geholt': datetime.date.today().isoformat()}
        print('  %s  %d S.  %s  %d Zeichen' % (nr, seiten, 'OCR' if ocr else 'Text', len(txt)), flush=True)
        if i % 25 == 24:
            schreibe_json(os.path.join(WURZEL, 'index.json'), index)
        time.sleep(0.5)
    schreibe_json(os.path.join(WURZEL, 'index.json'), index)


if __name__ == '__main__':
    main()
