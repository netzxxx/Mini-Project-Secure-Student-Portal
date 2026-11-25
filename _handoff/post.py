from PIL import Image
import json
js=json.load(open("j.json",encoding="utf-8-sig"))
ims=[Image.open(j["name"]+".png").convert("RGB") for j in js]
ims=[m.crop((m.width*22//100,0,m.width*78//100,m.height)) if m.width==1000 else m for m in ims]
n=len(ims);k=(n+1)//2 if n>3 else n
h=800 if k<3 else 620
ims=[m.resize((m.width*h//m.height,h)) for m in ims]
rows=[ims[:k],ims[k:]]
W=max(sum(m.width for m in r) for r in rows)
c=Image.new("RGB",(W,h*(2 if n>3 else 1)))
for j,r in enumerate(rows):
  x=0
  for m in r: c.paste(m,(x,j*h));x+=m.width
c.save("all.png")
