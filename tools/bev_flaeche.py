# Amtliche Grundstücksflächen Wien aus dem BEV-Grundstücksverzeichnis (GPKG KAT_DKM_GST, CC BY 4.0).
# Aufruf: python3 bev_flaeche.py <gpkg> <ausgabe.json> [nur_schema]
# Ausgabe: {"stichtag": "...", "kg": {"01657": {"1496/78": 596, ...}, ...}}  – nur Wiener KGs (01xxx)
import sqlite3, json, sys
SRC, OUT = sys.argv[1], sys.argv[2]
c = sqlite3.connect(f'file:{SRC}?mode=ro', uri=True)
tab = [r[0] for r in c.execute("select name from sqlite_master where type in ('table','view') and name not like 'rtree%' and name not like 'gpkg%'")]
print('Tabellen:', tab)
for t in tab:
    cols = [r[1] for r in c.execute(f'pragma table_info("{t}")')]
    print(t, cols[:30])
if len(sys.argv) > 3:
    for t in tab:
        cols = [r[1] for r in c.execute(f'pragma table_info("{t}")')]
        kgc = next((x for x in cols if x.upper() in ('KG', 'KG_NR', 'KGNR', 'KG-NR')), None)
        if kgc:
            print('--', t, 'Beispiel 01657:')
            for r in c.execute(f'select * from "{t}" where "{kgc}" in (\'01657\', 1657) limit 3'): print([str(v)[:40] for v in r])
    sys.exit()
t = next(x for x in tab if 'grundst' in x.lower() and 'verz' in x.lower())
cols = [r[1] for r in c.execute(f'pragma table_info("{t}")')]
U = {x.upper(): x for x in cols}
kgc = next(U[k] for k in ('KG', 'KG_NR', 'KGNR', 'KG-NR') if k in U)
gc = next(U[k] for k in ('GNR', 'GST_NR', 'GST', 'GSTNR', 'GST-NR') if k in U)
fc = next(U[k] for k in ('FLAECHE', 'FL', 'GESAMTFLAECHE') if k in U)
out = {}
for kg, gnr, fl in c.execute(f'select "{kgc}", "{gc}", "{fc}" from "{t}" where cast("{kgc}" as text) like \'01%\' or cast("{kgc}" as integer) between 1000 and 1999'):
    k = str(kg).zfill(5); g = str(gnr).strip()
    if fl is None: continue
    out.setdefault(k, {}); out[k][g] = out[k].get(g, 0) + float(fl)   # mehrere Nutzungszeilen → Summe = Gesamtfläche
for k in out:
    for g in out[k]: out[k][g] = round(out[k][g]) if abs(out[k][g] - round(out[k][g])) < 1e-6 else round(out[k][g], 2)
json.dump({'quelle': 'BEV Grundstücksverzeichnis (CC BY 4.0)', 'stichtag': SRC.rsplit('_', 1)[-1].split('.')[0], 'kg': out}, open(OUT, 'w'), separators=(',', ':'), ensure_ascii=False)
print('KGs', len(out), 'Grundstücke', sum(len(v) for v in out.values()), 'Test 01657 1496/78 =', out.get('01657', {}).get('1496/78'))
