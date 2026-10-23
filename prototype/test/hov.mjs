import { chromium } from 'playwright';import http from 'http';import fs from 'fs';import path from 'path';
const dir=process.cwd();const srv=http.createServer((q,s)=>{const f=path.join(dir,q.url==='/'?'page.html':q.url.split('?')[0].split('#')[0]);if(!fs.existsSync(f)){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':'text/html; charset=utf-8'});s.end(fs.readFileSync(f))}).listen(8768);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1200,height:900}});
await p.goto('http://localhost:8768/#disp');await p.waitForTimeout(800);
for(const pt of [{x:300,y:170},{x:312,y:250},{x:470,y:200},{x:460,y:290}]){await p.hover('#cl',{position:pt});await p.waitForTimeout(80);console.log(pt,await p.evaluate(()=>document.getElementById('tipl').style.display+' '+document.getElementById('tipl').innerText.replace(/\n/g,' | ').slice(0,80)))}
await p.hover('#cs',{position:{x:300,y:260}});await p.waitForTimeout(80);console.log('cs',await p.evaluate(()=>document.getElementById('tips').style.display+' '+document.getElementById('tips').innerText.replace(/\n/g,' | ').slice(0,80)));
await p.screenshot({path:'hov.png',clip:{x:0,y:440,width:1200,height:620}});await b.close();srv.close();
