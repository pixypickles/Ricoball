(() => {
"use strict";

const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");
const scoreEl=document.getElementById("scoreboard"),messageEl=document.getElementById("message");
const restartBtn=document.getElementById("restart"),joystick=document.getElementById("joystick"),stick=document.getElementById("stick");
const actionButtons=[...document.querySelectorAll(".action")];

const W=canvas.width,H=canvas.height;
const BORDER=42,CORNER=126,TARGET_R=145,MATCH=100;
const GRAVITY=1250;
const teams=[
 {name:"RED",color:"#ff5262",side:"top",score:0},
 {name:"BLUE",color:"#3da2ff",side:"right",score:0},
 {name:"GREEN",color:"#46dc83",side:"bottom",score:0},
 {name:"YELLOW",color:"#ffd64f",side:"left",score:0}
];

const keys=new Set(),joy={x:0,y:0,id:null},held={a:false,b:false,c:false},pressAt={a:0,b:0,c:0};
let players=[],ball,started,last=performance.now(),gameOver=false,msgTimer=0,shake=0,hitStop=0;

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const norm=(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d,d}};
const now=()=>performance.now();

function makePlayer(team,x,y,human=false,role="chaser"){
 return {
  team,x,y,z:0,vx:0,vy:0,vz:0,r:28,human,role,
  speed:human?285:235,faceX:0,faceY:-1,cool:0,stun:0,
  action:"idle",actionT:0,walkT:Math.random()*10,slideDirX:0,slideDirY:0,
  targetX:x,targetY:y
 };
}
function reset(){
 teams.forEach(t=>t.score=0);
 players=[
  makePlayer(0,W*.5,H*.73,true,"human"),
  makePlayer(1,W*.77,H*.5,false,"defender"),
  makePlayer(2,W*.5,H*.23,false,"chaser"),
  makePlayer(3,W*.23,H*.5,false,"interceptor")
 ];
 ball={x:W/2,y:H/2,z:50,vx:330,vy:-180,vz:250,r:15,lastTouch:null,curve:0,lastScore:-9999};
 started=now();gameOver=false;shake=0;hitStop=0;messageEl.classList.remove("show");updateScore();
}
function updateScore(){
 scoreEl.innerHTML=teams.map((t,i)=>`<div class="score" style="--c:${t.color}"><small>${i===0?"YOU / ":""}${t.name}</small><strong>${t.score}</strong></div>`).join("");
}
function showMessage(s,ms=650){messageEl.textContent=s;messageEl.classList.add("show");msgTimer=ms;}
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
 shake=pts===6?18:11;hitStop=.055;updateScore();
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
  const inside=(c.sx<0?o.x<c.cx:o.x>c.cx)&&(c.sy<0?o.y<c.cy:o.y>c.cy);
  if(!inside)continue;
  const dx=o.x-c.cx,dy=o.y-c.cy,d=Math.hypot(dx,dy),rr=CORNER-o.r;
  if(d>rr){
   const nx=dx/d,ny=dy/d;o.x=c.cx+nx*rr;o.y=c.cy+ny*rr;
   if("vx" in o){const dot=o.vx*nx+o.vy*ny;if(dot>0){o.vx-=1.9*dot*nx;o.vy-=1.9*dot*ny;}}
  }
 }
}

