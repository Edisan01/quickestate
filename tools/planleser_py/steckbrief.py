# Zonen je Grundstück: Stadt-Widmungszonen (genau) + Planleser-Tokens + G-Flächen per Flutfüllung
import sys,json,cv2,numpy as np,math,re
import os as _os; sys.path.insert(0,_os.path.dirname(_os.path.abspath(__file__)))
import kat, zonen as Z
ROMAN={'1':'I','2':'II','3':'III','4':'IV','5':'V','6':'VI'}
def stadtzonen(m,wfs,off):
  out=[]
  for f in wfs['features']:
    gm=f['geometry']; polys=gm['coordinates'] if gm['type']=='MultiPolygon' else [gm['coordinates']]
    for pg in polys:
      P=np.array([kat.px(m,*q[:2]) for q in pg[0]])-off
      out.append(dict(w=f['properties']['WIDMUNG'],kl=f['properties']['WIDMUNGSKLASSE'],P=P))
  return out
def maske(P,shape):
  k=np.zeros(shape,np.uint8); cv2.fillPoly(k,[np.round(P).astype(np.int32)],1); return k
def analysiere(m,im,wfs,rand=260):
  ps=[kat.finde(*m['punkt'],m['kg'],g)[0] for g in m['gnr'].split('+')]
  Rs=[np.array([kat.px(m,*q) for q in p['polys'][0][0]]) for p in ps]; R=np.vstack(Rs)
  x0,y0=np.maximum(R.min(0)-rand,0).astype(int); x1,y1=(R.max(0)+rand).astype(int)
  crop=im[y0:y1,x0:x1,::-1].copy(); H,W=crop.shape[:2]; off=np.array([x0,y0])
  rings=[r-off for r in Rs]; pm=np.zeros((H,W),np.uint8)
  for r in rings: cv2.fillPoly(pm,[np.round(r).astype(np.int32)],1)
  T,mm,gl=Z.tokens(crop,None,rings); lab,st,lin=Z.regionen(mm,T,gl)
  SZ=stadtzonen(m,wfs,off); erg=[]
  for z in SZ:
    zm=maske(z['P'],(H,W)); teil=(zm&pm)
    if teil.sum()<60: continue
    # Tokens in dieser Stadtzone (ganze Zone im Ausschnitt)
    tk=[t for t in T if 0<=int(t['y'])<H and 0<=int(t['x'])<W and cv2.dilate(zm,np.ones((5,5),np.uint8))[int(t['y']),int(t['x'])]]
    # G-Flächen: Flutfüllung ab jedem G-Token innerhalb der Zone, Linien + Zonengrenze als Sperre
    sperre=((lin>0)|(zm==0)).astype(np.uint8)
    n,rl,rs,_=cv2.connectedComponentsWithStats((sperre==0).astype(np.uint8),4)
    g_ids=set()
    for t in tk:
      tt=t['t'].replace(' ','')
      if re.fullmatch(r'G(BB\d*)?\.?|GBB\d*|CBB',tt) or (tt=='G'):
        r_=rl[int(t['y']),int(t['x'])]
        if r_>0 and rs[r_][4]<0.85*zm.sum(): g_ids.add(r_)
    gm=np.isin(rl,list(g_ids)).astype(np.uint8)
    gteil=teil&cv2.dilate(gm,np.ones((5,5),np.uint8)); bteil=teil&(1-gteil)
    erg.append(dict(stadt=z['w'],kl=z['kl'],px=int(teil.sum()),g_px=int(gteil.sum()),b_px=int(bteil.sum()),
                    tokens=[t['t'] for t in tk],attr=Z.attrs([t for t in tk if not re.fullmatch(r'G(BB\d*)?|GBB\d*|CBB',t['t'])]),
                    g_attr=Z.attrs([t for t in tk if re.fullmatch(r'G(BB\d*)?|GBB\d*|CBB',t['t'])]),teil=teil,gteil=gteil))
  return erg,T,lin,(x0,y0),rings
