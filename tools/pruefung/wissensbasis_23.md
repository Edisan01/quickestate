# 23 – Prüfablauf pro Adresse (verbindlich, Stand 18.11.2026)

Gilt für jede Adresse. Ausführlich in den Docs:
- Prüfablauf: https://claude.ai/artifact/KW69kXiU2BJnGmajonVQMs
- Ablauf beim Auslesen: https://claude.ai/artifact/TqTLVVyStWA8zvX9AdCvcU
- Feste Werte und Sonderfälle: https://claude.ai/artifact/7wZbMtgz6cQXz5HcKPvFTD

Im Repo: `tools/pruefung/pruefschema.json` (Liste als Programm) und `tools/pruefung/soll.json` (Sollwerte aus Eduards 8 Blättern).

## Entscheidungen 18.11.
- **Kein nächtliches Kachel-Holen mehr** (ganz Wien vorab). Stattdessen: Rechner fertig bauen, dann Adresse für Adresse testen; Eduard liefert jeweils das Plandokument.
- Später voraussichtlich Mischbetrieb: geprüfte Adressen vorgerechnet, andere live mit denselben 14 Schritten, Ergebnis gespeichert, nächtlich neu gerechnet. Server-Frage erst nach Phase 7.
- Der Leser ist keine KI; live rechnen kostet keine Claude-Tokens.
- **Eduard 18.11. abends:** jeder Meilenstein wird gespeichert und geht online (Commit + Push). Jedes geprüfte grüne Feld je Grundstück wird gespeichert (`planleser/geprueft.json`), damit nichts neu gerechnet werden muss. Prüfstand-Bericht online zum Testen: **quickestate.at/pruefstand.html** (noindex, nicht verlinkt).
- **Eduard 18.11.:** Ohne Planleser geht nichts – er ist der Kern. Lernerkenntnisse immer speichern (Gemeinsamkeiten finden, nicht annehmen).
- Aus v204 unverändert übernehmen (mit v204-Tests): bb.js ✓, plandokumente.js, kataster.js (katStrassenbreite = 2. Beleg Straßenbreite, katSeitenFlaeche), planflaechen.summenPruefung, baurecht_wien.js (§75), geschosse_auto.js, hinweise.js. Nicht: alter Planbild-Leser (Tesseract).

## Grundsätze
- Die Liste ist Programm: Leser, Bericht und Webseite lesen nur `pruefschema.json`.
- Jedes Feld **pro Teilfläche**, jedes Feld genau ein Zustand: bestätigt (2 Belege) · trifft nicht zu (mit Grund) · offen („noch nicht gelesen“). Leeres Feld = Fehler = nicht online.
- Erst alles erfassen, dann deuten. Jede Zahl/Linie im Umkreis wird zugeordnet oder mit Grund verworfen.
- Planzahl gewinnt, Messung bestätigt. Nie schätzen.
- Widmung/Bauklasse aus Stadt-Daten, Plan bestätigt; Widerspruch sperrt die Adresse.
- BB nur, wenn Nummer in der Teilfläche steht/Pfeil zeigt; Text aus dem PD dieser Adresse; allgemeine Bestimmungen ohne Plandarstellung zu jeder Teilfläche.

## Feste Werte (bestätigt Eduard 18.11.)
- Planzahl gegen Messung ± 0,6 m
- Summe Abschnitte gegen Grundbuch ± 2 %
- §75(4) Zuschlag: BK III +3 m, ab BK IV +4 m (Achtung: v204 rechnet BK IV nur bei Straße > 15 m +4, sonst +3 – Frage an Eduard offen)
- Rundung: Maße/Flächen 2 Nachkommastellen, Geschoße abrunden
- Prüfstand-Vergleich: Planzahlen exakt, Kataster-Breiten ± 0,6 m (Blätter runden), Flächen ± 2 %

