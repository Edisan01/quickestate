# Schritt 2 Stadt-Daten + Plandokument: Schutzzone, Wohnzone, Bausperre (Verschnitt mit dem Grundstück), Plandokument-Nr. + Kundmachung (WMS SCHNITTMUSTEROGD),
# Straßenfronten aus Widmungszonen (2. Beleg für Eck), Text des Plandokuments → allgemeine Bestimmungen (BB-Leser v204, unverändert).
# Daten: tools/pruefung/stadt/<kg>_<gnr>.json (Workflow pruefung-stadt.yml). Fehlt die Datei → alles offen.
import json, os, re, subprocess, math
from shapely.geometry import shape, Point
from shapely.ops import transform as _tr
import grundstueck as G
H = os.path.dirname(os.path.abspath(__file__)); R = os.path.abspath(os.path.join(H, '..', '..'))
V204 = os.path.join(R, 'tools', 'planleser_py', 'v204')
MIN_M2 = 1.0   # Verschnitt kleiner = nur Randberührung
def daten(e):
    f = os.path.join(H, 'stadt', f"{e['kg']}_{e['gnr'].replace('/', '-')}.json")
    return json.load(open(f)) if os.path.exists(f) else None
def flaechen(fc, filt=lambda p: True):
    out = []
    for f in (fc or {}).get('features', []):
        if f.get('geometry') and filt(f.get('properties') or {}):
            out.append((f['properties'], _tr(lambda x, y, z=None: G.TM(x, y), shape(f['geometry'])).buffer(0)))
    return out
def schnitt(g, fl): return [(p, round(g.intersection(s).area, 1)) for p, s in fl if g.intersects(s) and g.intersection(s).area >= MIN_M2]
def pd_text(nr):
    for d in (os.path.join(V204, 'texte'), os.path.join(R, 'plandokumente', 'text')):   # v204-Texte zuerst (auf sie ist der BB-Leser abgestimmt)
        f = os.path.join(d, f'{nr}.txt')
        if os.path.exists(f): return f
def bb_lesen(nr, plan_bb=None):
    f = pd_text(nr)
    if not f: return None
    r = subprocess.run(['node', os.path.join(V204, 'bb_cli.mjs'), f, json.dumps(plan_bb or {})], capture_output=True, text=True)
    return json.loads(r.stdout) if r.returncode == 0 else None
def strassenfronten(g, zonen):
    # Kante liegt an der Straße, wenn 4 m außerhalb keine Widmungszone liegt (wie export.py)
    out = []
    for a, b in G.seiten(g['poly']):
        L = math.dist(a, b)
        if L < 3: continue
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2; nx, ny = (b[1] - a[1]) / L, -(b[0] - a[0]) / L
        q = Point(mx + nx * 4, my + ny * 4)
        if g['poly'].contains(q): q = Point(mx - nx * 4, my - ny * 4)
        if not any(s.contains(q) for _, s in zonen): out.append((a, b, L))
    fr = []
    for a, b, L in out:
        for f in fr:
            d = abs(G.richtung(a, b) - f['r']); d = min(d, 180 - d)
            if d < 8: f['L'] += L; break
        else: fr.append(dict(r=G.richtung(a, b), L=L))
    return [round(f['L'], 2) for f in fr]
