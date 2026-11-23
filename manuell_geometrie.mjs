// Geometrie für nutzerbestätigte Flächenentwürfe. Keine baurechtliche Freigabe.
const EPS = 1e-8;
const cross = (a,b) => a[0]*b[1]-a[1]*b[0];
const sub = (a,b) => [a[0]-b[0],a[1]-b[1]];
export const flaeche = r => Math.abs(r.reduce((s,a,i) => s+cross(a,r[(i+1)%r.length]),0)/2);
export function ringOffen(r) { const a=r.map(p=>[+p[0],+p[1]]); if(a.length>1&&Math.hypot(...sub(a[0],a.at(-1)))<EPS)a.pop();return a; }
function kanten(r) { return r.map((a,i)=>[a,r[(i+1)%r.length]]); }
function treffer(a,b,c,d) {
 const u=sub(b,a),v=sub(d,c),w=sub(c,a),q=cross(u,v);
 if(Math.abs(q)<EPS) {
  if(Math.abs(cross(w,u))>EPS)return null;
  const k=Math.abs(u[0])>=Math.abs(u[1])?0:1;
  return Math.max(Math.min(a[k],b[k]),Math.min(c[k],d[k]))<=Math.min(Math.max(a[k],b[k]),Math.max(c[k],d[k]))+EPS ? {kollinear:true}:null;
 }
 const t=cross(w,v)/q,s=cross(w,u)/q;
 return t>=-EPS&&t<=1+EPS&&s>=-EPS&&s<=1+EPS?{x:a[0]+t*u[0]}:null;
}
export function ringFehler(r) {
 if(!Array.isArray(r)||r.length<3||r.some(p=>p.length!==2||p.some(v=>!Number.isFinite(v))))return 'Mindestens drei gültige Eckpunkte setzen.';
 for(let i=0;i<r.length;i++)if(Math.hypot(...sub(r[i],r[(i+1)%r.length]))<EPS)return 'Doppelte Eckpunkte entfernen.';
 const E=kanten(r);
 for(let i=0;i<E.length;i++)for(let j=i+1;j<E.length;j++) {
  const hit=treffer(...E[i],...E[j]);
  const u=sub(E[i][1],E[i][0]),v=sub(E[j][1],E[j][0]);
  if((j===i+1||(i===0&&j===E.length-1)) ? hit?.kollinear&&(u[0]*v[0]+u[1]*v[1]<0) : hit)return 'Die Fläche berührt oder überschneidet sich selbst.';
 }
 return flaeche(r)>EPS?null:'Die Fläche hat keinen Flächeninhalt.';
}
function vereinen(A) { const out=[];for(const [a,b] of A.sort((x,y)=>x[0]-y[0])){const p=out.at(-1);if(p&&a<=p[1]+EPS)p[1]=Math.max(p[1],b);else out.push([a,b]);}return out; }
function schnitt(A,B) { let total=0;for(const a of A)for(const b of B)total+=Math.max(0,Math.min(a[1],b[1])-Math.max(a[0],b[0]));return total; }
function intervalle(polys,x) {
 const all=[];
 for(const rings of polys){const ys=[];for(const r of rings)for(const [a,b] of kanten(r))if((a[0]<=x&&x<b[0])||(b[0]<=x&&x<a[0]))ys.push(a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0]));ys.sort((a,b)=>a-b);for(let i=0;i+1<ys.length;i+=2)all.push([ys[i],ys[i+1]]);}
 return vereinen(all);
}
// Exakte stückweise lineare Querschnitte: Integrationsgrenzen an allen Knoten und Schnittpunkten.
export function vergleich(grund,teile,regel={}) {
 const rings=[...grund.flat(),...teile],edges=rings.flatMap(kanten);
 if(edges.length>(regel.max_kanten_gesamt??600))throw Error('Zu viele Eckpunkte für diese Bearbeitung (höchstens 600 insgesamt).');
 const xs=rings.flat().map(p=>p[0]);
 for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){const p=treffer(...edges[i],...edges[j]);if(p&&'x'in p)xs.push(p.x);}
 xs.sort((a,b)=>a-b);const X=xs.filter((x,i)=>!i||x-xs[i-1]>EPS);let g=0,u=0,inside=0,sum=0;
 for(let i=0;i+1<X.length;i++){const dx=X[i+1]-X[i];if(dx<=EPS)continue;const x=(X[i]+X[i+1])/2,G=intervalle(grund,x),T=teile.map(r=>intervalle([[r]],x)),U=vereinen(T.flat().map(a=>[...a]));const len=A=>A.reduce((s,[a,b])=>s+b-a,0);g+=len(G)*dx;u+=len(U)*dx;inside+=schnitt(G,U)*dx;sum+=T.reduce((s,t)=>s+len(t),0)*dx;}
 return {grund_m2:g,summe_m2:sum,vereinigung_m2:u,luecke_m2:Math.max(0,g-inside),ausserhalb_m2:Math.max(0,u-inside),ueberlappung_m2:Math.max(0,sum-u)};
}
export function pruefen(grund,teile,regel={}) {
 const fehler=[];
 for(const p of grund)for(const r of p){const f=ringFehler(r);if(f)throw Error('Ungültige Katasterkontur: '+f);}
 for(const [i,t] of teile.entries()){const f=ringFehler(t.punkte);if(f)fehler.push(`Fläche ${i+1}: ${f}`);if(!t.widmung?.trim())fehler.push(`Fläche ${i+1}: Widmung fehlt.`);}
 if(!teile.length)fehler.push('Mindestens eine Fläche einzeichnen.');
 if(fehler.length)return {ok:false,fehler};
 const v=vergleich(grund,teile.map(t=>t.punkte),regel),tol=regel.numerische_flaeche_toleranz_m2??0.000001;
 if(v.luecke_m2>tol)fehler.push('Die Teilflächen lassen eine Lücke im Grundstück.');
 if(v.ueberlappung_m2>tol)fehler.push('Teilflächen überlappen sich.');
 if(v.ausserhalb_m2>tol)fehler.push('Eine Teilfläche liegt außerhalb des Grundstücks.');
 return {ok:fehler.length===0,fehler,...v};
}
export function naechsterPunkt(p,ringe,max) { let best=null,D=max;for(const r of ringe)for(const [a,b] of kanten(r)){const v=sub(b,a),ll=v[0]**2+v[1]**2;if(!ll)continue;const t=Math.max(0,Math.min(1,((p[0]-a[0])*v[0]+(p[1]-a[1])*v[1])/ll));const q=[a[0]+t*v[0],a[1]+t*v[1]],d=Math.hypot(...sub(p,q));if(d<D){D=d;best=q;}}return best; }
// WGS84-Ellipsoid -> lokale horizontale Tangentialebene (ENU), ohne Web-Mercator-Flächenmaß.
export function rahmen(lon,lat) {
 const rad=Math.PI/180,A=6378137,e2=6.6943799901413165e-3,B=A*Math.sqrt(1-e2),lo=lon*rad,la=lat*rad;
 const ecef=([x,y])=>{const l=x*rad,f=y*rad,n=A/Math.sqrt(1-e2*Math.sin(f)**2);return [n*Math.cos(f)*Math.cos(l),n*Math.cos(f)*Math.sin(l),n*(1-e2)*Math.sin(f)];};
 const O=ecef([lon,lat]),E=[-Math.sin(lo),Math.cos(lo),0],N=[-Math.sin(la)*Math.cos(lo),-Math.sin(la)*Math.sin(lo),Math.cos(la)],U=[Math.cos(la)*Math.cos(lo),Math.cos(la)*Math.sin(lo),Math.sin(la)],dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
 return {ursprung:[lon,lat],project(p){const Q=ecef(p).map((v,i)=>v-O[i]);return [dot(Q,E),dot(Q,N)];},unproject([x,y]){const P=O.map((v,i)=>v+x*E[i]+y*N[i]),scale=[A*A,A*A,B*B],aa=U.reduce((s,v,i)=>s+v*v/scale[i],0),bb=2*P.reduce((s,v,i)=>s+v*U[i]/scale[i],0),cc=P.reduce((s,v,i)=>s+v*v/scale[i],0)-1,disc=bb*bb-4*aa*cc;if(disc<0)throw Error('Punkt liegt außerhalb des lokalen Kartenrahmens.');const h=-2*cc/(bb+Math.sqrt(disc)),Q=P.map((v,i)=>v+h*U[i]);return [Math.atan2(Q[1],Q[0])/rad,Math.atan2(Q[2],Math.hypot(Q[0],Q[1])*(1-e2))/rad];}};
}

