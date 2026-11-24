import os
import cv2,numpy as np,math,sys
from PIL import Image,ImageDraw,ImageFont
CH='WIVGBELSKOFAPMNTHRCDgm0123456789,.[]()/o-'
N=20
def schriftdateien():
  # Schriften liegen im Repo (tools/planleser_py/fonts/). Jeder Rechner lädt bitgleiche Vorlagen.
  konfig=os.environ.get('QE_PLAN_FONTS')
  if konfig:
    dateien=konfig.split(os.pathsep)
    fehlt=[p for p in dateien if not os.path.isfile(p)]
    if fehlt: raise RuntimeError('QE_PLAN_FONTS: Schrift fehlt: '+', '.join(fehlt))
    return dateien
  basis=os.path.join(os.path.dirname(__file__),'fonts')
  dateien=[os.path.join(basis,n) for n in ('LiberationSans-Regular.ttf','DejaVuSans.ttf','LiberationSans-Bold.ttf','DejaVuSans-Bold.ttf')]
  fehlt=[p for p in dateien if not os.path.isfile(p)]
  if fehlt: raise RuntimeError('Repo-Schriften fehlen: '+', '.join(fehlt))
  return dateien
def norm(b):
  ys,xs=np.nonzero(b)
  if len(xs)==0: return None
  b=b[ys.min():ys.max()+1,xs.min():xs.max()+1].astype(np.float32)
  h,w=b.shape; s=N/max(h,w); nh,nw=max(1,round(h*s)),max(1,round(w*s))
  r=cv2.resize(b,(nw,nh),interpolation=cv2.INTER_AREA); out=np.zeros((N,N),np.float32)
  out[(N-nh)//2:(N-nh)//2+nh,(N-nw)//2:(N-nw)//2+nw]=r
  out=cv2.GaussianBlur(out,(3,3),0.8); out-=out.mean(); n=np.linalg.norm(out)
  return out/n if n else None
def vorlagen():
  T=[]
  for fn in schriftdateien():
    for px in (14,22,40):
      f=ImageFont.truetype(fn,px)
      for c in CH:
        im=Image.new('L',(px*2,px*2),0); ImageDraw.Draw(im).text((px//2,px//4),c,font=f,fill=255)
        a=(np.array(im)>110).astype(np.uint8)
        ys,xs=np.nonzero(a); 
        if len(xs)==0: continue
        asp=(ys.max()-ys.min()+1)/(xs.max()-xs.min()+1)
        v=norm(a)
        if v is not None: T.append((c,v,asp,(ys.max()-ys.min()+1)/px))
  return T
TPL=vorlagen()
import json as _j,os as _o
for _c,_l in _j.load(open(_o.path.join(_o.path.dirname(__file__),'plan_vorlagen.json'))).items():
  for _s in _l:
    _b=np.array([[ch=='#' for ch in r] for r in _s.split()],np.uint8); _y,_x=np.nonzero(_b)
    TPL.append((_c,norm(_b),(_y.max()-_y.min()+1)/(_x.max()-_x.min()+1),1))
def alle(b):
  v=norm(b); d={}
  if v is None: return d
  ys,xs=np.nonzero(b); asp=(ys.max()-ys.min()+1)/(xs.max()-xs.min()+1)
  # Löcher zählen (6/9/0 eines, 8 zwei, 5/3/2/7/1 keines) – trennt 5 von 6 und 3 von 8 sicherer als die Form allein
  bb=(b>0).astype(np.uint8); cs,hi=cv2.findContours(bb,cv2.RETR_CCOMP,cv2.CHAIN_APPROX_SIMPLE)
  loch=sum(1 for k,c_ in enumerate(cs) if hi is not None and hi[0][k][3]>=0 and cv2.contourArea(c_)>=2)
  SOLL={'0':1,'1':0,'2':0,'3':0,'5':0,'6':1,'7':0,'8':2,'9':1}
  for c,t,ta,_ in TPL:
    s=float((v*t).sum()) - 0.25*abs(math.log(asp/ta))
    if c in SOLL and SOLL[c]!=loch: s-=0.08
    if s>d.get(c,-9): d[c]=s
  return d
def klass(b):
  d=alle(b)
  if not d: return '?',0
  c=max(d,key=d.get); return c,d[c]