def ergaenzen(gs, e, adr):
    from pruefstand import feld
    d = daten(e)
    if not d: return
    g = G.grundstueck(e['kg'], e['gnr'].split('+'))
    if not g: return
    P = g['poly']; W = d['wfs']
    for k, L, filt in (('schutzzone', 'SCHUTZZONEOGD', lambda p: True), ('wohnzone', 'GRPZONENOGD', lambda p: 'WZ' in str(p.get('LAYER', ''))),
                       ('bausperre', None, lambda p: True)):
        fcs = [W.get('BAUSPERRE82OGD'), W.get('BAUSPERRE86OGD')] if L is None else [W.get(L)]
        if any(fc is None for fc in fcs): gs[k] = feld(None, 'offen', grund='Stadt-Daten nicht abrufbar'); continue
        s = [x for fc in fcs for x in schnitt(P, flaechen(fc, filt))]
        gs[k] = feld(bool(s), quelle='stadt ' + (L or 'BAUSPERRE82/86OGD') + (f" ({', '.join(str(p.get('SLANG') or p.get('LAYER') or '') + f' {m2} m²' for p, m2 in s)})" if s else ''))
    zonen = flaechen(W.get('GENFLWIDMUNGOGD'))
    if zonen:
        fr = strassenfronten(g, zonen); kat = (gs.get('fronten_m') or {}).get('wert') or []
        gleich = bool(kat) and len(fr) >= 1 and abs(max(fr) - kat[0]) <= 0.6
        gs['fronten_m'] = feld(fr, 'bestaetigt' if gleich else 'offen', 'kataster-Seiten + Stadt-Zonen (4 m außerhalb keine Zone)' + ('' if gleich else f'; Leser-Front {kat}'))
        gs['eckgrundstueck'] = feld(len(fr) >= 2, 'bestaetigt' if gleich else 'offen', 'Stadt-Zonen + Kataster')
    pd = [p for p in d.get('pd', []) if re.fullmatch(r'\d{3,5}[A-Z]?', p.get('PLANNUMMER', '').strip())]
    if pd:
        fest = [p for p in pd if 'Festsetz' in p.get('PLANTYP_TXT', '')] or pd
        def dat(p):
            m = re.match(r'(\d\d)\.(\d\d)\.(\d{4})', p.get('KUNDMACHUNG', '')); return m.group(3) + m.group(2) + m.group(1) if m else ''
        h = max(fest, key=dat)
        gs['plandokument_nr'] = feld(h['PLANNUMMER'].strip(), quelle='stadt WMS SCHNITTMUSTEROGD', grund=None if len(pd) == 1 else 'alle: ' + ', '.join(f"{p['PLANNUMMER']} {p.get('PLANTYP_TXT', '')} {p.get('KUNDMACHUNG', '')}" for p in pd))
        gs['kundmachung'] = feld(h.get('KUNDMACHUNG') or None, quelle='stadt WMS SCHNITTMUSTEROGD')
        r = bb_lesen(h['PLANNUMMER'].strip())
        if r is None: gs['allgemeine_bestimmungen'] = feld(None, 'offen', grund=f"Text Plandokument {h['PLANNUMMER']} fehlt"); return
        # allgemein = Treffer ohne BB-Bezug (v204 überspringt BB-Sätze, solange die BB nicht gewählt ist); Kopfzeile „ohne Plandarstellung“ wird in -layout-Texten oft nicht erkannt
        allg = [t['text'] if isinstance(t.get('text'), str) else t['art'] for t in r['treffer'] if not t.get('bb') and not t.get('teilweise')]
        if any(t['id'] == 'vorbauten_nein' and not t.get('bb') for t in r['treffer']):
            # v204-Text nennt nur „Erker/Balkone“ → welche Vorbauten genau, steht im Satz des PD (z. B. auch Loggien)
            roh = re.sub(r'-\s*\n\s*', '', open(pd_text(h['PLANNUMMER'])).read()); roh = re.sub(r'\s+', ' ', roh)
            for satz in re.split(r'(?<=[.;])\s', roh):
                if re.search(r'(Erker|Balkon|Loggi)', satz) and re.search(r'unzul[äa]ssig|nicht\s+zul[äa]ssig|untersagt|nicht\s+gestattet', satz):
                    w = sorted(set(re.findall(r'Erker|Balkon|Loggi', satz)), key=['Erker', 'Balkon', 'Loggi'].index)
                    allg.append('Laut PD-Satz unzulässig: ' + ', '.join({'Erker': 'Erker', 'Balkon': 'Balkone', 'Loggi': 'Loggien'}[x] for x in w)); break
        gs['allgemeine_bestimmungen'] = feld(allg, quelle=f"Plandokument {h['PLANNUMMER']} (BB-Leser v204)")
        gs['pd_bb'] = feld({p['nr']: p['text'] for p in r['plan']}, quelle=f"Plandokument {h['PLANNUMMER']}")
