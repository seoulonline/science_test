import test from 'node:test';
import assert from 'node:assert/strict';
import { solve, loopChanges } from '../physics.js';
const base = { voltage:12, r1:4, r2:6, r3:6, closed:true };
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10, `${a} ≠ ${b}`);
test('대칭 병렬 회로의 독립 계산 결과와 일치한다',()=>{
 const s=solve(base); near(s.total,7);near(s.i1,12/7);near(s.i2,6/7);near(s.i3,6/7);near(s.branchVoltage,36/7);
});
test('R₂를 늘리면 I₂는 줄지만 공통 저항으로 인해 I₃는 늘어난다',()=>{
 const a=solve(base), b=solve({...base,r2:12});near(b.i1,1.5);near(b.i2,.5);near(b.i3,1);assert.ok(b.i2<a.i2);assert.ok(b.i3>a.i3);
});
test('개방한 가지는 전류 0이고, 남은 가지의 전류와 전력은 증가한다',()=>{
 const s=solve({...base,closed:false});near(s.i3,0);near(s.i1,1.2);near(s.i2,1.2);near(s.branchVoltage,7.2);near(s.i2**2*6,8.64);
 assert.equal(loopChanges({...base,closed:false},'r3'),null);
});
test('다양한 전압·저항·스위치 조건에서 전하와 전력 및 고리 전위가 보존된다',()=>{
 for(const voltage of [2,12,24])for(const r1 of [1,4,20])for(const r2 of [1,6,20])for(const r3 of [1,6,20])for(const closed of [true,false]){
  const state={voltage,r1,r2,r3,closed};const s=solve(state);near(s.i1,s.i2+s.i3);near(s.sourcePower,s.resistorPower);near(s.kvlResidual,0);
  for(const branch of ['r2','r3'])if(closed||branch==='r2'){
   const f=loopChanges(state,branch),r=loopChanges(state,branch,true);near(f.reduce((a,b)=>a+b,0),0);near(r.reduce((a,b)=>a+b,0),0);f.forEach((v,i)=>near(v,-r[2-i]));
  }
 }
});
test('허용되지 않는 값은 계산하지 않는다',()=>{
 for(const state of [{...base,r1:0},{...base,r2:-1},{...base,voltage:Infinity},{...base,r3:NaN}])assert.throws(()=>solve(state),RangeError);
});
test('교과서 내부 저항 모형: I=ε/(R+r), 단자 전압 ε−Ir 및 전력 수지',()=>{
 const state={...base,internalR:1};const s=solve(state);
 near(s.externalResistance,7);near(s.total,8);near(s.i1,1.5);
 near(s.internalDrop,1.5);near(s.terminalVoltage,10.5);near(s.i2,.75);near(s.i3,.75);
 near(s.sourcePower,18);near(s.resistorPower,15.75);near(s.internalPower,2.25);
 near(s.totalDissipation,s.sourcePower);
 assert.deepEqual(loopChanges(state),[12,-1.5,-6,-4.5]);
 assert.deepEqual(loopChanges(state,'r2',true),[4.5,6,1.5,-12]);
});
test('내부 저항을 포함한 전하·전위·전력 보존과 순회 부호',()=>{
 for(const voltage of [0,2,12,24])for(const internalR of [0,.5,1,5])for(const r1 of [1,4,20])for(const r2 of [1,6,20])for(const r3 of [1,6,20])for(const closed of [true,false]){
  const state={voltage,internalR,r1,r2,r3,closed};const s=solve(state);
  near(s.i1,s.i2+s.i3);near(s.terminalVoltage,s.i1*s.externalResistance);
  near(s.sourcePower,s.resistorPower+s.internalPower);near(s.kvlResidual,0);
  assert.ok(s.terminalVoltage>=0&&s.terminalVoltage<=voltage+1e-10);
  for(const branch of ['r2','r3'])if(closed||branch==='r2'){
   const f=loopChanges(state,branch),r=loopChanges(state,branch,true);
   near(f.reduce((a,b)=>a+b,0),0);near(r.reduce((a,b)=>a+b,0),0);
   f.forEach((v,i)=>near(v,-r.at(-1-i)));
  }
 }
});
test('내부 저항의 음수·무한대·NaN 입력을 거부한다',()=>{
 for(const internalR of [-1,Infinity,NaN])assert.throws(()=>solve({...base,internalR}),RangeError);
});