function nearBall(p,range=40){return Math.hypot(ball.x-p.x,ball.y-p.y)<p.r+ball.r+range&&Math.abs(ball.z-p.z)<95;}
function charge(a){return clamp((now()-pressAt[a])/900,0,1);}
function setAction(p,a,d){p.action=a;p.actionT=d;}
function kickBall(p,type,power){
 const aim=norm(p.faceX,p.faceY);let fx=aim.x,fy=aim.y;
 if(type==="curve"){
  let best=null,bd=1e9;
  teams.forEach((t,i)=>{if(i===p.team)return;const q=targetCenter(t.side),d=Math.hypot(q.x-ball.x,q.y-ball.y);if(d<bd){bd=d;best=q;}});
  if(best){const t=norm(best.x-ball.x,best.y-ball.y);fx=fx*.68+t.x*.32;fy=fy*.68+t.y*.32;const n=norm(fx,fy);fx=n.x;fy=n.y;}
 }
 const speed=(type==="straight"?680:560)+(type==="straight"?520:380)*power;
 ball.vx=fx*speed+p.vx*.18;ball.vy=fy*speed+p.vy*.18;ball.vz=220+90*power;
 ball.curve=type==="curve"?(p.team%2===0?1:-1)*(170+120*power):0;ball.lastTouch=p.team;
 setAction(p,"kick",.34);p.cool=.28;shake=4;
}
function shoulder(p){
 if(p.cool>0||p.stun>0)return;
 setAction(p,"shoulder",.28);p.cool=.48;
 p.vx=p.faceX*620;p.vy=p.faceY*620;
 p.slideDirX=p.faceX;p.slideDirY=p.faceY;
}
function slide(p){
 if(p.cool>0||p.stun>0)return;
 setAction(p,"slide",.52);p.cool=1.05;
 p.vx=p.faceX*760;p.vy=p.faceY*760;
 p.slideDirX=p.faceX;p.slideDirY=p.faceY;
}
function jump(p){
 if(p.z>1||p.stun>0)return;
 p.vz=470;setAction(p,"jump",.62);
 if(ball.z>42&&nearBall(p,42)){ball.vx*=.42;ball.vy*=.42;ball.vz=Math.max(90,ball.vz*.35);showMessage("TRAP!",360);}
}
function actionA(p,power=0){
 if(p.stun>0||p.cool>0)return;
 if(ball.z>58&&nearBall(p,50)){
  ball.vx=p.faceX*(760+260*power);ball.vy=p.faceY*(760+260*power);ball.vz=180;ball.lastTouch=p.team;
  setAction(p,"volley",.45);p.cool=.38;showMessage("VOLLEY!",400);return;
 }
 if(nearBall(p,30)){kickBall(p,"straight",power);return;}
 shoulder(p);
}
function actionB(p,power=0){
 if(p.stun>0||p.cool>0)return;
 if(ball.z>72&&nearBall(p,46)){
  ball.vx=p.faceX*(560+230*power);ball.vy=p.faceY*(560+230*power);ball.vz=300;ball.lastTouch=p.team;
  p.vz=270;setAction(p,"header",.42);p.cool=.38;showMessage("HEADER!",400);return;
 }
 if(nearBall(p,30)){kickBall(p,"curve",power);return;}
 slide(p);
}
function actionC(p){jump(p);}
function releaseAction(a,p){
 const power=charge(a);held[a]=false;
 if(a==="a")actionA(p,power);
 if(a==="b")actionB(p,power);
 if(a==="c")actionC(p);
 document.querySelector(`.action.${a} i`).style.height="0%";
}

function humanInput(p,dt){
 let x=joy.x,y=joy.y;
 if(keys.has("ArrowLeft")||keys.has("KeyA"))x-=1;
 if(keys.has("ArrowRight")||keys.has("KeyD"))x+=1;
 if(keys.has("ArrowUp")||keys.has("KeyW"))y-=1;
 if(keys.has("ArrowDown")||keys.has("KeyS"))y+=1;
 let m=Math.hypot(x,y);if(m>1){x/=m;y/=m;}
 if(p.action!=="slide"&&p.action!=="shoulder"&&p.stun<=0){
  const s=p.speed*(held.a||held.b?.78:1);p.vx=x*s;p.vy=y*s;
 }
 if(m>.08){p.faceX=x;p.faceY=y;}
 p.x+=p.vx*dt;p.y+=p.vy*dt;roundedArenaClamp(p);
}