if __name__=='__main__' and sys.argv[1]!='tf':
  M=json.load(open('/home/claude/pb/meta.json'))
  for i in map(int,sys.argv[1:]):
    m=M[i]; im=cv2.imread(f'/home/claude/pb/f{i}.png'); g0=m['gnr'].split('+')[0]
    import glob
    fs=[f for g in m['gnr'].split('+') for f in glob.glob(f"/home/claude/pb/wfs/{m['kg']}_{g.replace('/','-')}_GENFLWIDMUNGOGD.json")]
    wfs=json.load(open(fs[0]))
    erg,T,lin,o,rings=analysiere(m,im,wfs)
    print(m['name'])
    for e in sorted(erg,key=lambda e:-e['px']):
      print('  Stadt %-6s %5d px (bebaubar %d, G %d) | Plan:'%(e['stadt'],e['px'],e['b_px'],e['g_px']),e['attr'],'G:',e['g_attr'])

GRX=re.compile(r'^(G(BB\d*)?\.?|GBB\d*|CBB)$')
def teilflaechen(m,im,wfs,rand=260):
  ps=[kat.finde(*m['punkt'],m['kg'],g)[0] for g in m['gnr'].split('+')]
  Rs=[np.array([kat.px(m,*q) for q in p['polys'][0][0]]) for p in ps]; R=np.vstack(Rs)
  x0,y0=np.maximum(R.min(0)-rand,0).astype(int); x1,y1=(R.max(0)+rand).astype(int)
  crop=im[y0:y1,x0:x1,::-1].copy(); H,W=crop.shape[:2]; off=np.array([x0,y0])
  rings=[r-off for r in Rs]; pm=np.zeros((H,W),np.uint8)
  for r in rings: cv2.fillPoly(pm,[np.round(r).astype(np.int32)],1)
  T,mm,gl=Z.tokens(crop,None,rings); lab,st,lin=Z.regionen(mm,T,gl)
  SZ=stadtzonen(m,wfs,off); zid=np.full((H,W),-1,np.int32)
  for k,z in enumerate(SZ): zid[maske(z['P'],(H,W))>0]=k
  zgrenz=np.zeros((H,W),np.uint8)
  for z in SZ: cv2.polylines(zgrenz,[np.round(z['P']).astype(np.int32)],True,1,2)
  frei=((lin==0)&(zgrenz==0)).astype(np.uint8)
  nF,fl,fs,_=cv2.connectedComponentsWithStats(frei,4)          # Planflächen (ohne Grundstücksgrenze)
  bar=frei.copy()
  for r in rings: cv2.polylines(bar,[np.round(r).astype(np.int32)],True,0,2)
  nT,tl,ts,_=cv2.connectedComponentsWithStats(((bar>0)&(pm>0)).astype(np.uint8),4)  # Teilflächen im Grundstück
  def tk_in(maskk):
    d=cv2.dilate(maskk,np.ones((7,7),np.uint8)); return [t for t in T if 0<=int(t['y'])<H and 0<=int(t['x'])<W and d[int(t['y']),int(t['x'])]]
  TF=[]
  for i in range(1,nT):
    if ts[i][4]<55: continue
    msk=(tl==i).astype(np.uint8)
    zs,zc=np.unique(zid[msk>0],return_counts=True); z=zs[np.argmax(zc)]
    fid,fc=np.unique(fl[msk>0],return_counts=True); f=fid[np.argmax(fc)]
    fm=(fl==f).astype(np.uint8) if f>0 else msk
    gross=fm.sum()>25*msk.sum() or fm.sum()>60000
    toks=tk_in(msk) if gross else tk_in(fm)
    quelle='innen' if gross else 'planflaeche'
    if not any(re.match(r'^(W|GB|WGV|G|E|L)',t['t']) for t in toks) and not any(GRX.match(t['t']) for t in toks):
      (cx,cy),(rw,rh),an=cv2.minAreaRect(np.column_stack(np.nonzero(msk))[:,::-1].astype(np.float32))
      th=math.radians(an if rw>=rh else an+90); L_,S_=max(rw,rh),min(rw,rh); ux,uy=math.cos(th),math.sin(th)
      band=[t for t in T if abs(-(t['x']-cx)*uy+(t['y']-cy)*ux)<=S_/2+4 and abs((t['x']-cx)*ux+(t['y']-cy)*uy)<=L_/2+260
            and (zid[min(H-1,max(0,int(t['y']))),min(W-1,max(0,int(t['x'])))]==z)]
      toks=toks+[t for t in band if t not in toks]; quelle+='+band'
    # G-Suche auch in großen Planflächen und als Nachbar-Fallback
    fmt=[t for t in tk_in(fm) if math.hypot(t['x']-np.argwhere(msk)[:,1].mean(),t['y']-np.argwhere(msk)[:,0].mean())<300]
    if not any(GRX.match(t['t']) for t in toks) and any(GRX.match(t['t']) for t in fmt) and not any(re.match(r'^(W|GB|WGV)',t['t']) and t not in toks for t in fmt if not quelle.startswith('innen')):
      toks=toks+[t for t in fmt if GRX.match(t['t'])]; quelle+='+G'
    if not any(GRX.match(t['t']) or re.match(r'^(W|GB|WGV|III|II|IV|VI)',t['t']) for t in toks):
      dist=cv2.distanceTransform((1-msk).astype(np.uint8),cv2.DIST_L2,3)
      kand=[(dist[min(H-1,max(0,int(t['y']))),min(W-1,max(0,int(t['x'])))],t) for t in T if zid[min(H-1,max(0,int(t['y']))),min(W-1,max(0,int(t['x'])))]==z and (GRX.match(t['t']) or re.match(r'^(W|GB|WGV)',t['t']))]
      kand=[k_ for k_ in kand if k_[0]<150]
      if kand: toks=toks+[min(kand,key=lambda k_:k_[0])[1]]; quelle+='+nachbar'
    g=[t for t in toks if GRX.match(t['t'])]; rest=[t for t in toks if not GRX.match(t['t'])]
    innen=tk_in(msk); wl=[t for t in rest if re.match(r'^(W|GB|WGV|III|II|IV|VI|V\b)',t['t'])]
    if any(GRX.match(t['t']) for t in innen): istG=True
    elif any(t in innen for t in wl): istG=False
    elif g and wl:
      cy_,cx_=np.argwhere(msk).mean(0); dg=min(math.hypot(t['x']-cx_,t['y']-cy_) for t in g); dw=min(math.hypot(t['x']-cx_,t['y']-cy_) for t in wl)
      istG=dg<dw
    else: istG=bool(g)
    TF.append(dict(px=int(msk.sum()),m2=round(msk.sum()*(0.2986**2),1),stadt=SZ[z]['w'] if z>=0 else None,G=istG,
                   plan=Z.attrs(g if istG else rest),toks=[(t['t'],round(t['s'],2)) for t in toks],quelle=quelle,msk=msk,
                   label_pos=[(t['x']+x0,t['y']+y0,t['t'],cv2.boxPoints(((t['x']+x0,t['y']+y0),(t['w']+2,t['h']+2),t['ang'])).tolist()) for t in (g if istG else rest)]))
  return TF,T,lin,(x0,y0),rings
def roemisch(w):
  m_=re.match(r'([A-Z]+)(\d)?',w or ''); return (m_.group(1),ROMAN.get(m_.group(2),'')) if m_ else (w,'')
if __name__=='__main__' and len(sys.argv)>1 and sys.argv[1]=='tf':
  import glob
  M=json.load(open('/home/claude/pb/meta.json'))
  for i in map(int,sys.argv[2:]):
    m=M[i]; im=cv2.imread(f'/home/claude/pb/f{i}.png')
    fs=[f for g in m['gnr'].split('+') for f in glob.glob(f"/home/claude/pb/wfs/{m['kg']}_{g.replace('/','-')}_GENFLWIDMUNGOGD.json")]
    TF,T,lin,o,rings=teilflaechen(m,im,json.load(open(fs[0])))
    print(m['name'])
    for t in sorted(TF,key=lambda t:-t['px']):
      wk,bk=roemisch(t['stadt'])
      print('  %6.1f m²  Stadt %-4s %-4s %s  Plan %s  [%s] %s'%(t['m2'],wk,bk,'G ' if t['G'] else '  ',t['plan'],t['quelle'],[x[0] for x in t['toks']][:8]))
