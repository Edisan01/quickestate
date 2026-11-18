# Prüfstand (Wissensbasis/23, Schritt 14): Leser-Ausgabe → Schema (Adapter) → Vergleich gegen soll.json.
# Aufruf: python3 pruefstand.py            Bericht + Regressionsprüfung gegen stand.json (Exit 1, wenn ein grünes Feld nicht mehr grün ist)
#         python3 pruefstand.py --speichern Bericht + neuen Stand speichern (nur wenn keine Regression)
# Vergleich: Planzahlen exakt · Kataster-Maße ± 0,6 m · Flächen ± 2 % · Texte über Schlüsselwörter.
import json, os, re, sys
H = os.path.dirname(os.path.abspath(__file__)); R = os.path.abspath(os.path.join(H, '..', '..'))
SCHEMA = json.load(open(os.path.join(H, 'pruefschema.json'))); SOLL = json.load(open(os.path.join(H, 'soll.json')))
TOL_M = SCHEMA['toleranzen']['planzahl_gegen_messung_m']; TOL_P = SCHEMA['toleranzen']['summe_gegen_grundbuch_prozent']
import grundstueck as G
import stadt as ST

def num(s):
    if s is None: return None
    if isinstance(s, (int, float)): return float(s)
    m = re.search(r'\d+(?:[,.]\d+)?', str(s)); return float(m.group().replace(',', '.')) if m else None
def norm_w(s): return re.sub(r'\s+', '', s or '')
def bb_nr(s):
    m = re.search(r'BB\s?(\d+)', s or ''); return m.group(1) if m else None
SCHLUESSEL = [r'\d+,\d\s?m', r'Erker', r'Balkon', r'Loggi', r'Flachdach', r'unterird', r'\d+\s?%', r'25 m']
def schluessel(s):
    out = set()
    for rx in SCHLUESSEL:
        for x in re.findall(rx, s or '', re.I): out.add(re.sub(r'\s', '', x.lower()))
    return out

# ---------- Adapter: heutige Leser-Ausgabe → Schema (fehlt = offen) ----------
def feld(wert=None, zustand=None, quelle=None, grund=None):
    if zustand is None: zustand = 'offen' if wert is None else 'bestaetigt'
    d = {'wert': wert, 'zustand': zustand}
    if quelle: d['quelle'] = quelle
    if grund: d['grund'] = grund
    return d
ART = {'strasse': 'strassentrakt', 'vorgarten': 'vorgarten', 'abtretung': 'abtretung', 'frei': 'abstandsstreifen'}
def adapter(e, adr):
    pd = e.get('plandokument') or {}
    ist = {'grundstueck': {f['id']: feld() for f in SCHEMA['grundstueck']}, 'pro_front': {f['id']: feld() for f in SCHEMA['pro_front']}, 'teilflaechen': []}
    gs = ist['grundstueck']
    if pd.get('nr'): gs['plandokument_nr'] = feld(pd['nr'], quelle='plandokumente.json')
    allg = [' '.join(a) for a in pd.get('allgemein', [])]
    if allg: gs['allgemeine_bestimmungen'] = feld(allg, quelle='plandokument_text')
    G.ergaenzen(gs, e, adr)
    ST.ergaenzen(gs, e, adr)
    pf = ist['pro_front']
    for t in e['teile']:
        p = t['plan']; art = ART.get(t['rolle'], 'hof')
        tf = {f['id']: feld() for f in SCHEMA['teilflaeche']}
        tf['art'] = feld(art, quelle='leser')
        tf['farbe'] = feld({'abtretung': 'rot'}.get(art, 'gruen' if t['art'] in ('G', 'vorgarten', 'frei') else 'blau'), quelle='regel')
        if t['art'] == 'G' or p.get('widmung') == 'G':
            tf['widmung'] = feld('G', quelle='plan')
            for k in ('bauklasse', 'hoehe_m', 'bauweise'): tf[k] = feld(zustand='trifft_nicht_zu', grund='G nicht bebaubar')
        elif t['art'] in ('abtretung',):
            for k in ('widmung', 'bauklasse', 'hoehe_m', 'bauweise'): tf[k] = feld(zustand='trifft_nicht_zu', grund='Grundabtretung')
        elif p.get('widmung'):
            zwei = p.get('quelle_widmung') == 'plan' and t.get('stadt_plan_gleich')
            tf['widmung'] = feld(p['widmung'], 'bestaetigt' if zwei else 'offen', 'stadt+plan' if zwei else p.get('quelle_widmung'))
            zwei = p.get('quelle_bauklasse') == 'plan' and t.get('stadt_plan_gleich')
            if p.get('bauklasse'): tf['bauklasse'] = feld(p['bauklasse'], 'bestaetigt' if zwei else 'offen', 'stadt+plan' if zwei else p.get('quelle_bauklasse'))
            if p.get('hoehe'): tf['hoehe_m'] = feld(num(p['hoehe']), quelle='plan')
            if p.get('bauweise'): tf['bauweise'] = feld(p['bauweise'], quelle='plan')
        if p.get('bb'):
            tf['bb'] = feld([p['bb'] + (': ' + p['bb_text'] if p.get('bb_text') else '')], 'bestaetigt' if bb_nr(p['bb']) else 'offen', 'plan')
        elif t['art'] != 'abtretung':
            tf['bb'] = feld([], 'offen', 'plan', 'keine BB gelesen – Abgleich PD offen')
        tf['flaeche_m2'] = feld(t.get('m2_plan'), 'offen', 'planfläche (gemessen)')
        if art == 'strassentrakt':
            ti = t.get('tiefe') or {}
            if ti.get('plan') is not None:
                v = ti['plan']; tf['tiefe_links_m'] = feld(v, quelle='planzahl'); tf['tiefe_rechts_m'] = feld(v, quelle='planzahl'); tf['tiefe_mittel_m'] = feld(v, quelle='planzahl')
                pf['trakttiefe_m'] = feld(v, 'bestaetigt' if ti.get('ok') else 'offen', 'planzahl+messung' if ti.get('ok') else 'planzahl')
            sb = t.get('strassenbreite') or {}
            if sb.get('plan') is not None: pf['strassenbreite_m'] = feld(sb['plan'], 'bestaetigt' if sb.get('ok') else 'offen', 'planzahl+messung')
            elif sb.get('gemessen') is not None: pf['strassenbreite_m'] = feld(None, 'offen', grund=f"keine Planzahl, gemessen {sb['gemessen']}")
            vg = t.get('vorgarten')
            if vg and vg.get('plan') is not None: pf['vorgarten_m'] = feld(vg['plan'], quelle='planzahl+messung')
        ist['teilflaechen'].append(tf)
    abt = [t for t in e['teile'] if t['art'] == 'abtretung']
    pf['abtretung'] = feld(bool(abt), quelle='leser') if e['teile'] else feld()
    return ist

