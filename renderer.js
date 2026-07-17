window.RicoballRenderer = class {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext("2d");}
  targetCenter(side){
    if(side==="top")return{x:RC.W/2,y:RC.BORDER};if(side==="right")return{x:RC.W-RC.BORDER,y:RC.H/2};
    if(side==="bottom")return{x:RC.W/2,y:RC.H-RC.BORDER};return{x:RC.BORDER,y:RC.H/2};
  }
  drawTarget(team){
    const ctx=this.ctx,side=RC.teams[team].side,c=this.targetCenter(side);ctx.save();ctx.translate(c.x,c.y);
    if(side==="right")ctx.rotate(Math.PI/2);if(side==="bottom")ctx.rotate(Math.PI);if(side==="left")ctx.rotate(-Math.PI/2);ctx.scale(1,.42);
    for(const [r,col] of [[RC.TARGET_R,"#f2f1ec"],[RC.TARGET_R*.64,"#f0c843"],[RC.TARGET_R*.30,"#9362ff"]]){
      ctx.beginPath();ctx.fillStyle=col;ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(14,17,23,.74)";ctx.lineWidth=8;ctx.stroke();
    }ctx.restore();
  }
  limb(x1,y1,x2,y2,w=8){
    const ctx=this.ctx;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineCap="round";ctx.strokeStyle="#1b2130";ctx.lineWidth=w+4;ctx.stroke();
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle="#f2d1b2";ctx.lineWidth=w;ctx.stroke();
  }
  drawPlayer(p){
    const ctx=this.ctx,fy=p.y-p.z*.42,moving=Math.hypot(p.vx,p.vy)>35,walk=Math.sin(p.walkT)*10;
    let bodyX=p.x,bodyY=fy,legA=walk,legB=-walk,armA=-walk*.65,armB=walk*.65,leanX=0,leanY=0;
    if(p.action==="kick"){legA=29;legB=-8;leanY=-4;}if(p.action==="volley"){legA=37;legB=-21;bodyY-=6;}
    if(p.action==="header"){leanY=-12;bodyY-=8;}if(p.action==="shoulder"){leanX=p.faceX*14;leanY=p.faceY*10;armA=-17;armB=-17;}
    if(p.action==="slide"){bodyY+=15;legA=33;legB=17;leanX=p.faceX*18;leanY=p.faceY*12;}
    if(p.action==="jump"){legA=16;legB=-16;}if(p.action==="stunned"){leanX=20;leanY=16;legA=18;legB=-18;}
    if(!moving&&p.action==="idle"){legA=legB=armA=armB=0;}

    const shadowScale=1-RC.clamp(p.z/300,0,.55);
    ctx.beginPath();ctx.fillStyle="rgba(0,0,0,.24)";ctx.ellipse(p.x,p.y+16,26*shadowScale,9*shadowScale,0,0,Math.PI*2);ctx.fill();

    if(p.dribble){
      ctx.beginPath();ctx.arc(p.x,p.y,48,0,Math.PI*2);ctx.strokeStyle="rgba(255,255,255,.28)";ctx.lineWidth=3;ctx.setLineDash([8,8]);ctx.stroke();ctx.setLineDash([]);
    }

    ctx.save();ctx.translate(bodyX+leanX,bodyY+leanY);
    // 頭は常に画面上。キャラクター全体を進行方向へ回転させない。
    this.limb(-8,16,-10+legA,43,8);this.limb(8,16,10+legB,43,8);
    this.limb(-15,-8,-24+armA,17,7);this.limb(15,-8,24+armB,17,7);
    ctx.beginPath();ctx.roundRect(-18,-22,36,43,12);ctx.fillStyle=RC.teams[p.team].color;ctx.fill();ctx.strokeStyle="#fff";ctx.lineWidth=p.human?4:2.5;ctx.stroke();
    ctx.beginPath();ctx.arc(0,-38,13,0,Math.PI*2);ctx.fillStyle="#f2d1b2";ctx.fill();ctx.strokeStyle="#1b2130";ctx.lineWidth=4;ctx.stroke();
    ctx.fillStyle="#1b2130";ctx.beginPath();ctx.arc(-4,-41,2.1,0,Math.PI*2);ctx.arc(4,-41,2.1,0,Math.PI*2);ctx.fill();
    if(p.action==="shoulder"){ctx.beginPath();ctx.arc(p.faceX>=0?18:-18,-8,11,0,Math.PI*2);ctx.strokeStyle="rgba(255,255,255,.85)";ctx.lineWidth=5;ctx.stroke();}
    ctx.restore();

    // 進行方向は足元の小さな矢印で示す
    ctx.beginPath();ctx.moveTo(p.x+p.faceX*31,p.y+p.faceY*31);ctx.lineTo(p.x+p.faceX*42-p.faceY*6,p.y+p.faceY*42+p.faceX*6);
    ctx.lineTo(p.x+p.faceX*42+p.faceY*6,p.y+p.faceY*42-p.faceX*6);ctx.closePath();ctx.fillStyle="rgba(255,255,255,.7)";ctx.fill();
  }
  draw(game){
    const ctx=this.ctx;ctx.save();
    if(game.shake>0){ctx.translate((Math.random()-.5)*game.shake,(Math.random()-.5)*game.shake);game.shake*=.84;if(game.shake<.5)game.shake=0;}
    ctx.clearRect(-40,-40,RC.W+80,RC.H+80);ctx.fillStyle="#19784a";ctx.fillRect(0,0,RC.W,RC.H);
    for(let i=0;i<10;i++){ctx.fillStyle=i%2?"rgba(255,255,255,.026)":"rgba(0,0,0,.026)";ctx.fillRect(i*RC.W/10,0,RC.W/10,RC.H);}
    ctx.strokeStyle="rgba(255,255,255,.78)";ctx.lineWidth=6;ctx.beginPath();ctx.roundRect(RC.BORDER,RC.BORDER,RC.W-2*RC.BORDER,RC.H-2*RC.BORDER,RC.CORNER);ctx.stroke();
    ctx.beginPath();ctx.moveTo(RC.W/2,RC.BORDER+20);ctx.lineTo(RC.W/2,RC.H-RC.BORDER-20);ctx.moveTo(RC.BORDER+20,RC.H/2);ctx.lineTo(RC.W-RC.BORDER-20,RC.H/2);ctx.stroke();
    ctx.beginPath();ctx.arc(RC.W/2,RC.H/2,92,0,Math.PI*2);ctx.stroke();
    for(let i=0;i<4;i++)this.drawTarget(i);
    for(const p of game.players)this.drawPlayer(p);
    const b=game.ball,by=b.y-b.z*.48;
    ctx.beginPath();ctx.fillStyle="rgba(0,0,0,.24)";ctx.ellipse(b.x,b.y+8,b.r*(1-RC.clamp(b.z/380,0,.58)),b.r*.4,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.fillStyle="#fff";ctx.arc(b.x,by,b.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#171a20";ctx.lineWidth=4;ctx.stroke();
    const rem=Math.max(0,RC.MATCH-(RC.now()-game.started)/1000);ctx.fillStyle="rgba(8,11,17,.72)";ctx.fillRect(RC.W/2-74,RC.H/2-29,148,58);
    ctx.fillStyle="#fff";ctx.font="900 34px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(Math.ceil(rem),RC.W/2,RC.H/2);ctx.restore();
    if(rem<=0&&!game.gameOver){game.gameOver=true;const top=Math.max(...RC.teams.map(t=>t.score));game.show(`${RC.teams.filter(t=>t.score===top).map(t=>t.name).join(" & ")} WINS!`,999999);}
  }
};