export function rechteck(a,b) {
 if(![...a,...b].every(Number.isFinite)||Math.abs(a[0]-b[0])<EPS||Math.abs(a[1]-b[1])<EPS)return [];
 return [[a[0],a[1]],[b[0],a[1]],[b[0],b[1]],[a[0],b[1]]];
}
export function punktEinfuegen(r,index,p) {
 if(!Number.isInteger(index)||index<0||index>=r.length||p.length!==2||!p.every(Number.isFinite))throw Error('Ungültige Kante oder Punkt.');
 const out=r.map(q=>[...q]);out.splice(index+1,0,[...p]);return out;
}
export function enthaelt(polys,p) {
 const imRing=r=>{let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[j],b=r[i];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
 return polys.some(pg=>pg.reduce((v,r)=>v!==imRing(r),false));
}

// Schnitt zweier Polygonmengen mit Innenringen. Nur positive Fläche zählt; bloße Berührung nicht.
export function schnittflaeche(A,B){
 const rings=[...A.flat(),...B.flat()],edges=rings.flatMap(kanten);
 if(edges.length>6000)throw Error('Stadt-Zone zu komplex für den geometrischen Abgleich.');
 const xs=rings.flat().map(p=>p[0]);
 for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
  const [a,b]=edges[i],[c,d]=edges[j];if(Math.max(a[0],b[0])<Math.min(c[0],d[0])||Math.max(c[0],d[0])<Math.min(a[0],b[0])||Math.max(a[1],b[1])<Math.min(c[1],d[1])||Math.max(c[1],d[1])<Math.min(a[1],b[1]))continue;
  const p=treffer(a,b,c,d);if(p&&'x'in p)xs.push(p.x);
 }
 xs.sort((a,b)=>a-b);const X=xs.filter((x,i)=>!i||x-xs[i-1]>EPS);let total=0;
 for(let i=0;i+1<X.length;i++){const dx=X[i+1]-X[i];if(dx<=EPS)continue;const x=(X[i]+X[i+1])/2;total+=schnitt(intervalle(A,x),intervalle(B,x))*dx;}
 return total;
}
