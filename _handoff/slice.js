const fs=require('fs'),vm=require('vm');
const D=require('path').join(__dirname,'../src/main/resources/static/js/');
const g={console,postMessage(){},setTimeout,TextDecoder,fetch:async()=>({arrayBuffer:async()=>{const b=fs.readFileSync(D+'human.bin');return b.buffer.slice(b.byteOffset,b.byteOffset+b.length)}})};
const ctx=vm.createContext(g);g.importScripts=()=>vm.runInContext(fs.readFileSync(D+'avatar-human.js','utf8'),ctx);
let src=fs.readFileSync(D+'avatar-worker.js','utf8');
// the strict script needs human first
vm.runInContext(src+';globalThis.__p=person;globalThis.__H=Human;',ctx);
(async()=>{await g.__H.load();let c={build:0,weight:0,muscle:.2,origin:'central',age:0,smile:.25,eyeNarrow:0};
for(const k of g.__H.FACE) if(!(k in c)) c[k]=0;
Object.assign(c,JSON.parse(process.argv[2]||'{}'));
let t=Date.now();const P=g.__p(c);console.log('person ms',Date.now()-t);t=Date.now();g.__p({...c,faceWidth:.5});console.log('face only',Date.now()-t);
console.log({S:P.S,E:P.E,W:P.W,K:P.K,A:P.A,eye:P.H.eye,nose:P.nose,temple:P.temple,earTop:P.earTop,lobe:P.lobe,rim:P.H.rim.length});
console.log(P.H.J);
const out={};
const W=160,fns={trunk:(x,y,z)=>P.torso(x,y,z,0),arm:P.arm,leg:P.leg,neck:P.neckline};
for(const n in fns){const a=[];for(let j=0;j<W;j++)for(let i=0;i<W;i++)a.push(fns[n](i/W*.45,1.65-j/W*1.0,0));out[n+'_xy']=a;const b=[];for(let j=0;j<W;j++)for(let i=0;i<W;i++)b.push(fns[n](n=='arm'?.2:n=='leg'?.09:.0,1.65-j/W*1.0,-.3+i/W*.6));out[n+'_zy']=b;}
fs.writeFileSync('slice.json',JSON.stringify(out))})();
