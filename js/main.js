(() => {
"use strict";

const canvas = document.getElementById("game"), ctx = canvas.getContext("2d");
const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
let W=innerWidth,H=innerHeight,DPR=1,last=0;

function resize(){DPR=Math.min(devicePixelRatio||1,2);W=innerWidth;H=innerHeight;canvas.width=W*DPR;canvas.height=H*DPR;ctx.setTransform(DPR,0,0,DPR,0,0)}
addEventListener("resize",resize); resize();

const storage = {
  get(k, fallback=0){try{return localStorage.getItem(k) ?? fallback}catch(_){return fallback}},
  set(k,v){try{localStorage.setItem(k,v)}catch(_){}}
};
const store = {
  high:+storage.get("haiAuHigh",0)||0,
  coins:+storage.get("haiAuCoins",0)||0,
  amulets:+storage.get("haiAuAmulets",0)||0,
  save(){storage.set("haiAuHigh",this.high);storage.set("haiAuCoins",this.coins);storage.set("haiAuAmulets",this.amulets)}
};

class AudioManager{
  constructor(){this.ac=null;this.master=null;this.timer=null}
  init(){if(this.ac)return;const A=window.AudioContext||window.webkitAudioContext;if(!A)return;this.ac=new A();this.master=this.ac.createGain();this.master.gain.value=.08;this.master.connect(this.ac.destination)}
  tone(freq,dur=.1,type="sine",gain=.08,when=0){if(!this.ac)return;const t=this.ac.currentTime+when,o=this.ac.createOscillator(),g=this.ac.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+.01);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g).connect(this.master);o.start(t);o.stop(t+dur+.03)}
  sfx(name){this.init();if(this.ac?.state==="suspended")this.ac.resume();const m={coin:[[880,.08,"sine",.12],[1320,.12,"sine",.08,.06]],hit:[[120,.12,"sawtooth",.1]],shield:[[500,.1,"triangle",.1],[800,.18,"triangle",.08,.07]],laser:[[180,.5,"sawtooth",.1]],boom:[[70,.35,"sawtooth",.13]],win:[[523,.12,"sine",.1],[659,.12,"sine",.1,.13],[784,.25,"sine",.12,.26]],alert:[[90,.5,"square",.07]]};(m[name]||[]).forEach(x=>this.tone(...x))}
  start(stage){this.init(); if(!this.ac)return;if(this.timer)clearInterval(this.timer);const patterns=[[261,329,392,329],[220,277,330,277],[110,147,175,147],[392,494,587,494]][stage]||[261,329,392,329];let i=0;this.timer=setInterval(()=>this.tone(patterns[i++%patterns.length],.35,stage===2?"sawtooth":"triangle",.045),420)}
  stop(){if(this.timer)clearInterval(this.timer);this.timer=null}
}
const audio=new AudioManager();

window.addEventListener("error", e=>{
  console.error("Sky Guardian error:", e.error || e.message);
  const toast=$("toast");
  if(toast){toast.textContent="LỖI GAME: " + (e.message || "JavaScript error");toast.style.opacity=1;}
});
window.addEventListener("unhandledrejection", e=>{
  console.error("Sky Guardian promise error:", e.reason);
});

const input={x:0,y:0,keys:new Set(),touch:new Set()};
addEventListener("keydown",e=>{input.keys.add(e.key.toLowerCase());audio.init()});
addEventListener("keyup",e=>input.keys.delete(e.key.toLowerCase()));

