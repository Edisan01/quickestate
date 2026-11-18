import sys,json,cv2,numpy as np,math,re
import os as _os; sys.path.insert(0,_os.path.dirname(_os.path.abspath(__file__)));import kat,leser3 as L
from leser2 import rot_mask,glyphen,winkel
ROM=re.compile(r'^(VI|IV|V|III|II|I)$')
def regionen(m,T,gl=None):
  lin=(m>0).astype(np.uint8); tb=np.zeros_like(lin)
  for t in T:
    box=cv2.boxPoints(((t['x'],t['y']),(t['w']+6,t['h']+6),t['ang']))
    cv2.fillPoly(tb,[box.astype(np.int32)],1)
  # Glyphen in gelesenen Wörtern raus; übrige Kleinteile (Striche) bleiben Linie, außer isolierte Punkte
  lin[(tb>0)&(gl>0)]=0
  n_,l_,s_,_=cv2.connectedComponentsWithStats(lin,8)
  klein=np.isin(l_,[i for i in range(1,n_) if max(s_[i][2],s_[i][3])<7])
  lin[klein]=0
  lin=cv2.dilate(lin,np.ones((3,3),np.uint8))
  lin=cv2.morphologyEx(lin,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(19,19)))
  lin=verlaengern(lin)
  n,lab,st,_=cv2.connectedComponentsWithStats((lin==0).astype(np.uint8),4)
  return lab,st,lin
def verlaengern(lin,maxd=45):
  ls=cv2.HoughLinesP(lin*255,1,np.pi/180,30,minLineLength=30,maxLineGap=4)
  if ls is None: return lin
  ls=ls.reshape(-1,4).astype(float); H,W=lin.shape; out=lin.copy()
  def endnah(seg,P):
    x1,y1,x2,y2=seg; L=math.hypot(x2-x1,y2-y1); ux,uy=(x2-x1)/L,(y2-y1)/L
    t=(P[0]-x1)*ux+(P[1]-y1)*uy
    if -maxd<=t<=0: return (x1,y1)
    if L<=t<=L+maxd: return (x2,y2)
    if 0<t<L: return 'auf'
    return None
  for a in range(len(ls)):
    for b in range(a+1,len(ls)):
      x1,y1,x2,y2=ls[a]; x3,y3,x4,y4=ls[b]
      d=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4)
      if abs(d)<1e-6: continue
      ua=math.atan2(y2-y1,x2-x1); ub=math.atan2(y4-y3,x4-x3); da=abs(math.degrees(ua-ub))%180
      if min(da,180-da)<25: continue
      px=((x1*y2-y1*x2)*(x3-x4)-(x1-x2)*(x3*y4-y3*x4))/d; py=((x1*y2-y1*x2)*(y3-y4)-(y1-y2)*(x3*y4-y3*x4))/d
      ea=endnah(ls[a],(px,py)); eb=endnah(ls[b],(px,py))
      if ea is None or eb is None or (ea=='auf' and eb=='auf'): continue
      for e in (ea,eb):
        if e!='auf': cv2.line(out,(int(e[0]),int(e[1])),(int(round(px)),int(round(py))),1,3)
  # Enden ohne Partner: Strahl bis zur nächsten Linie
  for x1,y1,x2,y2 in ls:
    L=math.hypot(x2-x1,y2-y1); ux,uy=(x2-x1)/L,(y2-y1)/L
    for (px,py,sx,sy) in ((x2,y2,ux,uy),(x1,y1,-ux,-uy)):
      for d in range(5,maxd):
        qx,qy=int(round(px+sx*d)),int(round(py+sy*d))
        if not(0<=qx<W and 0<=qy<H): break
        if out[qy,qx]:
          if d>6: cv2.line(out,(int(px),int(py)),(qx,qy),1,3)
          break
  return out
def kantenwinkel(rings):
  E=[]
  for r in rings:
    for a,b in zip(r,np.roll(r,-1,0)):
      L_=math.hypot(*(b-a))
      if L_>15: E.append((L_,math.degrees(math.atan2(b[1]-a[1],b[0]-a[0]))%90))
  out=[]
  for L_,a in sorted(E,reverse=True):
    if all(min(abs(a-b),90-abs(a-b))>4 for b in out): out.append(a)
  return [a if a<45 else a-90 for a in out[:3]]
