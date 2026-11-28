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
  - **24.11. Theresiengasse 47 tf1.hof BB1 – ERLEDIGT:** PD 7208 gilt für Theresiengasse 47 (Stadtkarte zeigt „WGV I 4,5 m g" im Hof = Festsetzung PD 7208, Hand-Anker-Overlay bestätigt). „G BB" nur im Nachbarhof (Richtung Nr. 43/45), kein Pfeil → **keine BB in tf1**, 2 Belege (PD 7208 + Stadtkarte 01514_430-18.png). `soll.json` Theresiengasse 47 tf1 geändert: `bb: ["BB1: 50 % bebaubar"]` → `bb: []`, Kurswert als `kurs_hinweis` aufbewahrt.
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
- **Nordmanngasse 20 (23.11.):** Netz nimmt die Baufluchtlinie (strich) bei 10,38 m hinter der Front – Plan-Linie richtig gelesen. Auf dem ganzen Planbild (1792 px, alle Pfeilpaare) keine lesbare Trakttiefe-Zahl. Blatt sagt 11 m (0,62 m daneben). → Frage an Eduard: steht im Plandokument 7216 eine Maßzahl 11?
- **Entscheidung Eduard 23.11. (Nordmanngasse):** Steht im Plan keine Maßzahl, zählt unsere Messung der Baufluchtlinie, nicht der gerundete Kurswert. Kennzeichnung „gemessen – im Plan keine Maßzahl“, Zustand offen (gelb), Vergleich ± 0,6 m. soll.json Nordmann tiefe 11 → 10,38 (mit Vermerk). Prüfstand 108 grün / 12 rot.

## Phase 6 / P1 Höhe in m (23.11.)
`tools/planleser_py/phase6_hoehe.py` → `planleser/hoehen.json`. Je Teilfläche: Beschriftung in der Fläche (+3 m); sonst entlang des Streifens (Tiefenband der Fläche, längs der Front ± 60 m, nächste Widmungs-Beschriftung + Texte ≤ 6 m). Ergebnis: Zahl · „keine“ (Beschriftung ohne m → BK-Höhe gilt) · „trifft nicht zu“ (G) · offen.
Getestet und verworfen: Stadt-Zone als Planbereich (W3 umfasst ganzen Block samt G → falsche Höhen 4,5/5,5 m) und Liniennetz-Flächen im großen Ausschnitt (Linien schließen nicht).
Ergebnis: Theresiengasse Hof WGV I 4.5m ✓ (Punkt statt Komma gelesen), Ybbs 18,5 ✓, 8 Straßentrakte „keine“ ✓ (soll.json neu „keine“ aus den Blättern: dort keine Höhe angegeben). Gerstlgasse Straßentrakt offen (keine Beschriftung im Streifen gefunden). Prüfstand 116 grün / 12 rot (61 %).

## ChatGPT-Aufträge A/B/C (23.11., geprüft)
- **A BB-Texte:** 8 PD, 49 BB + 40 allgemeine Bestimmungen → `plandokumente/bb_texte.json`. Gegen eigene Scan-Texte: 49/49 BB gleich (≥ 0,8) = bestätigt (2 Belege). Unterschiede waren Scan-Fehler bei uns („BB l“ statt BB1 in 7208/7318, „BBS“ statt BB5 in 7216) → BB-Nummern in Scan-Texten nie allein trauen.
- **B Höhen-Testfälle:** 10 Fälle; Ybbs 18,5 und Theresiengasse 4,5 = unsere Lesung ✓. Neu für P1: Sommerschuhgasse 3 (W I 6,5 m o), Enenkelstraße 21 (Hof GBGV I 5 m g), Josefstädter Straße 93-97 (Hof WGV I 8 m g) → Planbilder über Mac-Auftrag.
- **C Darwingasse 5/7/8:** Vorschläge, nicht bestätigt. Beleg C_5 plausibel (W IV g, Trakttiefe 14,00, G BB ohne Nummer, W I 6,5 m g hinten, 15,17). Wartet auf Eduard.
- Mac-Auftrag um 7 Adressen erweitert (Linzer 22 = GNR 347 KG 01210 aus Kataster am Adresspunkt, mehrere GNR noch prüfen).

## Planleser-Schriften im Repo (24.11.)
`tools/planleser_py/fonts/` enthält LiberationSans Regular/Bold + DejaVuSans Regular/Bold (OFL/Bitstream-Vera, Lizenzen dabei) – gleiche Dateien wie unter Linux (MD5 bestätigt). `glyph.py:schriftdateien()` nutzt nur noch diese Dateien, `QE_PLAN_FONTS` als Override bleibt. Mac und Linux lesen bitgleiche Templates. `zonen.py:110` Höhe: erstes Muster `re.fullmatch(r'(\d{1,2})(?:[,.](\d))?m',…)`, zweites Muster Vorsilbe `(?:GBGV|WGV|GB|W)`. „4W5m" (OCR-Rest) fällt durch → offen statt falsch 5 m. Prüfstand 116 grün / 12 rot unverändert; Theresiengasse Hof 4,5 m stabil.

## P5-Zwischenstand (24.11.)
`export.py`: Text-Quelle für BB auf `plandokumente/bb_texte.json` (ChatGPT-A, 24.11.) umgestellt, `plandokumente.json.dokumente` als Fallback. Hand-Zuordnung pro Testadresse bewusst **nicht** ergänzt – der Leser muss die Marke selbst lesen (2 Belege). Schema neu: `teilflaeche.allg` (plandokument_text, pflicht=false); Theresiengasse 47 tf1.hof soll getrennt: `bb:["BB1: 50 % bebaubar"]` + `allg:["Flachdach"]`. `pruefstand.py` setzt `tf.allg` bis `bb_marke.py` als offen. Prüfstand 116 grün / 12 rot / 63 offen (+1 offen, keine Regression). Widerspruch bb_texte 7208 BB1 „mindestens 30 % frei" vs. soll „50 % bebaubar" – an Eduard.

## Verworfen (mit Grund)
- **Tesseract als OCR**: unterschiedliche Schriften/Versionen zwischen Mac und Linux → nicht reproduzierbar; eigene Glyph-Vorlagen aus `tools/planleser_py/fonts/` (Liberation+DejaVu, MD5 fix) gewinnen (24.11.).
- **Kachel-Holen für ganz Wien**: Netzlast gegen Stadtdienst zu hoch, ohne Nutzen. Nur Adressen, die gerade getestet werden (Arbeitsregel).
- **Stadt-Zone als Planbereich**: W3 umfasst ganzen Block samt G → falsche Höhen 4,5/5,5 m. Planbereich kommt aus Plan-Netz (23.11., Phase 6).
- **Liniennetz-Flächen im großen Ausschnitt**: Linien schließen nicht. Netz nur im geschnittenen Kataster-Polygon (23.11.).
- **Freitext-Stichwort-Zuordnung von BB-Texten**: BB-Marke zur Teilfläche nur über Plan-Koordinaten (Pfeil/Enthaltensein), nie über Textähnlichkeit. Nummer ohne Position ist kein Beleg.
- **Rahmen-Vektorkoordinaten aus PD-PDF**: PD-PDF ist ein reines Rasterbild mit eingebettetem JPEG, keine Vektorebene (geprüft 24.11. an PD 7208: 0 Zeichen-Befehle, 0 Textwörter). a1 (OCR Randzahlen) + a2 (Anker-Matching) fallen aus.
- **ORB gegen flwbplmzk-Planbild (a3)**: Rohbild 6/400 und Canny-ORB 7/400 RANSAC-Inliers für PD 7208 vs. Theresiengasse-Planbild (24.11.) – farbige Widmungen vs. s/w Stadtkarte, Überlappungszone klein. Hand-Anker als Hauptweg ausgeschlossen (Live-Betrieb braucht Automatik). Aktueller Weg: a4.
- **SCHNITTMUSTEROGD per WMS/WFS auf data.wien.gv.at (verschoben)**: In GetCapabilities von `data.wien.gv.at/daten/geo` (WMS+WFS), `/daten/wms`, `/daten/geoserver/ows`, `wms.wien.gv.at`, `maps.wien.gv.at/basemap/geolandbasemap/wms` nicht gelistet (24.11.). Alternativlayer: `fmzk` via `maps.wien.gv.at/wmts/fmzk/{style}/google3857/{z}/{y}/{x}.jpeg` (Styles: farbe, grau, pastell, normal). PD-Nummer wird bis auf Weiteres manuell aus dem Fachportal entnommen; CLAUDE.md entsprechend korrigiert.
- **matchTemplate (flwbplmzk-Dunkelpixel + DKM-Linien, Grob+Fein-Winkel)**: Score Grob 0,25 → Fein 0,06; Δ zweitbest ≈ 0,001; Winkel instabil zwischen Läufen. 48 % Canny-Dichte im PD-JPEG und Text-Beschriftung im flwbplmzk-Template verrauschen die Suche (24.11.).
- **HSV-Rot-Hough automatisch für Kreuzungen (D11/D13)**: 8 000–12 000 Linien je Crop (Baufluchtlinien + Beschriftung + 45°-Hough-Rasterartefakte), Mittellinien-Logik verwaschen. Reste N11/J19 < 1,1 m, D11/D13 6+ m. Pipeline verworfen, Hand-Anker = wirklich von Hand (24.11.).
- **Rahmen-Hough auf PDF-Canny**: PDF-Canny-Edges 48 % Dichte, Rot-Hough-Peak-Winkel landet bei 45°-Rasterartefakten statt Straßen (24.11.).
- **INSPIRE plu:SpatialPlan (haleconnect WFS)**: liefert nur 1 Feature für "Flächenwidmungs- und bebauungsplan 2023" ganz Wien, keine PD-Attribute (kein "7208", kein "PD"). Für Georef pro PD unbrauchbar (24.11.).

## Hand-Anker-Georef PD 7208 (24.11.)
`planleser/georef_7208.json`. 4 Anker (Zellen D11, N11, J19, E5 im 200-Px-Raster-Overlay) gegen Welt-Knoten aus `STRASSENKNOTENOGD` (WFS data.wien.gv.at, EPSG:31256). 4-Pt-LSQ Welt→PDF: Skala 3,9261 PDF-Px/m (Soll 1:2000@200dpi = 3,937, Δ 0,3 %), Winkel +90,49° (Nordpfeil rechts). Restfehler D11 1,63 / N11 0,64 / J19 1,05 / E5 1,22 m.
**Toleranz 2 m** akzeptiert. **Grund:** `STRASSENKNOTENOGD` liefert Straßenachsen (Mittellinie), der Plan zeigt Fluchtlinien (Straßenrand) → systembedingt 1–2 m Offset. Nutzbar für BB-Marke → Teilfläche-Zuordnung (Teilflächen 15–30 m). **Nicht** nutzbar für Maßprüfung ±0,6 m.
flwbplmzk-Pixel → EPSG:31256 exakt über Slippy-Map z=19 Mercator-Umkehr (x0,y0 aus `~/qe_planbilder/<kg_gnr>.json`), pyproj EPSG:4326→31256. Mitte des 1792×1792-Mosaiks ≠ Adresspunkt (Theresiengasse 47: Punkt bei mosaic-Px (992, 880), nicht (896, 896)).
- **BB-Suche im ganzen PD-Blatt per Template** (Rot-Maske, Normschrift-Vorlage aus C10, Rotation 0–350° in 10°-Schritten, Hälften-IoU + Ziffer-Rotpixel-Zweitprüfung): Von 28 NMS-Kandidaten 14 echt / 10 falsch (GBGV×4, Maßzahlen 11,38 / 18,96, GB III, BEZIRKSGRENZE/PLANGEBIETS×3) / 1 echter BB abgelehnt (24.11.). Scores und IoU-Werte überlappen → Schwelle allein trennt nicht. Nächster Weg: Position aus flwbplmzk-Inventar, nur Nummer per Fenster-Match aus PD (über georef_7208.json).

## Noch nicht automatisch (Stand 24.11., pro Adresse Handarbeit)
- **Adresse → PD-Nummer (größte Lücke für „jede Adresse")**: Aktuell nur Hand-Zuordnung in `tools/planleser_py/plandokumente.json → zuordnung` (`KG_GNR → {pd, bebaubar, G, …}`). Es gibt keinen OGD-Layer mehr, der die PD-Nummer pro Punkt liefert (SCHNITTMUSTEROGD verschwunden; GENFLWIDMUNGOGD hat nur `BEFRISTUNG_PD`; INSPIRE `plu:SpatialPlan`/`ZoningElement` referenziert nur den Wiener Gesamtplan 2023). Ohne diesen Schritt kann keine neue Adresse automatisch geprüft werden. Nächste Suche: Fachportal-Rest-API oder BauplatzWebservice-Endpunkt.
- **PD-Georef** pro Adresse: Hand-Anker (3–4 Straßenkreuzungen im Rasterblatt) + `STRASSENKNOTENOGD`, Toleranz 2 m. Einziger Fall heute: `planleser/georef_7208.json` (Theresiengasse 47). Automatik verworfen (siehe „Verworfen (mit Grund)": ORB, matchTemplate, Rot-Hough).
- **BB-Texte** nur für 8 PDs vorhanden: `plandokumente/bb_texte.json` (ChatGPT-Auftrag A, 24.11.: 6538, 6848, 6999, 7208, 7216, 7318, 7462, 7486). Neue Adresse ohne PD-Text: Vorschlag „BB-Text offen", bis Texte ergänzt.
- **Scan vs. Vektor-PD**: Alle 8 Prüfadressen-PDs = Scan (1 JPEG, 0 Text, 0 Vektor). Neuere PDs (z. B. 8485) = Vektor + Text (1 136 Blöcke, 20 719 Zeichen-Ops). Für Vektor-PDs sind Georef + BB-Text-Extraktion vereinfachbar – später.

## Feste Regeln (Eduard 24.11.)
- **Plan vs. Kursblatt:** Kursblätter sind Lernmaterial. Soll = heute gültiger Plan – **aber nur**, wenn der Plan-Wert mit 2 Belegen bestätigt ist (z. B. PD-Text + Stadtkarte, oder PD-Text + Scan-Plan). Ohne 2 Belege bleibt der Kurswert im Soll und das Feld wird als „Abweichung ungeklärt" markiert. Nie pauschal alle Sollwerte auf heute umschreiben.
- **Stadtkarten-Text ≠ PD-Text an derselben Stelle** → PD dort veraltet → Feld offen + richtiges PD suchen. Nie veraltetes PD verwenden. (Pflichtschritt, siehe `pruefschema.json → pflichtpruefungen.P8_stadt_vs_pd`.)
- **Jede soll.json-Änderung einzeln dokumentieren** (Adresse, Feld, alt → neu, Belege) – siehe Abschnitt „soll.json-Änderungen" unten.

## soll.json-Änderungen (Protokoll)
- **24.11. Theresiengasse 47 tf1.hof.bb:** `["BB1: 50 % bebaubar"]` → `[]`. Belege: (1) PD 7208 Hand-Anker-Overlay zeigt „G BB 2" nur im Nachbarhof, nicht in tf1; (2) Stadtkarte 01514_430-18.png zeigt im Hof „WGV I 4,5 m g" (PD 7208) ohne BB-Marke. Kurswert „BB1: 50 % bebaubar" als `kurs_hinweis` aufbewahrt. Entscheidung Eduard.

## Offener Punkt „Theresiengasse Kursstand" (24.11., erledigt)
- 762 m²/23,66 m/W III/4,5 m/Erker ≤ 0,6 m sind heutige Werte aus PD 7208 + BEV/Stadt; Kurs 672/21/W IV/5,5/keine Erker ist veraltet. Siehe Protokoll oben.

## 28.11.2026 – Fertiges Beispiel Hochstettergasse 4 online (/beispiel/hochstettergasse-4/)
- Befund: Muster nach Kursblatt L50 komplett: Steckbrief (S. 1), Skizze Gebäudehöhe + Balkone/Erker, Nutzfläche a/a1/a2/b/c, Zeitplan, Ankauf, Kredit 1, Herstellung, Kredit 2, GIK, Ertrag, Halten, Zusammenfassung, Residualwert (Ziel-Rendite 4 %).
- Prüfung: Rechenlogik mit Kurs-Eingaben L50 nachgerechnet – alle Werte gleich (±1 € Rundung, Rendite 3,13 %, Deckung 52,96 %); Ankauf/Kredit 1 mit Gerstlgasse 18 gleich.
- Entscheidungen Eduard 27./28.11.: Baukosten 3.000 €/m² oberirdisch, Garage ½; Ablöse 16.200 €/Stellplatz; Fahrräder 2/Wohnung (§ 119a (3) BO, 2,40 m² bzw. Lastenrad 4,00 m²); Einlagerung 0; Notar 1 %; Kredit 2 Standard 2 Jahre; Ziel-Rendite 4 %. Zinssatz vorbelegt mit Kurswert 2,85 % (änderbar). Mieten 17–20 €/m² (2.DG 20, je Geschoß −0,50, EG Garten 17,50) von Eduard bestätigt 28.11. 08:28.
- Statische Seite, kein Server; Prüfstand unberührt (keine Leser-Änderung).
- Eingaben oben neben Ziel-Rendite: Baukosten €/m² (Garage automatisch ½) und Zinssatz (Kredit 1+2), synchron mit den Feldern in der Rechnung (Eduard 28.11. 08:21).
- Live-Rechner (Startseite): Bauplatz KG 01657 GNR 651/12 (Hochstettergasse 4) zeigt statt der Live-Karten den fertigen Steckbrief eingebettet (iframe /beispiel/hochstettergasse-4/?embed=1, Höhe per postMessage). Liste BSP in start.js – weitere fertige Beispiele dort eintragen (Eduard 28.11. 08:31). start.js v415, start.css v414.
- 8b Verkaufen (nach Kurs Gerstlgasse 18 Pkt. 19): a) Endkunde – €/m² brutto je Geschoß + Stellplatz €/Stk, Gewinn = Erlös brutto − GIK brutto (Ankauf + Errichtung brutto + Finanzierung), Rendite auf GIK und EK gesamt + p.a.; b) Investor – Kaufpreis = nachhaltige Jahresmiete ÷ 2,50/2,75/3,00 % + eigener Wert, Gewinn gegen GIK netto. Verkaufspreise vorbelegt 7.300–8.500 €/m², Stellplatz 35.000 € = Annahme (Markt 1020 Neubau 2026 teils 9.700–12.400 €/m² Angebote, Bezirk Ø gemischt ~6.700), Bestätigung offen.
- Ausnahme Planbild (Eduard 28.11.): plan.png (aus flwbplmzk, Stadt Wien OGD CC BY 4.0, Quelle auf der Seite) für dieses Beispiel bewusst im Repo. Regel „Plankarten nie ins Repo" gilt sonst weiter.
