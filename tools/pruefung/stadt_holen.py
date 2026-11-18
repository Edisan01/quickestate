# Stadt-Daten je Prüfadresse holen (läuft als GitHub Action; Sandbox/Mac erreichen data.wien.gv.at nicht).
# Ebenen: GENFLWIDMUNGOGD, SCHUTZZONEOGD, GRPZONENOGD (Wohnzone), BAUSPERRE82/86OGD + WMS SCHNITTMUSTEROGD (Plandokument-Nr., Kundmachung).
# Aufruf: python3 stadt_holen.py stadt_auftrag.json stadt/   → stadt/<kg>_<gnr>.json ; druckt Plandokument-Nummern (Komma-Liste) als letzte Zeile
import json, sys, os, urllib.request, time, re
A = json.load(open(sys.argv[1])); OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
UA = {'User-Agent': 'quickestate.at Pruefstand (eb@quickestate.at)'}
def hole(u):
    for v in range(4):
        try: return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40).read()
        except Exception as e: print('Fehler', v, u[:100], e, flush=True); time.sleep(5 * (v + 1))
LAYER = ['GENFLWIDMUNGOGD', 'SCHUTZZONEOGD', 'GRPZONENOGD', 'BAUSPERRE82OGD', 'BAUSPERRE86OGD']
alle = set()
for name, kg, gnr, lon, lat in A:
    d = 0.0012; r = {'name': name, 'kg': kg, 'gnr': gnr, 'punkt': [lon, lat], 'geholt': time.strftime('%Y-%m-%d'), 'wfs': {}, 'pd': []}
    for L in LAYER:
        u = ('https://data.wien.gv.at/daten/geo?service=WFS&request=GetFeature&version=1.0.0&typeName=ogdwien:' + L +
             '&srsName=EPSG:4326&outputFormat=json&maxFeatures=300&bbox=%f,%f,%f,%f,EPSG:4326' % (lon - d, lat - d * 0.67, lon + d, lat + d * 0.67))
        b = hole(u); r['wfs'][L] = json.loads(b) if b else None; time.sleep(1)
    for dx, dy in [(0, 0), (0.00006, 0.00004)]:
        x, y = lon + dx, lat + dy
        u = ('https://data.wien.gv.at/daten/wms?service=WMS&request=GetFeatureInfo&version=1.1.1&layers=SCHNITTMUSTEROGD&query_layers=SCHNITTMUSTEROGD'
             '&styles=&srs=EPSG:4326&bbox=%.6f,%.6f,%.6f,%.6f&width=101&height=101&x=50&y=50&info_format=text/xml&feature_count=10') % (x - 0.0005, y - 0.0002, x + 0.0005, y + 0.0002)
        b = hole(u) or b''
        for m in re.finditer(rb'<FIELDS\b([^>]*)>', b):
            a = {k.decode(): v.decode('utf-8', 'replace') for k, v in re.findall(rb'(\w+)="([^"]*)"', m.group(1))}
            if a not in r['pd']: r['pd'].append(a)
        time.sleep(1)
    for p in r['pd']:
        if re.fullmatch(r'\d{3,5}[A-Z]?', p.get('PLANNUMMER', '').strip()): alle.add(p['PLANNUMMER'].strip())
    json.dump(r, open(os.path.join(OUT, f"{kg}_{gnr.replace('/', '-')}.json"), 'w'), ensure_ascii=False)
    print('ok', name, [p.get('PLANNUMMER') for p in r['pd']], flush=True)
print(','.join(sorted(alle)))