function predictBall(seconds=.45){return{x:ball.x+ball.vx*seconds,y:ball.y+ball.vy*seconds,z:Math.max(0,ball.z+ball.vz*seconds-.5*GRAVITY*seconds*seconds)};}
function aiTarget(p){
 const own=targetCenter(teams[p.team].side);
 const pred=predictBall(.48);
 if(p.role==="defender"){
  const dOwn=Math.hypot(ball.x-own.x,ball.y-own.y);
  return dOwn<390?{x:pred.x,y:pred.y}:{x:own.x+(W/2-own.x)*.34,y:own.y+(H/2-own.y)*.34};
 }
 if(p.role==="interceptor"){
  const mid={x:(pred.x+W/2)/2,y:(pred.y+H/2)/2};
  return {x:mid.x,y:mid.y};
 }
 return {x:pred.x,y:pred.y};
}
function nearestChaser(){
 let best=null,bd=1e9;
 for(const p of players.filter(p=>!p.human)){
  const d=Math.hypot(p.x-ball.x,p.y-ball.y);
  if(d<bd){bd=d;best=p;}
 }
 return best;
}
function ai(p,dt){
 if(p.stun>0)return;
 const chaser=nearestChaser();
 let target=aiTarget(p);
 if(p!==chaser&&p.role==="chaser"){
  const own=targetCenter(teams[p.team].side);
  target={x:own.x+(W/2-own.x)*.5,y:own.y+(H/2-own.y)*.5};
 }
 const n=norm(target.x-p.x,target.y-p.y);
 if(p.action!=="slide"&&p.action!=="shoulder"){p.faceX=n.x;p.faceY=n.y;p.vx=n.x*p.speed;p.vy=n.y*p.speed;}
 p.x+=p.vx*dt;p.y+=p.vy*dt;roundedArenaClamp(p);

 if(p.cool<=0){
  const closePlayer=players.find(o=>o!==p&&Math.hypot(o.x-p.x,o.y-p.y)<72&&Math.hypot(ball.x-o.x,ball.y-o.y)<95);
  if(closePlayer&&Math.random()<.018){shoulder(p);return;}
  if(nearBall(p,32)){
   let best=null,bd=1e9;
   teams.forEach((t,i)=>{if(i===p.team)return;const q=targetCenter(t.side),d=Math.hypot(q.x-p.x,q.y-p.y);if(d<bd){bd=d;best=q;}});
   if(best){
    const a=norm(best.x-p.x,best.y-p.y);p.faceX=a.x;p.faceY=a.y;
    if(ball.z>65)(Math.random()<.5?actionA:actionB)(p,.5);
    else (Math.random()<.38?actionB:actionA)(p,.45+Math.random()*.45);
   }
  }else if(p===chaser&&Math.hypot(ball.x-p.x,ball.y-p.y)<155&&Math.random()<.008){slide(p);}
 }
}

function updatePlayer(p,dt){
 p.cool=Math.max(0,p.cool-dt);p.stun=Math.max(0,p.stun-dt);p.actionT=Math.max(0,p.actionT-dt);p.walkT+=dt*Math.hypot(p.vx,p.vy)*.04;
 if(p.actionT<=0&&p.action!=="idle")p.action="idle";
 if(p.z>0||p.vz>0){p.vz-=GRAVITY*dt;p.z+=p.vz*dt;if(p.z<=0){p.z=0;p.vz=0;if(p.action==="jump"||p.action==="header"||p.action==="volley")p.action="idle";}}
 if(p.action!=="slide"&&p.action!=="shoulder"){p.vx*=Math.pow(.84,dt*60);p.vy*=Math.pow(.84,dt*60);}
}

