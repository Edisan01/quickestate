# Planleser-Ergebnis je Grundstück als JSON (vorberechnet, ohne KI)
import sys,json,cv2,numpy as np,math,re,glob,datetime
import os as _os; sys.path.insert(0,_os.path.dirname(_os.path.abspath(__file__)))
import kat, steckbrief as S
def ll(m,x,y):
  n=2**19; X=x/256+m['x0']; Y=y/256+m['y0']
  lon=X/n*360-180; lat=math.degrees(math.atan(math.sinh(math.pi*(1-2*Y/n)))); return [round(lon,7),round(lat,7)]
DEBUG=False
MPX=0.2986*math.cos(math.radians(48.21))
def strassenkanten(m,ringe_px,off,zonen):
  # Kante liegt an der Straße, wenn 4 m außerhalb keine Widmungszone (Bauland/Grün) liegt
  andere=[z['P'].astype(np.float32) for z in zonen]
  out=[]
  for r in ringe_px:
    c=r.mean(0)
    for a,b in zip(r,np.roll(r,-1,0)):
      L=np.hypot(*(b-a))
      if L<8: continue
      mid=(a+b)/2; nrm=np.array([b[1]-a[1],-(b[0]-a[0])])/L
      if np.dot(mid-c,nrm)<0: nrm=-nrm
      q=mid+nrm*(4/MPX)
      drin=sum(1 for o in andere if cv2.pointPolygonTest(o,(float(q[0]),float(q[1])),False)>=0)
      if drin==0: out.append((a,b))
  return out
def laeufe(lin,p,d,maxpx,skip=0):
  # Linien-Treffer entlang eines Strahls: Mitte jedes roten Laufs (Abstand in px)
  H,W=lin.shape; out=[]; inn=None
  for k in range(int(skip),int(maxpx)):
    x,y=int(round(p[0]+d[0]*k)),int(round(p[1]+d[1]*k))
    if not(0<=x<W and 0<=y<H): break
    v=lin[y,x]>0
    if v and inn is None: inn=k
    if not v and inn is not None: out.append((inn+k-1)/2); inn=None
  return out
