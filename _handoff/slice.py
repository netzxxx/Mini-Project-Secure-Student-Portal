import json,numpy as np
from PIL import Image
d=json.load(open('slice.json'));ims=[]
for k,v in d.items():
    a=np.array(v).reshape(160,160)
    r=np.where(a<0,200,60)+ (np.sin(a*600)*40); g=np.where(abs(a)<.004,255,60)
    ims.append(np.dstack([r,g,np.where(a<0,60,180)]).clip(0,255).astype('u1'))
t=np.concatenate([np.concatenate(ims[::2],1),np.concatenate(ims[1::2],1)],0)
Image.fromarray(t).resize((t.shape[1]*2,t.shape[0]*2)).save('slice.png')