function collisions(){
 for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){
  const a=players[i],b=players[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),md=a.r+b.r;
  if(d>0&&d<md&&Math.abs(a.z-b.z)<52){
   const nx=dx/d,ny=dy/d,push=(md-d)/2;a.x-=nx*push;a.y-=ny*push;b.x+=nx*push;b.y+=ny*push;
   const attacker=(a.action==="shoulder"||a.action==="slide")?a:(b.action==="shoulder"||b.action==="slide")?b:null;
   const victim=attacker===a?b:attacker===b?a:null;
   if(attacker&&victim&&victim.stun<=0){
    const power=attacker.action==="slide"?760:560;
    victim.stun=attacker.action==="slide"?.72:.46;
    victim.vx=attacker.slideDirX*power;victim.vy=attacker.slideDirY*power;victim.vz=attacker.action==="slide"?180:110;
    setAction(victim,"stunned",victim.stun);
    shake=attacker.action==="slide"?14:9;hitStop=.045;
    if(Math.hypot(ball.x-victim.x,ball.y-victim.y)<78){
      ball.vx=attacker.slideDirX*(attacker.action==="slide"?920:720);
      ball.vy=attacker.slideDirY*(attacker.action==="slide"?920:720);
      ball.vz=260;ball.lastTouch=attacker.team;
    }
    showMessage(attacker.action==="slide"?"SLIDE HIT!":"SHOULDER!",360);
   }
  }
 }
}

function updateBall(dt,t){
 ball.vx+=-ball.vy*ball.curve*.0016*dt*60;
 ball.vy+= ball.vx*ball.curve*.0016*dt*60;
 ball.curve*=Math.pow(.984,dt*60);
 ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;ball.z+=ball.vz*dt;ball.vz-=GRAVITY*dt;

 if(ball.z<0){
  ball.z=0;
  if(Math.abs(ball.vz)>85)ball.vz=-ball.vz*.74;
  else ball.vz=0;
  ball.vx*=.94;ball.vy*=.94;
 }
 ball.vx*=Math.pow(.993,dt*60);ball.vy*=Math.pow(.993,dt*60);

 const targetHit=(team,offset,nx,ny)=>{
  if(Math.abs(offset)<=TARGET_R&&ball.z<TARGET_R*1.18){
   const pts=targetScore(offset),speed=Math.hypot(ball.vx,ball.vy);
   scoreHit(team,offset,t);
   const sideKick=(offset/TARGET_R)*170;
   ball.vx=nx*Math.max(430,speed*.92)+(ny!==0?sideKick:0);
   ball.vy=ny*Math.max(430,speed*.92)+(nx!==0?sideKick:0);
   ball.vz=pts===6?650:pts===4?520:410;
   return true;
  }
  return false;
 };

 if(ball.y-ball.r<BORDER){if(!targetHit(0,ball.x-W/2,0,1)){ball.y=BORDER+ball.r;ball.vy=Math.abs(ball.vy)*.92;ball.vz=Math.max(ball.vz,170);}}
 if(ball.x+ball.r>W-BORDER){if(!targetHit(1,ball.y-H/2,-1,0)){ball.x=W-BORDER-ball.r;ball.vx=-Math.abs(ball.vx)*.92;ball.vz=Math.max(ball.vz,170);}}
 if(ball.y+ball.r>H-BORDER){if(!targetHit(2,ball.x-W/2,0,-1)){ball.y=H-BORDER-ball.r;ball.vy=-Math.abs(ball.vy)*.92;ball.vz=Math.max(ball.vz,170);}}
 if(ball.x-ball.r<BORDER){if(!targetHit(3,ball.y-H/2,1,0)){ball.x=BORDER+ball.r;ball.vx=Math.abs(ball.vx)*.92;ball.vz=Math.max(ball.vz,170);}}
 roundedArenaClamp(ball);
}

function drawTarget(team){
 const side=teams[team].side,c=targetCenter(side);
 ctx.save();ctx.translate(c.x,c.y);
 if(side==="right")ctx.rotate(Math.PI/2);
 if(side==="bottom")ctx.rotate(Math.PI);
 if(side==="left")ctx.rotate(-Math.PI/2);
 ctx.scale(1,.42);
 for(const [r,col] of [[TARGET_R,"#f2f1ec"],[TARGET_R*.64,"#f0c843"],[TARGET_R*.30,"#9362ff"]]){
  ctx.beginPath();ctx.fillStyle=col;ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(14,17,23,.74)";ctx.lineWidth=8;ctx.stroke();
 }
 ctx.restore();
}

