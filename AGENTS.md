# QuickEstate – Baurechner Wien (quickestate.at)

Eduard Beches baut einen Rechner: Was darf ich auf diesem Wiener Grundstück bauen? Kern ist der **Planleser**. Er liest den Flächenwidmungs- und Bebauungsplan (Planbild der Stadt Wien) je Teilfläche aus.

## STARTPFLICHT
Vor jeder Aufgabe lesen: `tools/pruefung/wissensbasis_23.md` (insb. Abschnitt „Verworfen (mit Grund)") und `tools/pruefung/lernwissen.json`. Nichts vorschlagen, was dort als verworfen steht.

## ABSCHLUSSPFLICHT
Nach jeder Aufgabe `tools/pruefung/wissensbasis_23.md` ergänzen (Befund, Entscheidung, Prüfstand-Zahl). Commit + Push erst nach Eduards OK.

## Arbeitsregeln (Eduard, verbindlich)
- Antworten auf Deutsch, kurz, ohne Füllwörter. Ergebnisse als kurze Tabelle.
- Nur betroffene Zeilen ändern (Edit/sed), nie ganze Dateien neu schreiben.
- Nie schätzen: **Planzahl gewinnt, Messung bestätigt (± 0,6 m)**. Steht im Plan keine Maßzahl, zählt unsere Messung der Planlinie, gekennzeichnet „gemessen – im Plan keine Maßzahl“, gelb (Eduard 23.11.).
- Jedes Feld **pro Teilfläche**, Zustand: bestätigt (2 Belege) · trifft nicht zu (mit Grund) · offen.
- Annahmen offen nennen, keine Werte heimlich ändern. Kursblätter sind gerundet → nur gelber Hinweis.
- **Nichts live schalten ohne Eduards OK.** Keine Passwörter, keine Konten, keine Tracking-Cookies, keine Geheimnisse im Repo, **Kurs-PDFs nicht ins Repo**.
- Kein Kachel-Holen für ganz Wien. Planbilder nur für die Adressen, die gerade getestet werden.
- Plankarten der Stadt (isPlan=true, flwbplmzk-Kacheln) nach `~/qe_planbilder/`, **nie ins Repo**. Max. 1 Abruf/s, User-Agent setzen (siehe „Daten der Stadt Wien").
- Neues Wissen = Schema-Feld (`tools/pruefung/pruefschema.json`) + Testfall (`tools/pruefung/soll.json`) + Wissensbasis 23 (`tools/pruefung/wissensbasis_23.md`) + Lernwissen (`tools/pruefung/lernwissen.json`). Gemeinsamkeiten finden, nicht annehmen.
- Neue Teile nur einbauen, wenn ein Test zeigt, dass sie helfen; sonst wieder raus (in WB 23 als „verworfen“ vermerken).
- Lange Arbeitsblöcke, nur bei echten Entscheidungen fragen. Kein Browser/Screenshot ohne Eduards Wunsch.
- Bei Fragen zur Richtung: „Team“ = EBE-Rollen (Lena CD, Mia Brand, Jonas UI/UX, Kai Interaction, Marco Frontend, Nina Performance, Clara Content, Marcus Fach/DACH, Lisa Growth, Ben Reader-XP, Fatima Accessibility/Prüfung).

## Speichern und online
- Jeder Meilenstein: Prüfstand laufen lassen, dann committen und pushen.
- Commit-Autor: `git -c user.name="Eduard Beches" -c user.email="eb@quickestate.at" commit …`
- Push: `git -c push.negotiate=true push -q origin main` (GitHub Pages = quickestate.at)
- Website-Änderungen (start.js/index.html/start.css) mit Versionsnummer `?v=` hochzählen; live nur mit OK.

## Prüfstand (vor und nach jeder Änderung)
```
python3 tools/pruefung/pruefstand.py -v --neu      # Tabelle + rote Felder; Exit 1 bei Regression
python3 tools/pruefung/pruefstand.py --speichern   # stand.json, planleser/geprueft.json, planleser/pruefstand.json
python3 tools/pruefung/fehlercodes.py              # rote/offene Felder je Code (S1-GS … S12-RE)
```
**Kein grünes Feld darf rot werden** – sonst Änderung zurücknehmen. Online-Bericht: quickestate.at/pruefstand.html.
Vergleich: Planzahlen exakt, Kataster ± 0,6 m, Flächen ± 2 %; Straßentrakt-Fläche gegen Katasterbreite × Plantiefe (Entscheidung B, 23.11.).

## Pipeline Planleser (tools/planleser_py)
| Schritt | Datei | Ausgabe |
|---|---|---|
| Inventar Linien/Maßpfeile | `inventar.py` | – |
| Maßzahlen (Pfeilpaar + OCR, 5 Querschnitte) | `masse.py`, `phase4.py` | `planleser/masse.json` |
| Teilflächen (Kataster außen + Liniennetz innen) | `netz.py`, `phase5.py` (+ `kataster_detail.py` als 2. Beleg) | `planleser/teilflaechen.json` |
| Abschnitte am Sprung | `abschnitte.py` | `teilflaechen.json → abschnitte` |
| Höhe in m je Planbereich (P1) | `phase6_hoehe.py <planbild-ordner>` | `planleser/hoehen.json` |
| Grundstück / Stadt-Daten / PD-Text | `tools/pruefung/grundstueck.py`, `stadt.py` | – |
Planbild z19 (~0,2 m/px), 40 m Rand; Kataster-Kacheln `kataster/16`; BB-Leser v204 unverändert in `tools/planleser_py/v204/`.
BB-Texte 8 PD bestätigt (2 Quellen): `plandokumente/bb_texte.json`.

## Daten der Stadt Wien (jetzt direkt vom Mac)
- WFS `https://data.wien.gv.at/daten/geo?service=WFS&request=GetFeature&version=1.0.0&typeName=ogdwien:<LAYER>&srsName=EPSG:4326&outputFormat=json&bbox=…` – Layer GENFLWIDMUNGOGD, SCHUTZZONEOGD, GRPZONENOGD, BAUSPERRE82OGD, BAUSPERRE86OGD.
- PD-Nummer: `SCHNITTMUSTEROGD` 24.11. in WMS/WFS Wien **nicht mehr auffindbar** (siehe WB 23 „Verworfen/verschoben"); PD derzeit manuell. Adresse → Punkt: `https://data.wien.gv.at/daten/OGDAddressService.svc/GetAddressInfo?Address=…&crs=EPSG:4326`.
- Planbild-Kacheln: `https://maps.wien.gv.at/wmts/flwbplmzk/rot/google3857/19/{y}/{x}.jpeg` (z19 ist Maximum; BB-Nummern stehen dort NICHT, nur „G BB“).
- PD-Text: `https://www.wien.gv.at/BauplatzWebservice/public/GetPlanDok.aspx?pnr=<nr>&planDpi=0&isPlan=false`; Plankarte mit BB-Nummern: `isPlan=true` (noch nicht ausgewertet).
- Bisheriger Umweg (Container ohne Netz): `~/Downloads/qe_pruefung/holen.py` + `tools/pruefung/mac_import.py`. Mit Codex auf dem Mac nicht mehr nötig.
- Höflich abrufen: ~1 Abruf/s, User-Agent `quickestate.at Pruefstand (eb@quickestate.at)`.

## Pflichtprüfungen P1–P7 (immer, jede Adresse – `pruefschema.json → pflichtpruefungen`)
P1 Höhe in m je Planbereich · P2 gleicher Stadt-Code ≠ ein Planbereich · P3 jeder Planbereich braucht eine Beschriftung (auch außerhalb, Streifen) · P4 Bauweise je Bereich · P5 BB-Marke → Text aus dem PD dieser Adresse, nur diesem Bereich · P6 Rolle aus Lage zur Straße, alle Straßenkanten prüfen · P7 mehrere GNR zusammenlegen.

## Stand 23.11.2026 (Details: tools/pruefung/wissensbasis_23.md)
- Prüfstand **116 grün / 12 rot / 62 offen (61 %)**, 9 Prüfadressen (Linzer Straße 22 noch ohne Planbild).
- Nächstes: P5 BB-Nummer je Teilfläche (Plankarte `isPlan=true` auswerten, sonst Ausschluss über PD-Text „G BB n“), P4 Bauweise, Planbilder für Linzer Straße 22, Sommerschuhgasse 3, Enenkelstraße 21, Josefstädter Straße 93-97, Darwingasse 5/7/8 holen und testen.
- Offen bei Eduard: Theresiengasse Kursstand (672 m²/W IV/BB1 50 % vs. heute 762 m²/W III/BB1 30 %); §75(4) BK IV +4 m immer oder nur bei Straße > 15 m; Leitermayergasse §75(4)-Einschränkung; ChatGPT-Vorschläge Darwingasse 5/7/8 (ergebnis_C, unbestätigt).
