# Testdaten: Flächenwidmungs-Zonen (OGD Stadt Wien, CC BY 4.0) um Testpunkte als GeoJSON speichern.
import json, sys, os, urllib.request, urllib.parse, time
F = json.load(open(sys.argv[1])); OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
LAYER = ['GENFLWIDMUNGOGD', 'SCHUTZZONEOGD']
for name, kg, gnr, pt in F:
    lon, lat = pt; d = 0.0025
    for L in LAYER:
        u = ('https://data.wien.gv.at/daten/geo?service=WFS&request=GetFeature&version=1.0.0&typeName=ogdwien:' + L +
             '&srsName=EPSG:4326&outputFormat=json&maxFeatures=500&bbox=%f,%f,%f,%f,EPSG:4326' % (lon - d, lat - d * 0.67, lon + d, lat + d * 0.67))
        for v in range(4):
            try:
                b = urllib.request.urlopen(u, timeout=30).read(); break
            except Exception as e: print('Fehler', name, L, e, flush=True); time.sleep(10)
        open(f'{OUT}/{kg}_{gnr.replace("/", "-")}_{L}.json', 'wb').write(b); print('ok', name, L, len(b), flush=True)