// Mobile: 4 nút cố định ở góc trái dưới. Có thể giữ nút để bay liên tục.
const mobileControls=$("mobileControls");
const dirVector={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
mobileControls.querySelectorAll(".moveBtn").forEach(btn=>{
  const dir=btn.dataset.dir;
  const press=e=>{e.preventDefault();input.touch.add(dir);btn.classList.add("pressed");audio.init();if(btn.setPointerCapture)btn.setPointerCapture(e.pointerId)};
  const release=e=>{e.preventDefault();input.touch.delete(dir);btn.classList.remove("pressed")};
  btn.addEventListener("pointerdown",press);
  btn.addEventListener("pointerup",release);
  btn.addEventListener("pointercancel",release);
  btn.addEventListener("lostpointercapture",()=>{input.touch.delete(dir);btn.classList.remove("pressed")});
});

const rand=(a,b)=>a+Math.random()*(b-a), clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

class Particle{
  constructor(x,y,color="white",speed=100,life=.7,size=3){this.x=x;this.y=y;const a=rand(0,TAU),s=rand(speed*.35,speed);this.vx=Math.cos(a)*s;this.vy=Math.sin(a)*s;this.life=life;this.max=life;this.color=color;this.size=rand(1,size)}
  update(dt){this.x+=this.vx*dt;this.y+=this.vy*dt;this.vx*=.97;this.vy*=.97;this.life-=dt}
  draw(){ctx.globalAlpha=Math.max(0,this.life/this.max);ctx.fillStyle=this.color;ctx.beginPath();ctx.arc(this.x,this.y,this.size,0,TAU);ctx.fill();ctx.globalAlpha=1}
}
class Coin{
  constructor(x,y){this.x=x;this.y=y;this.r=12;this.t=rand(0,TAU)}
  update(dt){this.t+=dt*4;this.x-=55*dt}
  draw(){ctx.save();ctx.translate(this.x,this.y);ctx.scale(.65+.35*Math.abs(Math.cos(this.t)),1);ctx.fillStyle="#ffd84a";ctx.strokeStyle="#fff1a5";ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,this.r,0,TAU);ctx.fill();ctx.stroke();ctx.fillStyle="#fff4a7";ctx.font="bold 11px system-ui";ctx.textAlign="center";ctx.fillText("$",0,4);ctx.restore()}
}
class ShieldItem{
  constructor(x,y){this.x=x;this.y=y;this.r=13;this.t=0}
  update(dt){this.x-=55*dt;this.t+=dt*4}
  draw(){ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this.t*.2);ctx.strokeStyle="#6de8ff";ctx.lineWidth=3;ctx.fillStyle="rgba(80,220,255,.18)";ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(13,-8);ctx.lineTo(10,8);ctx.lineTo(0,15);ctx.lineTo(-10,8);ctx.lineTo(-13,-8);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()}
}

class Player{
  constructor(){this.x=W*.22;this.y=H*.5;this.r=25;this.lives=3;this.shield=0;this.inv=0}
  update(dt){
    let x=input.x,y=input.y;
    if(input.keys.has("arrowleft")||input.keys.has("a"))x-=1;
    if(input.keys.has("arrowright")||input.keys.has("d"))x+=1;
    if(input.keys.has("arrowup")||input.keys.has("w"))y-=1;
    if(input.keys.has("arrowdown")||input.keys.has("s"))y+=1;
    for(const dir of input.touch){x+=dirVector[dir][0];y+=dirVector[dir][1]}
    const l=Math.hypot(x,y);if(l>1){x/=l;y/=l}
    this.x=clamp(this.x+x*330*dt,40,W*.7);this.y=clamp(this.y+y*330*dt,50,H-50);this.inv=Math.max(0,this.inv-dt)
  }
  hit(){
    if(this.inv>0)return false;
    if(this.shield>0){this.shield--;this.inv=.35;audio.sfx("shield");burst(this.x,this.y,"#6de8ff",18);return false}
    this.lives--;this.inv=1.3;audio.sfx("hit");shake=10;burst(this.x,this.y,"#fff",20);return true
  }
  draw(){
    if(this.inv>0 && Math.floor(this.inv*12)%2===0)return;
    ctx.save();ctx.translate(this.x,this.y);ctx.rotate(input.x*.15);
    ctx.fillStyle="#fff";ctx.strokeStyle="#13263b";ctx.lineWidth=2;
    ctx.beginPath();ctx.ellipse(0,0,25,13,0,0,TAU);ctx.fill();ctx.stroke();
    ctx.fillStyle="#1e78b5";ctx.beginPath();ctx.ellipse(-3,2,14,8,-.3,0,TAU);ctx.fill();
    ctx.fillStyle="#f6c83e";ctx.beginPath();ctx.moveTo(22,-2);ctx.lineTo(35,2);ctx.lineTo(22,7);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle="#111";ctx.beginPath();ctx.arc(14,-6,2.5,0,TAU);ctx.fill();
    ctx.fillStyle="#eaf6ff";ctx.beginPath();ctx.moveTo(-18,-3);ctx.quadraticCurveTo(-5,-25,8,-7);ctx.quadraticCurveTo(-4,-2,-18,3);ctx.fill();ctx.stroke();
    if(this.shield>0){ctx.strokeStyle="rgba(100,230,255,.8)";ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,34+Math.sin(performance.now()/100)*2,0,TAU);ctx.stroke()}
    ctx.restore()
  }
}

