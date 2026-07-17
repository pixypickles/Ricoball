window.RicoballAI = {
  target(game,p){
    const own=game.targetCenter(RC.teams[p.team].side),b=game.ball,lead=.45;
    const pred={x:b.x+b.vx*lead,y:b.y+b.vy*lead};
    if(p.role==="defender"){
      const d=Math.hypot(b.x-own.x,b.y-own.y);
      return d<390?pred:{x:own.x+(RC.W/2-own.x)*.34,y:own.y+(RC.H/2-own.y)*.34};
    }
    if(p.role==="interceptor")return{x:(pred.x+RC.W/2)/2,y:(pred.y+RC.H/2)/2};
    return pred;
  },
  update(game,p,dt,chaser){
    if(p.stun>0)return;
    let target=this.target(game,p);
    if(p!==chaser&&p.role==="chaser"){
      const own=game.targetCenter(RC.teams[p.team].side);
      target={x:own.x+(RC.W/2-own.x)*.5,y:own.y+(RC.H/2-own.y)*.5};
    }
    const n=RC.norm(target.x-p.x,target.y-p.y);p.move(n.x,n.y,dt);
    if(p.cool>0)return;
    if(game.ball.carrier===p){
      const goal=game.closestEnemyTarget(p.team,p.x,p.y),a=RC.norm(goal.x-p.x,goal.y-p.y);p.faceX=a.x;p.faceY=a.y;
      if(Math.hypot(goal.x-p.x,goal.y-p.y)<430&&Math.random()<.025)game.kick(p,Math.random()<.35?"curve":"straight",.45+Math.random()*.45);
      return;
    }
    const carrier=game.ball.carrier;
    if(carrier&&carrier.team!==p.team&&Math.hypot(carrier.x-p.x,carrier.y-p.y)<80&&Math.random()<.025){Math.random()<.55?p.shoulder():p.slide();return;}
    if(game.ball.near(p,28)&&game.ball.z<50){
      const goal=game.closestEnemyTarget(p.team,p.x,p.y),a=RC.norm(goal.x-p.x,goal.y-p.y);p.faceX=a.x;p.faceY=a.y;
    }
  }
};