def tokens(crop,A,rings=None):
  m=rot_mask(crop); gl=glyphen(m); T=[]
  from leser2 import winkel_alle
  W_=kantenwinkel(rings) if rings else []
  for a in winkel_alle(m):
    if all(min(abs(a-b)%90,90-abs(a-b)%90)>4 for b in W_): W_.append(a)
  if all(min(abs(b)%90,90-abs(b)%90)>3 for b in W_): W_.append(0)
  rw=L.rotwert(crop,gl); SK=3.0
  for k,ang in [(k,a+90*k) for a in W_ for k in range(4)]:
    g,Mi=L.drehen(rw,ang,SK)
    for wd in L.woerter(L.zeichen(g)):
      t,sc=L.text(wd)
      if sc<0.78: continue
      x0=min(z['x'] for z in wd); y0=min(z['y'] for z in wd); x1=max(z['x']+z['w'] for z in wd); y1=max(z['y']+z['h'] for z in wd)
      cx,cy=(x0+x1)/2,(y0+y1)/2
      mp=lambda X,Y:(Mi[0,0]*X+Mi[0,1]*Y+Mi[0,2],Mi[1,0]*X+Mi[1,1]*Y+Mi[1,2])
      gls=[[mp(z['x'],z['y']),mp(z['x']+z['w'],z['y']),mp(z['x']+z['w'],z['y']+z['h']),mp(z['x'],z['y']+z['h'])] for z in sorted(wd,key=lambda z:z['x'])]
      T.append(dict(t=t,s=sc,x=Mi[0,0]*cx+Mi[0,1]*cy+Mi[0,2],y=Mi[1,0]*cx+Mi[1,1]*cy+Mi[1,2],w=(x1-x0)/SK,h=(y1-y0)/SK,n=len(wd),k=k,ang=ang,gl=gls))
  T=[t for t in T if (t['n']>=2 and t['s']>=0.8) or (t['n']==1 and t['s']>=0.85 and t['h']>=9 and t['t'] in 'WGg')]
  T.sort(key=lambda r:-(r['s']+0.03*r['n'])); out=[]
  for r in T:
    if all(math.hypot(r['x']-o['x'],r['y']-o['y'])>max(min(r['w'],r['h']),min(o['w'],o['h']))/1.5 for o in out): out.append(r)
  # einzelne „G“ (auch an Linien klebend) per Vorlage
  for g in g_suche(crop,gl,W_):
    if g['s']<0.8: break
    ok=True
    for o in out:
      box=cv2.boxPoints(((o['x'],o['y']),(o['w']+8,o['h']+8),o['ang']))
      if cv2.pointPolygonTest(box.astype(np.float32),(float(g['x']),float(g['y'])),False)>=0:
        ok=False; break
    if ok: out.append(dict(g,t='G',n=1))
  return out,m,gl
WRX=re.compile(r'^(GBGV|GBBG|GB|WGV|W|G|E|L|SO|IG|BS|SN|F)')
def attrs(toks):
  a={}; txt=' '.join(t['t'] for t in toks)
  for t in sorted(toks,key=lambda t:-t['h']):
    s=t['t'].replace('[','I').replace(']','')
    m0=re.fullmatch(r'GBB(\d*)',s)
    if m0: a.setdefault('widmung','G'); a['bb']='BB'+m0.group(1); continue
    m=WRX.match(s)
    if m and 'widmung' not in a and t['h']>=15: a['widmung']=m.group(1); s=s[m.end():]
    r=re.search(r'(VI|IV|V|III|II|I)(?![IV])',s)
    if r and 'bauklasse' not in a and (r.start()==0 or 'widmung' in a): a['bauklasse']=r.group(1)
    h=re.search(r'(\d{1,2})[,.]?(\d)?m',t['t']) or re.search(r'^(?:W|GB|WGV)(?:VI|IV|V|III|II|I)(\d{1,2})[,.](\d)',t['t'])
    if h and 'hoehe' not in a: a['hoehe']=h.group(1)+(','+h.group(2) if h.group(2) else '')+' m'
    if s in ('9','g') and 'bauweise' not in a: a['bauweise']='g'; continue
    if re.match(r'^(W|GB|WGV)',t['t']) and re.search(r'(gk|g|o)$',t['t']) and 'bauweise' not in a: a['bauweise']=re.search(r'(gk|g|o)$',t['t']).group(1)
    if re.search(r'(^|[IVm])(gk|g|o)$',s) and 'bauweise' not in a: a['bauweise']=re.search(r'(gk|g|o)$',s).group(1)
    if re.search(r'BB\d*',s): a['bb']=re.search(r'BB\d*',s).group(0)
    p=re.search(r'[\[I(](\d{2})[%o]',t['t'])
    if p and 'm' not in t['t'][p.end():p.end()+1] and t['t'].count(',')<=1 and not re.fullmatch(r'\d+,\d\d',t['t']): a['bebauung']=p.group(1)+' %'
  return a