class Projectile{
  constructor(x,y,vx,vy,r=11,type="fire"){Object.assign(this,{x,y,vx,vy,r,type,life:6})}
  update(dt){
    if(this.delay>0){this.delay-=dt;return}
    this.x+=this.vx*dt;this.y+=this.vy*dt;this.life-=dt
  }
  draw(){ctx.save();ctx.translate(this.x,this.y);const c=this.type==="fire"?"#ff7138":this.type==="laser"?"#ff174f":"#f8b84e";ctx.shadowBlur=18;ctx.shadowColor=c;ctx.fillStyle=c;ctx.beginPath();ctx.arc(0,0,this.r,0,TAU);ctx.fill();ctx.restore()}
}
class SkillOrb{
  constructor(x,y,type){this.x=x;this.y=y;this.r=15;this.type=type;this.t=0}
  update(dt){this.x-=85*dt;this.t+=dt*5}
  draw(){const c={fire:"#ff6b35",freeze:"#72d9ff",wither:"#bd78ff"}[this.type];ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this.t);ctx.fillStyle=c;ctx.shadowBlur=20;ctx.shadowColor=c;ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(12,0);ctx.lineTo(0,15);ctx.lineTo(-12,0);ctx.closePath();ctx.fill();ctx.restore()}
}

class Boss{
  constructor(){this.x=W*.84;this.y=H*.5;this.r=Math.min(W,H)*.12;this.hp=10000;this.max=10000;this.cool=1.5;this.skill=0;this.tele=0;this.lane=1;this.frozen=0;this.slow=0}
  update(dt){
    this.frozen=Math.max(0,this.frozen-dt);this.slow=Math.max(0,this.slow-dt);
    if(this.frozen>0)return;
    this.cool-=dt;
    if(this.tele>0){this.tele-=dt;if(this.tele<=0)this.fireLaser();return}
    if(this.cool<=0){this.skill=(this.skill+1)%4;if(this.skill===0)this.firePattern();else if(this.skill===1){this.tele=1.2;this.lane=Math.floor(rand(0,3));audio.sfx("alert")}else if(this.skill===2)this.fireGrid();else this.fireRadial();this.cool=rand(1.5,2.6)}
  }
  firePattern(){
    const gap=Math.floor(rand(1,7));
    const speed=260*(this.slow?0.5:1);
    for(let i=0;i<8;i++)if(i!==gap){
      const y=22+i*(H-44)/7;
      const p=new Projectile(W+24,y,-speed,0,10,"fire");
      p.life=(W+120)/speed+1;
      game.projectiles.push(p);
    }
  }
  fireLaser(){audio.sfx("laser");shake=14;game.laser={lane:this.lane,t:0,dur:.65}}
  fireRadial(){
    // Đạn bắt đầu tại đúng tâm Boss. Mỗi tia có nhiều viên nối tiếp nhau,
    // tạo hiệu ứng từ tâm mở rộng dần tới đường tròn.
    const rays=16;
    const bulletsPerRay=5;
    const base=rand(0,TAU);
    const speed=this.slow?170:300;
    for(let i=0;i<rays;i++){
      const a=base+i*TAU/rays;
      for(let j=0;j<bulletsPerRay;j++){
        const delay=j*0.055;
        const p=new Projectile(this.x,this.y,Math.cos(a)*speed,Math.sin(a)*speed,8,"fire");
        p.life=Math.hypot(W+120,H+120)/speed+1;
        p.delay=delay;
        game.projectiles.push(p);
      }
    }
  }
  fireGrid(){
    const gap=Math.floor(rand(2,7));
    const speed=310*(this.slow?0.5:1);
    for(let i=0;i<10;i++)if(i!==gap){
      const y=18+i*(H-36)/9;
      const p=new Projectile(W+24,y,-speed,0,9,"fire");
      p.life=(W+120)/speed+1;
      game.projectiles.push(p);
    }
  }
  damage(n,type){
    this.hp=clamp(this.hp-n,0,this.max);shake=9;burst(this.x,this.y,type==="freeze"?"#72d9ff":type==="wither"?"#bd78ff":"#ff7138",24);
    if(type==="freeze")this.frozen=3;if(type==="wither")this.slow=4;audio.sfx("boom")
  }
  draw(){
    ctx.save();ctx.translate(this.x,this.y);ctx.shadowBlur=28;ctx.shadowColor="#8d36ff";
    ctx.fillStyle="#241a4c";ctx.strokeStyle="#c57cff";ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,this.r,0,TAU);ctx.fill();ctx.stroke();
    for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.fillStyle="#56349a";ctx.beginPath();ctx.moveTo(0,-this.r);ctx.lineTo(13,-this.r-35);ctx.lineTo(27,-this.r+2);ctx.closePath();ctx.fill()}
    ctx.fillStyle="#ff4368";ctx.beginPath();ctx.arc(-15,-5,7,0,TAU);ctx.arc(15,-5,7,0,TAU);ctx.fill();
    ctx.restore();
    if(this.tele>0){const h=H/3,y=this.lane*h;ctx.fillStyle=`rgba(255,30,70,${.14+.12*Math.sin(performance.now()/80)})`;ctx.fillRect(0,y,W,h);ctx.strokeStyle="#ff365a";ctx.lineWidth=3;ctx.strokeRect(0,y,W,h)}
  }
}

