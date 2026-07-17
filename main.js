(() => {
"use strict";
const canvas=document.getElementById("game"),scoreEl=document.getElementById("scoreboard"),messageEl=document.getElementById("message");
const input=new RicoballInput(document.getElementById("joystick"),document.getElementById("stick"),[...document.querySelectorAll(".action")]);
const renderer=new RicoballRenderer(canvas);

const game={
  players:[],ball:null,started:0,last:RC.now(),gameOver:false,msgTimer:0,shake:0,hitStop:0,
  targetCenter:side=>renderer.targetCenter(side),
  targetScore(offset){const d=Math.abs(offset);return d<RC.TARGET_R*.30?6:d<RC.TARGET_R*.64?4:2;},
  closestEnemyTarget(team,x,y){
    let best=null,bd=1e9;RC.teams.forEach((t,i)=>{if(i===team)return;const q=this.targetCenter(t.side),d=Math.hypot(q.x-x,q.y-y);if(d<bd){bd=d;best=q;}});return best;
  },
  show(s,ms=650){messageEl.textContent=s;messageEl.classList.add("show");this.msgTimer=ms;},
  updateScore(){scoreEl.innerHTML=RC.teams.map((t,i)=>`<div class="score" style="--c:${t.color}"><small>${i===0?"YOU / ":""}${t.name}</small><strong>${t.score}</strong></div>`).join("");},
  scoreHit(targetTeam,offset,t){
    if(t-this.ball.lastScore<420||this.ball.lastTouch==null)return;
    this.ball.lastScore=t;const pts=this.targetScore(offset),att=this.ball.lastTouch,minus=Math.floor(pts/2);
    if(att===targetTeam){RC.teams[targetTeam].score=Math.max(0,RC.teams[targetTeam].score-minus);this.show(`OWN TARGET −${minus}`);}
    else{RC.teams[att].score+=pts;RC.teams[targetTeam].score=Math.max(0,RC.teams[targetTeam].score-minus);this.show(`${RC.teams[att].name} +${pts} / ${RC.teams[targetTeam].name} −${minus}`);}
    this.shake=pts===6?18:11;this.hitStop=.055;this.updateScore();
  },
  reset(){
    RC.teams.forEach(t=>t.score=0);
    this.players=[
      new RicoballPlayer(0,RC.W*.5,RC.H*.73,true,"human"),
      new RicoballPlayer(1,RC.W*.77,RC.H*.5,false,"defender"),
      new RicoballPlayer(2,RC.W*.5,RC.H*.23,false,"chaser"),
      new RicoballPlayer(3,RC.W*.23,RC.H*.5,false,"interceptor")
    ];
    this.ball=new RicoballBall();this.started=RC.now();this.gameOver=false;this.shake=0;this.hitStop=0;messageEl.classList.remove("show");this.updateScore();
  },
  arenaClamp(o){
    const m=RC.BORDER+o.r;o.x=RC.clamp(o.x,m,RC.W-m);o.y=RC.clamp(o.y,m,RC.H-m);
  },
  kick(p,type,power){
    if(p.cool>0||p.stun>0)return;
    if(this.ball.carrier===p||this.ball.near(p,30)){
      this.ball.kick(p,type,power);p.setAction(type==="straight"?"kick":"kick",.34);p.cool=.28;this.shake=4;
    }else if(type==="straight")p.shoulder();else p.slide();
  },
  playerActions(){
    const p=this.players[0];
    for(const e of input.drain()){
      if(e.a==="c"){p.jump();if(this.ball.z>42&&this.ball.near(p,42)){this.ball.release();this.ball.vx*=.42;this.ball.vy*=.42;this.ball.vz=Math.max(90,this.ball.vz*.35);this.show("TRAP!",360);}}
      if(e.a==="a"){
        if(this.ball.z>58&&this.ball.near(p,50)){this.ball.release();this.ball.vx=p.faceX*(760+260*e.p);this.ball.vy=p.faceY*(760+260*e.p);this.ball.vz=180;this.ball.lastTouch=p.team;p.setAction("volley",.45);p.cool=.38;this.show("VOLLEY!",400);}
        else this.kick(p,"straight",e.p);
      }
      if(e.a==="b"){
        if(this.ball.z>72&&this.ball.near(p,46)){this.ball.release();this.ball.vx=p.faceX*(560+230*e.p);this.ball.vy=p.faceY*(560+230*e.p);this.ball.vz=300;this.ball.lastTouch=p.team;p.vz=270;p.setAction("header",.42);p.cool=.38;this.show("HEADER!",400);}
        else this.kick(p,"curve",e.p);
      }
    }
  },
  collisions(){
    for(let i=0;i<this.players.length;i++)for(let j=i+1;j<this.players.length;j++){
      const a=this.players[i],b=this.players[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),md=a.r+b.r;
      if(d>0&&d<md&&Math.abs(a.z-b.z)<52){
        const nx=dx/d,ny=dy/d,push=(md-d)/2;a.x-=nx*push;a.y-=ny*push;b.x+=nx*push;b.y+=ny*push;
        const attacker=["shoulder","slide"].includes(a.action)?a:["shoulder","slide"].includes(b.action)?b:null,victim=attacker===a?b:attacker===b?a:null;
        if(attacker&&victim&&victim.stun<=0){
          const power=attacker.action==="slide"?760:560;victim.stun=attacker.action==="slide"?.72:.46;victim.vx=attacker.slideDirX*power;victim.vy=attacker.slideDirY*power;victim.vz=attacker.action==="slide"?180:110;victim.setAction("stunned",victim.stun);
          if(this.ball.carrier===victim){this.ball.release();this.ball.vx=attacker.slideDirX*(attacker.action==="slide"?920:720);this.ball.vy=attacker.slideDirY*(attacker.action==="slide"?920:720);this.ball.vz=260;this.ball.lastTouch=attacker.team;}
          this.shake=attacker.action==="slide"?14:9;this.hitStop=.045;this.show(attacker.action==="slide"?"SLIDE HIT!":"SHOULDER!",360);
        }
      }
    }
  },
  update(dt,t){
    this.playerActions();
    const m=input.movement(),human=this.players[0],slow=(input.held.a||input.held.b)?.78:1;human.move(m.x,m.y,dt,slow);
    let chaser=null,bd=1e9;for(const p of this.players.slice(1)){const d=Math.hypot(p.x-this.ball.x,p.y-this.ball.y);if(d<bd){bd=d;chaser=p;}}
    for(const p of this.players.slice(1))RicoballAI.update(this,p,dt,chaser);
    for(const p of this.players){p.updateBase(dt);this.arenaClamp(p);}
    this.collisions();this.ball.tryClaim(this.players);this.ball.update(dt,t,this);this.arenaClamp(this.ball);
    for(const a of ["a","b"]){if(input.held[a])document.querySelector(`.action.${a} i`).style.height=`${RC.clamp((RC.now()-input.pressAt[a])/900,0,1)*100}%`;else document.querySelector(`.action.${a} i`).style.height="0%";}
    if(this.msgTimer>0&&this.msgTimer<999999){this.msgTimer-=dt*1000;if(this.msgTimer<=0)messageEl.classList.remove("show");}
  }
};

function loop(t){
  let dt=Math.min(.033,(t-game.last)/1000);game.last=t;
  if(game.hitStop>0){game.hitStop-=dt;renderer.draw(game);requestAnimationFrame(loop);return;}
  if(!game.gameOver)game.update(dt,t);renderer.draw(game);requestAnimationFrame(loop);
}
document.getElementById("restart").addEventListener("click",()=>game.reset());
game.reset();requestAnimationFrame(loop);
})();