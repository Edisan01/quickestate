# Planleser (Python, offline, ohne KI)

Liest das Planbild der Stadt Wien (WMTS flwbplmzk, CC BY 4.0) je Grundstück und kombiniert es mit den
Widmungszonen der Stadt (OGD GENFLWIDMUNGOGD). Ergebnis wird vorberechnet als JSON gespeichert (`planleser/*.json`).

- `glyph.py` Zeichen-Schablonen (Buchstabe für Buchstabe, keine Texterkennung von außen)
- `leser2.py`/`leser3.py` Rotmaske, Linien/Strichlinien, Wörter, Zahlen-/Beschriftungsmodus
- `zonen.py` Tokens in mehreren Drehungen, Linien schließen, Merkmale (Widmung, Bauklasse, Höhe, Bauweise, BB, %)
- `steckbrief.py` Teilflächen im Grundstück: Stadtzone + Planfläche + G-Flächen + Grundabtretung
- `export.py` JSON je Grundstück (Rolle Straßentrakt/Hof, Polygone, Beschriftungs-Kästchen zum Einkreisen)

Stand 18.11.2026: 9 Testadressen (Wissensbasis/20 + Darwingasse 3).
