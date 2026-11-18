import re
BK={'I':'I','II':'II','III':'III','IV':'IV','V':'V','VI':'VI'}
RX=re.compile(r'(GBGV|GBBG|GB|WGV|W|G|E|L|SO|IG|BS|F|SN|SWW|Esp|Ekl|Epk|V)(VI|IV|V|III|II|I)?(\d{1,2}(?:,\d)?m)?(gk|g|o|k|b)?(?:I?(\d{2})[,%o]*\]?)?(BB\d*)?')
def widmung(t):
  t=t.replace('[','I').replace(']','')
  m0=re.fullmatch(r'GBB(\d*)',t)
  if m0: return dict(widmung='G',bb='BB'+m0.group(1))
  best=None
  for m in RX.finditer(t):
    if not m.group(0): continue
    sc=sum(1 for g in m.groups() if g)
    if m.group(1) in ('E','L','F','V') and not m.group(2) and not m.group(3): sc-=1
    if best is None or sc>best[0]: best=(sc,m)
  if not best or best[0]<1: return None
  m=best[1]; d=dict(widmung=m.group(1))
  if m.group(2): d['bauklasse']=m.group(2)
  if m.group(3): d['hoehe']=m.group(3).replace('m',' m')
  if m.group(4): d['bauweise']=m.group(4)
  if m.group(5): d['bebauung']=m.group(5)+' %'
  if m.group(6) or 'BB' in t: d['bb']=m.group(6) or 'BB'
  return d
