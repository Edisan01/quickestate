# Import der vom Mac geholten Rohdaten (~/Downloads/qe_pruefung/out, holen.py) → tools/pruefung/stadt/*.json, Planbilder (pb/), PD-Texte.
# Aufruf: python3 mac_import.py <out-Ordner> <planbild-Ziel>
import json, os, re, sys, glob, subprocess, tempfile, datetime, cv2, numpy as np
H = os.path.dirname(os.path.abspath(__file__)); R = os.path.abspath(os.path.join(H, '..', '..'))
SRC, PB = sys.argv[1], sys.argv[2]; os.makedirs(PB, exist_ok=True); os.makedirs(os.path.join(H, 'stadt'), exist_ok=True)
LAYER = ['GENFLWIDMUNGOGD', 'SCHUTZZONEOGD', 'GRPZONENOGD', 'BAUSPERRE82OGD', 'BAUSPERRE86OGD']
for d in sorted(glob.glob(os.path.join(SRC, '*_*'))):
    if not os.path.isdir(d) or not os.path.exists(os.path.join(d, 'meta.json')): continue
    m = json.load(open(os.path.join(d, 'meta.json'))); k = os.path.basename(d)
    r = {'name': m['name'], 'kg': m['kg'], 'gnr': m['gnr'], 'punkt': m['punkt'], 'geholt': datetime.date.today().isoformat(), 'quelle': 'Mac holen.py', 'wfs': {}, 'pd': []}
    for L in LAYER:
        f = os.path.join(d, L + '.json')
        try: r['wfs'][L] = json.load(open(f))
        except Exception: r['wfs'][L] = None
    for f in sorted(glob.glob(os.path.join(d, 'pd*.xml'))):
        for mm in re.finditer(rb'<FIELDS\b([^>]*)>', open(f, 'rb').read()):
            a = {x.decode(): y.decode('utf-8', 'replace') for x, y in re.findall(rb'(\w+)="([^"]*)"', mm.group(1))}
            if a not in r['pd']: r['pd'].append(a)
    json.dump(r, open(os.path.join(H, 'stadt', k + '.json'), 'w'), ensure_ascii=False)
    # Planbild 7×7 Kacheln → ein Bild (wie planbild_holen.py)
    R_ = 3; im = np.full(((2 * R_ + 1) * 256, (2 * R_ + 1) * 256, 3), 255, np.uint8); fehlt = 0
    for dx in range(2 * R_ + 1):
        for dy in range(2 * R_ + 1):
            f = os.path.join(d, f"k_{m['x0'] + dx}_{m['y0'] + dy}.jpeg"); t = cv2.imread(f) if os.path.exists(f) else None
            if t is None: fehlt += 1; continue
            im[dy * 256:(dy + 1) * 256, dx * 256:(dx + 1) * 256] = t[:256, :256]
    cv2.imwrite(os.path.join(PB, k + '.png'), im); json.dump(m, open(os.path.join(PB, k + '.json'), 'w'), ensure_ascii=False)
    print(k, m['name'], 'PD', sorted({p.get('PLANNUMMER') for p in r['pd']}), 'Kacheln fehlen', fehlt)
idx_f = os.path.join(R, 'plandokumente', 'index.json'); idx = json.load(open(idx_f))
for f in sorted(glob.glob(os.path.join(SRC, 'PD_*.pdf'))):
    nr = os.path.basename(f)[3:-4]
    with tempfile.TemporaryDirectory() as t:
        seiten = int((re.search(r'Pages:\s+(\d+)', subprocess.run(['pdfinfo', f], capture_output=True, text=True).stdout) or [0, 0])[1])
        txt = subprocess.run(['pdftotext', '-layout', f, '-'], capture_output=True, text=True).stdout; ocr = False
        if len(re.sub(r'\s', '', txt)) < 200 * max(1, seiten):   # gescannt → Texterkennung (wie pd_sammeln.py)
            subprocess.run(['pdftoppm', '-r', '300', '-gray', f, os.path.join(t, 's')]); teile = []
            for b in sorted(x for x in os.listdir(t) if x.startswith('s')):
                teile.append(subprocess.run(['tesseract', os.path.join(t, b), '-', '-l', 'deu', '--psm', '6'], capture_output=True, text=True).stdout)
            txt, ocr = '\n\f'.join(teile), True
    open(os.path.join(R, 'plandokumente', 'text', nr + '.txt'), 'w').write(txt)
    idx[nr] = dict(idx.get(nr, {}), seiten=seiten, ocr=ocr, zeichen=len(txt), geholt=datetime.date.today().isoformat())
    print('PD', nr, seiten, 'S.', 'OCR' if ocr else 'Text', len(txt))
json.dump(idx, open(idx_f, 'w'), ensure_ascii=False, indent=0, sort_keys=True)