function limb(x1,y1,x2,y2,w=8){
 ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineCap="round";ctx.strokeStyle="#1b2130";ctx.lineWidth=w+4;ctx.stroke();
 ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle="#f2d1b2";ctx.lineWidth=w;ctx.stroke();
}
function drawPlayer(p){
 const fy=p.y-p.z*.42,ang=Math.atan2(p.faceY,p.faceX);
 const moving=Math.hypot(p.vx,p.vy)>35,walk=Math.sin(p.walkT)*10;
 let lean=0,bodyY=fy,bodyX=p.x,legA=walk,legB=-walk,armA=-walk*.65,armB=walk*.65,rot=ang+Math.PI/2;

 if(p.action==="kick"){legA=28;legB=-8;lean=-5;}
 if(p.action==="volley"){legA=36;legB=-20;lean=-10;bodyY-=6;}
 if(p.action==="header"){lean=18;bodyY-=8;}
 if(p.action==="shoulder"){lean=18;armA=-18;armB=-18;}
 if(p.action==="slide"){bodyY+=14;lean=34;legA=34;legB=18;}
 if(p.action==="jump"){bodyY-=4;legA=16;legB=-16;}
 if(p.action==="stunned"){rot+=.8;lean=26;legA=18;legB=-18;}
 if(!moving&&p.action==="idle"){legA=legB=armA=armB=0;}

 ctx.save();ctx.translate(bodyX,bodyY);ctx.rotate(rot);

 const shadowScale=1-clamp(p.z/300,0,.55);
 ctx.save();ctx.rotate(-rot);ctx.translate(-bodyX,-bodyY);
 ctx.beginPath();ctx.fillStyle="rgba(0,0,0,.24)";ctx.ellipse(p.x,p.y+16,26*shadowScale,9*shadowScale,0,0,Math.PI*2);ctx.fill();ctx.restore();

 ctx.rotate(lean*Math.PI/180);
 const torsoTop=-18,torsoBottom=16;
 // legs
 limb(-8,torsoBottom,-10+legA,43,8);
 limb(8,torsoBottom,10+legB,43,8);
 // arms
 limb(-15,-8,-24+armA,17,7);
 limb(15,-8,24+armB,17,7);
 // torso
 ctx.beginPath();ctx.roundRect(-18,-22,36,43,12);ctx.fillStyle=teams[p.team].color;ctx.fill();ctx.strokeStyle="#fff";ctx.lineWidth=p.human?4:2.5;ctx.stroke();
 // head
 ctx.beginPath();ctx.arc(0,-38,13,0,Math.PI*2);ctx.fillStyle="#f2d1b2";ctx.fill();ctx.strokeStyle="#1b2130";ctx.lineWidth=4;ctx.stroke();
 // face direction
 ctx.fillStyle="#1b2130";ctx.beginPath();ctx.arc(-4,-40,2.2,0,Math.PI*2);ctx.arc(4,-40,2.2,0,Math.PI*2);ctx.fill();
 // shoulder emphasis
 if(p.action==="shoulder"){
  ctx.beginPath();ctx.arc(18,-8,11,0,Math.PI*2);ctx.strokeStyle="rgba(255,255,255,.85)";ctx.lineWidth=5;ctx.stroke();
 }
 ctx.restore();

 if(p.action==="slide"){
  ctx.save();ctx.globalAlpha=.35;ctx.fillStyle="#fff";
  for(let i=0;i<5;i++){ctx.beginPath();ctx.arc(p.x-p.faceX*(18+i*12),fy-p.faceY*(18+i*12)+10,(5-i*.6),0,Math.PI*2);ctx.fill();}
  ctx.restore();
 }
}
function draw(){
 ctx.save();
 if(shake>0){ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);shake*=.84;if(shake<.5)shake=0;}
 ctx.clearRect(-40,-40,W+80,H+80);ctx.fillStyle="#19784a";ctx.fillRect(0,0,W,H);
 for(let i=0;i<10;i++){ctx.fillStyle=i%2?"rgba(255,255,255,.026)":"rgba(0,0,0,.026)";ctx.fillRect(i*W/10,0,W/10,H);}
 ctx.strokeStyle="rgba(255,255,255,.78)";ctx.lineWidth=6;ctx.beginPath();ctx.roundRect(BORDER,BORDER,W-2*BORDER,H-2*BORDER,CORNER);ctx.stroke();
 ctx.beginPath();ctx.moveTo(W/2,BORDER+20);ctx.lineTo(W/2,H-BORDER-20);ctx.moveTo(BORDER+20,H/2);ctx.lineTo(W-BORDER-20,H/2);ctx.stroke();
 ctx.beginPath();ctx.arc(W/2,H/2,92,0,Math.PI*2);ctx.stroke();
 for(let i=0;i<4;i++)drawTarget(i);
 for(const p of players)drawPlayer(p);

 const by=ball.y-ball.z*.48;
 ctx.beginPath();ctx.fillStyle="rgba(0,0,0,.24)";ctx.ellipse(ball.x,ball.y+8,ball.r*(1-clamp(ball.z/380,0,.58)),ball.r*.4,0,0,Math.PI*2);ctx.fill();
 ctx.beginPath();ctx.fillStyle="#fff";ctx.arc(ball.x,by,ball.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#171a20";ctx.lineWidth=4;ctx.stroke();
 if(ball.z>90){ctx.beginPath();ctx.moveTo(ball.x,by+20);ctx.lineTo(ball.x,by+50);ctx.strokeStyle="rgba(255,255,255,.45)";ctx.lineWidth=5;ctx.stroke();}

 const rem=Math.max(0,MATCH-(now()-started)/1000);
 ctx.fillStyle="rgba(8,11,17,.72)";ctx.fillRect(W/2-74,H/2-29,148,58);ctx.fillStyle="#fff";ctx.font="900 34px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(Math.ceil(rem),W/2,H/2);
 ctx.restore();
 if(rem<=0&&!gameOver){gameOver=true;const top=Math.max(...teams.map(t=>t.score));showMessage(`${teams.filter(t=>t.score===top).map(t=>t.name).join(" & ")} WINS!`,999999);}
}

