// Vollständiger geometrischer Verschnitt statt eines 7×7-Stichprobenrasters.
import {rahmen,ringOffen,schnittflaeche} from './manuell_geometrie.mjs?v=1';
export function stadtWidmungen(polys,features,proben=[]){
 const pts=polys.flat(2);if(!pts.length)return [];
 const mitte=pts.reduce((s,p)=>[s[0]+p[0]/pts.length,s[1]+p[1]/pts.length],[0,0]),frame=rahmen(...mitte),project=p=>p.map(pg=>pg.map(r=>ringOffen(r).map(frame.project))),grund=project(polys);
 const box=p=>{const q=p.flat(2);return [Math.min(...q.map(v=>v[0])),Math.min(...q.map(v=>v[1])),Math.max(...q.map(v=>v[0])),Math.max(...q.map(v=>v[1]))];},G=box(polys),out=[];
 for(const f of features){const geo=f.geometry,p=geo?.type==='Polygon'?[geo.coordinates]:geo?.type==='MultiPolygon'?geo.coordinates:[];if(!p.length)continue;const B=box(p);if(B[2]<G[0]||B[0]>G[2]||B[3]<G[1]||B[1]>G[3])continue;
 const metric=project(p),a=schnittflaeche(grund,metric);if(a<=1e-6)continue;
 out.push({w:f.properties,geo,pts:proben.filter(q=>{const mq=frame.project(q);return metric.some(pg=>imRing(mq,pg[0])&&!pg.slice(1).some(h=>imRing(mq,h)));}),schnitt_m2:a});
 }
 return out;
}
function imRing(p,r){let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function detailStadtHinweis(anzahl,zonen){
 if(!Array.isArray(zonen))return 'Stadt-Zonen noch nicht vollständig geladen. Detailwidmungen und BB bleiben offen.';
 const codes=[...new Set(zonen.map(z=>z.w?.WIDMUNG).filter(Boolean))];
 return anzahl+' erkannte Planbereiche · '+zonen.length+' generalisierte Stadt-Zone'+(zonen.length===1?'':'n')+(codes.length?' ('+codes.join(', ')+')':'')+'. Die Stadt-Zonen ersetzen nicht die Detailwidmungen: G, Höhenbegrenzungen und BB müssen aus dem Detailplan zugeordnet werden.';
}