## 14 Schritte
1. Grundstück (Kataster, Grundbuch, Grenzkataster, Seiten, Eck, mehrere GNR)
2. Stadt-Daten + Plandokument (Nummer, Datum, Text, Bausperre/Aktualität)
3. Planausschnitt + 40 m Rand
4. Inventar: alle Linien, Maßlinien, Texte
5. Maßzahlen → Maßlinien (Art aus Endpunkten, Gültigkeitsbereich)
6. Teilflächen bilden, exakt nach Planzahlen
7. Texte → Teilflächen, Abgleich Stadt
8. Bedingte Pflichtfelder auslösen
9. Pflichtmaße pro Teilfläche
10. Färben (blau/grün/rot), Summe = Grundstück
11. Vollständigkeits-Kontrolle
12. Rechnungen: §76(10a), §75(4), BB-%, Höhe/Geschoße
13. Freigabe + Bericht (inkl. „verworfen + Grund“)
14. Prüfstand vor jedem Deploy (100 % gegen `soll.json`)

## Bauplan Leser (Phasen, Prüfstand vor/nach jeder Phase, kein grünes Feld darf rot werden)
0 Prüfstand + Adapter → Schema · 1 Grundstück · 2 Stadt-Daten + PD-Text (21 Texte + BB-Parser aus v204) · 3 Inventar Linien + Maßlinien (Overlay-Sichtprüfung) · 4 Maßzahl → Maßlinie · 5 Teilflächen + Abschnitte · 6 BB automatisch + bedingte Felder · 7 Färben-Summe, Kontrollen, Rechnungen · 8 Bericht + Flächen-Rechnung online (nur mit OK)

## Werkzeuge (Repo)
- `tools/pruefung/pruefstand.py` – Adapter Leser-Ausgabe (`planleser/ergebnis.json`) → Schema (`ist.json`), Vergleich gegen `soll.json`, Regressionssperre gegen `stand.json` (Exit 1, wenn ein grünes Feld nicht mehr grün ist). `--speichern` schreibt Stand, `planleser/geprueft.json` und `planleser/pruefstand.json` (Webseite).
- `tools/pruefung/grundstueck.py` – Schritt 1: BEV-Grundbuchfläche + Geometrie aus `kataster/16` (≤ 2 % = bestätigt), mehrere GNR vereinigt, Seiten, Straßenfront = Kataster-Kante parallel (< 8°) und ≤ 3 m zur Leser-Straßenkante.
- `tools/pruefung/stadt.py` – Schritt 2: SZ/WZ/Bausperre als Verschnitt (≥ 1 m²), PD-Nr. + Kundmachung (WMS SCHNITTMUSTEROGD), Fronten aus Widmungszonen = 2. Beleg Eck, allgemeine Bestimmungen über BB-Leser v204 + Vorbauten-Wörter aus dem PD-Satz.
- **Daten holen:** Mac-Terminal `python3 ~/Downloads/qe_pruefung/holen.py` (Adressen aus `auftrag.json`, curl, ~12 min für 8 Adressen inkl. Planbild-Kacheln + PD-PDFs), dann `tools/pruefung/mac_import.py <out> <planbild-ziel>`. GitHub-Workflow `pruefung-stadt.yml` als Notweg (sehr langsam). Sandbox + Mac-VM erreichen data.wien.gv.at nicht.
- `tools/planleser_py/v204/` – BB-Leser `bb.mjs` = v204 engine/bb.js unverändert, `node bb_cli.mjs <text> '{"1":true}'`; `texte/` = 21 PD-Texte aus v204 (Vorrang).
- `tools/planleser_py/inventar.py` (Phase 3) + `masse.py` (Phase 4).
- Planbilder der Prüfadressen: Branch `pruef-planbilder`.

## Befunde 18.11.
- **Theresiengasse 47:** Blatt 672 m² / Front 21 m / W IV / 5,5 m First / keine Erker – heute BEV 762 m² (Geometrie 749), Front 23,66, Stadt W III, PD 7208 sagt 4,5 m und Erker ≤ 0,6 m erlaubt. Kursstand ≠ heute. Bleibt rot → Eduard entscheidet.
- Grenzkataster-Kennzeichen fehlt in unseren Kataster-Daten → offen.
- Zentagasse 6: Geometrie 3 % unter BEV (488 vs. 503) → Fläche offen. Zentagasse PD = 7486.
- Gartengasse 8: heute Bausperre (Stadt) – Blatt ist Kursstand.
- §75(4) rechnerisch konsistent mit allen Blättern (Leitermayergasse 11,38+3 = 14,38 < 16 → Einschränkung; Bestätigung Eduard offen).

