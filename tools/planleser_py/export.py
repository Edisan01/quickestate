# Planleser-Ergebnis je Grundstück als JSON (vorberechnet, ohne KI)
import sys,json,cv2,numpy as np,math,re,glob,datetime
import os as _os; sys.path.insert(0,_os.path.dirname(_os.path.abspath(__file__)))
import kat, steckbrief as S
def ll(m,x,y):
  n=2**19; X=x/256+m['x0']; Y=y/256+m['y0']
  lon=X/n*360-180; lat=math.degrees(math.atan(math.sinh(math.pi*(1-2*Y/n)))); return [round(lon,7),round(lat,7)]
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
def fall(m,im,wfs):
  TF,T,lin,(x0,y0),rings=S.teilflaechen(m,im,wfs); off=np.array([x0,y0])
  sk=strassenkanten(m,[r for r in rings],off,S.stadtzonen(m,wfs,off))
  H,W=lin.shape; front=np.zeros((H,W),np.uint8)
  for a,b in sk: cv2.line(front,tuple(np.round(a).astype(int)),tuple(np.round(b).astype(int)),1,9)
  # kleine unbeschriftete Splitter an gleichartigen Nachbarn anhängen
  teile=[]
  for t in sorted(TF,key=lambda t:-t['px']):
    wk,bk=S.roemisch(t['stadt'])
    key=('G' if t['G'] else ('A' if t['stadt'] is None else 'B'),t['stadt'])
    attrs=dict(t['plan'])
    teile.append(dict(key=key,msk=t['msk'].copy(),stadt=t['stadt'],G=t['G'],plan=attrs,labels=t['label_pos'],quelle=t['quelle'],wk=wk,bk=bk))
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
    for k,u in enumerate(merged): u['nv']=int((voll==k+1).sum()); u['msk']=cv2.dilate((voll==k+1).astype(np.uint8),np.ones((5,5),np.uint8))
  for u in merged: u['front']=int((u['msk']&front).sum())
  fr=sorted([u for u in merged if u['front']>0 and not u['G'] and u['stadt'] is not None],key=lambda u:-u['front'])
  hof=[u for u in merged if u not in fr[:1]]
  out=[]
  ges=sum(u.get('nv',u['msk'].sum()) for u in merged)
  for u in merged:
    cs,_=cv2.findContours(u['msk'],cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    polys=[[ll(m,p[0][0]+x0,p[0][1]+y0) for p in cv2.approxPolyDP(c,1.2,True)] for c in cs if cv2.contourArea(c)>20]
    wk,bk=u['wk'],u['bk']; pl=u['plan']
    if u['G'] or u['stadt'] is None: gleich=None
    else: gleich=bool(pl.get('widmung')==wk and pl.get('bauklasse')==bk)
    out.append(dict(rolle='strasse' if fr and u is fr[0] else 'hof',art='G' if u['G'] else ('abtretung' if u['stadt'] is None else 'bebaubar'),
      stadt=dict(widmung=wk,bauklasse=bk,code=u['stadt']),
      plan={k:v for k,v in pl.items()},stadt_plan_gleich=gleich,anteil=round(u.get('nv',u['msk'].sum())/ges,4),m2_plan=round(u.get('nv',u['msk'].sum())*MPX**2,1),
      poly=polys,labels=[dict(t=t,ll=ll(m,x,y),box=[ll(m,*q) for q in bx]) for x,y,t,bx in u['labels'] if re.match(r'^(W|GB|WGV|G|E|L|I|V|g|C?BB)',t) or re.fullmatch(r'\d{1,2}([,.]\d)?m',t)],quelle=u['quelle']))
  # Hof links/rechts aus Sicht der Straße
  for o in out:
    if o['art']=='abtretung': o['rolle']='abtretung'
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
  front_kante=None
  if sk and fr:
    best=max(sk,key=lambda e:(int((cv2.line(np.zeros((H,W),np.uint8),tuple(np.round(e[0]).astype(int)),tuple(np.round(e[1]).astype(int)),1,9)&fr[0]['msk']).sum()),np.hypot(*(e[1]-e[0]))))
    front_kante=[ll(m,*(best[0]+off)),ll(m,*(best[1]+off))]
  return out,front_kante
if __name__=='__main__':
  M=json.load(open('/home/claude/pb/meta.json')); res={}
  for i in map(int,sys.argv[2:]):
    m=M[i]; im=cv2.imread(f'/home/claude/pb/f{i}.png')
    fs=[f for g in m['gnr'].split('+') for f in glob.glob(f"/home/claude/pb/wfs/{m['kg']}_{g.replace('/','-')}_GENFLWIDMUNGOGD.json")]
    out,fk=fall(m,im,json.load(open(fs[0])))
    res[m['kg']+'_'+m['gnr']]=dict(name=m['name'],kg=m['kg'],gnr=m['gnr'],stand=str(datetime.date.today()),version='planleser-py-2',front=fk,teile=out)
    print(m['name']); [print('  ',o['rolle'],o['art'],o['stadt']['code'],o['plan'],o['stadt_plan_gleich'],o['m2_plan'],[l['t'] for l in o['labels']]) for o in out]
  json.dump(res,open(sys.argv[1],'w'),ensure_ascii=False)
