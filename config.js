window.RC = {
  W:960,H:960,BORDER:42,CORNER:126,TARGET_R:145,MATCH:100,GRAVITY:1250,
  teams:[
    {name:"RED",color:"#ff5262",side:"top",score:0},
    {name:"BLUE",color:"#3da2ff",side:"right",score:0},
    {name:"GREEN",color:"#46dc83",side:"bottom",score:0},
    {name:"YELLOW",color:"#ffd64f",side:"left",score:0}
  ],
  clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  norm:(x,y)=>{const d=Math.hypot(x,y)||1;return{x:x/d,y:y/d,d}},
  now:()=>performance.now()
};