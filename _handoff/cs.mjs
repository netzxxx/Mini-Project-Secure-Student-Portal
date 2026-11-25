// usage: node cs.mjs jobs.json   jobs: [{name, cfg, view, only, w, h, yaw, page, js, wait}]
import { spawn } from 'node:child_process';import fs from 'node:fs';
const OUT=import.meta.dirname+'/';const wait=ms=>new Promise(r=>setTimeout(r,ms));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=9344','--user-data-dir='+process.env.TEMP+'/cs-profile','--no-proxy-server','--hide-scrollbars','--no-first-run','--use-angle=d3d11','--ignore-gpu-blocklist','about:blank'],{stdio:'ignore'});
let l;for(let i=0;i<40;i++){try{l=await(await fetch('http://127.0.0.1:9344/json')).json();if(l.length)break}catch{}await wait(300)}
const ws=new WebSocket(l.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const pend={};
ws.onmessage=m=>{const d=JSON.parse(m.data);if(pend[d.id]){pend[d.id](d.result);delete pend[d.id]}
if(d.method==='Runtime.exceptionThrown')console.log('EXC',d.params.exceptionDetails.exception?.description?.slice(0,900));
if(d.method==='Log.entryAdded')console.log('LOG',d.params.entry.text.slice(0,300));};
const send=(method,params={})=>new Promise(r=>{pend[++id]=r;ws.send(JSON.stringify({id,method,params}))});
const js=async e=>(await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true})).result?.value;
await send('Runtime.enable');await send('Log.enable');
const go=async u=>{await send('Page.navigate',{url:'http://127.0.0.1:8196'+u});await wait(1200)};
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
await go('/');console.log(await js(`fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'student_a',password:'Student#2026'})}).then(r=>r.json()).then(r=>{sessionStorage.setItem('portal.token',r.token);return r.user.username})`));
for(const t of JSON.parse(fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,''))){
 await send('Emulation.setDeviceMetricsOverride',{width:t.w||900,height:t.h||900,deviceScaleFactor:1,mobile:false});
 await js(`localStorage.setItem('portal.character.student_a',${JSON.stringify(JSON.stringify(t.cfg||{}))})`);
 const t0=Date.now();await go('/app.html?'+Math.random()+'#'+(t.page||'grades'));
 for(let i=0;i<250;i++){if(await js(`!!document.querySelector('.avatar')&&!document.querySelector('.busy')`))break;await wait(150)}
 console.log(t.name,'built',Date.now()-t0);
 if(t.view){await js(`document.getElementById('char-open').click()`);await wait(200);
  if(t.only)await js(`document.querySelectorAll('.char-sections,.char-side,.char-bar').forEach(n=>n.classList.add('hidden'));document.getElementById('char-stage').style.gridColumn='1/-1'`);
  await js(`document.querySelector('[data-view=${t.view}]').click()`);
  if(t.yaw)await js(`(()=>{const c=document.querySelector('.avatar');c.setPointerCapture=()=>{};const f=(n,x)=>c.dispatchEvent(new PointerEvent(n,{pointerId:1,clientX:x,clientY:300,bubbles:true}));f('pointerdown',400);f('pointermove',${400-t.yaw/.009});f('pointerup',400)})()`)}
 if(t.js)console.log(await js(t.js));await wait(t.wait||1800);
 const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(OUT+t.name+'.png',Buffer.from(r.data,'base64'));}
await send('Browser.close');process.exit(0);
