import cv2,numpy as np,math,sys,re
sys.path.insert(0,'/home/claude/pbtools')
import glyph as G
from leser2 import rot_mask,glyphen,winkel
def drehen(gl,ang,sk=1.0):
  H,W=gl.shape; M=cv2.getRotationMatrix2D((W/2,H/2),ang,sk); cs,sn=abs(M[0,0]),abs(M[0,1])
  nW,nH=int(H*sn+W*cs),int(H*cs+W*sn); M[0,2]+=nW/2-W/2; M[1,2]+=nH/2-H/2
  g=cv2.warpAffine(gl.astype(np.float32),M,(nW,nH),flags=cv2.INTER_CUBIC); return (g>110).astype(np.uint8),cv2.invertAffineTransform(M)
def rotwert(crop,gl):
  im=crop.astype(np.float32); r=im[...,0]-np.maximum(im[...,1],im[...,2])
  r=np.clip((r-40)*255/140,0,255)
  return r*(cv2.dilate(gl,np.ones((3,3),np.uint8))>0)
def zeichen(g):
  n,lab,st,_=cv2.connectedComponentsWithStats(g,8)
  C=[i for i in range(1,n) if st[i][4]>=3]
  hs=sorted(st[i][3] for i in C if st[i][4]>=20); Hm=hs[len(hs)//2] if hs else 10
  grp={i:[i] for i in C}
  Hx=hs[int(len(hs)*0.9)] if hs else 20
  for i in C:
    if i not in grp: continue
    x,y,w,h,a=st[i]
    for j in C:
      if j==i or j not in grp: continue
      X,Y,W,H_,A=st[j]
      ov=min(x+w,X+W)-max(x,X)
      if ov>=0.6*min(w,W) and y<Y and y+h<=Y+0.5*H_ and Y-(y+h)<=max(3,0.15*Hm) and (Y+H_-y)<=1.1*Hx and (h<0.45*Hm or h+H_<=1.1*Hx):
        grp[j]+=grp.pop(i); break
  Z=[]
  for k,ids in grp.items():
    xs=[st[i][0] for i in ids]; ys=[st[i][1] for i in ids]; xe=[st[i][0]+st[i][2] for i in ids]; ye=[st[i][1]+st[i][3] for i in ids]
    x,y,X,Y=min(xs),min(ys),max(xe),max(ye)
    d=G.alle(np.isin(lab[y:Y,x:X],ids).astype(np.uint8))
    if not d: continue
    w,h=X-x,Y-y
    c=max(d,key=d.get)
    if c in ',.' and h>=9: c='I' if d.get('I',0)>=d.get('1',0) else '1'
    Z.append(dict(c=c,s=d[c],d=d,x=int(x),y=int(y),w=int(w),h=int(h)))
  return Z
DESC=set('g')
def woerter(Z):
  # Grundlinie: Unterkante (ohne Unterlänge); Zeilenhöhe ~ Höhe der großen Zeichen
  for z in Z:
    z['base']=z['y']+z['h']*(0.7 if z['c'] in DESC else 1.0)
    z['top']=z['y']
  Z=sorted(Z,key=lambda z:z['x']); used=set(); W=[]
  big=[z for z in Z if z['h']>=8 and z['c'] not in ',.-']
  for i,z in enumerate(Z):
    if i in used or z['h']<8 or z['c'] in ',.-' : continue
    wd=[i]; used.add(i); last=z
    while True:
      cand=None
      for j,q in enumerate(Z):
        if j in used: continue
        gap=q['x']-(last['x']+last['w'])
        H=max(last['h'] if last['c'] not in DESC else last['h']*0.7, 6)
        if gap< -2 or gap>0.9*H+3: continue
        if abs(q['base']-last['base'])>0.35*H+2 and not (q['c'] in ',.' and abs(q['base']-last['base'])<0.5*H+3): continue
        if cand is None or q['x']<Z[cand]['x']: cand=j
      if cand is None: break
      wd.append(cand); used.add(cand); last=Z[cand] if Z[cand]['c'] not in ',.' else dict(Z[cand],h=last['h'],base=last['base'],c=last['c'])
    W.append([Z[k] for k in wd])
  return W
NUM='0123456789,.'
LAB='WIVGBELSKOFAPMNTHRCDgmo0123456789,.[]()/'
def bester(z,alpha,H):
  d=z['d']; klein=z['h']<0.5*H
  c=max((k for k in d if k in alpha and ((k in ',.')==klein or k not in NUM)),key=lambda k:d[k],default=None)
  if c is None: c=max((k for k in d if k in alpha),key=lambda k:d[k])
  if c.isdigit():   # Ziffern, die sich zu ähnlich sehen (5/6, 3/8 …), nicht raten – lieber gar kein Wert (Eduard: kein Vielleicht)
    zw=max((d[k] for k in d if k.isdigit() and k!=c and k in alpha),default=0)
    if d[c]-zw<0.03: return '?',d[c]
  return c,d[c]
def text(wd):
  H=max(z['h'] for z in wd if z['c']!='g') if any(z['c']!='g' for z in wd) else wd[0]['h']
  n=[bester(z,NUM,H) for z in wd]
  dig=[(i,c,sc) for i,(c,sc) in enumerate(n) if c not in ',.']
  ns=''.join(c for _,c,_ in dig); nsc=[sc for _,_,sc in dig]
  if 3<=len(dig)<=5:
    k=len(dig)-3; i0,i1=dig[k][0],dig[k+1][0]
    gaps=[wd[dig[j+1][0]]['x']-(wd[dig[j][0]]['x']+wd[dig[j][0]]['w']) for j in range(len(dig)-1)]
    if i1-i0>1 or (gaps[k]==max(gaps) and gaps[k]>=(sorted(gaps)[-2] if len(gaps)>1 else 0)+3): ns=ns[:k+1]+','+ns[k+1:]
  n=[(None,s_) for s_ in nsc] or [(None,0)]
  l=[bester(z,LAB,H) for z in wd]; ls=''.join(c for c,_ in l)
  if re.fullmatch(r'\d{1,3},\d{2}',ns) and np.mean([s for _,s in n])>=np.mean([s for _,s in l])-0.08:
    return ns,float(np.mean([s for _,s in n]))
  ls=re.sub(r'(?<=[IVWGg])[\]\[](?=\d)','1',ls)
  ls=re.sub(r'(?<=[GB])8|8(?=B)','B',ls).replace('o/o','%').replace('o,o','%')
  return ls,float(np.mean([s for _,s in l]))
def lesen(im,A=None):
  m=rot_mask(im); gl=glyphen(m)
  if A is None: A=winkel(m)
  res=[]
  for k in range(4):
    g,Mi=drehen(gl,A+90*k)
    for wd in woerter(zeichen(g)):
      t,sc=text(wd)
      if sc<0.72: continue
      x0=min(z['x'] for z in wd); y0=min(z['y'] for z in wd); x1=max(z['x']+z['w'] for z in wd); y1=max(z['y']+z['h'] for z in wd)
      cx,cy=(x0+x1)/2,(y0+y1)/2
      ox=Mi[0,0]*cx+Mi[0,1]*cy+Mi[0,2]; oy=Mi[1,0]*cx+Mi[1,1]*cy+Mi[1,2]
      res.append(dict(t=t,s=round(sc,2),x=round(ox),y=round(oy),w=x1-x0,h=max(z['h'] for z in wd),ang=(A+90*k)%360,n=len(wd)))
  res.sort(key=lambda r:-(r['s']+0.03*r['n'])); out=[]
  for r in res:
    if all(math.hypot(r['x']-o['x'],r['y']-o['y'])>max(r['w'],o['w'])/2 for o in out): out.append(r)
  return out,A
if __name__=='__main__':
  im=cv2.imread(sys.argv[1])[:,:,::-1]
  x0,y0,x1,y1=map(int,sys.argv[2:6]) if len(sys.argv)>5 else (0,0,im.shape[1],im.shape[0])
  out,A=lesen(im[y0:y1,x0:x1]); print('winkel',A)
  for r in sorted(out,key=lambda r:(r['y'],r['x'])):
    if r['n']>=2 or r['h']>=18: print(r)
