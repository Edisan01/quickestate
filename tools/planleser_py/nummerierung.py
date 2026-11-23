"""Darstellungsreihenfolge: Frontteil zuerst, danach im Uhrzeigersinn im Planbild."""
import math,json
from pathlib import Path
from shapely.geometry import Polygon,LineString
from shapely.ops import unary_union

REGELN=json.loads((Path(__file__).resolve().parents[1]/'pruefung/pruefschema.json').read_text())

def nummerieren(ergebnis,front_px):
    if REGELN['planbereiche_anzeige']['nummerierung']['richtung']!='Uhrzeigersinn':raise ValueError('Nicht unterstützte Nummerierungsregel')
    teile=ergebnis['teilflaechen']
    if not front_px or len(front_px)!=2:
        ergebnis['nummerierung']={'zustand':'offen','grund':'Straßenfront nicht bestimmt'}
        return ergebnis
    front=LineString(front_px)
    if front.length<1:raise ValueError('Ungültige Frontkante')
    polys=[Polygon(t['ring_px'],t.get('loecher_px',[])) for t in teile];mitte=unary_union(polys).centroid
    # Größter Kontakt zur gelieferten Frontkante, dann Abstand zu deren Mittelpunkt.
    def score(i):
        p=polys[i];return (-p.boundary.intersection(front.buffer(REGELN['kataster_detail_versuch']['max_anschluss_px'])).length,p.distance(front),p.centroid.distance(front.interpolate(.5,normalized=True)),p.centroid.x,p.centroid.y)
    first=min(range(len(teile)),key=score);c=polys[first].centroid;start=math.atan2(c.y-mitte.y,c.x-mitte.x)
    def winkel(i):
        c=polys[i].centroid;return ((math.atan2(c.y-mitte.y,c.x-mitte.x)-start)%(2*math.pi),c.distance(mitte),c.x,c.y)
    order=[first]+sorted((i for i in range(len(teile)) if i!=first),key=winkel)
    ergebnis['teilflaechen']=[dict(teile[i],nummer=n,frontteil=n==1) for n,i in enumerate(order,1)]
    ergebnis['nummerierung']={'zustand':'vorschlag','quelle':'Kataster-Frontkante am Adresspunkt','richtung':'Uhrzeigersinn','front_px':front_px}
    return ergebnis
