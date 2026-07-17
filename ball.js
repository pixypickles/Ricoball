window.RicoballBall = class {
  constructor(){Object.assign(this,{x:RC.W/2,y:RC.H/2,z:50,vx:330,vy:-180,vz:250,r:15,lastTouch:null,curve:0,lastScore:-9999,carrier:null});}
  distanceTo(p){return Math.hypot(this.x-p.x,this.y-p.y);}
  near(p,range=40){return this.distanceTo(p)<p.r+this.r+range&&Math.abs(this.z-p.z)<95;}
  release(){
    if(this.carrier){this.carrier.dribble=false;this.carrier=null;}
  }
  attach(p,dt){
    if(this.carrier!==p)return;
    const ahead=34;
    const tx=p.x+p.faceX*ahead,ty=p.y+p.faceY*ahead;
    const strength=1-Math.pow(.06,dt*60);
    this.x+=(tx-this.x)*strength;this.y+=(ty-this.y)*strength;
    this.z+=(Math.max(0,p.z+4)-this.z)*strength;
    this.vx=p.vx*.92;this.vy=p.vy*.92;this.vz=0;this.lastTouch=p.team;
  }
  tryClaim(players){
    if(this.carrier||this.z>38||Math.hypot(this.vx,this.vy)>420)return;
    let best=null,bd=52;
    for(const p of players){
      if(p.stun>0||["slide","shoulder"].includes(p.action))continue;
      const d=this.distanceTo(p);
      if(d<bd){bd=d;best=p;}
    }
    if(best){this.carrier=best;best.dribble=true;best.dribbleT=.18;this.lastTouch=best.team;}
  }
  kick(p,type,power){
    this.release();
    const a=RC.norm(p.faceX,p.faceY);let fx=a.x,fy=a.y;
    const speed=(type==="straight"?690:570)+(type==="straight"?520:390)*power;
    this.vx=fx*speed+p.vx*.18;this.vy=fy*speed+p.vy*.18;this.vz=220+90*power;
    this.curve=type==="curve"?(p.team%2===0?1:-1)*(170+120*power):0;this.lastTouch=p.team;
  }
  update(dt,t,game){
    if(this.carrier){this.attach(this.carrier,dt);return;}
    this.vx+=-this.vy*this.curve*.0016*dt*60;this.vy+=this.vx*this.curve*.0016*dt*60;this.curve*=Math.pow(.984,dt*60);
    this.x+=this.vx*dt;this.y+=this.vy*dt;this.z+=this.vz*dt;this.vz-=RC.GRAVITY*dt;
    if(this.z<0){this.z=0;if(Math.abs(this.vz)>85)this.vz=-this.vz*.74;else this.vz=0;this.vx*=.94;this.vy*=.94;}
    this.vx*=Math.pow(.993,dt*60);this.vy*=Math.pow(.993,dt*60);

    const hit=(team,offset,nx,ny)=>{
      if(Math.abs(offset)>RC.TARGET_R||this.z>RC.TARGET_R*1.18)return false;
      const pts=game.targetScore(offset),speed=Math.hypot(this.vx,this.vy);game.scoreHit(team,offset,t);
      const sideKick=(offset/RC.TARGET_R)*170;this.vx=nx*Math.max(430,speed*.92)+(ny!==0?sideKick:0);this.vy=ny*Math.max(430,speed*.92)+(nx!==0?sideKick:0);
      this.vz=pts===6?650:pts===4?520:410;return true;
    };
    if(this.y-this.r<RC.BORDER&&!hit(0,this.x-RC.W/2,0,1)){this.y=RC.BORDER+this.r;this.vy=Math.abs(this.vy)*.92;this.vz=Math.max(this.vz,170);}
    if(this.x+this.r>RC.W-RC.BORDER&&!hit(1,this.y-RC.H/2,-1,0)){this.x=RC.W-RC.BORDER-this.r;this.vx=-Math.abs(this.vx)*.92;this.vz=Math.max(this.vz,170);}
    if(this.y+this.r>RC.H-RC.BORDER&&!hit(2,this.x-RC.W/2,0,-1)){this.y=RC.H-RC.BORDER-this.r;this.vy=-Math.abs(this.vy)*.92;this.vz=Math.max(this.vz,170);}
    if(this.x-this.r<RC.BORDER&&!hit(3,this.y-RC.H/2,1,0)){this.x=RC.BORDER+this.r;this.vx=Math.abs(this.vx)*.92;this.vz=Math.max(this.vz,170);}
  }
};