# ---------- Vergleich ----------
def vgl(art, soll, ist):
    if ist is None: return 'offen'
    if art == 'exakt': return 'gruen' if abs(num(ist) - soll) < 0.005 else 'rot'
    if art == 'masz': return 'gruen' if abs(num(ist) - soll) <= TOL_M else 'rot'
    if art == 'flaeche': return 'gruen' if abs(num(ist) - soll) <= soll * TOL_P / 100 else 'rot'
    if art == 'text': return 'gruen' if norm_w(str(ist)) == norm_w(str(soll)) else 'rot'
    if art == 'bool': return 'gruen' if bool(ist) == bool(soll) else 'rot'
TF_ART = {'widmung': 'text', 'bauklasse': 'text', 'bauweise': 'text', 'hoehe_m': 'exakt', 'breite_m': 'masz', 'tiefe_links_m': 'masz', 'tiefe_rechts_m': 'masz', 'tiefe_mittel_m': 'masz', 'flaeche_m2': 'flaeche', 'bb_flaeche_m2': 'flaeche', 'hoehe_summe_m': 'exakt', 'geschosse': 'exakt'}
def vgl_bb(soll, ist):
    if ist is None: return 'offen'
    if not soll: return 'gruen' if not ist else 'rot'
    if not ist: return 'offen'
    txt = ' '.join(ist)
    for s in soll:
        n = bb_nr(s)
        if n and n != bb_nr(txt): return 'rot' if bb_nr(txt) else 'offen'
        k = schluessel(s.split(':', 1)[-1])
        if k and not k <= schluessel(txt): return 'offen'
    return 'gruen'
def vgl_allg(soll_item, ist):
    if not ist: return 'offen'
    return 'gruen' if schluessel(soll_item) <= schluessel(' '.join(ist)) else 'offen'

