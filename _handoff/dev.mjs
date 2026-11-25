import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
const R=path.join(import.meta.dirname,'../src/main/resources/static');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.bin':'application/octet-stream'};
http.createServer((q,s)=>{const u=q.url.split('?')[0];
if(u.startsWith('/api')){const p=http.request({host:'127.0.0.1',port:8094,path:q.url,method:q.method,headers:q.headers},r=>{s.writeHead(r.statusCode,r.headers);r.pipe(s)});p.on('error',()=>{s.writeHead(502);s.end()});q.pipe(p);return}
const f=R+(u==='/'?'/index.html':u);if(!fs.existsSync(f)){s.writeHead(404);return s.end()}
s.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:"});fs.createReadStream(f).pipe(s)}).listen(8196,'127.0.0.1');
