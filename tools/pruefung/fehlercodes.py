"""Fehlercodes: jedes rote/offene Prüfstandsfeld → genau 1 Code (Schritt + Werkzeug + Gesetz). Zählung zeigt, wo zuerst gearbeitet wird."""
import json, os, re, sys, collections
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H); sys.argv = [sys.argv[0]]
import pruefstand as P
C = json.load(open(os.path.join(H, 'fehlercodes.json')))['codes']

def code_feld(k):
    t = [c['code'] for c in C if re.search(c['felder'], k)]
    return t

z, _ = P.pruefen()
ohne, doppelt, zaehl = [], [], collections.Counter()
for a, F in z.items():
    for k, v in F.items():
        if v[0] == 'gruen': continue
        t = code_feld(k)
        if not t: ohne.append(k)
        elif len(t) > 1: doppelt.append((k, t))
        else: zaehl[(t[0], v[0])] += 1
n = sum(zaehl.values()) + len(ohne) + len(doppelt)
print(f"Felder rot/offen: {n} | genau 1 Code: {sum(zaehl.values())} | ohne: {len(ohne)} | doppelt: {len(doppelt)}")
for k in ohne[:5]: print('  ohne', k)
for k, t in doppelt[:5]: print('  doppelt', k, t)
print('\nCode    rot offen  Werkzeug')
for c in C:
    r, o = zaehl[(c['code'], 'rot')], zaehl[(c['code'], 'offen')]
    if r or o: print(f"{c['code']:7} {r:3} {o:5}  {c['werkzeug']}")

if ohne or doppelt: sys.exit(1)
