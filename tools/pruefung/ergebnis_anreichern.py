#!/usr/bin/env python3
"""Reichert planleser/ergebnis.json mit PD-Nr + bb_text an, damit die
9 Prüfadressen in der Live-Seite denselben Steckbrief wie Sommerschuhgasse 3
zeigen. Nur bestätigte Werte, nichts erfinden.
Mapping: tools/planleser_py/plandokumente.json → zuordnung (fehlende Prüfadressen)
BB-Text:  plandokumente/bb_texte.json → dokumente[pd].bb
Allgemein: plandokumente/bb_texte.json → dokumente[pd].allgemein (oder leere Liste)
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
ERG = ROOT / "planleser" / "ergebnis.json"
PDM = ROOT / "tools" / "planleser_py" / "plandokumente.json"
BBT = ROOT / "plandokumente" / "bb_texte.json"

# Hand-Zuordnung KG_GNR → PD (aus WB 23 / pd_abdeckung-Tabelle)
PD_FALLBACK = {
    "01657_1496+1496/78": "6538",  # Ybbsstraße 7 – Fallback
    "01657_1496/78": "6538",
    "01514_300/22": "7318",  # Leitermayergasse 50
    "01008_929/7": "7486",   # Zentagasse 6
    "01603_454": "7216",     # Nordmanngasse 20
    "01514_430/18": "7208",  # Theresiengasse 47
    "01005_1021": "6999",    # Tigergasse 21
    "01008_174+175": "7462", # Gartengasse 8
    "01609_674+675": "7294", # Gerstlgasse 18
    "01657_678/9": None,     # Darwingasse 3 – PD aktuell unbestätigt (ChatGPT C, WB23)
    "01514_425/16": None,    # Schumanngasse 3 – offen
    "01503_382/1": None,     # Barawitzkagasse 36 – offen
}


def bb_text_dict(bbt_data, pd):
    d = (bbt_data.get("dokumente") or {}).get(str(pd)) or {}
    out = {}
    for item in d.get("bb") or []:
        nr = (item.get("nr") or "").replace(" ", "")   # „BB 1“ → „BB1“
        if nr:
            out[nr] = item.get("text", "")
    return out


def allgemein(bbt_data, pd):
    d = (bbt_data.get("dokumente") or {}).get(str(pd)) or {}
    out = []
    for item in d.get("allgemein") or []:
        # bb_texte-Format: {"k":"4,5 m","titel":"...","text":"..."} ODER tuple
        if isinstance(item, dict):
            out.append([item.get("k") or item.get("kurz") or "?", item.get("titel") or item.get("t") or "", item.get("text") or ""])
        elif isinstance(item, list) and len(item) >= 3:
            out.append(item[:3])
    return out


def main():
    data = json.loads(ERG.read_text())
    pdm = json.loads(PDM.read_text())
    bbt = json.loads(BBT.read_text())
    zuordnung = pdm.get("zuordnung", {})
    dokumente = pdm.get("dokumente", {})

    changed = 0
    log = []
    for key, entry in data.items():
        # PD-Nr. bestimmen
        z = zuordnung.get(key) or {}
        pd = z.get("pd")
        if not pd:
            pd = PD_FALLBACK.get(key)
        # Namen-Mapping für Enenkelstraße 21 → gibt es in pd_abdeckung nicht, bleibt 7537 aus plandokumente.json

        if not pd:
            log.append(f"  {entry.get('name',key):25s}  PD offen (nichts geändert)")
            continue

        # Plandokument-Block an Top-Level
        bb_map = bb_text_dict(bbt, pd)
        allg = allgemein(bbt, pd)
        # Fallback: wenn bb_texte keine allgemein-Einträge hat, aus plandokumente.json ziehen
        if not allg and dokumente.get(pd, {}).get("allgemein"):
            allg = dokumente[pd]["allgemein"]
        plandokument = entry.get("plandokument") or {}
        plandokument.setdefault("nr", pd)
        plandokument["nr"] = pd
        if allg:
            plandokument.setdefault("allgemein", allg)
        entry["plandokument"] = plandokument

        # bb_text je Teilfläche
        for t in entry.get("teile", []):
            p = t.setdefault("plan", {})
            bb = (p.get("bb") or "").replace(" ", "")
            if bb and not p.get("bb_text") and bb in bb_map:
                p["bb_text"] = bb_map[bb]

        changed += 1
        bbs = sorted({(t.get('plan') or {}).get('bb') for t in entry.get('teile',[]) if (t.get('plan') or {}).get('bb')})
        log.append(f"  {entry.get('name',key):25s}  PD={pd}  bb={bbs}  allgemein={len(allg)}")

    ERG.write_text(json.dumps(data, ensure_ascii=False, indent=0))
    print(f"ergebnis.json: {changed}/{len(data)} Einträge angereichert")
    for ln in log:
        print(ln)


if __name__ == "__main__":
    main()