## Lernregel
Neues Wissen = Schema-Feld + Testfall in `soll.json` + Wissensbasis + `lernwissen.json`. Erst dann erledigt.

## Lernwissen (Eduard 18.11.: Gemeinsamkeiten finden statt annehmen)
- Alle Muster mit Beleg in `tools/pruefung/lernwissen.json` (14 Einträge, Stand 18.11.). Neues Muster = Eintrag dort + Testfall in `soll.json` + kurz hier.
- Kern: Maßpfeil = offenes V (7 px, ±27–30°, dünn) an der Linie, Achse quer zur Linie · Maßzahl parallel zu den gemessenen Linien · Trakttiefe = Baulinie (voll) → Baufluchtlinie (strich) · Stadt liefert nur Widmungs-Code (G, Bauweise, Höhe, BB nur im Plan) · fast jedes PD: Dach 4,5 m über Gebäudehöhe · Vorbauten-Liste aus dem PD-Satz · Leser-Front kann Baulinie hinter Abtretung sein · Kursblatt ≠ heute möglich → fragen.
- Lesefehler bei Maßzahlen (fehlende Ziffer) zeigt die Messung auf → verwerfen, nie korrigieren.

## Stand
- **Phase 0:** 46 / 174 grün = 26 %.
- **Phase 1:** 55 grün = 31 % (Fläche Ybbs 596 / Nordmann 536, Front 5×, mehrere GNR).
- **Phase 2 fertig:** 87 grün = 48 %, keine Regression. Stadt-Daten + 8 PD-Texte (6538, 6999, 7208, 7216, 7294, 7318, 7462, 7486 = Zentagasse) über Eduards Mac (`~/Downloads/qe_pruefung/holen.py`, Import `tools/pruefung/mac_import.py`). PD-Nr. 7/7 = Blatt; SZ/WZ alle = Blatt; allgemeine Bestimmungen 15/18 grün. Planbilder der 8 Adressen: Branch `pruef-planbilder`.
- **Phase 3 (Teil):** `planleser_py/inventar.py` – Linienarten gut; Maßpfeile noch viele Fehltreffer an Ecken/Textresten.
- **Phase 4 (Teil):** `planleser_py/masse.py` – Ybbs Trakttiefe 12,00 ✓, Gartengasse 15,00/12,00 ✓, Enenkelstraße 14,00 ✓. Hauptlücke: Maßzahlen werden noch zu selten gelesen (Leitermayergasse, Nordmanngasse: 0; Straßenbreiten 18,96/11,38/15,17 fehlen) → nächster Schritt Zahlenleser für schräge/kleine Zahlen.
- **v409 live:** Adressen ohne Planleser: Hof grau + Hinweis, Ampel gelb „Plan noch nicht geprüft“.
- **Offen bei Eduard:** Theresiengasse Kursstand (672/21 m/W IV/5,5 m/keine Erker vs. heute 762/23,66/W III/4,5 m/Erker ≤ 0,6 m); §75(4) BK IV: +4 m immer oder nur bei Straße > 15 m (v204: sonst +3); Leitermayergasse §75(4) Einschränkung bestätigen.
- Allgemeine Bestimmungen = alle PD-Treffer ohne BB-Bezug (Annahme, weil v204 den Kopf in -layout-Texten nicht erkennt) → können Punkte enthalten, die nur für bestimmte Flächen gelten (z. B. 7208 Pkt. 3.3 GV-Dächer). Zuordnung zu Flächen in Phase 6.

