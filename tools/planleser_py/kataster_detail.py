"""Sichtbare rote Planlinien im gelieferten Katasterrahmen (Versuch, keine Freigabe).

Keine Sollzahlen, erwartete Flächenzahl oder Widmungscodes als Eingabe.
Kataster-Innenkanten sind ausdrücklich keine Trennlinienquelle.
"""
import math,json
from pathlib import Path
import cv2
import numpy as np
from shapely.geometry import Polygon, LineString
from shapely.ops import split, unary_union, transform


REGEL=json.loads((Path(__file__).resolve().parents[1]/'pruefung/pruefschema.json').read_text())['kataster_detail_versuch']

def untersuchen(rgb,polys_px,mpp,pixel_zu_meter=None):
    if not np.isfinite(mpp) or mpp<=0:raise ValueError('Maßstab fehlt')
    grund=unary_union([Polygon(p[0],p[1:]) for p in polys_px])
    if not grund.is_valid or grund.is_empty:raise ValueError('Ungültige Katasterkontur')
    def area(p):
        if pixel_zu_meter is None:return p.area*mpp*mpp
        return transform(lambda x,y:tuple(pixel_zu_meter(np.column_stack((x,y))).T),p.segmentize(.25)).area
    r,g,b=[rgb[:,:,i].astype(float) for i in range(3)]
    maske=((r-g>REGEL['min_rot_gruen'])&(r-b>REGEL['min_rot_blau'])&(r>REGEL['min_rot'])).astype('uint8')*255
    seg=cv2.HoughLinesP(maske,1,np.pi/720,threshold=25,minLineLength=REGEL['hough_min_laenge_px'],maxLineGap=REGEL['hough_max_luecke_px'])
    gruppen=[]
    for a in sorted([] if seg is None else seg.reshape(-1,4).tolist(),key=lambda q:-math.hypot(q[2]-q[0],q[3]-q[1])):
        p,q=np.array(a[:2],float),np.array(a[2:],float);u=(q-p)/np.linalg.norm(q-p)
        if u[0]<0 or (abs(u[0])<1e-8 and u[1]<0):u=-u
        n=np.array([-u[1],u[0]]);rho=float(n@p)
        found=None
        for z in gruppen:
            if abs(float(z['u']@u))>math.cos(math.radians(REGEL['linien_winkel_grad'])) and max(abs(float(z['n']@v-z['rho'])) for v in (p,q))<REGEL['linien_abstand_px']:
                found=z;break
        if found is None:gruppen.append({'u':u,'n':n,'rho':rho,'punkte':[p,q]})
        else:found['punkte'] += [p,q]
    for z in gruppen:
        pts=np.array(z['punkte']);center=pts.mean(axis=0);_,_,v=np.linalg.svd(pts-center,full_matrices=False);u=v[0]
        if u[0]<0 or (abs(u[0])<1e-8 and u[1]<0):u=-u
        n=np.array([-u[1],u[0]]);z.update(u=u,n=n,rho=float(n@center))
    teile=list(grund.geoms) if grund.geom_type=='MultiPolygon' else [grund]
    belege=[];abgelehnt=[]
    # Lange belegte Linien zuerst: eine T-Linie darf danach nur ihren Abschnitt teilen.
    gruppen.sort(key=lambda z:-(max(float(z['u']@p) for p in z['punkte'])-min(float(z['u']@p) for p in z['punkte'])))
    for z in gruppen:
        u,n,rho=z['u'],z['n'],z['rho'];o=n*rho
        ts=[float(u@p) for p in z['punkte']];lo,hi=min(ts),max(ts)
        linie=LineString([o+u*(lo-REGEL['max_anschluss_px']),o+u*(hi+REGEL['max_anschluss_px'])])
        neu=[]
        for poly in teile:
            stueck=poly.intersection(linie)
            if stueck.geom_type!='LineString' or stueck.length<REGEL['hough_min_laenge_px']:neu.append(poly);continue
            a,b=np.array(stueck.coords[0]),np.array(stueck.coords[-1]);L=np.linalg.norm(b-a)
            # Profil ist senkrecht zur dünnen Linie, nicht eine breite Suchfläche.
            t=np.linspace(0,1,max(2,int(L)+1));c=a+t[:,None]*(b-a)
            vals=[]
            for v in (-1,0,1):
                xy=np.rint(c+n*v).astype(int);ok=(xy[:,0]>=0)&(xy[:,1]>=0)&(xy[:,0]<rgb.shape[1])&(xy[:,1]<rgb.shape[0]);s=np.zeros(len(xy),bool);s[ok]=maske[xy[ok,1],xy[ok,0]]>0;vals.append(s)
            on=np.any(vals,axis=0);dichte=float(on.mean());maxloch=akt=0
            for v in on:
                akt=0 if v else akt+1;maxloch=max(maxloch,akt)
            if dichte<REGEL['min_belegung'] or maxloch>REGEL['max_profilluecke_px']:
                neu.append(poly);continue
            # Verlängern ist nur um zwei Bildpunkte zum numerischen Anschluss erlaubt.
            try:kandidaten=list(split(poly,linie).geoms)
            except ValueError:kandidaten=[poly]
            if len(kandidaten)<2 or min(area(p) for p in kandidaten)<REGEL['min_teilflaeche_m2']:
                neu.append(poly);continue
            def breite(p):
                xy=list(p.minimum_rotated_rectangle.exterior.coords);return min(math.dist(xy[i],xy[i+1]) for i in range(4))
            if min(breite(p) for p in kandidaten)<REGEL['linien_abstand_px']:
                abgelehnt.append({'a':a.tolist(),'b':b.tolist(),'grund':'Abtrennung schmaler als Linienbreite; Grenze im Plan nicht ausreichend auflösbar'});neu.append(poly);continue
            neu.extend(kandidaten);belege.append({'a':a.tolist(),'b':b.tolist(),'belegung':dichte,'max_luecke_px':maxloch,'zustand':'Vorschlag, Linienart und Zuordnung offen'})
        teile=neu
    vereint=unary_union(teile)
    return {'verfahren':'Kataster außen + sichtbare rote Originalplanlinien','fachlich_freigegeben':False,'mpp':mpp,'flaechenmassstab':'lokaler WGS84-ENU-Rahmen' if pixel_zu_meter else 'lokaler Näherungsmaßstab','anzahl_vorschlaege':len(teile),'linien':belege,'verworfen':abgelehnt,'teilflaechen':[{'ring_px':list(p.exterior.coords),'loecher_px':[list(r.coords) for r in p.interiors],'flaeche_m2':area(p),'widmung':None,'zustand':'offen'} for p in teile],'kontrolle':{'summe_m2':sum(area(p) for p in teile),'kataster_m2':area(grund),'luecke_m2':area(grund.difference(vereint)),'ueberlappung_m2':max(0,sum(area(p) for p in teile)-area(vereint))}}


def pixelrahmen(basis):
    """Native Web-Mercator-Bildpunkte -> WGS84 -> lokales ENU, wie im Editor."""
    from pyproj import Transformer
    k=256*2**basis['zoom'];tr=Transformer.from_crs(4979,4978,always_xy=True)
    lonlat=np.array(basis['grund']['polys'][0][0]);lon,lat=lonlat.mean(axis=0);la,ph=np.radians([lon,lat]);origin=np.array(tr.transform(lon,lat,0));east=np.array([-np.sin(la),np.cos(la),0]);north=np.array([-np.sin(ph)*np.cos(la),-np.sin(ph)*np.sin(la),np.cos(ph)])
    def project(points):
        points=np.asarray(points);lon=(points[:,0]+basis['x0'])/k*360-180;lat=np.degrees(np.arctan(np.sinh(np.pi*(1-2*(points[:,1]+basis['y0'])/k))));xyz=np.column_stack(tr.transform(lon,lat,np.zeros(len(points))))-origin
        return np.column_stack((xyz@east,xyz@north))
    return project