class Game{
  constructor(){this.running=false;this.stage=0;this.score=0;this.coins=0;this.time=0;this.spawn=0;this.shieldSpawn=15;this.dodgeTimer=0;this.projectiles=[];this.coinsList=[];this.shields=[];this.orbs=[];this.particles=[];this.player=new Player();this.boss=null;this.laser=null;this.shake=0;this.bgT=0}
  start(){this.running=true;this.stage=0;this.score=0;this.coins=0;this.time=0;this.spawn=0;this.shieldSpawn=15;this.dodgeTimer=0;this.projectiles=[];this.coinsList=[];this.shields=[];this.orbs=[];this.particles=[];this.laser=null;this.player=new Player();this.setStage(0);hideAll();$("hud").classList.remove("hidden");$("mobileControls").classList.remove("hidden");input.touch.clear();audio.start(0)}
  setStage(s){this.stage=s;$("stage").textContent=["BẦU TRỜI TRONG XANH","BẦU TRỜI MÂY ĐEN","MƯA GIÔNG BÃO TỐ","SAU CƠN MƯA"][s];$("bossBar").classList.toggle("hidden",s!==2);audio.start(s)}
  update(dt){
    this.bgT+=dt;this.player.update(dt);this.time+=dt;this.score=Math.floor(this.time*10);
    if(this.stage===0 && this.score>=300)this.setStage(1);
    if(this.stage===1 && this.score>=600){this.setStage(2);this.boss=new Boss();showToast("BOSS XUẤT HIỆN!")}
    if(this.stage!==2){this.spawn-=dt;if(this.spawn<=0){this.spawn=rand(.55,1.25)/(this.stage===1?1.25:1);this.spawnObstacle()}
      this.shieldSpawn-=dt;if(this.shieldSpawn<=0){this.shieldSpawn=15;this.shields.push(new ShieldItem(W+20,rand(80,H-80)))}
    }
    this.dodgeTimer+=dt;if(this.stage===2 && this.dodgeTimer>=10){this.dodgeTimer=0;const types=["fire","freeze","wither"];this.orbs.push(new SkillOrb(W+20,rand(80,H-80),types[Math.floor(rand(0,3))]))}
    this.projectiles.forEach(p=>p.update(dt));this.projectiles=this.projectiles.filter(p=>p.life>0&&p.x>-60);
    this.coinsList.forEach(c=>c.update(dt));this.coinsList=this.coinsList.filter(c=>c.x>-30);
    this.shields.forEach(s=>s.update(dt));this.shields=this.shields.filter(s=>s.x>-30);
    this.orbs.forEach(o=>o.update(dt));this.orbs=this.orbs.filter(o=>o.x>-40);
    if(this.boss){this.boss.update(dt);if(this.laser){this.laser.t+=dt;if(this.laser.t>=this.laser.dur)this.laser=null}}
    this.collisions();this.particles.forEach(p=>p.update(dt));this.particles=this.particles.filter(p=>p.life>0);
    shake=Math.max(0,shake-dt*24);updateHUD()
    if(this.player.lives<=0)this.end()
    if(this.boss&&this.boss.hp<=0)this.victory()
  }
  spawnObstacle(){
    const y=rand(30,H-30);
    const speed=rand(120,190)*(this.stage===1?1.3:1);
    const p=new Projectile(W+30,y,-speed,0,rand(14,20),"fire");
    p.life=(W+120)/speed+1;
    this.projectiles.push(p);
    if(Math.random()<.32)this.coinsList.push(new Coin(W+100,clamp(y+rand(-100,100),60,H-60)))
  }
  collisions(){
    for(const p of this.projectiles)if(dist(p,this.player)<p.r+this.player.r*.65){p.life=0;this.player.hit()}
    for(const c of this.coinsList)if(dist(c,this.player)<c.r+this.player.r){c.x=-100;this.coins++;audio.sfx("coin");burst(c.x,c.y,"#ffe56a",14)}
    for(const s of this.shields)if(dist(s,this.player)<s.r+this.player.r){s.x=-100;this.player.shield=5;audio.sfx("shield");burst(this.player.x,this.player.y,"#6de8ff",18);showToast("KHIÊN ×5")}
    for(const o of this.orbs)if(dist(o,this.player)<o.r+this.player.r){o.x=-100;if(this.boss){this.boss.damage(1000,o.type);showToast({fire:"🔥 FIRE +1000",freeze:"❄ FREEZE +1000",wither:"☄ WITHER +1000"}[o.type])}}
    if(this.laser){const h=H/3,y=this.laser.lane*h;if(this.player.y>y+10&&this.player.y<y+h-10)this.player.hit()}
  }
  draw(){
    drawBackground(this.stage,this.bgT);
    ctx.save();if(shake){ctx.translate(rand(-shake,shake),rand(-shake,shake))}
    this.coinsList.forEach(x=>x.draw());this.shields.forEach(x=>x.draw());this.orbs.forEach(x=>x.draw());this.projectiles.forEach(x=>x.draw());
    if(this.boss)this.boss.draw();this.player.draw();this.particles.forEach(x=>x.draw());
    if(this.laser){ctx.fillStyle="rgba(255,40,70,.55)";ctx.fillRect(0,this.laser.lane*H/3,W,H/3);ctx.fillStyle="#fff";ctx.fillRect(0,this.laser.lane*H/3,W,5)}
    ctx.restore()
  }
  end(){if(!this.running)return;this.running=false;audio.stop();store.high=Math.max(store.high,this.score);store.coins+=this.coins;store.save();$("finalScore").textContent=this.score;$("finalCoins").textContent=this.coins;hideAll();$("gameover").classList.remove("hidden");$("reviveBox").classList.toggle("hidden",store.amulets<=0);if(store.amulets>0)startCountdown()}
  revive(){if(store.amulets<=0)return;store.amulets--;store.save();this.player.lives=1;this.player.inv=3;this.running=true;hideAll();$("hud").classList.remove("hidden");$("mobileControls").classList.remove("hidden");input.touch.clear();audio.start(this.stage);showToast("BÙA HỘ MỆNH — BẤT TỬ 3 GIÂY")}
  victory(){if(!this.running)return;this.running=false;audio.stop();this.coins+=100;store.coins+=this.coins;store.high=Math.max(store.high,this.score);store.save();$("winScore").textContent=this.score;hideAll();$("victory").classList.remove("hidden");audio.sfx("win")}
}
let game=new Game(),shake=0,countTimer=null;