def massgap(lin,t):
  # Maßzahl misst senkrecht zur Schriftrichtung zwischen den beiden nächsten Linien – Median über mehrere Stellen der Zahl
  a=math.radians(t['ang']); d=np.array([math.cos(a),math.sin(a)]); n=np.array([-d[1],d[0]]); p0=np.array([t['x'],t['y']])
  gs=[]
  for f in (-0.35,-0.15,0,0.15,0.35):
    p=p0+d*f*t['w']; r1=laeufe(lin,p,n,400,t['h']/2+1); r2=laeufe(lin,p,-n,400,t['h']/2+1)
    if r1 and r2: gs.append((r1[0]+r2[0],r1[0],r2[0]))
  if len(gs)<3: return None
  gs.sort(); g=gs[len(gs)//2]
  return g[0], p0+n*g[1], p0-n*g[2]
TEILRX=[('widmung',r'^(GBGV|WGV|GB|W|G(?=BB|$)|G)'),('bauklasse',r'(?<=[A-Z])(VI|IV|V|III|II|I)(?=\d|[gok]|$)|^(VI|IV|V|III|II|I)$'),('hoehe',r'\d{1,2}[,.]?\d?m|(?<=[IV])\d{1,2}[,.]\d'),('bauweise',r'(gk|g|o)(?=BB\d*$)|(gk|g|o)$'),('bb',r'BB\d*')]
def teilboxen(m,t,gl):
  # einzelne Planteile (Widmung, Bauklasse, Höhe, Bauweise, BB) mit eigenem Kästchen zum Einkreisen
  if not gl or len(gl)!=len(t): return {}
  out={}
  for art,rx in TEILRX:
    mm_=re.search(rx,t)
    if not mm_ or mm_.end()<=mm_.start(): continue
    pts=[q for g_ in gl[mm_.start():mm_.end()] for q in g_]
    if art=='bauweise' and t in ('g','9'): pts=[q for g_ in gl for q in g_]
    out[art]=[ll(m,*q) for q in pts]
  if t in ('g','9'): out={'bauweise':[ll(m,*q) for g_ in gl for q in g_]}
  return out
MASS=re.compile(r'^(\d{1,2})[,.](\d\d)$')
def masszahlen(lin,T):
  out=[]
  for t in T:
    mm_=MASS.match(t['t'])
    if not mm_: continue
    v=float(mm_.group(1)+'.'+mm_.group(2)); g=massgap(lin,t)
    if not g: continue
    gm=g[0]*MPX
    out.append(dict(v=v,gem=round(gm,2),ok=abs(gm-v)<=max(0.45,0.035*v),a=g[1],b=g[2],t=t))
  return out
def g_fern(m,im,msk,x0,y0,rand=700):
  # Hof ohne eigene Beschriftung: gilt das „G“ derselben Planfläche, auch weit weg (Sommerschuhgasse: G BB ~110 m entfernt)
  import zonen as Z, leser2
  ys,xs=np.nonzero(msk); X0,Y0=max(0,int(xs.min()+x0-rand)),max(0,int(ys.min()+y0-rand)); X1,Y1=int(xs.max()+x0+rand),int(ys.max()+y0+rand)
  crop=im[Y0:Y1,X0:X1,::-1].copy(); mm=leser2.rot_mask(crop); gl=leser2.glyphen(mm)
  lab,st,lin=Z.regionen(mm,[],gl)
  ids,cnt=np.unique(lab[ys+y0-Y0,xs+x0-X0],return_counts=True); ids=ids[ids>0]
  if not len(ids): return None
  rid=ids[np.argmax([cnt[list(np.unique(lab[ys+y0-Y0,xs+x0-X0],return_counts=True)[0]).index(i)] for i in ids])]
  for g in Z.g_suche(crop,gl,[0,8,-8,15,-15]):
    if g['s']<0.8: break
    gx,gy=int(g['x']),int(g['y'])
    if not(0<=gy<lab.shape[0] and 0<=gx<lab.shape[1]): continue
    if cv2.dilate((lab==rid).astype(np.uint8),np.ones((25,25),np.uint8))[gy,gx]:
      w=crop[max(0,gy-40):gy+40,max(0,gx-30):gx+160]; a_=math.radians(g['ang']%90 if g['ang']%90<45 else g['ang']%90-90)
      ring=np.array([[0,0],[100*math.cos(a_),100*math.sin(a_)],[100*math.cos(a_)-100*math.sin(a_),100*math.sin(a_)+100*math.cos(a_)],[-100*math.sin(a_),100*math.cos(a_)]])
      T,_,_=Z.tokens(w,0,[ring]); bb=any('BB' in t['t'] for t in T)
      box=cv2.boxPoints(((gx+X0,gy+Y0),(g['w']*(3.2 if bb else 1)+4,g['h']+4),0)).tolist()
      cx=gx+X0+(g['w']*1.1 if bb else 0)
      return dict(bb=bb,label=(cx,gy+Y0,'GBB' if bb else 'G',cv2.boxPoints(((cx,gy+Y0),(g['w']*(3.2 if bb else 1)+4,g['h']+4),0)).tolist(),[]))
  return None
def fall(m,im,wfs):
  TF,T,lin,(x0,y0),rings=S.teilflaechen(m,im,wfs); off=np.array([x0,y0])
  sk=strassenkanten(m,[r for r in rings],off,S.stadtzonen(m,wfs,off))
  H,W=lin.shape; front=np.zeros((H,W),np.uint8)
  for a,b in sk: cv2.line(front,tuple(np.round(a).astype(int)),tuple(np.round(b).astype(int)),1,9)
  # kleine unbeschriftete Splitter an gleichartigen Nachbarn anhängen
  # Vorgarten-Tiefe früh messen (Front → erste Linie innen)
  vgm0=None
  if sk:
    a0_,b0_=max(sk,key=lambda e:np.hypot(*(e[1]-e[0]))); dv0=(b0_-a0_)/np.hypot(*(b0_-a0_)); c0_=np.vstack(rings).mean(0); nv0=np.array([-dv0[1],dv0[0]])
    if np.dot(c0_-(a0_+b0_)/2,nv0)<0: nv0=-nv0
    vg0=[]
    for f_ in np.linspace(0.2,0.8,7):
      p_=a0_+(b0_-a0_)*f_; r_=[x-8 for x in laeufe(lin,p_-nv0*8,nv0,8+9/MPX)]
      if len(r_)>=2 and abs(r_[0])<=1.5/MPX: vg0.append((r_[0],r_[1]))
    if len(vg0)>=4: vgm0=(float(np.median([v[0] for v in vg0])),float(np.median([v[1] for v in vg0])))
  # Baufenster-Gebiet (offene/gekuppelte Bauweise): Teile ohne eigene Beschriftung liegen außerhalb der Baufluchtlinien
  offen={t['stadt'] for t in TF if t['plan'].get('bauweise') in ('o','gk') or any(re.search(r'(gk|o)(BB\d*)?\]?$',x[2]) for x in t['label_pos'])}
  teile=[]
  for t in sorted(TF,key=lambda t:-t['px']):
    wk,bk=S.roemisch(t['stadt'])
    art='G' if t['G'] else ('A' if t['stadt'] is None else 'B')
    if art=='B' and vgm0 and sk:
      ys_,xs_=np.nonzero(t['msk']); dd=(np.column_stack([xs_,ys_])-a0_)@nv0
      if dd.max()<=vgm0[1]+3 and vgm0[1]*MPX<=9: art='V'
    if art=='B' and t['stadt'] in offen and ('nachbar' in t['quelle'] or t['quelle'].startswith('innen')):
      art='F'; gf=g_fern(m,im,t['msk'],x0,y0)
      if gf: art='G'; t['G']=True; t['plan']={'bb':'BB'} if gf['bb'] else {}; t['label_pos']=[gf['label']]; t['quelle']+='+G-fern'
    key=(art,t['stadt'])
    attrs=dict(t['plan'])
    if art in ('V','F'): attrs={}
    teile.append(dict(key=key,art=art,msk=t['msk'].copy(),stadt=t['stadt'],G=t['G'],plan=attrs,labels=t['label_pos'] if art not in ('V','F') else [],quelle=t['quelle'],wk=wk,bk=bk))
  merged=[]
  for t in teile:
    tgt=None
    for u in merged:
      if u['key']==t['key'] and all(t['plan'].get(k_)==u['plan'].get(k_) for k_ in ('hoehe','bauklasse','widmung') if t['plan'].get(k_) and u['plan'].get(k_)):
        tgt=u; break
    if tgt:
      tgt['msk']|=t['msk']; tgt['labels']+=[l for l in t['labels'] if l not in tgt['labels']]
      for k,v in t['plan'].items(): tgt['plan'].setdefault(k,v)
    else: merged.append(t)
  merged=[u for u in merged if u['msk'].sum()*MPX**2>=8]
  # Lücken (Linienbreite) bis zur Grundstücksgrenze auffüllen: jedes Grundstückspixel zur nächsten Teilfläche
  pmk=np.zeros((H,W),np.uint8)
  for r in rings: cv2.fillPoly(pmk,[np.round(r).astype(np.int32)],1)
  lab_=np.zeros((H,W),np.int32)
  for k,u in enumerate(merged): lab_[u['msk']>0]=k+1
  if merged:
    _,lbl=cv2.distanceTransformWithLabels((lab_==0).astype(np.uint8),cv2.DIST_L2,5,labelType=cv2.DIST_LABEL_PIXEL)
    ys,xs=np.nonzero(lab_>0); idx2lab=np.zeros(lbl.max()+1,np.int32); idx2lab[lbl[ys,xs]]=lab_[ys,xs]
    voll=idx2lab[lbl]*(pmk>0)
    for k,u in enumerate(merged): u['nv']=int((voll==k+1).sum()); u['msk']=(voll==k+1).astype(np.uint8)
  # doppelt gelesene Beschriftung (gleiche Stelle, andere Drehung) nur einmal – die längere bleibt
  for u in merged:
    keep=[]
    for L_ in sorted(u['labels'],key=lambda l:-len(l[2])):
      if not any(cv2.pointPolygonTest(np.array(k[3],np.float32),(float(L_[0]),float(L_[1])),False)>=0 for k in keep): keep.append(L_)
    u['labels']=keep
  for u in merged: u['front']=int((u['msk']&front).sum())
  fr=sorted([u for u in merged if u['front']>0 and u['art']=='B'],key=lambda u:-u['front'])
  if not fr: fr=sorted([u for u in merged if u['art']=='B'],key=lambda u:-int(u['msk'].sum()))
  hof=[u for u in merged if u not in fr[:1]]
  out=[]
  ges=sum(u.get('nv',u['msk'].sum()) for u in merged)
  for u in merged:
    cs,_=cv2.findContours(u['msk'],cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    polys=[[ll(m,p[0][0]+x0,p[0][1]+y0) for p in cv2.approxPolyDP(c,1.2,True)] for c in cs if cv2.contourArea(c)>20]
    wk,bk=u['wk'],u['bk']; pl=u['plan']
    if u['G'] or u['stadt'] is None or u['art'] in ('V','F'): gleich=None
    else: gleich=bool(pl.get('widmung')==wk and pl.get('bauklasse')==bk)
    out.append(dict(rolle='strasse' if fr and u is fr[0] else 'hof',art={'G':'G','A':'abtretung','V':'vorgarten','F':'frei'}.get(u['art'],'bebaubar'),
      stadt=dict(widmung=wk,bauklasse=bk,code=u['stadt']),
      plan={k:v for k,v in pl.items()},stadt_plan_gleich=gleich,anteil=round(u.get('nv',u['msk'].sum())/ges,4),m2_plan=round(u.get('nv',u['msk'].sum())*MPX**2,1),
      poly=polys,labels=[dict(t=t,ll=ll(m,x,y),box=[ll(m,*q) for q in bx],teile=teilboxen(m,t,gl)) for x,y,t,bx,gl in u['labels'] if re.match(r'^(W|GB|WGV|G|E|L|I|V|g|C?BB)',t) or re.fullmatch(r'\d{1,2}([,.]\d)?m',t)],quelle=u['quelle']))
  # Hof links/rechts aus Sicht der Straße
  for o in out:
    if o['art'] in ('abtretung','vorgarten','frei'): o['rolle']=o['art']
  hofs=[o for o in out if o['rolle']=='hof']
  if len(hofs)>=2 and sk:
    a,b=sk[0]; d=(b-a)/np.hypot(*(b-a))
    # Blick von der Straße ins Grundstück (n nach innen); links = (n_y, -n_x) in Bildkoordinaten
    c=np.vstack(rings).mean(0); nrm=np.array([-d[1],d[0]])
    if np.dot(c-(a+b)/2,nrm)<0: nrm=-nrm
    links=np.array([nrm[1],-nrm[0]])
    def proj(o):
      pts=np.array([kat.px(m,*q) for q in o['poly'][0]])-off; return -float(np.dot(pts.mean(0)-c,links))
    hofs.sort(key=proj)
    for k,o in enumerate(hofs): o['rolle']=('hof_links','hof_rechts')[k] if len(hofs)==2 else f'hof_{k+1}'
  MZ=masszahlen(lin,T)
  if sk:
    a_,b_=max(sk,key=lambda e:np.hypot(*(e[1]-e[0]))); dv=(b_-a_)/np.hypot(*(b_-a_)); c_=np.vstack(rings).mean(0); nv=np.array([-dv[1],dv[0]])
    if np.dot(c_-(a_+b_)/2,nv)<0: nv=-nv
    # Vorgarten: Abstand Front → erste Linie innen (Median über die Front), nur wenn ≤ 9 m und kein Widmungsteil davor
    vg=[]
    for f_ in np.linspace(0.2,0.8,7):
      p_=a_+(b_-a_)*f_; r_=laeufe(lin,p_-nv*8,nv,8+9/MPX)
      r_=[x-8 for x in r_]
      if len(r_)>=2 and abs(r_[0])<=1.5/MPX: vg.append((r_[1]-r_[0])*MPX)
    vgm=float(np.median(vg)) if len(vg)>=4 else None
    for o in out:
      if o['rolle']!='strasse': continue
      # Trakttiefe: Maßzahl im Straßentrakt, senkrecht zur Front, Messung bestätigt
      kand=[z for z in MZ if z['ok'] and abs(np.dot((z['a']-z['b'])/max(1e-6,np.hypot(*(z['a']-z['b']))),nv))>0.9]
      inT=[z for z in kand if any(cv2.pointPolygonTest(np.array([[kat.px(m,*q)[0]-x0,kat.px(m,*q)[1]-y0] for q in r],np.float32),(float(z['t']['x']),float(z['t']['y'])),True)>=-12 for r in o['poly'])]
      if inT: z=inT[0]; o['tiefe']=dict(plan=z['v'],gemessen=z['gem'],ok=True,box=[ll(m,*(q+off)) for q in cv2.boxPoints(((z['t']['x'],z['t']['y']),(z['t']['w']+2,z['t']['h']+2),z['t']['ang']))])
      if DEBUG:
        for z in MZ:
          dd=min(cv2.pointPolygonTest(np.array([[kat.px(m,*q)[0]-x0,kat.px(m,*q)[1]-y0] for q in r],np.float32),(float(z['t']['x']),float(z['t']['y'])),True) for r in o['poly'])
          print('    MZ',z['v'],z['gem'],z['ok'],'dot',round(abs(np.dot((z['a']-z['b'])/max(1e-6,np.hypot(*(z['a']-z['b']))),nv)),2),'dist',round(dd,1))
    # Straßenbreite am eigenen Grundstück: von der Front nach außen bis zur Linie gegenüber; Planzahl im Straßenraum mit gleicher Breite
    sb=[]
    for f_ in np.linspace(0.2,0.8,7):
      p_=a_+(b_-a_)*f_; r_=[x-15 for x in laeufe(lin,p_+nv*15,-nv,15+40/MPX)]
      if len(r_)>=2 and abs(r_[0])<=3/MPX: sb.append((r_[-1] if len(r_)==2 else r_[1])-r_[0])
    sbm=float(np.median(sb))*MPX if len(sb)>=4 else None
    if sbm:
      kz=[z for z in MZ if z['ok'] and abs(z['v']-sbm)<=0.6 and cv2.pointPolygonTest(np.vstack(rings).astype(np.float32)[cv2.convexHull(np.vstack(rings).astype(np.float32),returnPoints=False).ravel()],(float(z['t']['x']),float(z['t']['y'])),False)<0]
      sbr=dict(gemessen=round(sbm,2),plan=kz[0]['v'] if kz else None,ok=bool(kz),box=[ll(m,*(q+off)) for q in cv2.boxPoints(((kz[0]['t']['x'],kz[0]['t']['y']),(kz[0]['t']['w']+2,kz[0]['t']['h']+2),kz[0]['t']['ang']))] if kz else None)
      for o in out:
        if o['rolle']=='strasse': o['strassenbreite']=sbr
    # weitere Straßenmaße derselben Straße (z. B. 12,00 Baulinie–Baulinie am Straßenende), Planzahl mit Pfeilen quer zur Straße
    L_=np.hypot(*(b_-a_)); hull=np.vstack(rings).astype(np.float32)
    sm=[]
    for z in MZ:
      if not z['ok']: continue
      q=np.array([z['t']['x'],z['t']['y']]); al=np.dot(q-a_,dv); pe=np.dot(q-a_,nv)
      if cv2.pointPolygonTest(hull[cv2.convexHull(hull,returnPoints=False).ravel()],(float(q[0]),float(q[1])),False)>=0: continue
      if not(-25/MPX<=pe<=0 and -120/MPX<=al<=L_+120/MPX): continue
      zon=S.stadtzonen(m,wfs,off)
      if any(cv2.pointPolygonTest(zz['P'].astype(np.float32),(float(q[0]),float(q[1])),False)>=0 for zz in zon):
        # Maß liegt im Bauland (z. B. Baufenster-Tiefe 12,00 beim Nachbarn derselben Zeile) → Tiefe, nicht Straße
        for o in out:
          if o['rolle']=='strasse' and 'tiefe' not in o: o['tiefe']=dict(plan=z['v'],gemessen=z['gem'],ok=True,art='baufenster',box=[ll(m,*(qq+off)) for qq in cv2.boxPoints(((z['t']['x'],z['t']['y']),(z['t']['w']+2,z['t']['h']+2),z['t']['ang']))])
        continue
      if abs(np.dot((z['a']-z['b'])/max(1e-6,np.hypot(*(z['a']-z['b']))),nv))<0.9: continue
      if sbm and 'sbr' in dir() and sbr.get('plan')==z['v']: continue
      if any(abs(x['v']-z['v'])<0.01 for x in sm): continue
      sm.append(dict(v=z['v'],box=[ll(m,*(qq+off)) for qq in cv2.boxPoints(((z['t']['x'],z['t']['y']),(z['t']['w']+2,z['t']['h']+2),z['t']['ang']))]))
    if sm:
      for o in out:
        if o['rolle']=='strasse': o['strassenmasse']=sm
    if vgm and 1.5<=vgm<=9:
      kz=[z for z in MZ if z['ok'] and abs(z['v']-vgm)<=0.45]
      vor=dict(gemessen=round(vgm,2),plan=kz[0]['v'] if kz else None,ok=bool(kz))
      for o in out:
        if o['rolle']=='strasse': o['vorgarten']=vor
  dbg=[(z['v'],z['gem'],z['ok']) for z in MZ]
  front_kante=None
  if sk and fr:
    # zusammenhängende Straßenkanten zu Geraden vereinen, dann die längste (Eingangsseite)
    def winkel(e): return math.degrees(math.atan2(e[1][1]-e[0][1],e[1][0]-e[0][0]))%180
    gr=[]
    for e in sk:
      for g_ in gr:
        if min(abs(winkel(e)-winkel(g_[0])),180-abs(winkel(e)-winkel(g_[0])))<8: g_.append(e); break
      else: gr.append([e])
    def spann(g_):
      P_=np.array([q for e in g_ for q in e]); dd=np.array([math.cos(math.radians(winkel(g_[0]))),math.sin(math.radians(winkel(g_[0])))]); t_=P_@dd
      return P_[np.argmin(t_)],P_[np.argmax(t_)]
    best=max((spann(g_) for g_ in gr),key=lambda e:np.hypot(*(e[1]-e[0])))
    front_kante=[ll(m,*(best[0]+off)),ll(m,*(best[1]+off))]
  return out,front_kante,dbg
if __name__=='__main__':
  import os
  MF=os.environ.get('META','/home/claude/pb/meta.json'); BILD=os.environ.get('BILD','/home/claude/pb/f%d.png')
  M=json.load(open(MF)); res=json.load(open(sys.argv[1])) if os.environ.get('ANHAENGEN') else {}
  for i in map(int,sys.argv[2:]):
    m=M[i]; im=cv2.imread(BILD%i)
    fs=[f for g in m['gnr'].split('+') for f in glob.glob(f"/home/claude/pb/wfs/{m['kg']}_{g.replace('/','-')}_GENFLWIDMUNGOGD.json")]
    out,fk,dbg=fall(m,im,json.load(open(fs[0])))
    key=m['kg']+'_'+m['gnr']
    res[key]=dict(name=m['name'],kg=m['kg'],gnr=m['gnr'],stand=str(datetime.date.today()),version='planleser-py-2',front=fk,teile=out)
    pdz=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'plandokumente.json')))
    if key in pdz.get('zuordnung',{}):
      z_=pdz['zuordnung'][key]; pdo=pdz['dokumente'][z_['pd']]; res[key]['plandokument']=dict(pdo,nr=z_['pd'])
      for t in out:
        b_=z_.get(t['art'] if t['art']!='bebaubar' else 'bebaubar')
        if b_ and t['plan'].get('bb'): t['plan']['bb']=b_; t['plan']['bb_text']=pdo['bb'][b_]
    print(m['name'],'Maßzahlen:',dbg); [print('  ',o['rolle'],o['art'],o['stadt']['code'],o['plan'],o['stadt_plan_gleich'],o['m2_plan'],[l['t'] for l in o['labels']],o.get('tiefe'),o.get('vorgarten')) for o in out]
  json.dump(res,open(sys.argv[1],'w'),ensure_ascii=False)