def parzelle_zonen(crop,rings,A=None):
  if A is None: A=winkel(rot_mask(crop))
  T,m,gl=tokens(crop,A,rings); lab,st,lin=regionen(m,T,gl)
  H,W=m.shape; pm=np.zeros((H,W),np.uint8)
  for r in rings: cv2.fillPoly(pm,[r.astype(np.int32)],1)
  bar=lin.copy()
  for r in rings: cv2.polylines(bar,[r.astype(np.int32)],True,1,2)
  n,rl,rs,_=cv2.connectedComponentsWithStats(((bar==0)&(pm>0)).astype(np.uint8),4)
  Z=[]
  for i in range(1,n):
    if rs[i][4]<250: continue
    msk=(rl==i).astype(np.uint8); dm=cv2.dilate(msk,np.ones((7,7),np.uint8))
    tk=[t for t in T if t['s']>=0.8 and 0<=int(t['y'])<H and 0<=int(t['x'])<W and dm[int(t['y']),int(t['x'])]]
    ys,xs=np.nonzero(msk); pts=np.column_stack([xs,ys]).astype(np.float32)
    (cx,cy),(rw,rh),an=cv2.minAreaRect(pts)
    Z.append(dict(i=i,px=int(rs[i][4]),c=(cx,cy),rect=((cx,cy),(rw,rh),an),toks=tk,a=attrs(tk),msk=msk))
  # Zonen ohne Widmung: erst ganze Planfläche (ohne Grundstücksgrenze), dann Band entlang der Längsachse
  for z in Z:
    if 'widmung' in z['a']: continue
    ids,cnt=np.unique(lab[z['msk']>0],return_counts=True); ids=[i_ for i_,c_ in zip(ids,cnt) if i_>0 and c_>0.5*z['px']]
    if ids:
      fm=(lab==ids[0]).astype(np.uint8)
      if fm.sum()<8*z['px']:
        dm=cv2.dilate(fm,np.ones((7,7),np.uint8))
        z['flaeche']=[t for t in T if dm[min(H-1,max(0,int(t['y']))),min(W-1,max(0,int(t['x'])))] and t not in z['toks']]
        a2=attrs(z['toks']+z['flaeche'])
        for k,v in a2.items(): z['a'].setdefault(k,v)
    if 'widmung' in z['a']: continue
    (cx,cy),(rw,rh),an=z['rect']; th=math.radians(an if rw>=rh else an+90); L_,S_=max(rw,rh),min(rw,rh)
    ux,uy=math.cos(th),math.sin(th); band=[]
    for t in T:
      if t['s']<0.8: continue
      dx,dy=t['x']-cx,t['y']-cy; al=dx*ux+dy*uy; pe=-dx*uy+dy*ux
      if abs(pe)<=S_/2+4 and abs(al)<=L_/2+260 and not pm[min(H-1,max(0,int(t['y']))),min(W-1,max(0,int(t['x'])))]: band.append(t)
    z['band']=band; a2=attrs(z['toks']+band)
    for k,v in a2.items(): z['a'].setdefault(k,v)
  return Z,T,lin
def g_suche(crop,gl,winkel,hoehen=(14,17,20,24),schwelle=0.62):
  from PIL import Image,ImageDraw,ImageFont
  im=crop.astype(np.float32); r=np.clip((im[...,0]-np.maximum(im[...,1],im[...,2])-40)*255/140,0,255).astype(np.float32)
  out=[]
  for fn in ['/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']:
    for hh in hoehen:
      f=ImageFont.truetype(fn,int(hh*1.38)); t=Image.new('L',(hh*3,hh*3),0); ImageDraw.Draw(t).text((hh//2,0),'G',font=f,fill=255)
      a=np.array(t); ys,xs=np.nonzero(a>100); a=a[ys.min()-3:ys.max()+4,xs.min()-3:xs.max()+4].astype(np.float32)
      for ang in winkel:
        for k in range(4):
          A=ang+90*k; H,W=r.shape; M=cv2.getRotationMatrix2D((W/2,H/2),A,1); cs,sn=abs(M[0,0]),abs(M[0,1])
          nW,nH=int(H*sn+W*cs),int(H*cs+W*sn); M[0,2]+=nW/2-W/2; M[1,2]+=nH/2-H/2
          rr=cv2.warpAffine(r,M,(nW,nH)); res=cv2.matchTemplate(rr,a,cv2.TM_CCOEFF_NORMED); Mi=cv2.invertAffineTransform(M)
          sm=cv2.boxFilter(rr,-1,(a.shape[1],a.shape[0]),normalize=True,anchor=(0,0))[:res.shape[0],:res.shape[1]]
          res[(sm<0.25*a.mean())|~np.isfinite(res)]=0
          ys_,xs_=np.nonzero(res>schwelle)
          for y_,x_ in zip(ys_,xs_):
            cx,cy=x_+a.shape[1]/2,y_+a.shape[0]/2; ox=Mi[0,0]*cx+Mi[0,1]*cy+Mi[0,2]; oy=Mi[1,0]*cx+Mi[1,1]*cy+Mi[1,2]
            out.append(dict(t='G',s=float(res[y_,x_]),x=ox,y=oy,w=a.shape[1],h=a.shape[0],n=1,ang=A,quelle='vorlage'))
  out.sort(key=lambda t:-t['s']); E_=[]
  for t in out:
    if all(math.hypot(t['x']-e['x'],t['y']-e['y'])>12 for e in E_): E_.append(t)
  return E_