function burst(x,y,c,n=12){for(let i=0;i<n;i++)game.particles.push(new Particle(x,y,c,rand(60,220),rand(.3,.9),rand(2,5)))}
function drawBackground(stage,t){
  const grads=[["#4fc3f7","#bfefff"],["#273b57","#111d31"],["#192f47","#080e1a"],["#f39b72","#7ec8df"]],g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,grads[stage][0]);g.addColorStop(1,grads[stage][1]);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  if(stage===2){ctx.strokeStyle="rgba(170,210,235,.32)";ctx.lineWidth=1;for(let x=0;x<W;x+=18){ctx.beginPath();ctx.moveTo(x,(t*420+x*2)%H);ctx.lineTo(x-35,(t*420+x*2)%H+70);ctx.stroke()}}
  for(let i=0;i<7;i++){let x=(i*190-t*25)%(W+260)-130,y=80+(i%3)*130;ctx.fillStyle=stage===0?"rgba(255,255,255,.42)":"rgba(5,15,28,.28)";ctx.beginPath();ctx.ellipse(x,y,80,25,0,0,TAU);ctx.ellipse(x+50,y-8,55,28,0,0,TAU);ctx.fill()}
  if(stage===3){ctx.fillStyle="rgba(255,255,220,.45)";ctx.beginPath();ctx.arc(W*.78,H*.25,55,0,TAU);ctx.fill()}
}
function updateHUD(){$("lives").textContent=game.player.lives;$("score").textContent=game.score;$("coins").textContent=game.coins;$("shield").textContent=game.player.shield;if(game.boss)$("bossHp").style.width=(game.boss.hp/game.boss.max*100)+"%"}
function hideAll(){["menu","shop","gameover","victory"].forEach(id=>$(id).classList.add("hidden"));$("hud").classList.add("hidden");$("mobileControls").classList.add("hidden");input.touch.clear()}
function showToast(s){const e=$("toast");e.textContent=s;e.style.opacity=1;clearTimeout(showToast.t);showToast.t=setTimeout(()=>e.style.opacity=0,1200)}
function refreshMenu(){$("menuHigh").textContent=store.high;$("menuCoins").textContent=store.coins;$("amulets").textContent=store.amulets}
function startCountdown(){clearInterval(countTimer);let n=10;$("countdown").textContent=n;countTimer=setInterval(()=>{n--;$("countdown").textContent=n;if(n<=0){clearInterval(countTimer);$("reviveBox").classList.add("hidden");store.save()}},1000)}

$("playBtn").onclick=()=>{audio.init();game.start()};
$("shopBtn").onclick=()=>{refreshMenu();$("menu").classList.add("hidden");$("shop").classList.remove("hidden")};
$("backBtn").onclick=()=>{refreshMenu();$("shop").classList.add("hidden");$("menu").classList.remove("hidden")};
$("buyBtn").onclick=()=>{if(store.coins>=50){store.coins-=50;store.amulets++;store.save();refreshMenu();showToast("ĐÃ MUA BÙA HỘ MỆNH")}else showToast("CHƯA ĐỦ XU")};
$("retryBtn").onclick=()=>{clearInterval(countTimer);game.start()};
$("menuBtn").onclick=$("winMenuBtn").onclick=()=>{clearInterval(countTimer);game.running=false;refreshMenu();hideAll();$("menu").classList.remove("hidden")};
$("reviveBtn").onclick=()=>{clearInterval(countTimer);game.revive()};

function loop(ts){const dt=Math.min((ts-last)/1000||0,.033);last=ts;if(game.running)game.update(dt);game.draw();requestAnimationFrame(loop)}
refreshMenu();requestAnimationFrame(loop);
})();