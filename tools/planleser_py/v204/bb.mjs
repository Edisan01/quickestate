// Besondere Bestimmungen (BB) aus dem Plandokument erkennen (Eduard 02.10.2026).
// Grundlage: § 5 Abs. 4 BO Wien (abschließende Liste möglicher Festsetzungen, lit. a–z) + übliche Formulierungen der MA 21 + Kursbeispiele.
// Reine Textregeln, keine KI: was nicht sicher erkannt wird, bleibt als „nicht erkannt – selbst prüfen“ stehen.
const zahlBB = s => +String(s).replace(/\s/g, '').replace(',', '.').replace('\u2024', '.');
// Jede Regel: id, art (Kurzname), lit (§ 5 Abs. 4), re (RegExp), wert(m) → Zahl/true, setzt: { S-Schlüssel: Wert | (w)=>Wert }, sperrt: [S-Schlüssel], text(w)
export const BB_REGELN = [
  { id: 'unterirdisch_nein', lit: 'p/q', art: 'Keine unterirdischen Bauten', verbot: true, re: /(unterirdische[nr]?\s+(bau(werk|ten|lichkeiten|teile)|geb[äa]ude(teile)?)[^.;]{0,80}?(unzul[äa]ssig|untersagt|nicht\s+zul[äa]ssig|nicht\s+errichtet)|nicht\s+unterbaut|keine\s+(?:ober-?\s+und\s+)?unterirdischen|weder\s+unterirdische)/i,
    setzt: { unterirdisch: false, zufahrt: 'keine' }, sperrt: ['unterirdisch', 'zufahrt'], text: () => 'Keine Tiefgarage im Hof bzw. unter der G-Fläche – Garage entfällt.' },
  { id: 'frei_pct', lit: 'e/p', art: 'Freifläche (unversiegelt)', nicht: /Erdkern/i, re: /(\d{1,2}(?:[.,]\d+)?)\s*(%|v\.\s?H\.|Prozent)[^.;]{0,90}?(unversiegelt|g[äa]rtnerisch|frei\s*zu\s*halten|freizuhalten|nicht\s+(zu\s+)?bebau|nicht\s+(zu\s+)?versiegel|frei\s+bleiben)/i,
    wert: m => zahlBB(m[1]), setzt: { bbFrei: w => w }, sperrt: [], text: w => `${w} % des Bauplatzes bleiben frei – weder oberirdisch noch unterirdisch bebaut (Garage begrenzt).` },
  { id: 'bebaut_pct', lit: 'e', art: 'Bebaubare Fläche', re: /(?:bebaute[nr]?|bebaubaren?|überbaute[nr]?)\s+Fl[äa]che[^.;]{0,80}?(\d{1,2}(?:[.,]\d+)?)\s*(?:%|v\.\s?H\.|Prozent)|Ausma(?:ß|ss)\s+von\s+(\d{1,2}(?:[.,]\d+)?)\s*(?:%|v\.\s?H\.|Prozent)[^.;]{0,50}?bebaut|bauliche\s+Ausn[üu]tzbarkeit[^.;]{0,50}?(\d{1,2}(?:[.,]\d+)?)\s*(?:%|v\.\s?H\.|Prozent)/i,   /* Eduard 18.10.: auch „Ausmaß der bebauten Fläche … 25 %“ und „bis zu einem Ausmaß von 20 % … bebaut“ */
    wert: m => zahlBB(m[1] ?? m[2] ?? m[3]), setzt: { bbBebaut: w => w }, sperrt: [], text: w => `Bebaute Fläche höchstens ${w} % des Bauplatzes (oberirdisch).` },
  { id: 'gh_max', lit: 'h', art: 'Gebäudehöhe', re: /Geb[äa]udeh[öo]he[^.;]{0,50}?(?:(?:h[öo]chstens|max(?:imal|\.|\u2024)?|nicht\s+mehr\s+als|bis)\s*(\d{1,2}(?:[.,]\d+)?)\s*m\b|(\d{1,2}(?:[.,]\d+)?)\s*m\s+nicht\s+[üu]berschr(?:eiten|itten))|\bGH\s*(?:max\S*\s*|h[öo]chstens\s*)?(\d{1,2}(?:[.,]\d+)?)\s*m\b|max(?:imal(?:en)?)?\s+Geb[äa]udeh[öo]he\s+von\s+(\d{1,2}(?:[.,]\d+)?)\s*m\b/i, nicht: /mindestens|Gel[äa]nde|Wiener\s+Null|Adria|[üu]berrag|\bum\s+(?:nicht\s+mehr\s+als|h[öo]chstens|max)|Punkt\s+der\s+D[äa]cher|First|Traufe/i,   /* „Dächer dürfen die Gebäudehöhe um 4,5 m überragen“ = Dachhöhe (Plandokument 7206) */
    wert: m => zahlBB(m[1] || m[2] || m[3] || m[4]), setzt: { ghPlanArt: 'ja', ghPlan: w => w }, sperrt: ['ghPlanArt'], text: w => `Gebäudehöhe höchstens ${String(w).replace('.', ',')} m.` },
  { id: 'dach_h', lit: 'h/k', art: 'Dachhöhe', re: /(?:Dachh[öo]he[^.;]{0,40}?(\d(?:[.,]\d+)?)\s*m\b|(?:oberste[rn]?\s+Abschlu(?:ss|ß)\s+des\s+Daches|h[öo]chste[rn]?\s+Punkt\s+(?:des\s+Daches|der\s+(?:[\wäöüß]+\s+){0,4}D[äa]cher)|First\w*)[^.;]{0,60}?(\d(?:[.,]\d+)?)\s*m\b[^.;]{0,40}?[üu]ber\s+(?:der|die)\s+(?:[\wäöüß]+\s+){0,2}Geb[äa]udeh[öo]he|D[äa]ch(?:er|es)[^.;]{0,60}?Geb[äa]udeh[öo]he[^.;]{0,90}?\bum\s+(?:(?:nicht\s+mehr\s+als|h[öo]chstens|max(?:imal|\.|․)?)\s*)?(\d(?:[.,]\d+)?)\s*m\b[^.;]{0,15}?(?:[üu]berrag|[üu]berschreit))|(\d(?:[.,]\d+)?)\s*m?\s*First\w*\s*(?:[üu]ber|ueber)\s*(?:der\s+|die\s+)?(?:Traufe|GH|Geb[äa]udeh)|(?:First|Dach)\w*\s*(?:max\S*\s*|h[öo]chstens\s*)?(\d(?:[.,]\d+)?)\s*m?\s*(?:[üu]ber|ueber)\s*(?:der\s+|die\s+)?(?:Traufe|GH|Geb[äa]udeh)/i, nicht: /Gel[äa]nde|Wiener\s+Null|Adria/i,
    wert: m => zahlBB(m[1] || m[2] || m[3] || m[4] || m[5]), setzt: { dachArt: 'begrenzt', dachH: w => w }, sperrt: ['dachArt'], text: w => `Dach höchstens ${String(w).replace('.', ',')} m über der Gebäudehöhe.` },
  { id: 'flachdach', lit: 'k', art: 'Flachdach', nicht: /Nebengeb/i, re: /((nur|ausschlie(?:ß|ss)lich)\s+Flachd[äa]ch|als\s+(?:begr[üu]nte\s+)?Flachd[äa]ch(?:er)?\s+(auszu|herzu|zu\s+errichten)|Flachd[äa]ch(?:er)?[^.;]{0,40}?(vorgeschrieben|auszuf[üu]hren|herzustellen))/i,
    setzt: { dachArt: 'flach' }, sperrt: ['dachArt'], text: () => 'Flachdach (meist begrünt) – kein Dachgeschoß; Gründach-Kosten einplanen.' },
  { id: 'staffel_nein', lit: 'i', art: 'Staffelung untersagt', verbot: true, re: /(Staffelung[^.;]{0,40}?(untersagt|unzul[äa]ssig|nicht\s+zul[äa]ssig)|Staffelgescho(?:ß|ss)\w*[^.;]{0,90}?(untersagt|unzul[äa]ssig|nicht\s+zul[äa]ssig)|nicht\s+(zu\s+)?staffeln)/i,
    setzt: { staffelnVerboten: true }, sperrt: ['staffelnVerboten'], text: () => 'Zur Straße nicht staffeln – Dachgeschoß im vollen 45°-Umriss.' },
  { id: 'vorbauten_nein', lit: 'i', art: 'Vorbauten untersagt', verbot: true, re: /((Vorbauten|Erker|Balkone)[^.;]{0,60}?(untersagt|unzul[äa]ssig|nicht\s+zul[äa]ssig|nicht\s+gestattet))/i,
    setzt: { vorbautenVerboten: true, erker: false, vorbau: 'keiner' }, sperrt: ['vorbautenVerboten', 'erker', 'vorbau'], text: () => 'Keine Erker/Balkone zur Straße.' },
  { id: 'stapel_nein', lit: 'p', art: 'Stapel-/Doppelparker untersagt', verbot: true, re: /((Stapel|Doppel)[-\s]?park(er|systeme|anlagen)|mechanische\s+Parksysteme)[^.;]{0,60}?(untersagt|unzul[äa]ssig|nicht\s+zul[äa]ssig|nicht\s+gestattet)/i,
    setzt: { stapelVerboten: true, stpLoesung: 'abgabe' }, sperrt: ['stapelVerboten', 'stpLoesung'], text: () => 'Keine Stapel-/Doppelparker – fehlende Plätze über 2. UG oder Ausgleichsabgabe.' },
  { id: 'erdkern', lit: 'p', art: 'Erdkerne / Überschüttung über Tiefgarage', re: /^(?=[^.;]*Garage)(?=[^.;]*Erdkern)[^.;]*?(\d{1,2}(?:[.,]\d+)?)\s*(%|v\.\s?H\.|Prozent)/i,
    wert: m => zahlBB(m[1]), setzt: { erdkern: true, erdkernPct: w => w }, sperrt: ['erdkern'], text: w => `${w} % der Garagenfläche unter G als Erdkern für Bäume – fällt als Garage weg.` },
  { id: 'fenster_eg', lit: 'w', art: 'Keine Wohnungsfenster zur Straße', verbot: true, re: /(Fenstern?\s+von\s+Aufenthaltsr[äa]umen[^.;]{0,80}?(untersagt|unzul[äa]ssig|nicht\s+zul[äa]ssig)|keine\s+Fenster\s+von\s+Aufenthaltsr[äa]umen|Fenster\s+der\s+Aufenthaltsr[äa]ume[^.;]{0,80}?nicht\s+zur\s+Verkehrsfl[äa]che\s+gerichtet)/i,   /* + PD 6848 Pkt. 3.2.3 */
    setzt: { fensterEG: true }, sperrt: ['fensterEG'], text: (w, t) => `Keine Wohnungsfenster ${/Erdgescho/i.test(t?.satz || '') ? 'im EG ' : ''}zur ${t?.strassen?.length ? t.strassen.join(', ') : 'Verkehrsfläche (meist EG)'} – EG als Geschäft/Allgemeinflächen.` },
  { id: 'einfahrt_nein', lit: 'r', art: 'Ein-/Ausfahrten untersagt', verbot: true, re: /(Ein-?\s*(und|bzw\.?|\/)\s*Ausfahrten|Einfahrten|Ausfahrten)[^.;]{0,60}?(untersagt|unzul[äa]ssig|nicht\s+zul[äa]ssig)/i,
    setzt: {}, sperrt: [], text: () => 'An dieser Fluchtlinie keine Garagen-Einfahrt – Zufahrt von anderer Seite oder keine Garage. Bitte prüfen.' },
  { id: 'geschosse_max', lit: 'h', art: 'Geschoßanzahl', re: /(h[öo]chstens|max(imal|\.|\u2024)?|mehr\s+als)\s*(\d{1,2}|zwei|drei|vier|f[üu]nf|sechs)\s*(oberirdische\s+|Haupt)?gescho(ß|ss)(e|en)?\b/i,
    wert: m => ({ zwei: 2, drei: 3, vier: 4, 'fünf': 5, funf: 5, sechs: 6 })[m[3].toLowerCase()] ?? zahlBB(m[3]), setzt: {}, sperrt: [], text: w => `Höchstens ${w} Geschoße – mit dem Schnitt rechts abgleichen.` },
  { id: 'regulativ', lit: 'b', art: 'Stellplatzregulativ', re: /(Stellplatzregulativ|Regulativ|Stellplatzverpflichtung|Pflichtstellpl[äa]tze)[^.;]{0,80}?(\d{1,3})\s*(%|v\.\s?H\.|Prozent)/i,
    wert: m => zahlBB(m[2]), setzt: { regulativ: w => w }, sperrt: ['regulativ'], text: w => `Stellplatzregulativ: ${w} % der Pflichtstellplätze.` },
  { id: 'dachneigung', lit: 'k', art: 'Dachneigung', re: /Dachneigung[^.;]{0,40}?(\d{1,2})\s*°/i,
    wert: m => zahlBB(m[1]), setzt: {}, sperrt: [], text: w => `Dachneigung ${w}° – bei weniger als 45° kleineres Dachgeschoß (Rechner rechnet 45°).` },
  { id: 'wohnanteil', lit: 'w', art: 'Wohnnutzung (Anteil)', re: /(\d{1,3})\s*(%|v\.\s?H\.|Prozent)[^.;]{0,80}?(Wohnnutz|Wohnzweck|f[üu]r\s+Wohnungen\s+zu\s+verwenden)/i, nicht: /gef[öo]rdert/i,
    wert: m => zahlBB(m[1]), setzt: {}, sperrt: [], text: w => `Mindestens ${w} % Wohnnutzung (Wohnzone/Plan).` },
  { id: 'trakttiefe', lit: '', art: 'Trakttiefe', nicht: /mindestens/i, re: /Trakttiefe[^.;]{0,150}?(?:(?:h[öo]chstens|max(?:imal|\.|\u2024)?|mit|bis\s+zu)\s*(\d{1,2}(?:[.,]\d+)?)\s*m\b|(\d{1,2}(?:[.,]\d+)?)\s*m\s+nicht\s+[üu]berschrei)/i,   // Eduard 13.10.2026 (Plandokument 6951)
    wert: m => zahlBB(m[1] || m[2]), setzt: { bbTrakt: w => w, bbTraktOffen: (w, t) => !!t?.nurOffen }, sperrt: [], text: w => `Gebäude höchstens ${String(w).replace('.', ',')} m tief (Trakttiefe) – Haus wird darauf begrenzt.` },
  { id: 'nebengebaeude', lit: '', art: 'Nebengebäude', nicht: /begr[üu]n|Flachd/i, re: /Nebengeb[äa]ude[^.;]{0,90}?(\d{1,3}(?:[.,]\d+)?)\s*m(?:²|2\b)/i,
    wert: m => zahlBB(m[1]), setzt: {}, sperrt: [], text: w => `Nebengebäude (Gartenhaus, Carport) höchstens ${String(w).replace('.', ',')} m² je Bauplatz.` },
  { id: 'bebaut_m2', lit: '', art: 'Bebaute Fläche (m²)', nicht: /Nebengeb/i, re: /bebauten?\s+(?:Grund)?fl[äa]che\s+von\s+(?:jeweils\s+)?(?:h[öo]chstens|max(?:imal|\.|\u2024)?|nicht\s+mehr\s+als)\s*(\d{2,4}(?:[.,]\d+)?)\s*m/i,   // Plandokument 7206 BB1: „bebauten Grundfläche von jeweils nicht mehr als 200 m²“
    wert: m => zahlBB(m[1]), setzt: { bbBebautM2: w => w, bbJeBauplatz: (w, t) => !!t?.jeBauplatz }, sperrt: [], text: (w, t) => `Bebaute Fläche höchstens ${String(w).replace('.', ',')} m²${t?.jeBauplatz ? ' je Bauplatz, höchstens ein Hauptgebäude je Bauplatz' : ''}.` },
  { id: 'gliederung', lit: 'i', art: 'Gliederungselemente zur Straße', re: /Gliederung[^.;]{0,160}?Ausladung\s+von\s+(\d{1,2}[.,]\d{1,2})\s*m(?:[^;]{0,120}?Ausladung\s+von\s+(\d{1,2}[.,]\d{1,2})\s*m)?/i,   // Plandokument 6848 Pkt. 3.1.1 (Sturzgasse, Eduard 07.11.)
    wert: m => zahlBB(m[1]), setzt: {}, sperrt: [], text: (w, t) => `Gesimse/Lisenen (Gliederung) zur Straße höchstens ${String(w).replace('.', ',')} m vorragend${t?.w2 ? ` (an Straßen über 16 m: ${String(t.w2).replace('.', ',')} m)` : ''}.` },
  { id: 'zufahrt_minimal', lit: '', art: 'Zufahrt / Rangierfläche', re: /Rangier-?\s*(?:und|u\.)\s*Zufahrtsfl[äa]chen[^.;]{0,60}?unbedingt/i,   // PD 6848 Pkt. 3.1.3
    setzt: {}, sperrt: [], text: () => 'Zufahrt und Rangierflächen nur so groß wie unbedingt nötig – der Rest bleibt Garten.' },
  { id: 'erdkern_ausreichend', lit: 'p', art: 'Erdkerne über unterirdischen Bauten', nicht: /\d\s*(%|v\.\s?H\.|Prozent)/i, re: /unterirdischen\s+(?:Baulichkeiten|Bauten|Geb[äa]uden)[^.;]{0,140}?Erdkerne/i,   // PD 6848 Pkt. 3.1.5 – ohne Prozentangabe
    setzt: {}, sperrt: [], text: () => 'Über einer Tiefgarage unter Gartenflächen ausreichend Erdkerne für Bäume lassen – Menge nicht festgelegt, mit der Baupolizei klären.' },
  { id: 'regenwasser', lit: '', art: 'Regenwasser nicht in den Kanal', verbot: true, re: /(Niederschlagsw[äa]sser|Regenw[äa]sser|Oberfl[äa]chenw[äa]sser|Dachw[äa]sser)[^.;]{0,90}?Kanal/i,
    setzt: { versickerung: true }, sperrt: [], text: () => 'Regenwasser auf eigenem Grund versickern – Versickerung in den Kosten (Annahme).' },
  { id: 'einfriedung_durchblick', lit: '', art: 'Einfriedung durchsichtig', re: /Einfriedung(?:en)?[^.;]{0,160}?ab\s+einer\s+H[öo]he\s+von\s+(\d(?:[.,]\d+)?)\s*m[^.;]{0,60}?Durchblick/i,   // 8216 Pkt. 3.6
    wert: m => zahlBB(m[1]), setzt: {}, sperrt: [], text: w => `Zaun ab ${String(w).replace('.', ',')} m Höhe durchsichtig (kein blickdichter Zaun/Sichtschutz).` },
  { id: 'einfriedung', lit: '', art: 'Einfriedung', re: /Einfriedung(?:en)?[^.;]{0,240}?(?:(\d(?:[.,]\d+)?)\s*m\s+nicht\s+[üu]berrag|(?:h[öo]chstens|max(?:imal|\.|\u2024)?|(?<!ab\s+einer\s+)H[öo]he\s+von)\s*(\d(?:[.,]\d+)?)\s*m\b)/i,
    wert: m => zahlBB(m[1] || m[2]), setzt: {}, sperrt: [], text: w => `Zaun seitlich und hinten höchstens ${String(w).replace('.', ',')} m.` },
  { id: 'erdkern_min', lit: 'p', art: 'Erdkern Mindestgröße', re: /Einzelfl[äa]chen[^.;]{0,80}?(\d{1,3}(?:[.,]\d+)?)\s*m²/i,   // Plandokument 7294 Pkt. 3.2: „Einzelflächen … mindestens 25 m²“
    wert: m => zahlBB(m[1]), setzt: { erdkernMin: w => w }, sperrt: [], text: w => `Jeder Erdkern mindestens ${String(w).replace('.', ',')} m² groß.` },
  { id: 'wohnung_eg', lit: 'w', art: 'Keine Wohnungen im EG', verbot: true, re: /((Erdgescho(?:ß|ss)|\bEG\b)[^.;]{0,80}?Wohnungen[^.;]{0,40}?(unzul[äa]ssig|nicht\s+zul[äa]ssig|untersagt)|Wohnungen[^.;]{0,30}?(?:im|in\s+der)\s+(?:Erdgescho|EG\b)[^.;]{0,30}?(unzul[äa]ssig|nicht\s+zul[äa]ssig|untersagt))/i,
    setzt: { fensterEG: true }, sperrt: [], text: () => 'Im Erdgeschoß keine Wohnungen – EG als Geschäft, Büro oder Allgemeinflächen.' },
  { id: 'wohnung_nein', lit: 'w', art: 'Keine Wohnungen', verbot: true, nicht: /Erdgescho|\bEG\b/i, re: /Wohnungen[^.;]{0,30}?(unzul[äa]ssig|nicht\s+zul[äa]ssig|untersagt)/i,   // Plandokument 7294 BB2
    setzt: {}, sperrt: [], text: () => 'Keine Wohnungen zulässig – nur Gewerbe, Büro, Garage o. ä.; Wohnungsverkauf auf dieser Fläche nicht möglich.' },
  { id: 'bauweise_unterbr', lit: 'd', art: 'Unterbrechung der geschlossenen Bauweise', re: /Unterbrechung\s+der\s+geschlossenen\s+Bauweise[^.;]{0,40}?zul[äa]ssig/i,   // Plandokument 7294 BB1
    setzt: {}, sperrt: [], text: () => 'Geschlossene Bauweise darf unterbrochen werden – seitlicher Abstand statt Feuermauer möglich (Wahl).' },
  { id: 'unbebaut', lit: 'e/p', art: 'Von jeder Bebauung freihalten', re: /(weder\s+unterirdische\s+noch\s+oberirdische|keine\s+ober-?\s+und\s+unterirdischen|von\s+jeder\s+(?:oberirdischen\s+)?Bebauung\s+frei\s*zu\s*halten|von\s+jeder\s+(?:oberirdischen\s+)?Bebauung\s+freizuhalten|unbebaut\s+zu\s+belassen)/i,   // Plandokument 7294 Esp BB4
    setzt: {}, sperrt: [], text: (w, t) => t?.ober ? 'Diese Fläche bleibt oberirdisch unbebaut (im Plan prüfen, bis zu welcher Höhe).' : 'Diese Fläche bleibt ganz unbebaut – auch keine Tiefgarage darunter.' },
  { id: 'gebaeude_nein', lit: 'e', art: 'Keine Gebäude', verbot: true, re: /Errichtung\s+von\s+(?:oberirdischen\s+)?Geb[äa]uden\s+(?:ist\s+)?(untersagt|nicht\s+zul[äa]ssig|unzul[äa]ssig)/i,   // 7525 Eklw BB6, 8033 BB9
    setzt: {}, sperrt: [], text: (w, t) => t?.ober ? 'Keine oberirdischen Gebäude auf dieser Fläche.' : 'Keine Gebäude auf dieser Fläche.' },
  { id: 'einfriedung_nein', lit: '', art: 'Keine Einfriedung', verbot: true, re: /Einfriedungen?[^.;]{0,30}?(untersagt|nicht\s+zul[äa]ssig|unzul[äa]ssig)|Errichtung\s+von\s+Einfriedungen\s+(?:ist\s+)?(untersagt|nicht\s+zul)/i,   // 8033
    setzt: {}, sperrt: [], text: () => 'Kein Zaun/keine Einfriedung (an der genannten Linie).' },
  { id: 'staffel_max', lit: 'i', art: 'Staffelgeschoß begrenzt', re: /(maximal|h[öo]chstens|nur)\s+(ein(?:es)?|\d)\s+Staffelgescho/i,   // 8033 BB3
    setzt: {}, sperrt: [], text: () => 'Höchstens ein Staffelgeschoß innerhalb des 45°-Umrisses – Dachgeschoß entsprechend.' },
  { id: 'wohnung_ab', lit: 'w', art: 'Wohnungen erst ab Höhe', re: /Fu(?:ß|ss)bodenoberkante\s+von\s+Wohnungen[^.;]{0,40}?(\d{1,2}(?:[.,]\d+)?)\s*m/i,   // 8033 BB6
    wert: m => zahlBB(m[1]), setzt: {}, sperrt: [], text: w => `Wohnungen erst ab ${String(w).replace('.', ',')} m über der Straße – darunter Gewerbe/Büro/Garage.` },
  { id: 'bgf_max', lit: '', art: 'Bruttogeschoßfläche begrenzt', re: /Bruttogescho(?:ß|ss)fl[äa]che[^.;]{0,140}?h[öo]chstens\s+(\d{1,3}(?:\.\d{3})+|\d+)\s*m²/i,   // 8033 BB14
    wert: m => +m[1].replace(/\./g, ''), setzt: {}, sperrt: [], text: w => `Bruttogeschoßfläche oberirdisch höchstens ${w.toLocaleString('de-AT')} m².` },
  { id: 'nutzung_bgf', lit: '', art: 'Fläche für bestimmte Nutzung', re: /(\d{1,3}(?:\.\d{3})+|\d+)\s*m²\s+der\s+Bruttogescho(?:ß|ss)fl[äa]che[^.;]{0,60}?(f[üu]r|zu\s+verwenden)/i,   // 8033 BB8
    wert: m => +m[1].replace(/\./g, ''), setzt: {}, sperrt: [], text: w => `Mindestens ${w.toLocaleString('de-AT')} m² BGF für eine vorgeschriebene Nutzung (z. B. Kindergarten/Schule) – nicht als Wohnung verkaufbar.` },
  { id: 'terrasse_pct', lit: 'k', art: 'Dachterrassen begrenzt', re: /begehbare\s+Terrassen[^.;]{0,50}?(\d{1,3})\s*(?:%|v․\s?H․|Prozent)/i,   // 8033 BB2/BB3
    wert: m => zahlBB(m[1]), setzt: {}, sperrt: [], text: w => `Dachterrassen auf höchstens ${w} % der Dachfläche – Rest begrünt.` },
  { id: 'dg_nein', lit: 'k', art: 'Kein Dachgeschoß', verbot: true, re: /(Dachgescho(?:ß|ss)e?\s+(?:sind\s+)?(?:nicht\s+zul|unzul|untersagt)|Aufenthaltsr[äa]ume\s+in\s+Dachgescho(?:ß|ss)en[^.;]{0,20}?(?:nicht\s+zul|unzul|untersagt))/i,   // 7454 BB3/BB4
    setzt: { dachArt: 'flach' }, sperrt: ['dachArt'], text: () => 'Kein (bewohnbares) Dachgeschoß – nur Regelgeschoße.' },
  { id: 'gauben_nein', lit: 'k', art: 'Keine Dachgauben', verbot: true, re: /Dachgauben[^.;]{0,30}?(nicht\s+zul|unzul|untersagt)/i,   // 7454 BB5
    setzt: {}, sperrt: [], text: () => 'Keine Gauben – Dachgeschoß nur mit Dachflächenfenstern (weniger Fläche/Licht).' },
  { id: 'staffel_pflicht', lit: 'i', art: 'Dachgeschoß als Staffelgeschoß', re: /als\s+Staffelgescho(?:ß|ss)e?\s+auszubilden/i,   // 7964 BB4
    setzt: {}, sperrt: [], text: () => 'Dachgeschoß nur als Staffelgeschoß mit Flachdach – Fläche kleiner als beim Schrägdach-DG.' },
  { id: 'gefoerdert', lit: 'w', art: 'Geförderter Wohnbau (Anteil)', re: /(zwei\s+Drittel|drei\s+Viertel|die\s+H[äa]lfte|(\d{1,3})\s*(?:%|v․\s?H․|Prozent))[^.;]{0,120}?(?:Bruttogrundfl[äa]che|Wohnnutzfl[äa]che|Nutzfl[äa]che)[^.;]{0,250}?(Grundkostenangemessenheit|WWFSG|Wohnbauf[öo]rderung|gef[öo]rdert)/i,   // 8399 BB2/BB5 „Gebiete für geförderten Wohnbau“
    wert: m => /zwei\s+Drittel/i.test(m[1]) ? 66.7 : /drei\s+Viertel/i.test(m[1]) ? 75 : /H[äa]lfte/i.test(m[1]) ? 50 : zahlBB(m[2]), setzt: {}, sperrt: [], text: w => `${String(w).replace('.', ',')} % der Wohnfläche als geförderter Wohnbau (Grundkostenangemessenheit WWFSG) – Grundpreis für diesen Anteil gedeckelt, Verkaufspreise niedriger; Beherbergung meist untersagt.` },
  { id: 'erdschicht', lit: 'p', art: 'Erdschicht über Tiefgarage', re: /(?:mindestens\s+(\d(?:[.,]\d+)?)\s*m\s+hohe\s+Erd(?:schicht|sch[üu]ttung)|Erd(?:schicht|sch[üu]ttung)\s+von\s+mindestens\s+(\d(?:[.,]\d+)?)\s*m)/i,   // 8399 Pkt. 3.3, 7582 BB8
    wert: m => zahlBB(m[1] || m[2]), setzt: {}, sperrt: [], text: w => `Tiefgaragendecke für ${String(w).replace('.', ',')} m Erdschicht auslegen – stärkere Decke, Garage liegt tiefer (Kosten).` },
  { id: 'vorbehalten', lit: 'w', art: 'Fläche für bestimmte Nutzung', re: /(?:Grundfl[äa]chen|Fl[äa]chen?)\s+(?:sind|ist)\s+(?:der\s+Errichtung\s+von\s+)?([A-ZÄÖÜ][^.;]{2,60}?)\s+vorbehalten/,   // 8399 BB10, 7071 Eklw
    setzt: {}, sperrt: [], text: () => 'Fläche einer bestimmten Nutzung vorbehalten (z. B. Sozial-/Bildungseinrichtung) – kein freier Wohnungsverkauf.' },
  { id: 'raum_verkehr', lit: 'f', art: 'Unterer Raum ist Straße', re: /(Raum\s+(?:bis|unter|unterhalb)[^.;]{0,150}?(Verkehrsfl[äa]che|Verkehrsband)|darunter\s+liegende\s+Raum[^.;]{0,40}?Verkehrsfl[äa]che)/i,   // 8033 BB10–12
    setzt: {}, sperrt: [], text: () => 'Der untere Raum gehört zur Straße bzw. zum Verkehrsband – erst darüber ist Bauland (Überbauung).' },
  { id: 'pct_flaeche', lit: 'e', art: 'Bebaubarer Anteil laut Plankarte', re: /(Beschr[äa]nkung\s+der\s+baulichen\s+Ausnutzbarkeit|Prozents[äa]tze?n?[^.;]{0,60}?(Fluchtlinien|umgrenzten))/i,   // Plandokument 7294 BB3
    setzt: {}, sperrt: [], text: () => 'Wie viel bebaut werden darf, steht als Prozentzahl in der Plankarte (je von Fluchtlinien umgrenzter Fläche) – Prozentzahl aus dem Plan bei „Bebaute Fläche“ eintragen.' },
  { id: 'arkade', lit: 'f', art: 'Arkade/Durchgang', nicht: /nicht\s+gestattet|untersagt|unzul[äa]ssig/i, re: /\b(Arkade|Durchg[äa]ng|Durchfahrt|Laubengang)/i,
    setzt: {}, sperrt: [], text: (w, t) => `${t?.oeff ? 'Öffentlicher Durchgang' : 'Arkade/Durchgang/Durchfahrt'} verlangt${t?.mass ? ` (${t.mass})` : ''} – EG-Fläche geht verloren, im Plan Lage prüfen.` },
  { id: 'begruenung', lit: 'k/p', art: 'Begrünung', nicht: /Erdkern|Tiefgarage/i, re: /(begr[üu]n|g[äa]rtnerisch\s+(auszugestalten|zu\s+gestalten))/i,
    setzt: {}, sperrt: [], text: (w, t) => t?.wo === 'Fassade' ? `Fassadenbegrünung${t.pct ? ` auf mindestens ${t.pct} % der Straßenfronten` : ''} verlangt – Kosten einplanen.` : t?.wo === 'Dach' ? 'Dachbegrünung verlangt – Kosten einplanen.' : t?.wo === 'Fläche' ? 'Unbebaute Flächen gärtnerisch gestalten (Garten statt Pflaster) – Kosten einplanen.' : 'Begrünung (Dach/Fassade/Fläche) verlangt – Kosten einplanen.' }
];
// „lichten Breite und einer lichten Höhe von 2,5 m“ / „lichten Breite von 1,7 m und einer lichten Höhe von 3,0 m“
const durchMass = s => { const t = s.replace(/․/g, '.'), f = x => String(x).replace('.', ','), Z = String.raw`(\d{1,2}(?:[.,]\d+)?)`;
  const H = (t.match(new RegExp(String.raw`lichte[nr]?\s+H[öo]he\s+(?:im\s+Scheitelbereich\s+)?(?:von\s+)?(?:mindestens\s+)?${Z}\s*m`, 'i')) || t.match(new RegExp(String.raw`${Z}\s*m\s+lichter\s+H[öo]he`, 'i')) || [])[1];
  let B = (t.match(new RegExp(String.raw`lichte[nr]?\s+Breite\s+(?:von\s+)?(?:mindestens\s+)?${Z}\s*m`, 'i')) || t.match(new RegExp(String.raw`${Z}\s*m\s+(?:lichter\s+Breite|breite[nr]?\b)`, 'i')) || [])[1];
  if (!B && H && /Breite\s+und\s+(?:einer\s+)?lichten\s+H[öo]he/i.test(t)) B = H;
  return { ...(/[öo]ffentlich/i.test(t) ? { oeff: true } : {}), ...(B || H ? { mass: [B && `${f(B)} m breit`, H && `${f(H)} m hoch`].filter(Boolean).join(', ') } : {}) }; };
