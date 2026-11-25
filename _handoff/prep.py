import numpy as np, glob, os, json, heapq, struct, collections
os.chdir(os.path.dirname(os.path.abspath(__file__)))
V=[];G=collections.OrderedDict();g=None
for l in open('makehuman__data__3dobjs__base.obj'):
    s=l.split()
    if not s: continue
    if s[0]=='v': V.append([float(a) for a in s[1:4]])
    elif s[0]=='g': g=s[1];G.setdefault(g,[])
    elif s[0]=='f': G[g].append([int(a.split('/')[0])-1 for a in s[1:]])
V=np.array(V)
body=G['body']
NB=13380
# what is kept: body, eyes, lashes, joint cubes (as single points later)
keep=list(range(NB))
eyeL=sorted({a for f in G['helper-l-eye'] for a in f}); eyeR=sorted({a for f in G['helper-r-eye'] for a in f})
keep+=eyeL+eyeR
joints=['l-shoulder','l-elbow','l-hand','l-upper-leg','l-knee','l-ankle','neck','head','l-eye','l-clavicle','spine-3','mouth']
jv={j:sorted({a for f in G['joint-'+j] for a in f}) for j in joints}
for j in joints: keep+=jv[j]
pos={v:i for i,v in enumerate(keep)}
print('kept',len(keep))
# geodesic distances on the body
adj=collections.defaultdict(set)
for f in body:
    for a,b in zip(f,f[1:]+f[:1]): adj[a].add(b);adj[b].add(a)
def geo(src):
    d=np.full(NB,1e9);h=[]
    for s in src: d[s]=0;h.append((0.,s))
    heapq.heapify(h)
    while h:
        x,a=heapq.heappop(h)
        if x>d[a]: continue
        for b in adj[a]:
            y=x+np.linalg.norm(V[a]-V[b])
            if y<d[b]: d[b]=y;heapq.heappush(h,(y,b))
    return d
J={j:V[jv[j]].mean(0) for j in joints}
B=V[:NB]
def ring(p,axis,r,side):  # vertices near a plane through p
    ax=axis/np.linalg.norm(axis); t=(B-p)@ax
    m=(abs(t)<.12)&(np.linalg.norm(B-p,axis=1)<r)&(B[:,0]*side>0)
    return np.where(m)[0]
sm=lambda a,b,x:(lambda t:t*t*(3-2*t))(np.clip((x-a)/(b-a),0,1))
W=np.zeros((NB,4))
S,E,H=J['l-shoulder'],J['l-elbow'],J['l-hand'];HP,K,A=J['l-upper-leg'],J['l-knee'],J['l-ankle']
for side in(1,-1):
    m=np.array([side,1,1]);
    rel=ring(E*m,(H-S)*m,1.0,side); d=geo(rel)            # distance from the elbow ring
    tip=np.where((B[:,0]*side>4.0))[0]; dt=geo(tip)
    L=np.linalg.norm(S-E); LT=dt[rel].mean()
    sg=dt-LT                                               # 0 at the elbow, L at the shoulder, negative to the hand
    W[:,0]=np.maximum(W[:,0],sm(L+.35,L-.75,sg)*(B[:,0]*side>0))
    W[:,1]=np.maximum(W[:,1],sm(.32,-.32,sg)*(B[:,0]*side>0))
    foot=np.where((B[:,1]<-7.6)&(B[:,0]*side>0))[0]; df=geo(foot)
    rk=ring(K*m,(A-HP)*m,1.2,side); LK=df[rk].mean(); LH=np.linalg.norm(HP-K)
    W[:,2]=np.maximum(W[:,2],sm(LH+.3,LH-.8,df-LK)*(B[:,0]*side>0))
# head: 1 above the jaw/neck
top=np.where(B[:,1]>8.3)[0]; dh=geo(top)
W[:,3]=sm(J['neck'][1]-.45,J['neck'][1]+.15,B[:,1]+0*dh)*(abs(B[:,0])<1.3)
print('weights',[(w>.5).sum() for w in W.T])
# ---- targets
def rd(p):
    o={}
    for l in open(p):
        s=l.split()
        if len(s)==4 and s[0][0]!='#':
            i=int(s[0])
            if i in pos: o[pos[i]]=[float(x) for x in s[1:]]
    return o
T={}
for p in glob.glob('*.target'):
    n=p.split('__')[-1][:-7]
    if n.startswith('r-') or n=='desktop': continue
    if n.startswith('l-'):
        o=rd(p); q=p.replace('__l-','__r-')
        for k,v in rd(q).items(): o[k]=[a+b for a,b in zip(o[k],v)] if k in o else v
        T[n[2:]]=o
    else: T[n]=rd(p)
drop=('head-angle','nose-trans-in','nose-trans-out','mouth-trans-in','mouth-trans-out','asian-male-old','asian-female-old','neck-scale-vert')
T={k:v for k,v in T.items() if v and not k.startswith(drop)}
print(len(T),'targets',sum(len(v) for v in T.values()),'deltas')
# masks from targets (0..1 per body vertex)
def mask(*names):
    m=np.zeros(NB)
    for n in names:
        for i,v in T[n].items():
            if i<NB: m[i]=max(m[i],np.linalg.norm(v))
    return m/m.max()
lips=np.maximum(mask('mouth-upperlip-volume-incr'),mask('mouth-lowerlip-volume-incr'))
print('lip verts',(lips>.1).sum(), 'lip box',B[lips>.2].min(0),B[lips>.2].max(0))
for n in ['nose-point-width-incr','ear-scale-incr','eye-bag-incr','eye-scale-incr','cheek-volume-incr','chin-prominent-incr']:
    m=mask(n); print(n,B[m>.4].min(0).round(2),B[m>.4].max(0).round(2))
# ---- write
out=bytearray(); head={'n':len(keep),'body':NB,'eyeL':[pos[eyeL[0]],len(eyeL)],'eyeR':[pos[eyeR[0]],len(eyeR)],'joints':{j:[pos[jv[j][0]],8] for j in joints},'targets':{}}
def put(name,arr):
    while len(out)%4: out.append(0)
    head[name]=[len(out),arr.size]; out.extend(arr.tobytes())
put('verts',V[keep].astype('<f4'))
F=np.array([f if len(f)==4 else f+[f[-1]] for f in body]); print('tri faces',sum(len(f)!=4 for f in body))
put('faces',F.astype('<u2'))
put('weights',(W*255).round().astype('u1'))
put('lips',(lips*255).round().astype('u1'))
for n,o in sorted(T.items()):
    idx=np.array(sorted(o)); d=np.array([o[i] for i in idx]); s=abs(d).max()/32767 or 1
    while len(out)%4: out.append(0)
    a=len(out); out.extend(idx.astype('<u2').tobytes()); out.extend((d/s).round().astype('<i2').tobytes())
    head['targets'][n]=[a,len(idx),s]
h=json.dumps(head,separators=(',',':')).encode(); h+=b' '*(-len(h)%4)
open('human.bin','wb').write(struct.pack('<I',len(h))+h+bytes(out))
print('bytes',len(out)+len(h)); print(sorted(T))
import zlib;print('gz',len(zlib.compress(bytes(out),9)))
