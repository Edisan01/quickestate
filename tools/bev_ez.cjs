// Testwerkzeug: EZ-Grundstücke aus BEV-Kataster-Vektorkacheln (CC BY 4.0) – nutzt denselben Leser wie die Webseite (mvt.js)
const fs = require('fs'), vm = require('vm');
const ctx = { window: {}, Math, Array, Object, Uint8Array, DataView, TextDecoder, console }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(__dirname + '/../mvt.js', 'utf8'), ctx);
const [lon, lat, kg, gnr] = process.argv.slice(2); const z = 16, n = 2 ** z, la = lat * Math.PI / 180;
const x = Math.floor((+lon + 180) / 360 * n), y = Math.floor((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2 * n);
(async () => { const alle = [];
  for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) { const r = await fetch(`https://kataster.bev.gv.at/tiles/kataster/16/${x + dx}/${y + dy}.pbf`); if (!r.ok) continue;
    const t = ctx.window.MVT.lies(new Uint8Array(await r.arrayBuffer()).buffer, 16, x + dx, y + dy); (t.gst || []).forEach(f => alle.push(f.p)); }
  const s = alle.find(p => String(p.kg).padStart(5, '0') === kg && p.gnr === gnr);
  const gl = s ? [...new Set(alle.filter(p => p.ez === s.ez && p.kgez === s.kgez).map(p => p.gnr))] : [];
  console.log(JSON.stringify({ kg, gnr, ez: s && s.ez, kgez: s && s.kgez, teile: gl })); })();