def pruefen():
    erg = json.load(open(os.path.join(R, 'planleser', 'ergebnis.json')))
    nach_name = {v['name']: v for v in erg.values()}
    zeilen = {}; detail = {}
    for s in SOLL['adressen']:
        adr = s['adresse']; name = adr.split(',')[0]; e = nach_name.get(name)
        ist = adapter(e, adr) if e else None
        F = {}
        def setz(k, z, sw=None, iw=None): F[k] = (z, sw, iw)
        if not ist:
            setz('adresse', 'offen'); zeilen[adr] = F; continue
        gs, pf = ist['grundstueck'], ist['pro_front']
        for k, v in s.get('grundstueck', {}).items():
            if k.startswith('_'): continue
            iw = gs.get(k, {}).get('wert')
            setz('gs.' + k, vgl('flaeche' if k == 'flaeche_grundbuch' else 'bool', v, iw), v, iw)
        if 'plandokument' in s: iw = gs['plandokument_nr']['wert']; setz('gs.plandokument_nr', vgl('text', s['plandokument'], iw), s['plandokument'], iw)
        for i, a in enumerate(s.get('allgemeine_bestimmungen', [])):
            setz(f'allg.{i}', vgl_allg(a, gs['allgemeine_bestimmungen']['wert']), a, None)
        for k, v in s.get('pro_front', {}).items():
            if k.startswith('_') or k in ('abtretung_masse', 'arkade_m'):
                if k in ('abtretung_masse', 'arkade_m'): setz('front.' + k, 'offen', v, None)
                continue
            iw = pf.get(k, {}).get('wert')
            setz('front.' + k, vgl('bool' if k == 'abtretung' else 'exakt', v, iw), v, iw)
        # Straßenfront (Kataster) = Summe der Straßentrakt-Breiten laut Blatt; bei Abtretung „Tiefe × Länge“ = Länge
        fr = (gs.get('fronten_m') or {}).get('wert') or [None]
        sb = [t['breite_m'] for t in s.get('teilflaechen', []) if t['art'] == 'strassentrakt' and 'breite_m' in t]
        if sb: setz('gs.front_m', vgl('masz', sum(sb), fr[0]), sum(sb), fr[0])
        am = re.findall(r'\d+(?:,\d+)?', s.get('pro_front', {}).get('abtretung_masse', ''))
        if len(am) == 2: setz('gs.front_m', vgl('masz', num(am[1]), fr[0]), num(am[1]), fr[0])
        # Teilflächen zuordnen: gleiche Art, in Reihenfolge
        frei = list(ist['teilflaechen'])
        for i, st in enumerate(s.get('teilflaechen', [])):
            kand = [t for t in frei if t['art']['wert'] == st['art']]
            t = kand[0] if kand else None
            if t: frei.remove(t)
            for k, v in st.items():
                if k == 'art': continue
                key = f'tf{i}.{st["art"]}.{k}'
                if t is None: setz(key, 'offen', v); continue
                if k == 'bb': setz(key, vgl_bb(v, t['bb']['wert'] if t['bb']['zustand'] == 'bestaetigt' or t['bb']['wert'] else None), v, t['bb']['wert']); continue
                if k == 'tiefe_m':
                    iw = t['tiefe_mittel_m']['wert']; a = 'exakt' if st['art'] == 'strassentrakt' else 'masz'
                    setz(key, vgl(a, v, iw), v, iw); continue
                iw = (t.get(k) or {}).get('wert')
                setz(key, vgl(TF_ART.get(k, 'text'), v, iw), v, iw)
        if 'summe_m2' in s: setz('summe_m2', 'offen', s['summe_m2'])
        for k, v in s.get('rechnungen', {}).items(): setz('rech.' + k, 'offen', v)
        for i, h in enumerate(s.get('hinweise', [])): setz(f'hinweis.{i}', 'offen', h)
        zeilen[adr] = F; detail[adr] = ist
    return zeilen, detail

def bericht(zeilen):
    print(f"{'Adresse':24} {'grün':>5} {'rot':>4} {'offen':>5} {'%':>5}")
    G_ = R_ = O_ = 0
    for adr, F in zeilen.items():
        g = sum(1 for z in F.values() if z[0] == 'gruen'); r = sum(1 for z in F.values() if z[0] == 'rot'); o = len(F) - g - r
        G_ += g; R_ += r; O_ += o
        print(f"{adr.split(',')[0][:24]:24} {g:5} {r:4} {o:5} {100 * g / max(1, len(F)):5.0f}")
    n = G_ + R_ + O_
    print(f"{'GESAMT':24} {G_:5} {R_:4} {O_:5} {100 * G_ / max(1, n):5.0f}")
    if '-v' in sys.argv:
        print('\nrot:')
        for adr, F in zeilen.items():
            for k, z in F.items():
                if z[0] == 'rot': print(f"  {adr.split(',')[0][:18]:18} {k:28} soll={z[1]} ist={z[2]}")

if __name__ == '__main__':
    zeilen, detail = pruefen()
    json.dump(detail, open(os.path.join(H, 'ist.json'), 'w'), ensure_ascii=False, indent=1)
    bericht(zeilen)
    sp = os.path.join(H, 'stand.json')
    gruen = sorted(f'{a}|{k}' for a, F in zeilen.items() for k, z in F.items() if z[0] == 'gruen')
    alt = json.load(open(sp))['gruen'] if os.path.exists(sp) else []
    weg = [x for x in alt if x not in gruen]
    if weg:
        print('\nREGRESSION – grün → nicht grün:'); [print('  ', x) for x in weg]; sys.exit(1)
    neu = [x for x in gruen if x not in alt]
    print(f'\nneu grün: {len(neu)}')
    if '--neu' in sys.argv: [print('  ', x) for x in neu]
    if '--speichern' in sys.argv: json.dump({'gruen': gruen}, open(sp, 'w'), ensure_ascii=False, indent=0)
