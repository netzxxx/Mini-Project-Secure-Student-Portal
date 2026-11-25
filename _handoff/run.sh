cd "$(dirname "$0")"
[ -n "$1" ] && python e.py "$1"
node cs.mjs j.json
python - <<'E'
import json
from PIL import Image
js=json.load(open('j.json',encoding='utf-8-sig'))
ims=[Image.open(j['name']+'.png').convert('RGB') for j in js]
H=max(m.height for m in ims)
c=Image.new('RGB',(sum(m.width for m in ims),H))
x=0
for m in ims: c.paste(m,(x,0)); x+=m.width
c.save('all.png')
E
python post.py