// Text → Treffer + nicht erkannte Sätze. Ein Satz kann mehrere Regeln treffen; jede Regel nur einmal (erster Treffer).
export function bbErkennen(text, opt = {}) {
  // Abkürzungen schützen, sonst zerfällt „30 v.H. des Bauplatzes“ oder „gem. § 84 Abs. 2“ in Bruchstücke
  const ABK = /\b(v\.\s?H\.|z\.\s?B\.|d\.\s?h\.|u\.\s?a\.|o\.\s?ä\.|gem\.|lit\.|Abs\.|Art\.|bzw\.|max\.|min\.|ca\.|Nr\.|bez\.|lt\.|inkl\.|exkl\.|Pkt\.|Z\.)/gi;
  const roh = String(text || ''), Z0 = roh.split('\n'), kurz = Z0.length > 5 && roh.length / Z0.length < 70;
  const T = (/[A-Za-zäöüß]-\s*\n\s*[a-zäöüß]/.test(roh) || kurz ? bbNormal(roh) : roh).slice(0, 20000).replace(ABK, a => a.replace(/\./g, '\u2024'));   /* eingefügter Rohtext (Zeilenumbrüche, Trennungen) wird aufbereitet */
  /* Plan-BB: „mit BB1 bezeichneten“, „mit GV BB2 ausgewiesenen“, „mit Esp BB4 …“ – jedes Widmungskürzel davor (Plandokument 7294) */
  const VOR = String.raw`(?:(?:[A-Z]{1,3}\s?[IVX]{1,3}(?:\s+(?:gk|g|o|k|f))?|[A-Z][A-Za-z]{0,3})(?:\s+|\s*\/\s*))?`, VERB = /versehene[nr]?|bezeichnete[nr]?|ausgewiesene[nr]?|gekennzeichnete[nr]?|dargestellte[nr]?|festgesetzte[nr]?/;
  const bbNr = z => { const m = z.match(new RegExp(String.raw`mit\s+((?:${VOR}BB\s*\d{1,2}(?:\s*(?:,|und|bis|sowie|bzw․?|oder)\s*)?)+)\s*(?:${VERB.source})`, 'i')); if (!m || new RegExp(String.raw`mit\s+Ausnahme\s+der\s+mit\s+${VOR}BB`, 'i').test(z.slice(Math.max(0, m.index - 30), m.index + 12))) return null;
   const vor = (m[1].match(/^\s*([A-Z]{1,3}\s?[IVX]{1,3}(?:\s+(?:gk|g|o|k|f))?|[A-Z][A-Za-z]{0,3})(?:\s+|\s*\/\s*)BB/) || [])[1] || '';
   const n = [...m[1].matchAll(/BB\s*(\d{1,2})|(?<=bis\s*)(\d{1,2})/g)].map(x => +(x[1] || x[2])); const L = /bis/.test(m[1]) && n.length === 2 && n[1] > n[0] && n[1] - n[0] < 20 ? Array.from({ length: n[1] - n[0] + 1 }, (_, i) => String(n[0] + i)) : n.map(String); L.vor = vor; return L; };   /* „mit BB 4 und BB 5“, „BB 4 bis BB 6“ */
  /* Durchgang/Arkade „In Verbindung der Punkte A und B“ = nur dort, wo der Plan die Punkte zeigt */
  const PK = String.raw`(?<![A-Za-zäöüß])(?:[A-Z]{1,2}\d{0,2}|[a-z])(?![a-zäöüß])`;
  const punktNr = z => { let L = null; const oe = z.match(/mit\s+(ö\s?D[gf]|Ö\s?D[gf])\s+(?:bezeichnete|gekennzeichnete|ausgewiesene)/); if (oe) { const k = oe[1].replace(/\s/g, ''); return Object.assign([k], { punkt: true, name: `${k} (öffentlicher ${/f$/.test(k) ? 'Durchfahrt' : 'Durchgang'})` }); }   /* 6912: „mit öDg bezeichneten Fläche“ */
   const m = z.match(new RegExp(String.raw`(?:Verbindung|[Zz]wischen|die)\s+(?:der|den)?\s*Punkten?\s+(${PK}(?:\s*(?:-|,|und|bis|mit|bzw\S?|sowie(?:\s+der\s+Punkte)?)\s*${PK})*)`));
   if (m) { const x = m[1], tr = /-/.test(x) ? /\s*(?:,|und|bzw\S?|sowie(?:\s+der\s+Punkte)?)\s*/ : /\s*(?:bzw\S?|sowie(?:\s+der\s+Punkte)?)\s*/;
    L = x.split(tr).map(g => (g.match(new RegExp(PK, 'g')) || []).map(c => c.toUpperCase()).join('–')).filter(g => g.includes('–')); }
   else { const k = z.match(/((?:[A-Z]\s*-\s*[A-Z](?:\s*(?:bzw\S?|und|,)\s*)?)+)\s+gekennzeichneten\s+Punkten/); if (k) L = k[1].match(/[A-Z]\s*-\s*[A-Z]/g).map(x => x.replace(/\s*-\s*/, '–')); }
   if (!L) { const q = z.match(/Punktpaare?n?\s+((?:[A-Z]\s*\/\s*[A-Z][\s,]*(?:und\s+|bzw\S?\s+)?)+)/); if (q) L = q[1].match(/[A-Z]\s*\/\s*[A-Z]/g).map(x => x.replace(/\s*\/\s*/, '–')); }   /* 8399: „zwischen den Punktpaaren A/B, C/D und J/H“ */
   if (!L || !L.length) return null; L.punkt = true; return L; };
  /* Punkt 3 mit Bedingung „Auf den als Geschäftsviertel … ausgewiesenen Flächen“ (7223) = nur auf Flächen mit dieser Widmung */
  const widmNr = z => { const z1 = z.replace(/^\d{1,2}[.,․]\d{1,2}[.,․]?\s+/, ''), g = z1.match(/^(?:Auf|In|F[üu]r)\s+(?:den|der|dem|die)\s+mit\s+(?:einer\s+)?(?:maximale[nr]?\s+|h[öo]chstzul[äa]ssigen\s+)?Geb[äa]udeh[öo]he\s+von\s+(\d{1,2}(?:[.,]\d+)?)\s*m\s+(?:ausgewiesenen|bezeichneten|festgesetzten)\s+(?:Grundfl[äa]chen?|Fl[äa]chen?|Bereich)/);   /* 8216 Pkt. 3.5: gilt nur, wo der Plan diese Höhe zeigt */
   if (g) { const h = g[1].replace('.', ','), L = [`Flächen ${h} m`]; L.gh = zahlBB(g[1]); L.name = `nur Flächen mit „${h} m“ im Plan`; return L; }
   const m = z1.match(/^(?:(?:Auf|In)\s+(?:den|der|dem)\s+als\s+(.{3,90}?)\s+ausgewiesenen|F[üu]r\s+die\s+im\s+(.{3,90}?)\s+liegenden)\s+(?:Grundfl[äa]chen?|Fl[äa]chen?|Bereich)/); if (!m) return null; const w = (m[1] || m[2]).replace(/\s+/g, ' ').replace(/\u2024/g, '.').replace(/[,;\s]+$/, ''); const L = [`Widmung ${w}`]; L.widm = w; return L; };
  // Bestimmungen „mit Plandarstellung“ gelten nur, wo der Plan BB n zeigt – nur wenn ausgewählt (opt.planBB = { n: true })
  // Aufbau Plandokument: „3. … gesamtes Plangebiet ohne eigene Kennzeichnung“ (gilt überall) · „4. … mit eigener Kennzeichnung (BB)“ (nur wo der Plan es zeigt).
  // Ein nummerierter Absatz („4.2.“) gehört mit allen Sätzen zu seiner BB – auch wenn ein Satz am Zeilenende endet.
  const plan = [], saetze = []; let sek = null, cur = null;
  for (const zeile of T.split(/\n+/)) { const z = zeile.trim(); if (!z) continue;
    if ((/^\d{1,2}[.․]\s/.test(z) || /^Gem[äa](?:ß|ss)\s/.test(z)) && /:\s*$/.test(z) && /bestim|Bestimmung|festgelegt/i.test(z) && z.length < 400) { sek = /Strukturgebiet/i.test(z) ? 'struktur' : /ohne\s+(?:eigene[rn]?\s+)?(?:Kennzeichnung|Bezeichnung)/i.test(z) ? 'alle' : /mit\s+(?:eigene[rn]?\s+)?(?:Kennzeichnung|Bezeichnung)|\(BB\)|Planzeichen\s+BB/i.test(z) ? 'plan' : null; cur = null; continue; }   /* Überschrift „3. Gemäß § 5 (4) … bestimmt:“ / „4. Bestimmungen mit Bezeichnung … BB:“ (8033) */   /* Überschrift „3. Gemäß § 5 (4) … bestimmt:“ */
    const num = /^\d{1,2}[.,․]\d{1,2}[.․]?\s/.test(z), haupt = !num && /^\d{1,2}[.․]\s/.test(z);
    let nrs = bbNr(z) || punktNr(z) || widmNr(z) || (sek === 'plan' && /^\d{1,2}[.,․]\d{1,2}[.․]?\s/.test(z) ? (n => Object.assign([`Pkt. ${n}`], { nurPlan: true, name: `Pkt. ${n} – nur wo im Plan eingezeichnet` }))(z.match(/^(\d{1,2}[.,․]\d{1,2})/)[1].replace(/[,․]/, '.')) : null) || (sek === 'struktur' ? Object.assign(['StrE'], { name: 'Strukturgebiet (§ 77) – Werte je Struktureinheit' }) : null);
    if (num || nrs) cur = nrs && (num || /:\s*$/.test(z)) ? nrs : null; else if (haupt) { cur = null; sek = null; } else if (cur) nrs = cur;   /* erbt nur nach nummeriertem Absatz oder „… wird bestimmt:“ */   /* OCR verliert Nummern („. Auf den mit G BB3“): eigene BB-Nennung beginnt ebenfalls einen Absatz */   /* Fortsetzung des nummerierten Absatzes */
    const an = nrs && nrs.some(n => opt.planBB?.[n]), tx = z.replace(/․/g, '.').slice(0, 300);
    if (nrs) nrs.forEach(n => { const p0 = plan.find(p => p.nr === n); if (!p0) plan.push({ nr: n, text: tx, ...(nrs.vor ? { vor: nrs.vor } : {}), ...(nrs.gh ? { gh: nrs.gh } : {}), ...(nrs.nurPlan ? { nurPlan: true } : {}), ...(nrs.name ? { name: nrs.name } : nrs.widm ? { widm: nrs.widm, name: `nur Widmung „${nrs.widm}“` } : nrs.punkt ? { punkt: true, name: `Punkte ${n}` } : { name: `${nrs.vor ? nrs.vor + ' ' : ''}BB ${n}` }), ...(opt.planBB?.[n] ? { an: true } : {}) }); else if (p0.text.length < 300 && !p0.text.includes(tx.slice(0, 40))) p0.text = (p0.text + ' ' + tx).slice(0, 300); });
    if (nrs && !an) continue;
    const info = { alle: !nrs && sek === 'alle', bb: nrs ? nrs.filter(n => opt.planBB?.[n]).join(',') : '', vor: nrs?.vor || '' };
    const S2 = z.split(/(?<=[.;])\s+/).map(x => x.trim()).filter(x => x.length > 3).map(x => ({ s: x, ...info })); if (nrs) saetze.unshift(...S2); else saetze.push(...S2); }   /* gewählte Plan-BB zuerst: gilt dort vor der allgemeinen Bestimmung */   /* Platzhalter bleibt beim Prüfen ([^.;] darf nicht an „gem.“ enden) */
  const zeig = x => x.replace(/\u2024/g, '.');
  const NEG = /nicht\s+(untersagt|unzul[äa]ssig|verboten)|(?<!un)zul[äa]ssig(?![^.;]*unzul)|gestattet(?![^.;]*nicht)/i, AUSN = /ausgenommen|mit\s+Ausnahme|au(ß|ss)er\b|nur\s+bis|bis\s+zu\s+\d|sofern|soweit|teilweise/i;
  const treffer = [], gesehen = new Set(), offen = [];
  for (const { s: satz0, alle, bb, vor } of saetze) {
    const satz = satz0.replace(/v\u2024\s?H\u2024|\bv\s?H\b/g, '%'); let hit = false;   /* „v.H.“ = % */
    const ausBB = [...satz.matchAll(new RegExp(String.raw`mit\s+Ausnahme\s+der\s+mit\s+((?:${VOR}BB\s*\d{1,2}(?:\s*(?:,|und|sowie)\s*)?)+)`, 'gi'))].flatMap(m => [...m[1].matchAll(/\d{1,2}/g)].map(x => x[0]));
    if (ausBB.some(n => opt.planBB?.[n])) continue;   /* gilt „mit Ausnahme der BB n“ – und dein Grundstück liegt in BB n */
    for (const r of BB_REGELN) {
      const m = satz.match(r.re); if (!m) continue; if (r.nicht && r.nicht.test(satz)) continue;
      const ohneNeg = satz.replace(/nicht\s+(untersagt|unzul[äa]ssig|verboten)/gi, '');   /* „nicht untersagt“ = erlaubt */
      const verbotDa = /unzul[äa]ssig|untersagt|verboten|nicht\s+(zu\s+)?(gestattet|zul[äa]ssig|errichtet|unterbaut|staffeln)|keine\s+(?:ober-?\s+und\s+)?unterirdischen|d[üu]rfen\s+(?:keine|weder)|keine\s+Fenster|nicht\s+zur\s+Verkehrsfl[äa]che\s+gerichtet/i.test(ohneNeg);
      if (r.verbot && r.id !== 'arkade' && !verbotDa) { hit = true; continue; }   /* Erlaubnis („sind zulässig“) → keine Einschränkung */   /* Verneinung/Erlaubnis → keine Einschränkung */
      hit = true; const ex0 = r.id === 'begruenung' ? (/Fronten|Fassade/i.test(satz) ? 'fassade' : /D[äa]ch/i.test(satz) ? 'dach' : /g[äa]rtnerisch/i.test(satz) ? 'flaeche' : '') : '', rid = ex0 ? `begruenung_${ex0}` : r.id; if (gesehen.has(rid)) continue;
      const w = r.wert ? r.wert(m) : true; if (r.wert && !(Number.isFinite(w) && w > 0)) continue;
      if ((r.id === 'frei_pct' || r.id === 'bebaut_pct' || r.id === 'regulativ' || r.id === 'wohnanteil') && w > 100) continue;
      const teil = (r.verbot && AUSN.test(satz)) || /Struktureinheit/i.test(satz) || (r.id === 'trakttiefe' && /seitlichen\s+Grund/i.test(satz));   /* Trakttiefe nur an der seitlichen Grenze: selbst prüfen */   /* Verbot mit Ausnahme → nur Hinweis, nichts automatisch setzen */
      if (r.id === 'trakttiefe' && teil) { if (!gesehen.has('trakttiefe_seite')) { gesehen.add('trakttiefe_seite'); treffer.push({ id: 'trakttiefe_seite', art: 'Trakttiefe an der seitlichen Grenze', lit: '', wert: w, teilweise: true, text: `An der seitlichen Grundgrenze höchstens ${String(w).replace('.', ',')} m tief – selbst prüfen, nicht automatisch übernommen.`, quelle: zeig(satz).slice(0, 240) }); } continue; }   /* allgemeine Trakttiefe gilt daneben weiter */
      const str = r.id === 'fenster_eg' ? ((satz.match(/(?:zu|an)\s+(?:der|den)\s+(?:öffentlichen\s+)?Verkehrsfl[äa]chen?\s+(.{3,200}?)\s+d[üu]rfen/i) || satz.match(/Baupl[äa]tzen\s+an\s+der\s+(.{3,120}?)\s+zur\s+Errichtung/i) || [])[1] || '').split(/\s*,\s*|\s+und\s+/).map(x => x.trim()).filter(Boolean) : [];
      const ex = r.id === 'begruenung' ? (/Fronten|Fassade/i.test(satz) ? { wo: 'Fassade', pct: (satz.match(/(\d{1,2})\s*(?:%|v\u2024\s?H\u2024|v\.\s?H\.)/) || [])[1] } : /D[äa]ch/i.test(satz) ? { wo: 'Dach' } : /g[äa]rtnerisch/i.test(satz) ? { wo: 'Fläche' } : {}) : r.id === 'arkade' ? durchMass(satz) : /^(unbebaut|gebaeude_nein)$/.test(r.id) && /oberirdisch|lichten\s+H[öo]he|Raum\s+bis/i.test(satz) ? { ober: true } : {};
      const strNein = str.length && opt.strasse && !str.some(x => x.toLowerCase() === String(opt.strasse).toLowerCase());   /* Fenster-Verbot nennt Straßen – dein Grundstück liegt an keiner davon */
      if (str.length) Object.assign(ex, { strassen: str, satz }); if (strNein) { gesehen.add(rid); continue; }
      gesehen.add(rid); treffer.push({ id: rid, art: r.art, lit: r.lit, wert: w, teilweise: teil, ...ex, ...(alle ? { geltung: 'alle' } : {}), ...(bb ? { bb, ...(vor ? { vor } : {}) } : {}), ...(r.id === 'trakttiefe' && /offene|gekuppelte/i.test(satz) ? { nurOffen: true } : {}), ...(r.id === 'bebaut_m2' && /je\s+Bau-?\s*platz/i.test(satz) ? { jeBauplatz: true } : {}), text: r.text(w, { jeBauplatz: r.id === 'bebaut_m2' && /je\s+Bau-?\s*platz/i.test(satz), ...ex, ...(r.id === 'gliederung' && m[2] ? { w2: zahlBB(m[2]) } : {}) }) + (teil ? ' – mit Ausnahme/Einschränkung, nicht automatisch übernommen: selbst prüfen.' : ''), quelle: zeig(satz).slice(0, 240) });
    }
    if (!hit && !/:\s*$/.test(satz) && (T.length < 1500 || /Geb[äa]ude|Bau(?!m)|Dach|Fl[äa]che|Gescho|Garage|Stellpl|H[öo]he|zul[äa]ssig|untersagt|verboten|Tiefe/i.test(satz) && !/M\s?A\s?G\s?I\s?S\s?T\s?R\s?A\s?T|\bMA\s?21\b|Festsetzung\s+des\s+Fl[äa]chenwidmungs|Antragsplan|(Technische|Belichtung\s+dienende)\s+Aufbauten[^.;]*zul[äa]ssig/i.test(satz) && !(/Verkehrsfl[äa]che|Gehsteig|Baumreihe|Gemeinderat|Rechtskraft|Planzeichen|Zeichenerkl|Fl[äa]chenwidmungsplan|Bebauungsplan|Bestimmungen\s+getroffen/i.test(satz) && !/zul[äa]ssig|untersagt|verboten/i.test(satz)))) offen.push(zeig(satz).slice(0, 240));   /* lange Dokumente: nur, was das Bauen betrifft */
  }
  // „unterirdisch nein“ schließt Garage aus; „frei %“ + „bebaut %“ dürfen gemeinsam vorkommen
  const eigen = (T.match(/Plandokument\s+(\d{4}[A-Z]?)\b/) || [])[1] || '';
  const verweis = [...new Set([...T.matchAll(/\b(?:PD|Plandokument(?:es)?)\s*(?:Nr\S?\s*)?(\d{4})\b/g)].map(m => m[1]))].filter(n => n !== eigen);
  const aufgehoben = [...T.matchAll(/Punkte?\s+((?:\d{1,2}\.\d{1,2}\S?(?:\s*(?:,|und)\s*)?)+)\s+des\s+Verordnungstextes\s+zu\s+Plandokument\s+(\d{4})/g)].map(m => ({ pd: m[2], punkte: m[1].match(/\d{1,2}\.\d{1,2}/g) }));
  return { treffer, offen, plan, verweis, aufgehoben, eigen };
}
// Text aus PDF/OCR aufbereiten (Eduard 13.10.2026): Seitenzahlen, Trennungen am Zeilenende, Zeilen zu Absätzen, typische OCR-Fehler
export function bbNormal(text) {
  let s = String(text || '').replace(/\r/g, '').slice(0, 60000);
  s = s.replace(/^[\s\-=–—]*\d{1,3}[\s\-=–—]*$/gm, '');
  s = s.replace(/^[ \t]*[A-Za-zäöü]{1,4}[ \t]*$/gm, '');                       // OCR-Reste („ae“, „Sehr“)
  s = s.replace(/^\s*[-–—]?\s*Seite\s*[-–—]?\s*\d{1,3}\s*[-–—]?\s*$/gim, '');                     // „Seite - 3 -“ (Plandokument 7294)                       // „- 3 -“
  s = s.replace(/^[ \t|;:.,'"_~]+(?=[A-Za-zÄÖÜäöüß(§])/gm, '').replace(/^[ \t|;:.,'"_~]+$/gm, '').replace(/[ \t]\|[ \t]/g, ' ');
  s = s.replace(/([A-Za-zÄÖÜäöüß])-\s*\n\s*([a-zäöüß])/g, '$1$2');              // Er-\nrichtung → Errichtung
  s = s.replace(/(^|[\s(])S\s?(?=\d{1,3}\s*(\(|Abs|lit|der\s+BO|BO))/g, '$1§ ');      // OCR: „S 5 (4)“ → § 5 (4)
  s = s.replace(/(gem[äa](?:ß|ss)|nach|laut)\s+[S8]\s+(?=\d{1,3}\s*\()/g, '$1 § ');   // OCR: „gemäß 8 116 (1)“
  s = s.replace(/^\s*(Der\s+Abteilungsleiter|Die\s+Abteilungsleiterin|Dipl\.?\s?-?\s?Ing\.|Senatsr[aä]t|Unverk[äa]ufliches\s+Dienstexemplar).*$/gim, '');   // Unterschrift, Stempel
  s = s.replace(/(\d)\s?m(\s?\*?\?|@|2(?![\d,.]))/g, '$1 m²');
  s = s.replace(/\bBB[lI|]1?(?![\d])/g, 'BB1').replace(/\$S?\s?(?=\d)/g, '§ ').replace(/\bSS\s?(?=\d)/g, '§§ ').replace(/(Gem[äa](?:ß|ss))\s+5\s+(?=5\s*\()/g, '$1 § ');   // OCR (6916/7223): „BBl“, „$S 5 (4)“, „SS 4“, „Gemäß 5 5 (4)“                     // m? m*? m@ m2 → m²
  if (/\bf(ii|ir)r\b|gema[B8]|\bda[B8]\b/.test(s)) s = s.replace(/\bf(ii|i)r\b/g, 'für').replace(/\bFiir\b/g, 'Für').replace(/([a-zäöü])[B8](?=[a-zäöü\s.,;:)]|$)/gm, '$1ß');   // englische OCR
  s = s.replace(/\n(?=\s*\d+(\.\d+)+\.?\s)/g, '\n\n');                             // „3.1.2.“ beginnt einen Absatz
  s = s.replace(/([.;:])[ \t]*\n(?=[ \t]*[A-ZÄÖÜ§])/g, '$1\n\n');                      // Satzende am Zeilenende + Großbuchstabe → neuer Absatz
  s = s.replace(/([^.;:!?\s])[ \t]*\n[ \t]*\n+(?=[ \t]*(?!\d{1,2}\.(?:\d{1,2}\.)*\s|\d{1,2},\d{1,2}\.\s|[IVX]{1,4}[.,])[A-Za-zÄÖÜäöüß(„\d])/g, '$1\n');   // OCR-Leerzeile mitten im Satz
  return s.split(/\n\s*\n/).map(p => p.replace(/\s*\n\s*/g, ' ').replace(/[ \t]{2,}/g, ' ').trim()).filter(p => p.length > 1).join('\n');
}
// Treffer → zu setzende Werte + gesperrte Felder (nur aktive Treffer)
export function bbWirkung(treffer, aus = {}) {
  const setzt = {}, sperrt = new Set();
  for (const t of treffer || []) {
    if (aus[t.id] || t.teilweise) continue; const r = BB_REGELN.find(x => x.id === t.id); if (!r) continue;
    for (const [k, v] of Object.entries(r.setzt)) setzt[k] = typeof v === 'function' ? v(t.wert, t) : v;
    r.sperrt.forEach(k => sperrt.add(k));
  }
  return { setzt, sperrt: [...sperrt] };
}
