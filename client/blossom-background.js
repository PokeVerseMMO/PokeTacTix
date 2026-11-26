// Animated landscape behind the existing lobby UI and commander viewport.
(() => {
  const canvas = document.getElementById("blossomBackdrop");
  const menu = document.getElementById("menu");
  const playMotion = document.getElementById("playBackgroundMotion");
  const motionSelect = document.getElementById("backgroundMotion");
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    motionSelect.disabled = true;
    return;
  }

  const presets = {
    Low: { width: 768, fps: 20, petals: 34, streams: 23, spray: 14, bannerStep: 9, branchStep: 24 },
    Medium: { width: 1024, fps: 26, petals: 46, streams: 30, spray: 22, bannerStep: 8, branchStep: 22 },
    High: { width: 1280, fps: 30, petals: 58, streams: 39, spray: 27, bannerStep: 8, branchStep: 21 }
  };
  const preference = localStorage.quality;
  const quality = Object.hasOwn(presets, preference) ? presets[preference] : presets.High;
  const SCENE_WIDTH = quality.width;
  const SCENE_HEIGHT = Math.round(SCENE_WIDTH * 9 / 16);
  canvas.width = SCENE_WIDTH;
  canvas.height = SCENE_HEIGHT;

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const savedMotion = localStorage.getItem("backgroundMotion");
  let motionMode = savedMotion === "on" || savedMotion === "off" ? savedMotion : "system";
  motionSelect.value = motionMode;
  const artwork = new Image();

  const clamp = (v, lo=0, hi=1) => Math.max(lo,Math.min(hi,v));
  const smooth = (v) => { const n=clamp(v); return n*n*(3-2*n); };
  const mod = (v,n) => ((v%n)+n)%n;
  const mix = (a,b,t) => a+(b-a)*t;
  function randomSource(seed) {
    return () => {
      seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }
  const random = randomSource(2719);
  const petals = Array.from({length:quality.petals}, () => ({
    x:random(), y:random(), speed:random(), bend:random(), size:random(), color:Math.floor(random()*4),
    rotation:random()*Math.PI*2, depth:random()
  })).sort((a,b) => a.depth - b.depth);
  const water = Array.from({length:quality.streams}, () => ({
    phase:random(), edge:random(), speed:random(), width:random(), length:random()
  }));
  const spray = Array.from({length:quality.spray}, () => ({
    phase:random(), x:random(), vx:random(), vy:random(), size:random()
  }));
  const petalsPalette = ["#ffe5ea","#f3b7ce","#e883b0","#f7cadc"];
  function makeCanvas(width,height) {
    const canvas = document.createElement("canvas");
    canvas.width=width; canvas.height=height;
    return canvas;
  }
  function makePuff(seed) {
    const canvas = makeCanvas(260,116), context=canvas.getContext("2d"), rng=randomSource(seed);
    for (let i=0;i<33;i++) {
      const along=rng(), x=mix(32,228,along), y=58+mix(-20,21,rng());
      const radius=mix(15,43,rng()) * (0.6+0.4*Math.sin(along*Math.PI));
      context.save();
      context.translate(x,y);
      context.scale(1.30,.69);
      const g=context.createRadialGradient(0,0,1,0,0,radius);
      g.addColorStop(0,"rgba(221,238,255,.23)");
      g.addColorStop(.32,"rgba(189,216,245,.15)");
      g.addColorStop(1,"rgba(173,205,245,0)");
      context.fillStyle=g;
      context.fillRect(-radius,-radius,radius*2,radius*2);
      context.restore();
    }
    return canvas;
  }
  const puffs=[makePuff(40),makePuff(77),makePuff(121)];
  function makePatch(x,y,width,height,feather) {
    x=Math.round(x*SCENE_WIDTH); y=Math.round(y*SCENE_HEIGHT);
    width=Math.round(width*SCENE_WIDTH); height=Math.round(height*SCENE_HEIGHT);
    const canvas=makeCanvas(width,height), ctx=canvas.getContext("2d");
    const mask=makeCanvas(width,height), m=mask.getContext("2d");
    for (const axis of [0,1]) {
      const g=m.createLinearGradient(0,0,axis===0?width:0,axis===1?height:0);
      const start=feather[axis*2], end=feather[axis*2+1];
      if(start)g.addColorStop(0,"transparent");
      g.addColorStop(start,"black"); g.addColorStop(1-end,"black");
      if(end)g.addColorStop(1,"transparent");
      if(axis)m.globalCompositeOperation="destination-in";
      m.fillStyle=g; m.fillRect(0,0,width,height);
    }
    return { x,y,width,height,canvas,ctx,mask };
  }
  const leftTree=makePatch(0,0,.56,.34,[0,.19,0,.24]);
  const rightTree=makePatch(.84,.11,.16,.45,[.32,0,.19,.20]);
  const banner=makePatch(.153,.306,.075,.247,[.18,.2,.12,.16]);
  function deform(context,p,t,wind,kind) {
    const {ctx,x,y,width,height,canvas,mask}=p;
    const sourceX=artwork.naturalWidth/SCENE_WIDTH, sourceY=artwork.naturalHeight/SCENE_HEIGHT;
    ctx.clearRect(0,0,width,height);
    const step = kind === "banner" ? quality.bannerStep : quality.branchStep;
    for (let j=0;j<height;j+=step) {
      for (let i=0;i<width;i+=step) {
        const u=(i+step*.5)/width,v=(j+step*.5)/height;
        const anchor=kind==="banner"?Math.pow(v,1.15):kind==="left"?u*.83+v*.17:(1-u)*.78+v*.22;
        const wave=Math.sin(t*1.55-v*5-u*2)*2.6+Math.sin(t*.84+v*3)*4.2;
        const dx=anchor*wind*(wave+(kind==="banner"?2.5:2));
        const dy=anchor*wind*(Math.sin(t*1.26-u*4+v)*2.2 + Math.cos(t*.74+u*3)*.9);
        const dw=Math.min(step,width-i),dh=Math.min(step,height-j);
        const sx=clamp(x+i-dx,0,SCENE_WIDTH-dw),sy=clamp(y+j-dy,0,SCENE_HEIGHT-dh);
        ctx.drawImage(artwork,sx*sourceX,sy*sourceY,dw*sourceX,dh*sourceY,i,j,dw,dh);
      }
    }
    ctx.globalCompositeOperation="destination-in"; ctx.drawImage(mask,0,0);
    ctx.globalCompositeOperation="source-over";
    context.drawImage(canvas,x,y);
  }
  function drawWater(context,t,amount) {
    context.save();
    context.beginPath();
    context.moveTo(.815*SCENE_WIDTH,.276*SCENE_HEIGHT); context.lineTo(.855*SCENE_WIDTH,.275*SCENE_HEIGHT);
    context.bezierCurveTo(.844*SCENE_WIDTH,.364*SCENE_HEIGHT,.844*SCENE_WIDTH,.449*SCENE_HEIGHT,.829*SCENE_WIDTH,.547*SCENE_HEIGHT);
    context.lineTo(.789*SCENE_WIDTH,.568*SCENE_HEIGHT);
    context.bezierCurveTo(.801*SCENE_WIDTH,.466*SCENE_HEIGHT,.804*SCENE_WIDTH,.369*SCENE_HEIGHT,.815*SCENE_WIDTH,.276*SCENE_HEIGHT);
    context.closePath(); context.clip(); context.lineCap="round";
    for (const stream of water) {
      const phase=mod(stream.phase+t*mix(.22,.55,stream.speed),1);
      const lineY=.279+phase*.281, lineX=.821-.021*phase+stream.edge*.025;
      const reach=mix(.014,.051,stream.length)*(1+phase*.35);
      const fade=smooth(phase*15)*smooth((1-phase)*10);
      const length=reach*SCENE_HEIGHT;
      context.globalAlpha=fade*amount*mix(.23,.69,stream.width);
      context.strokeStyle=stream.width>.68?"#e4fbff":"#6ce9ff";
      context.lineWidth=mix(.8,2.6,stream.width);
      context.beginPath();
      context.moveTo(lineX*SCENE_WIDTH,lineY*SCENE_HEIGHT-length);
      context.quadraticCurveTo(lineX*SCENE_WIDTH-1,lineY*SCENE_HEIGHT-length*.34,lineX*SCENE_WIDTH-2.2,lineY*SCENE_HEIGHT);
      context.stroke();
    }
    context.restore();
    context.save();
    context.fillStyle="#e2f9ff";
    for (const particle of spray) {
      const f=mod(t*.71+particle.phase,1);
      const x=(.808+particle.x*.020)*SCENE_WIDTH+(particle.vx-.33)*58*f;
      const y=.548*SCENE_HEIGHT-(10+22*particle.vy)*Math.sin(f*2.31)+f*2;
      context.globalAlpha=amount*.43*Math.sin(f*Math.PI);
      context.beginPath(); context.ellipse(x,y,mix(.65,1.8,particle.size),.65,0,0,Math.PI*2); context.fill();
    }
    context.restore();
  }

  // These narrower falls stay visible in the gap between the trainer and the skill panel.
  const farFalls = [
    { x: .575, y: .315, width: .012, height: .122 },
    { x: .614, y: .317, width: .008, height: .098 }
  ];
  function drawFarWater(context, elapsed) {
    context.save();
    context.lineCap = "round";
    context.strokeStyle = "#e4f8ff";
    for (const [index, stream] of water.entries()) {
      const fall = farFalls[index % farFalls.length];
      const phase = mod(stream.phase + elapsed * mix(.30, .72, stream.speed), 1);
      const x = (fall.x + (stream.edge - .5) * fall.width - phase * .0018) * SCENE_WIDTH;
      const y = (fall.y + phase * fall.height) * SCENE_HEIGHT;
      const length = mix(.010, .035, stream.length) * SCENE_HEIGHT;
      context.globalAlpha = .41 * smooth(phase * 12) * smooth((1 - phase) * 8);
      context.lineWidth = mix(.65, 1.65, stream.width);
      context.beginPath();
      context.moveTo(x, Math.max(fall.y * SCENE_HEIGHT, y - length));
      context.lineTo(x - 1, y);
      context.stroke();
    }
    context.restore();
  }

  const cloudBanks = [
    [.011, .505, .31, .129, .006, .42],
    [.267, .549, .36, .174, .010, .55],
    [.356, .404, .31, .098, .013, .30],
    [.560, .504, .28, .134, .008, .55],
    [.689, .571, .29, .129, .016, .76],
    [.891, .529, .20, .123, .013, .59]
  ];
  function drawMist(context, t) {
    context.save();
    for (const [index, [x, y, width, height, speed, alpha]] of cloudBanks.entries()) {
      const offsetX = Math.sin(t * speed * 13 + index * 1.7) * .102;
      const offsetY = Math.cos(t * .24 + index) * .014;
      context.globalAlpha = alpha;
      context.drawImage(
        puffs[index % puffs.length],
        (x + offsetX - width * .45) * SCENE_WIDTH,
        (y + offsetY - height * .40) * SCENE_HEIGHT,
        width * SCENE_WIDTH,
        height * SCENE_HEIGHT
      );
    }
    context.restore();
  }
  function drawPetals(context,t,wind) {
    context.save();
    for (const petal of petals) {
      const cycle=5.1+petal.speed*7.1+(.55-petal.depth)*2.8;
      const f=mod(petal.y+t/cycle,1);
      const turn=petal.rotation+t*(1+petal.speed*2.8);
      const gust=Math.sin(t*1.14+petal.bend*5)*wind*.021;
      const lane=(petal.x>.72?.76:0)+petal.x*.62;
      const x=(mod(lane+f*mix(.16,.48,petal.depth)*wind+gust+.04,1.14)-.094)*SCENE_WIDTH;
      const y=(f*.93-.12+Math.sin(turn*.49)*.021)*SCENE_HEIGHT;
      const size=mix(2.3,8.9,petal.size)*mix(.67,1.38,petal.depth);
      context.globalAlpha=mix(.27,.91,petal.depth)*smooth(f*10)*smooth((1-f)*9);
      context.fillStyle=petalsPalette[petal.color];
      context.save(); context.translate(x,y); context.rotate(turn);
      context.scale(.37+.63*Math.abs(Math.cos(turn*.75)),1);
      context.beginPath(); context.moveTo(-size*.65,0);
      context.quadraticCurveTo(-size*.1,-size*.6,size*.62,-size*.08);
      context.quadraticCurveTo(size*.29,size*.59,-size*.65,0);
      context.fill(); context.restore();
    }
    context.restore();
  }
  const lights=[[.386,.495],[.411,.486],[.439,.476],[.469,.470],[.500,.467],[.531,.472],[.561,.481],[.590,.496],[.611,.511]];
  function drawArenaActivity(context,t) {
    const event = mod(t - 1.1, 34);
    context.save();
    context.globalCompositeOperation="screen";
    for (let i=0;i<lights.length;i++) {
      const [x,y]=lights[i],time=event-1.25-i*.37;
      const gain=smooth(time*1.4)*smooth((8.2-event)*.57);
      if(gain===0)continue;
      const px=x*SCENE_WIDTH,py=y*SCENE_HEIGHT;
      context.globalAlpha=gain*.84;
      const g=context.createRadialGradient(px,py,0,px,py,12);
      g.addColorStop(0,"#fff0c7"); g.addColorStop(.38,"#ffcb7b89"); g.addColorStop(1,"#ffa85100");
      context.fillStyle=g; context.fillRect(px-12,py-12,24,24);
      context.fillStyle="#fff2c4"; context.beginPath(); context.arc(px,py,1.5,0,Math.PI*2); context.fill();
    }
    const boardGlow=smooth((event-4.5)*.67)*smooth((8.2-event)*.58);
    if(boardGlow) {
      context.globalAlpha=boardGlow*.42;
      context.strokeStyle="#ffe2a0"; context.lineWidth=2;
      context.beginPath(); context.ellipse(.49*SCENE_WIDTH,.511*SCENE_HEIGHT,.08*SCENE_WIDTH,.026*SCENE_HEIGHT,-.024,0,Math.PI*2); context.stroke();
    }
    context.restore();
    const flight = mod(event + .85, 34);
    if(flight>7.9)return;
    context.save(); context.lineWidth=1.1; context.lineCap="round"; context.strokeStyle="#354768";
    for (let i=0;i<6;i++) {
      const step=(flight-i*.28)/7.1;
      if(step<=0||step>=1)continue;
      context.globalAlpha=.57*smooth(step*10)*smooth((1-step)*7);
      const x=(.31+step*.44)*SCENE_WIDTH, y=(.335-step*.053)*SCENE_HEIGHT+Math.sin(t*1.9+i)*2.7+i%2*6;
      const span=4.8+(i%3)*.7, lift=1.3+Math.sin(t*8.2+i*1.47)*2.2;
      context.beginPath(); context.moveTo(x-span,y-lift);
      context.quadraticCurveTo(x-span*.41,y-lift-1.7,x,y);
      context.quadraticCurveTo(x+span*.41,y-lift-1.7,x+span,y-lift);
      context.stroke();
    }
    context.restore();
  }

  function drawScene(elapsed) {
    const wind = (1 + Math.sin(elapsed * 1.04) * .26 + Math.sin(elapsed * 2.2) * .15) * 1.28;
    const zoom = 1.034 + Math.sin(elapsed * .24) * .003;
    const offsetX = Math.sin(elapsed * .29) * SCENE_WIDTH * .005;
    const offsetY = Math.sin(elapsed * .19) * SCENE_HEIGHT * .004;

    context.save();
    const pivotX = SCENE_WIDTH * .5;
    const pivotY = SCENE_HEIGHT * .75;
    context.translate(pivotX + offsetX, pivotY + offsetY);
    context.scale(zoom, zoom);
    context.translate(-pivotX, -pivotY);
    context.drawImage(artwork, 0, 0, SCENE_WIDTH, SCENE_HEIGHT);

    drawFarWater(context, elapsed);
    drawMist(context, elapsed);
    drawWater(context, elapsed, 1.13);
    deform(context, leftTree, elapsed, wind, "left");
    deform(context, rightTree, elapsed, wind, "right");
    deform(context, banner, elapsed, wind * 1.28, "banner");
    drawArenaActivity(context, elapsed);
    drawPetals(context, elapsed, wind);
    context.restore();
  }

  let ready = false;
  let request = 0;
  let lastDraw;
  let elapsed = 0;
  const interval = 1000 / quality.fps;

  function animate(now) {
    lastDraw ??= now;
    const delta = now - lastDraw;
    if (delta >= interval - 1) {
      elapsed += delta / 1000;
      drawScene(elapsed);
      lastDraw = now;
    }
    request = requestAnimationFrame(animate);
  }

  function syncPlayback() {
    const allowMotion = ready && (motionMode === "on" || (motionMode === "system" && !reduceMotion.matches));
    const visible = !menu.classList.contains("hidden") && !document.hidden;
    menu.dataset.motion = motionMode === "system" ? (reduceMotion.matches ? "off" : "on") : motionMode;
    canvas.classList.toggle("is-animated", allowMotion);
    playMotion.classList.toggle("hidden", allowMotion || !ready);
    if (allowMotion && visible) {
      if (!request) {
        lastDraw = undefined;
        drawScene(elapsed);
        request = requestAnimationFrame(animate);
      }
    } else if (request) {
      cancelAnimationFrame(request);
      request = 0;
    }
  }

  function changeMotion(mode) {
    motionMode = mode;
    localStorage.setItem("backgroundMotion", mode);
    motionSelect.value = mode;
    syncPlayback();
  }

  motionSelect.addEventListener("change", () => changeMotion(motionSelect.value));
  playMotion.addEventListener("click", () => changeMotion("on"));
  new MutationObserver(syncPlayback).observe(menu, { attributes: true, attributeFilter: ["class"] });
  document.addEventListener("visibilitychange", syncPlayback);
  reduceMotion.addEventListener("change", syncPlayback);
  syncPlayback();

  artwork.src = new URL("./art/environment/blossom-overlook.webp", import.meta.url).href;
  artwork.decode().then(() => {
    ready = true;
    syncPlayback();
  }).catch(() => {
    // The backdrop's CSS preserves a usable menu if the artwork cannot load.
  });
})();
