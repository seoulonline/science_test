// Exercise the game simulation without starting a browser or rendering frames.
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const drawing=new Proxy({}, {get:(_,key)=>()=>{},set:()=>true});
function element(){return {style:{},classList:{toggle(){},remove(){}},getContext:()=>drawing,getBoundingClientRect:()=>({width:1440,height:718}),addEventListener(){},replaceChildren(){},append(){},querySelector:()=>element()}}
const elements=new Map();const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,addEventListener(){},body:element()};
const sandbox={document,window:{addEventListener(){}},devicePixelRatio:1,performance:{now:()=>0},requestAnimationFrame(){},console};vm.createContext(sandbox);
vm.runInContext(readFileSync(join(__dirname,'../rts.js'),'utf8'),sandbox);
function test(name,script){vm.runInContext(script,sandbox);console.log('PASS:',name)}
sandbox.assert=assert;
test('resource gathering and production',`reset();started=true;paused=false;selected=[entities.find(e=>e.type==='hq'&&e.team===0)];train('worker');assert.equal(minerals,450);assert.equal(selected[0].queue.length,1);for(let i=0;i<600;i++)update(.025);assert.equal(entities.filter(e=>e.type==='worker').length,7);assert.ok(minerals>450);`);
test('construction, supply and gas production',`reset();started=true;paused=false;const w=entities.find(e=>e.type==='worker');selected=[w];mode='build';buildType='depot';place({x:820,y:1420});assert.equal(minerals,400);for(let i=0;i<1600;i++)update(.025);assert.equal(supply().max,32);reset();started=true;paused=false;selected=[entities.find(e=>e.type==='worker')];buildType='refinery';place({x:760,y:1120});for(let i=0;i<1600;i++)update(.025);assert.ok(gas>0);`);
test('insufficient resources and supply block production',`reset();selected=[entities.find(e=>e.type==='barracks'&&e.team===0)];minerals=0;train('marine');assert.equal(selected[0].queue.length,0);minerals=1000;for(let i=0;i<14;i++)add('marine',900+i,1100);train('marine');assert.equal(selected[0].queue.length,0);`);
test('ranged combat and area damage',`reset();started=true;paused=false;entities=[];const shooter=add('tank',500,500),target=add('marine',600,500,1),nearby=add('marine',610,510,1);shoot(shooter,target);assert.equal(target.hp,53);assert.equal(nearby.hp,81);assert.ok(shooter.cool>0);`);
test('victory and defeat on headquarters destruction',`reset();started=true;paused=false;entities.find(e=>e.team===1&&e.type==='hq').hp=0;update(.01);assert.equal(ended,true);assert.equal(paused,true);assert.equal(document.getElementById('status').textContent,'작전 성공');reset();started=true;paused=false;entities.find(e=>e.team===0&&e.type==='hq').hp=0;update(.01);assert.equal(ended,true);assert.equal(document.getElementById('status').textContent,'작전 실패');`);
test('enemy reinforcement and restart',`reset();started=true;paused=false;const before=entities.filter(e=>e.team===1).length;enemyClock=38;update(.1);assert.equal(enemyWave,1);assert.ok(entities.filter(e=>e.team===1).length>before);reset();assert.equal(ended,false);assert.equal(enemyWave,0);assert.equal(minerals,500);assert.equal(gas,0);`);