## Pflichtprüfungen P1–P7 (Eduard 23.11., immer, jede Adresse)
Anlass Linzer Straße 22: Seite zeigte Hof „Bauklasse I“ (wäre 9 m) statt **4,5 m**, Hof hinten W III 15 m g war in der Eckstück-Zeile versteckt (beide Stadt-Code W3). Festgelegt in `pruefschema.json → pflichtpruefungen`, Testfall in `soll.json`:
- **P1** Höhe in m je Planbereich suchen (Stadt liefert sie nie); Höhe = min(Plan, BK, §75(4)); nie BK-Höhe allein als erlaubt zeigen.
- **P2** Gleicher Stadt-Code ≠ ein Planbereich.
- **P3** Jeder Planbereich braucht eine Beschriftung (auch außerhalb, 40-m-Rand); sonst offen, keine Freigabe.
- **P4** Bauweise je Bereich.
- **P5** BB-Marke → Text aus dem PD dieser Adresse, nur diesem Bereich.
- **P6** Rolle aus der Lage zur Straße; jeder Häuserblock hat ≥ 4 Ecken → immer alle Straßenkanten prüfen.
- **P7** Mehrere GNR zusammenlegen, Bauplatz-Frage, GNR-Grenzen sind keine Planlinien.

## Stand 23.11.
- ChatGPT-Stand 10360f8 gesichtet (Team-Liste 1–16). Übernommen: Pfeilpaar endlich + 5 Querschnitte, Dezimalkomma, Mac-Schriften, Stadt-Zonen-Flächenverschnitt (v410 live, online geprüft Darwingasse 8), 11 Lernmuster. Nicht: Vektormodell, Kontrast, Figurenschluss, Testbilder.
- Prüfstand 89 grün / 12 rot / 80 offen (49 %); Linzer Straße 22 als 9. Prüfadresse (noch 0 %).
- Gültige Sicherung (ChatGPT-Stand): Downloads `Quickestate_Leser_Gesichert_2026-11-20_21-44-33` (+ .zip, c5eb815, veraltet); neue Sicherung 10360f8 läuft über `qe_pruefung/sicherung_erstellen.sh`.
- Nächste Schritte: v411 (Höhen-Hinweis je Zeile, zusammengefasste Zonen), Schritt 5 Teilflächen (Kataster + Detailplan), Phase 6 beginnt mit P1 Höhe in m.

## Fehlercodes (23.11., getestet)
Jedes rote/offene Feld → genau 1 Code = Schritt + Werkzeug + Gesetzesverweis (Text nur in WB 01). Datei `tools/pruefung/fehlercodes.json`, Zählung `python3 tools/pruefung/fehlercodes.py`.
Codes: S1-GS, S2-PD, S5-MASS, S6-TF, S7-WID, S7-HOE, S7-BW, S7-BB, S12-RE.
Test: Feld-Zuordnung 91/91 eindeutig → bleibt. Freitext-Stichwort-Zuordnung 4/10 → entfernt; Befunde bei Straßenbegehung ordnet Claude zu.
Befund: S7-HOE nur 1 Prüffeld → Höhen fehlen fast ganz in soll.json; darum blieb Linzer 22 (4,5 m / 15 m) unbemerkt.

## Schritt 5b Abschnitte am Sprung (23.11.)
`tools/planleser_py/abschnitte.py`: Grenze Straßentrakt/Hof springt quer zur Front (±20°, ≥ 1 m) → Lot zur Front durch den Sprung teilt alle Teilflächen. Leitermayergasse: Sprung bei 7,48 m (Plan 7 m, ±0,6 ✓); mittlere Tiefen 11,93 / 14,88 / 10,33 / 7,37 = Plan 12 / 15 / 10 / 7 ✓. Flächen weichen ab, weil das Blatt mit gerundeten Breiten 7 + 9 = 16 m rechnet, Kataster 16,32 m. Prüfstand 98 grün / 13 rot (54 %).
- **Entscheidung Eduard 23.11. (B):** Straßentrakt-Fläche gilt gegen Katasterbreite × Plantiefe (Breite ± 0,6, Tiefe ± 0,6, Fläche ± 2 %). Blätter runden die Breite → Abweichung zum Blatt nur gelber Hinweis (`pruefstand.json → hinweise_blatt`). Hof-Tiefe ist keine Planzahl (Rest) → Hof weiter gegen Blattfläche. Prüfstand 106 grün / 13 rot (59 %).
