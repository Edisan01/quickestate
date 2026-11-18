// BB-Leser aus Rechner v204 (engine/bb.js, unverändert als bb.mjs) für den Python-Planleser.
// Aufruf: node bb_cli.mjs <text.txt> ['{"1":true}']  → JSON {treffer, plan, offen, verweis, aufgehoben, eigen}
import { readFileSync } from 'node:fs';
import { bbErkennen, BB_REGELN } from './bb.mjs';
const t = readFileSync(process.argv[2], 'utf8'); const planBB = process.argv[3] ? JSON.parse(process.argv[3]) : {};
const r = bbErkennen(t, { planBB });
for (const x of r.treffer) { const g = BB_REGELN.find(y => y.id === x.id || (y.id === 'begruenung' && x.id.startsWith('begruenung_'))); if (g) try { x.text = g.text(x.wert, x); } catch (e) {} }
process.stdout.write(JSON.stringify(r));
