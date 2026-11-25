#!/usr/bin/env python3
"""ergebnis.json-Eintrag für Linzer Straße 22-24 (PD 6848).

Stand 25.11.2026 (Kataster+Adresspunkt-Prüfung Eduard 25.11.):
- Bauplatz = 3 GNR (347 + 343/1 + 338/1), Summe 2374 m² (BEV).
- 347: enthält Adresspunkt Linzer 22-24 + 22-24/1 → Regel (a) erfüllt.
- 343/1: kein Adresspunkt, nächster Adresspunkt Nr. 22-24/2 bei 3,1 m → Regel (b) über Nachbar 347.
- 338/1: enthält Adresspunkt 22-24/2 → Regel (a) erfüllt (enthält auch 20/3, Eckparzelle).
- 338/4: gehört laut Prüfung zur Hausnummer 20 (nächster Adresspunkt Nr. 20/3 bei 6,0 m,
  keine Nr. 22-24 im Umkreis) → NICHT aufnehmen.
- Netz liefert 3 Teilflächen: 888 (Straßentrakt GB III g), 1300 (Hof GBGV I + hinten W III,
  Trennlinie offen), 187 (Eckstück W III g rechts).
- Alle Teile tragen plan._in_pruefung → Darstellung mit gestricheltem Rand (CSS .zf.up).
"""
import json, math, pathlib

HOME = pathlib.Path.home()
REPO = pathlib.Path(__file__).resolve().parents[2]

# 338/4 gehört laut Kataster+Adresspunkt-Prüfung (25.11.2026) zur Hausnummer 20,
# nicht zu Linzer 22-24: 338/4 enthält keinen Adresspunkt der Nr. 22-24, nächster
# Adresspunkt ist Nr. 20/3 bei 6,0 m, Nr. 20 bei 17,8 m. Eduard 25.11.: NEIN.
GNR_338_4_DAZU = False  # Nicht wieder auf True setzen ohne Kataster+Adresspunkt-Beleg

META = json.load(open(HOME / "qe_planbilder" / "01210_347+343-1+338-1.json"))
TF = json.load(open(REPO / "planleser" / "teilflaechen.json"))["01210_347+343-1+338-1"]
ERG = REPO / "planleser" / "ergebnis.json"

def ll(x, y):
    n = 2 ** 19
    X = x / 256 + META["x0"]
    Y = y / 256 + META["y0"]
    lon = X / n * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * Y / n))))
    return [round(lon, 7), round(lat, 7)]


teile_px = TF["teile"]
teile = []
for t in teile_px:
    poly_ll = [ll(x, y) for x, y in t["ring_px"]]
    cy = sum(p[1] for p in t["ring_px"]) / len(t["ring_px"])
    cx = sum(p[0] for p in t["ring_px"]) / len(t["ring_px"])
    teile.append({
        "poly": [poly_ll],   # [ring] — eine Ebene weniger (Format wie Sommerschuhgasse)
        "flaeche_m2": t["flaeche_m2"],
        "cx_px": cx,
        "cy_px": cy,
    })

# Nach Fläche sortieren — klar erkennbar
by_area = sorted(teile, key=lambda t: -t["flaeche_m2"])
hof_gbgv_plus_w3 = by_area[0]   # 1300 m² = Hof GBGV I + Hof hinten W III zusammen
rest = by_area[1:]
rest.sort(key=lambda t: -t["cy_px"])   # südlichstes zuerst
strasse = rest[0]       # 888 m², unten
eckstueck = rest[1]      # 187 m², rechts

# Front = ganze Straßenkante des Straßentrakts über alle GNR.
# Methode: aus allen Polygon-Punkten die "südlichsten" (lat innerhalb Toleranz
# vom min_lat) nehmen, dann westlichsten vs. östlichsten = volle Breite.
def gcdist(a, b):
    kx = 111320 * math.cos(math.radians((a[1] + b[1]) / 2))
    return math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * 110574)

