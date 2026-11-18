import json,math,os
import os
K=os.path.join(os.path.dirname(__file__),'..','..','kataster','16')
def kach(lon,lat,z):
  n=2**z; la=math.radians(lat); return (lon+180)/360*n,(1-math.log(math.tan(la)+1/math.cos(la))/math.pi)/2*n
def ring(fl):
  r=[];x=y=0
  for i in range(0,len(fl)-1,2): x+=fl[i]; y+=fl[i+1]; r.append((x/1e7,y/1e7))
  return r
def parzellen(lon,lat):
  fx,fy=kach(lon,lat,16); P=[]
  for dx in (-1,0,1):
    for dy in (-1,0,1):
      f=f'{K}/{int(fx)+dx}_{int(fy)+dy}.json'
      if os.path.exists(f):
        for r in json.load(open(f)): P.append(dict(kg=r[0],gnr=r[1],polys=[[ring(rg) for rg in pg] for pg in (r[3] or [])]))
  return P
def finde(lon,lat,kg,gnr):
  return [p for p in parzellen(lon,lat) if str(p['kg']).zfill(5)==str(kg).zfill(5) and p['gnr']==gnr]
def px(meta,lon,lat):
  fx,fy=kach(lon,lat,19); return (fx-meta['x0'])*256,(fy-meta['y0'])*256
