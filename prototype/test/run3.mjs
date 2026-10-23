import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const dir=process.cwd();
const srv=http.createServer((q,s)=>{const f=path.join(dir,q.url==='/'?'page.html':q.url.split('?')[0].split('#')[0]);if(!fs.existsSync(f)){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':'text/html; charset=utf-8'});s.end(fs.readFileSync(f))}).listen(8767);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const errs=[];
for(const vp of [{width:1200,height:900},{width:390,height:800}]){
 const p=await b.newPage({viewport:vp});p.on('pageerror',e=>errs.push(vp.width+' PAGEERROR: '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
 await p.goto('http://localhost:8767/');await p.waitForTimeout(1000);
 for(const t of ['compare','trends','disp','notes','replay']){await p.click(`.tabs button[data-t="${t}"]`);await p.waitForTimeout(300);
   const sw=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);console.log(vp.width,t,'overflow',sw);}
 const sel=async(id,v)=>{await p.selectOption('#'+id,v);await p.waitForTimeout(250)};
 const chk=async(id)=>{await p.click(`label:has(#${id})`);await p.waitForTimeout(150)};
 for(const m of ['race','h2h','spray','all','best']){await sel('mode',m);const card=await p.evaluate(()=>document.getElementById('card').innerText.slice(0,90).replace(/\n/g,' | '));const cols=await p.evaluate(()=>getComputedStyle(document.getElementById('view')).gridTemplateColumns.split(' ').length);console.log(vp.width,'mode',m,'cols',cols,'card:',card)}
 await p.click('#sesbtn');await p.click('#sesmenu input[data-k="H"]');await p.click('#sesmenu [data-act="r9"]');console.log('seslbl',await p.evaluate(()=>document.getElementById('seslbl').textContent+' | '+document.getElementById('shot').options.length));await p.click('#sesmenu [data-act="all"]');await p.click('body',{position:{x:5,y:5}});await chk('donly');await p.waitForTimeout(200);await chk('donly');await sel('cam','landing');await chk('orbit');await chk('orbit');await chk('only');await chk('disp');await sel('fw','40');await chk('fwon');await chk('pdel');
 console.log('cols after pdel off',await p.evaluate(()=>getComputedStyle(document.getElementById('view')).gridTemplateColumns.split(' ').length));
 await chk('pdel');await chk('trails');await chk('auto');
 await p.click('#nx');await p.click('#pv');await sel('shot','H:13');console.log('info',await p.evaluate(()=>document.getElementById('info').textContent.slice(0,60)));
 await sel('mode','h2h');await sel('ha','E:best');console.log('ga synced',await p.evaluate(()=>document.getElementById('ga').value));
 await p.click('.tabs button[data-t="trends"]');await p.waitForTimeout(200);await p.click('.ses[data-k="H"]');await p.waitForTimeout(200);
 console.log('detail',await p.evaluate(()=>document.getElementById('detail').hidden+' '+document.getElementById('detail').innerText.slice(0,80).replace(/\n/g,' | ')));
 await p.screenshot({path:`s3-${vp.width}-trends.png`,fullPage:true});
 await p.click('#detail [data-open]');await p.waitForTimeout(300);console.log('opened',await p.evaluate(()=>location.hash+' '+document.getElementById('seslbl').textContent));
 await p.click('.tabs button[data-t="disp"]');await p.waitForTimeout(300);await p.hover('#cl',{position:{x:vp.width>600?400:150,y:300}});await p.waitForTimeout(100);console.log('tip',await p.evaluate(()=>document.getElementById('tipl').style.display+' '+document.getElementById('tipl').innerText.slice(0,50)));await p.screenshot({path:`s3-${vp.width}-disp.png`,fullPage:true});await p.click('#sesbtn2');await p.click('#sesmenu2 [data-act="qi"]');await p.click('body',{position:{x:5,y:5}});await chk('smo');await sel('lmet','0');await chk('smd');await chk('smr');await chk('smr');await chk('smd');await p.screenshot({path:`s3-${vp.width}-disp2.png`,fullPage:true});
 await p.click('.tabs button[data-t="notes"]');await p.waitForTimeout(200);await p.screenshot({path:`s3-${vp.width}-notes.png`,fullPage:true});
 await p.click('.tl [data-open="D"]');await p.waitForTimeout(300);console.log('notes open',await p.evaluate(()=>location.hash+' '+document.getElementById('seslbl').textContent));
 await sel('mode','spray');await p.screenshot({path:`s3-${vp.width}-replay.png`,fullPage:true});
 await p.close();
}
console.log('ERRORS',errs);await b.close();srv.close();
