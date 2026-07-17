window.RicoballInput = class {
  constructor(joystick,stick,buttons){
    this.keys=new Set();this.joy={x:0,y:0,id:null};this.held={a:false,b:false,c:false};this.pressAt={a:0,b:0,c:0};
    this.released=[];
    this.joystick=joystick;this.stick=stick;
    this.bindJoystick();this.bindButtons(buttons);this.bindKeyboard();
  }
  bindJoystick(){
    const move=(x,y)=>{
      const r=this.joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=r.width*.30;
      let dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy);if(d>max){dx=dx/d*max;dy=dy/d*max;}
      this.joy.x=dx/max;this.joy.y=dy/max;this.stick.style.transform=`translate(${dx}px,${dy}px)`;
    };
    this.joystick.addEventListener("pointerdown",e=>{this.joy.id=e.pointerId;this.joystick.setPointerCapture(e.pointerId);move(e.clientX,e.clientY);});
    this.joystick.addEventListener("pointermove",e=>{if(e.pointerId===this.joy.id)move(e.clientX,e.clientY);});
    const end=e=>{if(e.pointerId!==this.joy.id)return;this.joy.id=null;this.joy.x=this.joy.y=0;this.stick.style.transform="translate(0,0)";};
    this.joystick.addEventListener("pointerup",end);this.joystick.addEventListener("pointercancel",end);
  }
  bindButtons(buttons){
    buttons.forEach(btn=>{
      const a=btn.dataset.action;
      btn.addEventListener("pointerdown",e=>{e.preventDefault();this.held[a]=true;this.pressAt[a]=RC.now();btn.setPointerCapture(e.pointerId);if(a==="c")this.released.push({a,p:0});});
      btn.addEventListener("pointerup",e=>{e.preventDefault();if(a!=="c"&&this.held[a])this.release(a);});
      btn.addEventListener("pointercancel",()=>{this.held[a]=false;});
    });
  }
  bindKeyboard(){
    const map={KeyJ:"a",KeyK:"b",KeyL:"c"};
    addEventListener("keydown",e=>{
      this.keys.add(e.code);const a=map[e.code];
      if(a&&!this.held[a]){this.held[a]=true;this.pressAt[a]=RC.now();if(a==="c")this.released.push({a,p:0});}
      if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();
    });
    addEventListener("keyup",e=>{this.keys.delete(e.code);const a=map[e.code];if(a&&a!=="c"&&this.held[a])this.release(a);});
  }
  release(a){const p=RC.clamp((RC.now()-this.pressAt[a])/900,0,1);this.held[a]=false;this.released.push({a,p});}
  movement(){
    let x=this.joy.x,y=this.joy.y;
    if(this.keys.has("ArrowLeft")||this.keys.has("KeyA"))x-=1;
    if(this.keys.has("ArrowRight")||this.keys.has("KeyD"))x+=1;
    if(this.keys.has("ArrowUp")||this.keys.has("KeyW"))y-=1;
    if(this.keys.has("ArrowDown")||this.keys.has("KeyS"))y+=1;
    const d=Math.hypot(x,y);if(d>1){x/=d;y/=d;}return{x,y,d:Math.min(1,d)};
  }
  drain(){return this.released.splice(0);}
};