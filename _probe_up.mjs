import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'fs'; import path from 'path';
const ROOT = process.cwd();
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const vc = new VirtualConsole();
const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously', virtualConsole: vc,
  beforeParse(w) { w.requestAnimationFrame = () => 0; w.cancelAnimationFrame = () => {}; } });
const w = dom.window, doc = w.document;
const ORDER = []; const re = /<script src="([^"]+)"><\/script>/g; let m;
while ((m = re.exec(html))) ORDER.push(m[1]);
for (const f of ORDER) w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const BS = w.BS;
BS.bus.startKit();
BS.shop.clear(); BS.shop.place(0, [3, 2], 0);
const s = BS.shop.submit();
const r = BS.run.newRun(777, []);
let spot = null;
for (let y = 0; y < BS.td.ROWS && !spot; y++) for (let x = 0; x < BS.td.COLS && !spot; x++)
  if (BS.td.deployOk(BS.td.start({ seed: r.seed, turrets: [] }), [x, y]) === '') spot = [x, y];
BS.run.add(r, s.rec.id, spot);
BS.run.begin(r);
let g = 0; while (r.battle.enemies.length === 0 && g++ < 80) BS.td.tickOnce(r.battle);
r.battle.lux = 500;
const t = r.battle.towers[0];
const lv0 = t.level, lux0 = r.battle.lux;
BS.app.go('battle');
// 选中这座塔：点格子
const cell = doc.querySelector('#panel [data-c][data-t]');
console.log('找到带塔格子:', !!cell, cell && cell.getAttribute('data-t'));
if (cell) cell.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const lv1 = t.level, lux1 = r.battle.lux;
console.log('选中前: lv=' + lv0 + ' lux=' + lux0);
console.log('选中后: lv=' + lv1 + ' lux=' + lux1, '（选中这一下本身会 render 一次）');
await new Promise(res => setTimeout(res, 1200));
const lv2 = t.level, lux2 = r.battle.lux;
console.log('放 1.2 秒（时钟在跑，玩家什么都没点）: lv=' + lv2 + ' lux=' + lux2);
console.log('面板里该塔的等级读数:', (doc.getElementById('panel').textContent.match(/击杀[^0-9]*([0-9,]+)/) || [])[1]);
console.log('VERDICT:', lv2 > lv1 ? '★ 自动升级了（bug 确认）' : '等级没自己动');
