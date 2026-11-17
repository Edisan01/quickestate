// Minimaler Leser für Vektorkacheln (Mapbox Vector Tile / Protobuf) – nur was der Kataster braucht: Layer, Attribute, Polygone
// Liefert je Layer Features mit properties und Ringen in [lon, lat]. Keine Fremdbibliothek (CSP script-src 'self').
window.MVT = (() => {
  function Pbf(buf) { this.b = buf; this.p = 0; }
  Pbf.prototype.varint = function () { let r = 0, s = 0, c; do { c = this.b[this.p++]; if (s < 28) r |= (c & 0x7f) << s; else r += (c & 0x7f) * 2 ** s; s += 7; } while (c >= 0x80); return r >>> 0 === r ? r : r; };
  Pbf.prototype.skip = function (t) { if (t === 0) this.varint(); else if (t === 2) this.p += this.varint(); else if (t === 5) this.p += 4; else if (t === 1) this.p += 8; else throw Error('wt ' + t); };
  Pbf.prototype.str = function () { const n = this.varint(), s = new TextDecoder().decode(this.b.subarray(this.p, this.p + n)); this.p += n; return s; };
  Pbf.prototype.packed = function () { const end = this.varint() + this.p, a = []; while (this.p < end) a.push(this.varint()); return a; };
  const zz = n => (n >>> 1) ^ -(n & 1);
  function wert(pb, end) { let v = null; while (pb.p < end) { const k = pb.varint(), f = k >> 3, t = k & 7;
      if (f === 1) v = pb.str(); else if (f === 2) { v = new DataView(pb.b.buffer, pb.b.byteOffset + pb.p, 4).getFloat32(0, true); pb.p += 4; }
      else if (f === 3) { v = new DataView(pb.b.buffer, pb.b.byteOffset + pb.p, 8).getFloat64(0, true); pb.p += 8; }
      else if (f === 4 || f === 5) v = pb.varint(); else if (f === 6) v = zz(pb.varint()); else if (f === 7) v = !!pb.varint(); else pb.skip(t); } return v; }
  function geom(cmds, ext, z, tx, ty) {                     // Kachelkoordinaten → Ringe [lon, lat]
    const R = [], n = 2 ** z; let x = 0, y = 0, r = null;
    const ll = (px, py) => { const wx = (tx + px / ext) / n, wy = (ty + py / ext) / n; return [wx * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * wy))) * 180 / Math.PI]; };
    for (let i = 0; i < cmds.length;) { const c = cmds[i++], id = c & 7, cnt = c >> 3;
      if (id === 1 || id === 2) for (let k = 0; k < cnt; k++) { x += zz(cmds[i++]); y += zz(cmds[i++]); if (id === 1) { r = []; R.push(r); } r.push(ll(x, y)); }
      else if (id === 7 && r && r.length) r.push(r[0]); }
    return R; }
  const flaecheSigned = r => { let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return a / 2; };
  function lies(buf, z, tx, ty) {
    const pb = new Pbf(new Uint8Array(buf)), L = {};
    while (pb.p < pb.b.length) { const k = pb.varint(); if ((k >> 3) !== 3) { pb.skip(k & 7); continue; }
      const end = pb.varint() + pb.p; let name = '', ext = 4096; const keys = [], vals = [], feats = [];
      while (pb.p < end) { const kk = pb.varint(), f = kk >> 3, t = kk & 7;
        if (f === 1) name = pb.str(); else if (f === 3) keys.push(pb.str()); else if (f === 4) { const e = pb.varint() + pb.p; vals.push(wert(pb, e)); }
        else if (f === 5) ext = pb.varint(); else if (f === 2) { const e = pb.varint() + pb.p; const ft = { tags: [], typ: 0, g: [] };
          while (pb.p < e) { const k3 = pb.varint(), f3 = k3 >> 3; if (f3 === 2) ft.tags = pb.packed(); else if (f3 === 3) ft.typ = pb.varint(); else if (f3 === 4) ft.g = pb.packed(); else pb.skip(k3 & 7); } feats.push(ft); }
        else pb.skip(t); }
      L[name] = feats.map(ft => { const p = {}; for (let i = 0; i + 1 < ft.tags.length; i += 2) p[keys[ft.tags[i]]] = vals[ft.tags[i + 1]];
        const rings = ft.typ === 3 ? geom(ft.g, ext, z, tx, ty) : [];
        const polys = []; rings.forEach(r => { if (flaecheSigned(r) > 0 || !polys.length) polys.push([r]); else polys[polys.length - 1].push(r); });   // MVT: Außenring im Uhrzeigersinn (y nach unten) → in lon/lat gegen den Uhrzeigersinn (Fläche > 0)
        return { p, typ: ft.typ, polys }; }); }
    return L; }
  return { lies };
})();
