// Prüfstand-Bericht anzeigen (planleser/pruefstand.json, offline erzeugt von tools/pruefung/pruefstand.py)
(async () => {
  const kopf = document.getElementById('kopf'), liste = document.getElementById('liste');
  let d;
  try { const r = await fetch('planleser/pruefstand.json?t=' + Date.now()); if (!r.ok) throw r.status; d = await r.json(); }
  catch (e) { kopf.textContent = 'Bericht nicht abrufbar.'; return; }
  const esc = s => String(s ?? '–').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const wert = v => v === null || v === undefined ? '–' : Array.isArray(v) ? (v.length ? v.join(' · ') : 'keine') : typeof v === 'boolean' ? (v ? 'ja' : 'nein') : v;
  const g = d.gesamt, n = g.gruen + g.rot + g.offen;
  kopf.textContent = `Stand ${d.stand} · gesamt ${Math.round(100 * g.gruen / n)} % grün (${g.gruen} grün · ${g.rot} rot · ${g.offen} offen)`;
  for (const [adr, F] of Object.entries(d.adressen)) {
    const c = z => F.filter(f => f.z === z).length, pz = Math.round(100 * c('gruen') / F.length);
    const el = document.createElement('details');
    el.innerHTML = `<summary><b>${esc(adr)}</b><span class="bar"><i class="g"></i><i class="r"></i><i class="o"></i></span><span class="pz">${pz} %</span></summary>
      <table><tr><th></th><th>Feld</th><th>Soll (Blatt)</th><th>Ist (Leser)</th></tr>${F.sort((a, b) => ['rot', 'offen', 'gruen'].indexOf(a.z) - ['rot', 'offen', 'gruen'].indexOf(b.z))
        .map(f => `<tr><td class="z"><span class="${f.z[0]}"></span></td><td>${esc(f.feld)}</td><td>${esc(wert(f.soll))}</td><td>${esc(wert(f.ist))}</td></tr>`).join('')}</table>`;
    // Breiten per CSSOM (CSP erlaubt keine style-Attribute)
    const b = el.querySelectorAll('.bar i'); ['gruen', 'rot', 'offen'].forEach((z, i) => { b[i].style.width = (100 * c(z) / F.length) + '%'; });
    liste.appendChild(el);
  }
})();
