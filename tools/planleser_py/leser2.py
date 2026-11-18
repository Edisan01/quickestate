import cv2,numpy as np,subprocess,sys,os,tempfile,math,re
WL='WIVGBEgm0123456789,.%[]()'
def rot_mask(im):
  im=im.astype(int); r,g,b=im[...,0],im[...,1],im[...,2]
  return ((r>150)&(g<90)&(b<90)&(r-g>90)).astype(np.uint8)
def glyphen(m):
  n,lab,st,_=cv2.connectedComponentsWithStats(m,8)
  comps=[]
  for i in range(1,n):
    x,y,w,h,a=st[i]
    if max(w,h)>75 or a<2: continue
    pts=np.column_stack(np.nonzero(lab[y:y+h,x:x+w]==i))[:,::-1]+np.array([x,y]); pts=pts.astype(np.float32)
    (cx,cy),(rw,rh),an=cv2.minAreaRect(pts) if len(pts)>=3 else ((x+w/2,y+h/2),(w,h),0)
    L,T=max(rw,rh),min(rw,rh); th=math.radians(an if rw>=rh else an+90)
    if max(w,h)>40 and (T<=4.5 or a>0.6*w*h or L>8*T): continue
    comps.append(dict(i=i,c=(cx,cy),L=L,T=T,d=(math.cos(th),math.sin(th))))
  # Strichlinien entfernen
  dash=[k for k,c in enumerate(comps) if c['T']<=8 and 8<=c['L']<=50 and c['L']>=2.2*c['T']]
  weg=set()
  for k in dash:
    a=comps[k]; chain=0
    for j in dash:
      if j==k: continue
      b=comps[j]; dx=b['c'][0]-a['c'][0]; dy=b['c'][1]-a['c'][1]
      along=dx*a['d'][0]+dy*a['d'][1]; perp=abs(-dx*a['d'][1]+dy*a['d'][0])
      if perp<max(4,a['T']) and a['L']/2+1<abs(along)<a['L']/2+b['L']/2+26 and abs(a['d'][0]*b['d'][0]+a['d'][1]*b['d'][1])>0.97: chain+=1
    if chain>=1: weg.add(comps[k]['i'])
  keep=np.zeros(n,bool)
  for c in comps:
    if c['i'] not in weg: keep[c['i']]=True
  return keep[lab].astype(np.uint8)*255
def winkel(m):
  ls=cv2.HoughLinesP(m*255,1,np.pi/360,60,minLineLength=60,maxLineGap=4)
  h=np.zeros(90)
  if ls is None: return 0
  for x1,y1,x2,y2 in ls.reshape(-1,4):
    a=math.degrees(math.atan2(y2-y1,x2-x1))%90; h[int(a)%90]+=math.hypot(x2-x1,y2-y1)
  hs=np.convolve(np.r_[h[-2:],h,h[:2]],np.ones(5),'valid'); a=int(np.argmax(hs))
  return a if a<45 else a-90
def winkel_alle(m,n=3):
  ls=cv2.HoughLinesP(m*255,1,np.pi/360,60,minLineLength=60,maxLineGap=4)
  h=np.zeros(90)
  if ls is None: return [0]
  for x1,y1,x2,y2 in ls.reshape(-1,4):
    a=math.degrees(math.atan2(y2-y1,x2-x1))%90; h[int(a)%90]+=math.hypot(x2-x1,y2-y1)
  hs=np.convolve(np.r_[h[-2:],h,h[:2]],np.ones(5),'valid'); out=[]
  for a in np.argsort(-hs):
    if hs[a]<0.15*hs.max(): break
    if all(min(abs(a-b)%90,90-abs(a-b)%90)>8 for b in out): out.append(int(a))
    if len(out)>=n: break
  return [a if a<45 else a-90 for a in out]
def ocr(img):
  f=tempfile.mktemp(suffix='.png'); cv2.imwrite(f,img)
  out=subprocess.run(['tesseract',f,'-','--psm','7','-l','eng','-c','tessedit_char_whitelist='+WL,'tsv'],capture_output=True,text=True).stdout
  os.remove(f); t=[];c=[]
  for l in out.splitlines()[1:]:
    a=l.split('\t')
    if len(a)>11 and a[11].strip(): t.append(a[11]); c.append(float(a[10]))
  return ''.join(t),(min(c) if c else 0)
def lesen(im):
  m=rot_mask(im); gl=glyphen(m); A=winkel(m); H,W=gl.shape
  res=[]
  for k in range(4):
    ang=A+90*k
    M=cv2.getRotationMatrix2D((W/2,H/2),ang,1); cs,sn=abs(M[0,0]),abs(M[0,1])
    nW,nH=int(H*sn+W*cs),int(H*cs+W*sn); M[0,2]+=nW/2-W/2; M[1,2]+=nH/2-H/2
    g=cv2.warpAffine(gl,M,(nW,nH)); g=(g>100).astype(np.uint8)*255
    Mi=cv2.invertAffineTransform(M)
    for kw in (13,34):
     d=cv2.dilate(g,cv2.getStructuringElement(cv2.MORPH_RECT,(kw,3)))
     n,lab,st,_=cv2.connectedComponentsWithStats(d,8)
     for i in range(1,n):
      x,y,w,h,a=st[i]
      if h<8 or h>70 or w<h*0.6: continue
      cut=255-g[max(0,y-2):y+h+2,max(0,x-2):x+w+2]
      if cut.size==0: continue
      f=max(2,min(6,90/h)); cut=cv2.resize(cut,None,fx=f,fy=f,interpolation=cv2.INTER_CUBIC)
      cut=cv2.copyMakeBorder(cut,25,25,25,25,cv2.BORDER_CONSTANT,value=255)
      t,c=ocr(cut)
      if not t or c<60: continue
      cx,cy=x+w/2,y+h/2; ox=Mi[0,0]*cx+Mi[0,1]*cy+Mi[0,2]; oy=Mi[1,0]*cx+Mi[1,1]*cy+Mi[1,2]
      res.append(dict(t=t,c=round(c),x=round(ox),y=round(oy),h=int(h),w=int(w),ang=ang,kw=kw,ln=len(t)))
  # Dubletten: gleicher Ort -> höchste Konfidenz
  res.sort(key=lambda r:-(r['c']+3*r['ln'])); out=[]
  for r in res:
    if all(math.hypot(r['x']-o['x'],r['y']-o['y'])>max(r['w'],o['w'])/2 for o in out): out.append(r)
  return out,A
if __name__=='__main__':
  im=cv2.imread(sys.argv[1])[:,:,::-1]
  x0,y0,x1,y1=map(int,sys.argv[2:6]) if len(sys.argv)>5 else (0,0,im.shape[1],im.shape[0])
  out,A=lesen(im[y0:y1,x0:x1]); print('winkel',A)
  for r in sorted(out,key=lambda r:(r['y'],r['x'])): print(r)