def frontkette(ring_ll, seite="sued"):
    """Kette der Polygon-Kanten, die an der angegebenen Seite liegen (relativ zum Centroid).
    Linzer Straße verläuft diagonal → Südkante besteht aus mehreren Polygon-Kanten.
    Rückgabe: (Anfangs-Punkt, End-Punkt, Summen-Länge in m)."""
    # Ring ohne Schluss-Duplikat
    r = [p for i, p in enumerate(ring_ll) if i == 0 or p != ring_ll[0]]
    r = ring_ll if len(r) < 3 else r
    cx = sum(p[0] for p in r) / len(r)
    cy = sum(p[1] for p in r) / len(r)
    # Welche Kanten liegen an der gesuchten Seite?
    def unten(p): return p[1] < cy   # kleinere Lat = südlicher
    def oben(p):  return p[1] > cy
    def east(p):  return p[0] > cx
    def west(p):  return p[0] < cx
    pred = {"sued": unten, "nord": oben, "ost": east, "west": west}[seite]
    n = len(r)
    kanten = []
    for i in range(n):
        a, b = r[i], r[(i + 1) % n]
        if pred(a) and pred(b):
            kanten.append((a, b, gcdist(a, b)))
    # Gesamt-Länge
    gesamt = sum(k[2] for k in kanten)
    if not kanten:
        return r[0], r[1], 0.0
    # Für "front[0]→front[1]" nehme ersten und letzten Endpunkt der Kette
    endpunkte = [kanten[0][0], kanten[-1][1]]
    # Sortiere: west zuerst (kleineres lon)
    endpunkte.sort(key=lambda p: p[0])
    return endpunkte[0], endpunkte[1], gesamt

strring = strasse["poly"][0]
fl_a, fl_b, L_linzer = frontkette(strring, "sued")
front_linzer = [fl_a, fl_b]
L_linzer = round(L_linzer, 1)

ecring = eckstueck["poly"][0]
fe_a, fe_b, L_seiten_ec = frontkette(ecring, "ost")
L_seiten = round(L_seiten_ec, 1)
front_seitenstr = [fe_a, fe_b]

# Plausibilitäts-Prüfung Front × Trakttiefe ≈ Fläche (±10 %)
TIEFE_STRASSENTRAKT = 15.0   # aus soll.json
A_err = abs(L_linzer * TIEFE_STRASSENTRAKT - strasse["flaeche_m2"]) / strasse["flaeche_m2"]
front_linzer_plausibel = A_err <= 0.10
print(f"Plausibilität Linzer-Front: {L_linzer} × {TIEFE_STRASSENTRAKT} = {L_linzer*TIEFE_STRASSENTRAKT:.0f} m² vs. Straßentrakt {strasse['flaeche_m2']:.0f} m² → Δ {A_err*100:.1f}% {'✓' if front_linzer_plausibel else '✗ (in Prüfung)'}")