function loop(t){
 let dt=Math.min(.033,(t-last)/1000);last=t;
 if(hitStop>0){hitStop-=dt;draw();requestAnimationFrame(loop);return;}
 if(!gameOver){
  for(const p of players){updatePlayer(p,dt);p.human?humanInput(p,dt):ai(p,dt);}
  collisions();updateBall(dt,t);
 }
 for(const a of ["a","b"]){if(held[a])document.querySelector(`.action.${a} i`).style.height=`${charge(a)*100}%`;}
 if(msgTimer>0&&msgTimer<999999){msgTimer-=dt*1000;if(msgTimer<=0)messageEl.classList.remove("show");}
 draw();requestAnimationFrame(loop);
}

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
 btn.addEventListener("pointerdown",e=>{e.preventDefault();held[a]=true;pressAt[a]=now();btn.setPointerCapture(e.pointerId);if(a==="c")releaseAction("c",players[0]);});
 btn.addEventListener("pointerup",e=>{e.preventDefault();if(a!=="c"&&held[a])releaseAction(a,players[0]);});
 btn.addEventListener("pointercancel",()=>{held[a]=false;});
});
const keyMap={KeyJ:"a",KeyK:"b",KeyL:"c"};
window.addEventListener("keydown",e=>{
 keys.add(e.code);
 const a=keyMap[e.code];
 if(a&&!held[a]){held[a]=true;pressAt[a]=now();if(a==="c")releaseAction("c",players[0]);}
 if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();
});
window.addEventListener("keyup",e=>{keys.delete(e.code);const a=keyMap[e.code];if(a&&a!=="c"&&held[a])releaseAction(a,players[0]);});
restartBtn.addEventListener("click",reset);

reset();requestAnimationFrame(loop);
})();