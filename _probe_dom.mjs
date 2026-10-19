import fs from 'fs'; import path from 'path';
const ROOT='E:/__SOMETHING_REAL__/AI_Work/TemplaTD';
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
import { JSDOM, VirtualConsole } from 'jsdom';
const vc=new VirtualConsole();
const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'dangerously',resources:undefined,virtualConsole:vc,beforeParse(w){w.requestAnimationFrame=()=>0;w.cancelAnimationFrame=()=>{};}});
const w=dom.window;
const ORDER=[]; const re=/<script src="([^"]+)"><\/script>/g; let m;
while((m=re.exec(html))) ORDER.push(m[1]);
for(const f of ORDER) w.eval(fs.readFileSync(path.join(ROOT,f),'utf8'));
const BS=w.BS;
BS.shop.clear(); BS.shop.place(0,[3,2],0);
const s=BS.shop.submit();
const r=BS.run.newRun(20261013);
BS.run.add(r, s.rec.id, [2,2]);
BS.run.begin(r);
let g=0; while(r.battle.enemies.length===0&&g++<80) BS.td.tickOnce(r.battle);
for(let i=0;i<6;i++) BS.td.tickOnce(r.battle);
BS.app.go('battle');
for(const mm of BS.reg.list()) if(mm.tick) mm.tick(16);
const P=w.document.getElementById('panel');
console.log('svg count in panel:', P.querySelectorAll('svg').length);
for(const sv of P.querySelectorAll('svg')){
  const cls=sv.getAttribute('class');
  const par=sv.parentElement;
  console.log(' svg class='+cls, 'parent='+(par?par.className:'?'), 'viewBox='+sv.getAttribute('viewBox'),
    'parentDataC='+(par?par.getAttribute('data-c'):'?'));
}
console.log('beams:', r.battle.beams.length);
console.log('cells with .t:', P.querySelectorAll('.bgrid .cell.t').length);