entry = {
    "name": "Linzer Straße 22, 1140",
    "kg": "01210",
    "gnr": "347+343/1+338/1",
    "stand": "2026-11-24",
    "version": "planleser-py-2 (linzer22-handzuordnung)",
    "front": front_linzer,                 # Haupt-Front für Skizze (Linzer Straße)
    "fronten": [
        {"name": "Linzer Straße", "p": front_linzer, "m": L_linzer, "plausibel": front_linzer_plausibel,
         "_in_pruefung": None if front_linzer_plausibel else f"Front × Trakttiefe = {L_linzer*TIEFE_STRASSENTRAKT:.0f} m² vs. Straßentrakt {strasse['flaeche_m2']:.0f} m² (Δ {A_err*100:.0f} %)"},
        {"name": "Seitenstraße", "p": front_seitenstr, "m": L_seiten, "_in_pruefung": "Lage-Zuordnung über Eckstück-Polygon"},
    ],
    "fl": 2374,
    "teile_info": {"347": 1272, "343/1": 519, "338/1": 583},
    "gnr_belege": {"347": "BEV + Adresspunkt Nr. 22-24", "343/1": "BEV + Nachbar zu 347, nächster Adresspunkt Nr. 22-24/2", "338/1": "BEV + Adresspunkt Nr. 22-24/2 enthalten"},
    "teile": [
        {
            "rolle": "strasse",
            "art": "bebaubar",
            "stadt": {"widmung": "GB", "bauklasse": "III", "code": "GB3"},
            "plan": {
                "widmung": "GB", "bauklasse": "III", "bauweise": "g",
                "quelle_widmung": "pruefblatt", "quelle_bauklasse": "pruefblatt",
                "_in_pruefung": "Widmungs-Text im Plan noch nicht automatisch gelesen",
            },
            "stadt_plan_gleich": True,
            "anteil": round(strasse["flaeche_m2"] / 2375.0, 4),
            "m2_plan": round(strasse["flaeche_m2"], 1),
            "poly": strasse["poly"],
            "labels": [],
            "quelle": "netz",
            "tiefe": {"plan": 15.0, "gemessen": None, "ok": None, "_quelle": "soll.json / pruefblatt", "_in_pruefung": True, "box": None},
            "strassenbreite": None,
        },
        {
            "rolle": "hof",
            "art": "bebaubar",
            "stadt": {"widmung": "GB", "bauklasse": "I", "code": "GB1"},
            "plan": {
                "widmung": None, "bauklasse": None, "hoehe": None, "bauweise": None,
                "bb": "BB",
                "bb_text": "BB vorhanden – Nummer und Inhalt in Prüfung.",
                "_gemisch": True,   # ZART → 'zx' (GRAU) wegen Mischfläche
                "_in_pruefung": "Trennlinie fehlt – Netz-Polygon enthält Hof GBGV I 4,5 m g UND Hof hinten W III 15 m g zusammen (rote Planlinie im WMTS-Rot-Kanal nicht gelesen)",
                "_moegliche_widmungen": ["GBGV I 4,5 m g (BB)", "W III 15 m g"],
            },
            "stadt_plan_gleich": False,
            "anteil": round(hof_gbgv_plus_w3["flaeche_m2"] / 2375.0, 4),
            "m2_plan": round(hof_gbgv_plus_w3["flaeche_m2"], 1),
            "poly": hof_gbgv_plus_w3["poly"],
            "labels": [],
            "quelle": "netz",
            "tiefe": None,
            "strassenbreite": None,
        },
        {
            "rolle": "hof_rechts",
            "art": "bebaubar",
            "stadt": {"widmung": "W", "bauklasse": "III", "code": "W3"},
            "plan": {
                "widmung": "W", "bauklasse": "III", "bauweise": "g",
                "quelle_widmung": "pruefblatt", "quelle_bauklasse": "pruefblatt",
                "_rolle_vor": "Eckstück rechts (W III g)",
                "_in_pruefung": "Lage-Zuordnung aus Position im Mosaik (östliches Eck), Widmung aus soll.json",
            },
            "stadt_plan_gleich": True,
            "anteil": round(eckstueck["flaeche_m2"] / 2375.0, 4),
            "m2_plan": round(eckstueck["flaeche_m2"], 1),
            "poly": eckstueck["poly"],
            "labels": [],
            "quelle": "netz",
            "tiefe": None,
            "strassenbreite": None,
        },
    ],
    "plandokument": {
        "nr": "6848",
        "allgemein": [
            ["4,5 m", "Dach höchstens 4,5 m über Gebäudehöhe", "Im ganzen Plangebiet darf der höchste Punkt des Daches höchstens 4,5 m über der tatsächlich ausgeführten Gebäudehöhe liegen (3.1.2)."],
            ["Erker", "Keine Erker zur Straße", "An Gebäudefronten zu öffentlichen Verkehrsflächen keine Erker, Balkone, vorragende Loggien (Straßenbreite ≤ 16 m: bis 0,6 m, > 16 m: bis 0,8 m) (3.1.1)."],
            ["Garten", "Unbebaute Flächen begrünen", "Bebaubare, aber nicht bebaute Grundflächen sind gärtnerisch auszugestalten (3.1.3)."],
            ["2,0 m", "Zaun höchstens 2,0 m", "Einfriedungen seitlich/hinten max. 2,0 m, ab 0,5 m durchsichtig (3.1.4)."],
            ["5 m²", "Nebengebäude höchstens 5 m²", "Pro Bauplatz nur ein Nebengebäude, max. 5 m² bebaut (3.1.6)."],
            ["EG", "Fenster EG nicht zur Linzer Straße", "Fenster von Aufenthaltsräumen im Erdgeschoß nicht zur Linzer Straße gerichtet (3.2.3)."],
        ],
        "_in_pruefung": "PD-Zuordnung Hand (SCHNITTMUSTEROGD derzeit nicht erreichbar)",
    },
}

ERG_DATA = json.loads(ERG.read_text())
ERG_DATA["01210_347+343/1+338/1"] = entry
ERG.write_text(json.dumps(ERG_DATA, ensure_ascii=False, indent=0))
print(f"ergebnis.json: Linzer 22-24 → {len(entry['teile'])} Steckbrief-Zeilen")
for i, t in enumerate(entry["teile"]):
    poly_pts = sum(len(r) for r in t['poly']) if t['poly'] else 0
    m2 = t.get('m2_plan') or '—'
    print(f"  {i} {t['rolle']:12s} {t['plan'].get('widmung')} {t['plan'].get('bauklasse')} h={t['plan'].get('hoehe') or '-':6s}  m²={m2}  poly-pts={poly_pts}")
print(f"Front Linzer Straße: {L_linzer} m · Front Seitenstraße: {L_seiten} m (Summe: {L_linzer+L_seiten:.1f} m)")
print(f"Bauplatz: 3 GNR · {entry['fl']} m² (338/4 ausgeschlossen: gehört zu Nr. 20)")
