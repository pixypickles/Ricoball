(() => {
"use strict";

const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");
const scoreEl=document.getElementById("scoreboard"),messageEl=document.getElementById("message");
const restartBtn=document.getElementById("restart"),joystick=document.getElementById("joystick"),stick=document.getElementById("stick");
const actionButtons=[...document.querySelectorAll(".action")];

const W=canvas.width,H=canvas.height;
const BORDER=42,CORNER=120,TARGET_R=145,MATCH=100;
const GRAVITY=1050,BOUNCE_Z=.63;
const teams=[
 {name:"RED",color:"#ff5262",side:"top",score:0},
 {name:"BLUE",color:"#3da2ff",side:"right",score:0},
 {name:"GREEN",color:"#46dc83",side:"bottom",score:0},
 {name:"YELLOW",color:"#ffd64f",side:"left",score:0}
];
const keys=new Set(),joy={x:0,y:0,id:null};
const held={a:false,b:false,c:false},pressAt={a:0,b:0,c:0};
let players=[],ball,started,last=performance.now(),gameOver=false,msgTimer=0;

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hypot=(x,y)=>Math.hypot(x,y)||1;
const now=()=>performance.now();

function makePlayer(team,x,y,human=false){
 return {team,x,y,z:0,vx:0,vy:0,vz:0,r:26,human,speed:human?275:225,
 faceX:0,faceY:-1,cool:0,slide:0,stun:0,hasBall:false};
}
function reset(){
 teams.forEach(t=>t.score=0);
 players=[
  makePlayer(0,W*.5,H*.72,true),
  makePlayer(1,W*.72,H*.5),
  makePlayer(2,W*.5,H*.28),
  makePlayer(3,W*.28,H*.5)
 ];
 ball={x:W/2,y:H/2,z:18,vx:70,vy:-30,vz:0,r:15,lastTouch:null,curve:0,curveTeam:null,lastScore:-9999,controlledBy:null};
 started=now();gameOver=false;messageEl.classList.remove("show");updateScore();
}
function updateScore(){
 scoreEl.innerHTML=teams.map((t,i)=>`<div class="score" style="--c:${t.color}"><small>${i===0?"YOU / ":""}${t.name}</small><strong>${t.score}</strong></div>`).join("");
}
function showMessage(s,ms=750){messageEl.textContent=s;messageEl.classList.add("show");msgTimer=ms;}
function targetCenter(side){
 if(side==="top")return{x:W/2,y:BORDER};
 if(side==="right")return{x:W-BORDER,y:H/2};
 if(side==="bottom")return{x:W/2,y:H-BORDER};
 return{x:BORDER,y:H/2};
}
function targetScore(offset){
 const d=Math.abs(offset);
 return d<TARGET_R*.30?6:d<TARGET_R*.64?4:2;
}
function scoreHit(targetTeam,offset,t){
 if(t-ball.lastScore<420||ball.lastTouch==null||Math.abs(offset)>TARGET_R)return;
 ball.lastScore=t;
 const pts=targetScore(offset),att=ball.lastTouch,minus=Math.floor(pts/2);
 if(att===targetTeam){
  teams[targetTeam].score=Math.max(0,teams[targetTeam].score-minus);
  showMessage(`OWN TARGET −${minus}`);
 }else{
  teams[att].score+=pts;
  teams[targetTeam].score=Math.max(0,teams[targetTeam].score-minus);
  showMessage(`${teams[att].name} +${pts} / ${teams[targetTeam].name} −${minus}`);
 }
 updateScore();
}

function roundedArenaClamp(o){
 const m=BORDER+o.r;
 o.x=clamp(o.x,m,W-m);o.y=clamp(o.y,m,H-m);
 const cs=[
  {cx:BORDER+CORNER,cy:BORDER+CORNER,sx:-1,sy:-1},
  {cx:W-BORDER-CORNER,cy:BORDER+CORNER,sx:1,sy:-1},
  {cx:W-BORDER-CORNER,cy:H-BORDER-CORNER,sx:1,sy:1},
  {cx:BORDER+CORNER,cy:H-BORDER-CORNER,sx:-1,sy:1}
 ];
 for(const c of cs){
  const inCorner=(c.sx<0?o.x<c.cx:o.x>c.cx)&&(c.sy<0?o.y<c.cy:o.y>c.cy);
  if(!inCorner)continue;
  const dx=o.x-c.cx,dy=o.y-c.cy,d=Math.hypot(dx,dy),rr=CORNER-o.r;
  if(d>rr){
   o.x=c.cx+dx/d*rr;o.y=c.cy+dy/d*rr;
   if("vx" in o){const dot=o.vx*dx/d+o.vy*dy/d;if(dot>0){o.vx-=1.85*dot*dx/d;o.vy-=1.85*dot*dy/d;}}
  }
 }
}

function nearBall(p,range=42){return Math.hypot(ball.x-p.x,ball.y-p.y)<p.r+ball.r+range&&Math.abs(ball.z-p.z)<90;}
function charge(action){return clamp((now()-pressAt[action])/900,0,1);}
function setPossession(p){
 if(ball.z<35&&nearBall(p,24)&&Math.hypot(ball.vx,ball.vy)<330){
  ball.controlledBy=p;p.hasBall=true;ball.lastTouch=p.team;return true;
 }
 return false;
}
function releaseBall(p){
 if(ball.controlledBy===p)ball.controlledBy=null;p.hasBall=false;
}
function shoot(p,type,power){
 releaseBall(p);
 let fx=p.faceX,fy=p.faceY;
 if(type==="curve"){
  // subtle auto-correction toward nearest opponent target
  let best=null,bd=1e9;
  teams.forEach((t,i)=>{if(i===p.team)return;const q=targetCenter(t.side),d=Math.hypot(q.x-ball.x,q.y-ball.y);if(d<bd){bd=d;best=q;}});
  if(best){const tx=best.x-ball.x,ty=best.y-ball.y,td=hypot(tx,ty);fx=fx*.72+tx/td*.28;fy=fy*.72+ty/td*.28;const fd=hypot(fx,fy);fx/=fd;fy/=fd;}
 }
 const speed=(type==="straight"?520:430)+(type==="straight"?430:300)*power;
 ball.vx=fx*speed+p.vx*.25;ball.vy=fy*speed+p.vy*.25;
 ball.vz=type==="curve"?180:115;
 ball.curve=type==="curve"?(p.team%2===0?1:-1)*(110+120*power):0;
 ball.curveTeam=p.team;ball.lastTouch=p.team;
 p.cool=.24;
}
function actionA(p,power=0){
 if(p.stun>0||p.cool>0)return;
 if(ball.z>48&&nearBall(p,50)){ // volley
  const d=hypot(ball.x-p.x,ball.y-p.y);releaseBall(p);
  ball.vx=(ball.x-p.x)/d*(600+330*power);ball.vy=(ball.y-p.y)/d*(600+330*power);ball.vz=120;ball.lastTouch=p.team;p.cool=.28;showMessage("VOLLEY!",420);return;
 }
 if(p.hasBall||ball.controlledBy===p){shoot(p,"straight",power);return;}
 if(setPossession(p))return;
 if(nearBall(p,18)){ball.vx+=p.faceX*260;ball.vy+=p.faceY*260;ball.lastTouch=p.team;p.cool=.22;}
}
function actionB(p,power=0){
 if(p.stun>0||p.cool>0)return;
 if(ball.z>60&&nearBall(p,48)){ // header
  releaseBall(p);ball.vx=p.faceX*(420+230*power);ball.vy=p.faceY*(420+230*power);ball.vz=250;ball.lastTouch=p.team;p.vz=260;p.cool=.32;showMessage("HEADER!",420);return;
 }
 if(p.hasBall||ball.controlledBy===p){shoot(p,"curve",power);return;}
 p.slide=.42;p.cool=.8;p.vx=p.faceX*560;p.vy=p.faceY*560;
}
function actionC(p){
 if(p.stun>0||p.z>2)return;
 p.vz=430;
 if(ball.z>38&&nearBall(p,34)){ball.controlledBy=p;p.hasBall=true;ball.vx=ball.vy=0;ball.vz=0;ball.z=28;ball.lastTouch=p.team;showMessage("JUMP TRAP!",420);}
}
function resolveActionRelease(action,p){
 const power=charge(action);held[action]=false;
 if(action==="a")actionA(p,power);
 if(action==="b")actionB(p,power);
 if(action==="c")actionC(p);
 document.querySelector(`.action.${action} i`).style.height="0%";
}
function inputHuman(p,dt){
 let x=joy.x,y=joy.y;
 if(keys.has("ArrowLeft")||keys.has("KeyA"))x-=1;
 if(keys.has("ArrowRight")||keys.has("KeyD"))x+=1;
 if(keys.has("ArrowUp")||keys.has("KeyW"))y-=1;
 if(keys.has("ArrowDown")||keys.has("KeyS"))y+=1;
 let m=Math.hypot(x,y);if(m>1){x/=m;y/=m;}
 const speed=p.slide>0?0:p.speed*(held.a||held.b?.78:1);
 if(p.stun<=0){p.vx=x*speed;p.vy=y*speed;}
 if(m>.08){p.faceX=x;p.faceY=y;}
 p.x+=p.vx*dt;p.y+=p.vy*dt;roundedArenaClamp(p);
}
function ai(p,dt){
 if(p.stun>0)return;
 const own=targetCenter(teams[p.team].side);
 let tx=ball.x,ty=ball.y;
 const threat=Math.hypot(ball.x-own.x,ball.y-own.y)<310;
 if(!threat&&Math.hypot(ball.x-p.x,ball.y-p.y)>330){tx=own.x+(ball.x-own.x)*.5;ty=own.y+(ball.y-own.y)*.5;}
 const dx=tx-p.x,dy=ty-p.y,d=hypot(dx,dy);
 p.faceX=dx/d;p.faceY=dy/d;
 if(p.slide<=0){p.vx=p.faceX*p.speed;p.vy=p.faceY*p.speed;}
 p.x+=p.vx*dt;p.y+=p.vy*dt;roundedArenaClamp(p);
 if(nearBall(p,28)&&p.cool<=0){
  if(setPossession(p)){
   let best=null,bd=1e9;
   teams.forEach((t,i)=>{if(i===p.team)return;const q=targetCenter(t.side),dd=Math.hypot(q.x-p.x,q.y-p.y);if(dd<bd){bd=dd;best=q;}});
   if(best){const dx2=best.x-p.x,dy2=best.y-p.y,dd=hypot(dx2,dy2);p.faceX=dx2/dd;p.faceY=dy2/dd;shoot(p,Math.random()<.38?"curve":"straight",.35+Math.random()*.55);}
  }else if(Math.random()<.4) actionB(p,0);
 }
 if(ball.z>55&&nearBall(p,55)&&p.cool<=0)(Math.random()<.5?actionA:actionB)(p,.35);
}
function playerPhysics(p,dt){
 p.cool=Math.max(0,p.cool-dt);p.slide=Math.max(0,p.slide-dt);p.stun=Math.max(0,p.stun-dt);
 if(p.z>0||p.vz>0){p.vz-=GRAVITY*dt;p.z+=p.vz*dt;if(p.z<0){p.z=0;p.vz=0;}}
 if(p.slide<=0&&p.stun<=0){p.vx*=Math.pow(.77,dt*60);p.vy*=Math.pow(.77,dt*60);}
}
function collisions(){
 for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){
  const a=players[i],b=players[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),md=a.r+b.r;
  if(d>0&&d<md&&Math.abs(a.z-b.z)<42){
   const nx=dx/d,ny=dy/d,push=(md-d)/2;a.x-=nx*push;a.y-=ny*push;b.x+=nx*push;b.y+=ny*push;
   const slider=a.slide>0?a:b.slide>0?b:null,victim=slider===a?b:slider===b?a:null;
   if(slider&&victim&&victim.stun<=0){victim.stun=.38;victim.vx=nx*(slider===a?250:-250);victim.vy=ny*(slider===a?250:-250);if(ball.controlledBy===victim){releaseBall(victim);ball.vx=slider.faceX*420;ball.vy=slider.faceY*420;ball.vz=120;ball.lastTouch=slider.team;showMessage("STEAL!",400);}}
  }
 }
}
function updateBall(dt,t){
 if(ball.controlledBy){
  const p=ball.controlledBy;
  ball.x=p.x+p.faceX*(p.r+13);ball.y=p.y+p.faceY*(p.r+13);ball.z=p.z+22;ball.vx=p.vx;ball.vy=p.vy;return;
 }
 ball.vx+=-ball.vy*ball.curve*.0014*dt*60;
 ball.vy+= ball.vx*ball.curve*.0014*dt*60;
 ball.curve*=Math.pow(.985,dt*60);
 ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;ball.z+=ball.vz*dt;ball.vz-=GRAVITY*dt;
 if(ball.z<0){ball.z=0;if(Math.abs(ball.vz)>80)ball.vz=-ball.vz*BOUNCE_Z;else ball.vz=0;ball.vx*=.90;ball.vy*=.90;}
 ball.vx*=Math.pow(.989,dt*60);ball.vy*=Math.pow(.989,dt*60);

 // flat target plane, visually tilted: valid hits rebound inward and upward
 const hit=(team,offset,nx,ny)=>{
  if(Math.abs(offset)<=TARGET_R&&ball.z<TARGET_R*1.12){
   scoreHit(team,offset,t);
   const speed=Math.hypot(ball.vx,ball.vy);
   ball.vx=nx*Math.max(250,speed*.82)+(offset/TARGET_R)*110*(ny!==0?1:0);
   ball.vy=ny*Math.max(250,speed*.82)+(offset/TARGET_R)*110*(nx!==0?1:0);
   ball.vz=Math.max(250,170+speed*.28);
   return true;
  }
  return false;
 };
 if(ball.y-ball.r<BORDER){if(!hit(0,ball.x-W/2,0,1)){ball.y=BORDER+ball.r;ball.vy=Math.abs(ball.vy)*.86;}}
 if(ball.x+ball.r>W-BORDER){if(!hit(1,ball.y-H/2,-1,0)){ball.x=W-BORDER-ball.r;ball.vx=-Math.abs(ball.vx)*.86;}}
 if(ball.y+ball.r>H-BORDER){if(!hit(2,ball.x-W/2,0,-1)){ball.y=H-BORDER-ball.r;ball.vy=-Math.abs(ball.vy)*.86;}}
 if(ball.x-ball.r<BORDER){if(!hit(3,ball.y-H/2,1,0)){ball.x=BORDER+ball.r;ball.vx=Math.abs(ball.vx)*.86;}}
 roundedArenaClamp(ball);
}
function drawTarget(team){
 const side=teams[team].side,c=targetCenter(side);
 ctx.save();ctx.translate(c.x,c.y);
 if(side==="top")ctx.rotate(0);
 if(side==="right")ctx.rotate(Math.PI/2);
 if(side==="bottom")ctx.rotate(Math.PI);
 if(side==="left")ctx.rotate(-Math.PI/2);
 ctx.scale(1,.42); // ellipse/perspective tilt
 for(const [r,col] of [[TARGET_R,"#f4f4ef"],[TARGET_R*.64,"#f4c744"],[TARGET_R*.30,"#9a62ff"]]){
  ctx.beginPath();ctx.fillStyle=col;ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(14,17,23,.72)";ctx.lineWidth=8;ctx.stroke();
 }
 ctx.restore();
}
function draw(){
 ctx.clearRect(0,0,W,H);ctx.fillStyle="#19784a";ctx.fillRect(0,0,W,H);
 for(let i=0;i<10;i++){ctx.fillStyle=i%2?"rgba(255,255,255,.025)":"rgba(0,0,0,.025)";ctx.fillRect(i*W/10,0,W/10,H);}
 // rounded boundary
 ctx.strokeStyle="rgba(255,255,255,.76)";ctx.lineWidth=6;
 ctx.beginPath();ctx.roundRect(BORDER,BORDER,W-2*BORDER,H-2*BORDER,CORNER);ctx.stroke();
 ctx.beginPath();ctx.moveTo(W/2,BORDER+20);ctx.lineTo(W/2,H-BORDER-20);ctx.moveTo(BORDER+20,H/2);ctx.lineTo(W-BORDER-20,H/2);ctx.stroke();
 ctx.beginPath();ctx.arc(W/2,H/2,92,0,Math.PI*2);ctx.stroke();
 for(let i=0;i<4;i++)drawTarget(i);
 // shadows, players
 for(const p of players){
  const sh=1-clamp(p.z/250,0,.55);
  ctx.beginPath();ctx.fillStyle="rgba(0,0,0,.22)";ctx.ellipse(p.x,p.y+12,p.r*sh,p.r*.42*sh,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.fillStyle=teams[p.team].color;ctx.arc(p.x,p.y-p.z*.32,p.r,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="#fff";ctx.lineWidth=p.human?6:3;ctx.stroke();
  ctx.beginPath();ctx.moveTo(p.x,p.y-p.z*.32);ctx.lineTo(p.x+p.faceX*36,p.y-p.z*.32+p.faceY*36);ctx.strokeStyle="rgba(255,255,255,.85)";ctx.lineWidth=5;ctx.stroke();
 }
 const by=ball.y-ball.z*.45;
 ctx.beginPath();ctx.fillStyle="rgba(0,0,0,.24)";ctx.ellipse(ball.x,ball.y+8,ball.r*(1-clamp(ball.z/350,0,.55)),ball.r*.38,0,0,Math.PI*2);ctx.fill();
 ctx.beginPath();ctx.fillStyle="#fff";ctx.arc(ball.x,by,ball.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#171a20";ctx.lineWidth=4;ctx.stroke();
 const rem=Math.max(0,MATCH-(now()-started)/1000);
 ctx.fillStyle="rgba(8,11,17,.72)";ctx.fillRect(W/2-74,H/2-29,148,58);ctx.fillStyle="#fff";ctx.font="900 34px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(Math.ceil(rem),W/2,H/2);
 if(rem<=0&&!gameOver){gameOver=true;const top=Math.max(...teams.map(t=>t.score));showMessage(`${teams.filter(t=>t.score===top).map(t=>t.name).join(" & ")} WINS!`,999999);}
}
function loop(t){
 const dt=Math.min(.033,(t-last)/1000);last=t;
 if(!gameOver){
  players.forEach(p=>{playerPhysics(p,dt);p.human?inputHuman(p,dt):ai(p,dt);});
  collisions();updateBall(dt,t);
 }
 for(const a of ["a","b"]){if(held[a])document.querySelector(`.action.${a} i`).style.height=`${charge(a)*100}%`;}
 if(msgTimer>0&&msgTimer<999999){msgTimer-=dt*1000;if(msgTimer<=0)messageEl.classList.remove("show");}
 draw();requestAnimationFrame(loop);
}

// touch joystick
function joyMove(x,y){
 const r=joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=r.width*.30;
 let dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy);if(d>max){dx=dx/d*max;dy=dy/d*max;}
 joy.x=dx/max;joy.y=dy/max;stick.style.transform=`translate(${dx}px,${dy}px)`;
}
joystick.addEventListener("pointerdown",e=>{joy.id=e.pointerId;joystick.setPointerCapture(e.pointerId);joyMove(e.clientX,e.clientY);});
joystick.addEventListener("pointermove",e=>{if(e.pointerId===joy.id)joyMove(e.clientX,e.clientY);});
function joyEnd(e){if(e.pointerId!==joy.id)return;joy.id=null;joy.x=joy.y=0;stick.style.transform="translate(0,0)";}
joystick.addEventListener("pointerup",joyEnd);joystick.addEventListener("pointercancel",joyEnd);

actionButtons.forEach(btn=>{
 const a=btn.dataset.action;
 btn.addEventListener("pointerdown",e=>{e.preventDefault();held[a]=true;pressAt[a]=now();btn.setPointerCapture(e.pointerId);if(a==="c")resolveActionRelease("c",players[0]);});
 btn.addEventListener("pointerup",e=>{e.preventDefault();if(a!=="c"&&held[a])resolveActionRelease(a,players[0]);});
 btn.addEventListener("pointercancel",()=>{held[a]=false;});
});
const keyMap={KeyJ:"a",KeyK:"b",KeyL:"c"};
window.addEventListener("keydown",e=>{
 keys.add(e.code);
 if(keyMap[e.code]&&!held[keyMap[e.code]]){const a=keyMap[e.code];held[a]=true;pressAt[a]=now();if(a==="c")resolveActionRelease("c",players[0]);}
 if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();
});
window.addEventListener("keyup",e=>{keys.delete(e.code);const a=keyMap[e.code];if(a&&a!=="c"&&held[a])resolveActionRelease(a,players[0]);});
restartBtn.addEventListener("click",reset);

reset();requestAnimationFrame(loop);
})();