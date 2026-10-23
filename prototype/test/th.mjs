import { chromium } from 'playwright';import http from 'http';import fs from 'fs';import path from 'path';
const dir=process.cwd();const srv=http.createServer((q,s)=>{const f=path.join(dir,q.url==='/'?'page.html':q.url.split('?')[0].split('#')[0]);if(!fs.existsSync(f)){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':'text/html; charset=utf-8'});s.end(fs.readFileSync(f))}).listen(8769);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1200,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8769/#disp');await p.waitForTimeout(600);await p.click('.theme');await p.waitForTimeout(400);
await p.screenshot({path:'light-disp.png',fullPage:true});
await p.click('.tabs button[data-t="replay"]');await p.waitForTimeout(300);await p.screenshot({path:'light-replay.png',fullPage:true});
await p.click('.tabs button[data-t="trends"]');await p.waitForTimeout(300);await p.click('.ses[data-k="F"]');await p.waitForTimeout(300);await p.screenshot({path:'light-trends.png',fullPage:true});
await p.reload();await p.waitForTimeout(500);console.log('persisted',await p.evaluate(()=>document.documentElement.dataset.theme));
console.log('ERR',errs);await b.close();srv.close();
