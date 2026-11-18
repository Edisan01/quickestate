# Regel Eduard 18.11.2026: Widmung + Bauklasse aus den Stadt-Daten (GENFLWIDMUNGOGD) – der Planleser bestätigt nur.
# Widerspruch Plan ↔ Stadt sperrt die Adresse (manuelle Prüfung). Live nur, wenn jeder bebaubare Teil eine gelesene Bauweise hat.
import json, re, sys
ROEM = {'1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', '6': 'VI'}
def stadt(code):
    m = re.match(r'^([A-Z]+?)(\d)$', code or '')
    return (m.group(1), ROEM[m.group(2)]) if m else (None, None)
def regel(e):
    ok = True
    for t in e['teile']:
        if t['art'] != 'bebaubar': continue
        wk, bk = stadt((t.get('stadt') or {}).get('code'))
        if not wk: ok = False; continue
        pl = t['plan']
        if (pl.get('widmung') and pl.get('quelle_widmung') != 'stadt' and pl['widmung'] != wk) or (pl.get('bauklasse') and pl.get('quelle_bauklasse') != 'stadt' and pl['bauklasse'] != bk):
            t['stadt_plan_gleich'] = False; ok = False; continue
        pl.setdefault('quelle_widmung', 'plan' if pl.get('widmung') else 'stadt'); pl.setdefault('quelle_bauklasse', 'plan' if pl.get('bauklasse') else 'stadt')
        pl.setdefault('widmung', wk); pl.setdefault('bauklasse', bk)
        if pl.get('hoehe'):
            try: hv = float(pl['hoehe'].replace(' m', '').replace(',', '.'))
            except ValueError: hv = 0
            if not 2.5 <= hv <= 40: pl.pop('hoehe')
        t['stadt_plan_gleich'] = True
        if not pl.get('bauweise'): ok = False
    return ok
if __name__ == '__main__':
    alle = {}
    for f in sys.argv[2:]: alle.update(json.load(open(f)))
    live = {}
    for k, e in alle.items():
        g = regel(e); print(('LIVE ' if g else 'offen') + ' ' + e['name'], [(t['rolle'], t['art'], t['plan'].get('widmung'), t['plan'].get('bauklasse'), t['plan'].get('hoehe'), t['plan'].get('bauweise'), t['plan'].get('quelle_widmung')) for t in e['teile'] if t['art'] == 'bebaubar'])
        if g: live[k] = e
    json.dump(alle, open(sys.argv[1] + '/test.json', 'w'), ensure_ascii=False); json.dump(live, open(sys.argv[1] + '/ergebnis.json', 'w'), ensure_ascii=False)
