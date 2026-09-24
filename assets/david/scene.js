/* global THREE */
(() => {
  'use strict';
  const host = document.getElementById('hero-david');
  if (!host || !window.THREE || !window.DAVID_MODEL_GZIP) return;
  const T = THREE, motion = matchMedia('(prefers-reduced-motion: reduce)');
  const scene = new T.Scene(), sculpture = new T.Group();
  const camera = new T.PerspectiveCamera(35, 1, 0.1, 60);
  camera.position.set(0, 0.25, 10); camera.lookAt(0, 0, 0);
  scene.add(sculpture);
  const slices = [];
  let renderer, frame = 0, visible = true, disposed = false, ready = false;
  let idleTime = 0, lastRenderTime = 0;
  let target = window.davidScrollProgress || 0, progress = target;
  let headScale = 0.8, homeX = 0, splitShrink = 0.25;
  const pointer = { x:0, y:0, active:false };
  const gaze = { x:0, y:0, weight:0 };
  let gazeCenterX = 0.70;
  const rootStyle = document.documentElement.style;

  // Coarse four-tone halftone: the black pixels are opaque so the back of
  // the mesh cannot show through. The damaged scan bands are spatial only;
  // there is deliberately no time uniform or animated noise.
  const surface = new T.ShaderMaterial({
    uniforms: { pixelRatio: { value: 1 }, dotPitch: { value: 3.2 } },
    vertexShader: `
      attribute vec3 scanPosition;
      varying vec3 point;
      varying vec3 surfaceNormal;
      varying vec3 eye;
      void main() {
        point = scanPosition;
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        surfaceNormal = normalize(normalMatrix * normal);
        eye = normalize(-view.xyz);
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      uniform float pixelRatio;
      uniform float dotPitch;
      varying vec3 point;
      varying vec3 surfaceNormal;
      varying vec3 eye;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec3 n = normalize(surfaceNormal);
        float key = max(0.0, dot(n, normalize(vec3(-0.85, 0.65, 1.1))));
        float fill = max(0.0, dot(n, normalize(vec3(0.6, 0.15, 0.8))));
        float rim = pow(1.0 - abs(dot(n, normalize(eye))), 3.0);
        float value = smoothstep(0.10,0.93,key * 0.76 + fill * 0.08 + rim * 0.20);
        vec2 paper = gl_FragCoord.xy / pixelRatio;
        vec2 grid = mat2(0.94,-0.342,0.342,0.94) * paper / dotPitch;
        float grain = hash(floor(grid));
        float tone = floor(clamp(value + (grain-0.5)*0.16,0.0,0.999)*4.0)/3.0;
        vec2 cell = fract(grid)-0.5;
        float radius = mix(0.07,0.62,tone);
        float dotInk = 1.0-smoothstep(radius-0.065,radius+0.065,length(cell));
        float ink = dotInk * step(0.025,value);
        // Sparse rectangular dropouts and two fixed scan interruptions make
        // the head read as a degraded digital print, not polished marble.
        float dropout = step(0.025,hash(floor(paper/vec2(9.0,3.0))));
        ink *= mix(dropout,1.0,0.35);
        float band = step(-0.44,point.y)*(1.0-step(-0.37,point.y));
        band += step(0.66,point.y)*(1.0-step(0.70,point.y));
        float scan = step(0.42,fract(paper.y/3.0));
        ink *= 1.0-band*(1.0-scan)*0.82;
        float silver = 0.006 + ink*(0.50+tone*0.45);
        silver *= 0.91+hash(floor(paper))*0.09;
        gl_FragColor = vec4(vec3(silver)*vec3(0.96,0.985,0.97),1.0);
      }
    `
  });
  const atlas = document.createElement('canvas');
  atlas.width = atlas.height = 1024;
  const ctx = atlas.getContext('2d');
  ctx.fillStyle = '#020303'; ctx.fillRect(0,0,1024,1024);
  const code = [
    'const self = new Human();', 'struct Memory { vec3 origin; };',
    'if (curiosity) { create(); }', 'vec3 form = position.xyz;',
    'return imagination * time;', 'void Update(float deltaTime) {',
    '  world.Step(deltaTime);', '  ideas.forEach(prototype);', '}',
    '// beneath the surface', 'float possibility = 1.0;',
    'mesh.slice(plane.normal);', 'system.on("play", explore);',
    'const future = await build();', '01001001 01000100 01000101 01000001'
  ];
  ctx.font = '24px monospace';
  for(let row=0;row<24;row++) {
    ctx.fillStyle = row%5===0?'#b6c9c4':row%3===0?'#728d85':'#435b53';
    ctx.fillText(String(row+1).padStart(2,'0'),22,34+row*42);
    ctx.fillText(code[row%code.length],72,34+row*42);
    ctx.fillText(code[(row+6)%code.length],586,34+row*42);
  }
  const texture = new T.CanvasTexture(atlas); texture.colorSpace = T.SRGBColorSpace;
  const core = new T.MeshBasicMaterial({map:texture,side:T.DoubleSide});
  const clamp = x=>Math.max(0,Math.min(1,x));
  const smooth = (a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
  function pose(p) {
    const reduced=motion.matches;
    const turn=reduced?0:smooth(0,0.82,p);
    const split=reduced?0:smooth(0.16,0.64,p);
    const escape=reduced?0:smooth(0.64,1,p);
    // Slow physical motion only; the printed grain and light stay steady.
    // Scroll gently takes over before the slices begin to open fully.
    const idle=reduced?0:1-smooth(0.02,0.24,p);
    const wander=idle*(1-gaze.weight);
    const follow=idle*gaze.weight;
    const floatY=Math.sin(idleTime*0.78)*0.065*idle;
    sculpture.rotation.set(
      -0.025+split*0.35+Math.sin(idleTime*0.68)*0.017*wander+(gaze.y*0.30-0.07)*follow,
      0.22+turn*0.9+Math.sin(idleTime*0.52)*0.07*wander+(gaze.x*0.75-0.55)*follow,
      -0.07+split*0.1+Math.sin(idleTime*0.62)*0.014*wander
    );
    sculpture.scale.setScalar(headScale*(1-split*splitShrink));
    sculpture.position.set(homeX*(1-smooth(0,0.38,p)),-0.03+floatY,0);
    core.visible=split>0.001;
    slices.forEach((slice,i)=>{
      const c=i-(slices.length-1)/2,sign=i%2===0?-1:1;
      slice.position.set(sign*split*(0.018+Math.abs(c)*0.04)+sign*escape*(2+Math.abs(c)*0.6),slice.userData.center+c*split*0.24+c*escape*0.5,split*Math.sin(i*1.7)*0.09+escape*(i%3-1)*1.7);
      slice.rotation.set(split*0.045*sign+escape*c*0.11,split*c*0.045+escape*sign*0.7,escape*sign*0.3);
    });
    host.style.opacity=String(1-smooth(0.88,1,p));
    rootStyle.setProperty('--stream-opacity',String(0.13+smooth(0.55,1,p)*0.87));
  }
  function render(now) {
    frame=0;
    if(disposed||!visible||document.hidden||!ready){lastRenderTime=0;return;}
    const idleActive=!motion.matches&&progress<0.24;
    const gazeWeight=pointer.active&&!motion.matches?1:0;
    const gazeMoving=idleActive&&(Math.abs(gaze.x-pointer.x)+Math.abs(gaze.y-pointer.y)+Math.abs(gaze.weight-gazeWeight)>0.002);
    // Idle movement needs only 30 fps; scroll updates remain unrestricted.
    if(idleActive&&!gazeMoving&&progress===target&&lastRenderTime&&now-lastRenderTime<1000/30){frame=requestAnimationFrame(render);return;}
    const delta=lastRenderTime?Math.min((now-lastRenderTime)/1000,0.1):1/60;
    lastRenderTime=now;
    if(idleActive)idleTime+=delta;
    const ease=1-Math.exp(-8*delta);
    gaze.x+=(pointer.x-gaze.x)*ease;
    gaze.y+=(pointer.y-gaze.y)*ease;
    gaze.weight+=(gazeWeight-gaze.weight)*ease;
    progress+=(target-progress)*(1-Math.exp(-9*delta));
    if(Math.abs(target-progress)<0.0002)progress=target;
    pose(progress);renderer.render(scene,camera);
    if(progress!==target||(!motion.matches&&progress<0.24))frame=requestAnimationFrame(render);
    else lastRenderTime=0;
  }
  function pauseRendering(){cancelAnimationFrame(frame);frame=0;lastRenderTime=0;}
  function schedule(){if(!frame&&!disposed&&ready&&visible&&!document.hidden)frame=requestAnimationFrame(render);}
  function resetPointer(){pointer.active=false;schedule();}
  function followPointer(event) {
    if(disposed||motion.matches||!visible||target>=0.24||(event.pointerType!=='mouse'&&event.pointerType!=='pen'))return;
    const rect=host.getBoundingClientRect();
    if(!rect.width||!rect.height||event.clientY<rect.top||event.clientY>rect.bottom){resetPointer();return;}
    // Aim relative to the head, rather than the center of the page.
    // Positive pitch looks down; positive yaw looks to screen right.
    pointer.x=T.MathUtils.clamp((event.clientX-rect.left-rect.width*gazeCenterX)/(rect.width*0.58),-1,1);
    pointer.y=T.MathUtils.clamp((event.clientY-rect.top-rect.height*0.53)/(rect.height*0.60),-1,1);
    pointer.active=true;schedule();
  }
  function resize() {
    if(!renderer)return;
    const w=host.clientWidth,h=host.clientHeight,small=w<900;
    pointer.active=false;
    const ratio=Math.min(devicePixelRatio,small?1.5:1.8);
    renderer.setPixelRatio(ratio);surface.uniforms.pixelRatio.value=ratio;
    splitShrink=small?0.14:0.25;
    surface.uniforms.dotPitch.value=small?2.6:3.2;
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
    const worldHeight=2*Math.tan(T.MathUtils.degToRad(camera.fov/2))*camera.position.z;
    // Keep the head woven through both title layers, including on large displays.
    const targetHeight=small?Math.min(w*0.99,h*0.47):Math.min(h*0.82,w*0.53);
    // Center the combined title/sculpture silhouette, keeping their overlap intact.
    // Match --hero-center-offset in CSS so both title layers move with the head.
    const centerOffset=small?0:Math.max(0,w*0.1435-targetHeight*0.24);
    gazeCenterX=small?0.50:0.70+centerOffset/w;
    headScale=targetHeight*worldHeight/(h*3.8)*0.90;
    homeX=small?0:worldHeight*camera.aspect*(0.18+centerOffset/w);
    host.style.setProperty('--sculpture-height',`${targetHeight}px`);
    schedule();
  }
  const unpack=(text,Ctor)=>{const bytes=Uint8Array.from(atob(text),c=>c.charCodeAt(0));return new Ctor(bytes.buffer);};
  async function init() {
    try {
      renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
      texture.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
      renderer.setClearColor(0x000000,0);renderer.outputColorSpace=T.SRGBColorSpace;
      renderer.domElement.setAttribute('aria-hidden','true');
      const stream=new Blob([unpack(window.DAVID_MODEL_GZIP,Uint8Array)]).stream().pipeThrough(new DecompressionStream('gzip'));
      const data=JSON.parse(await new Response(stream).text());
      if(disposed)return;
      data.forEach(part=>{
        const positions=Float32Array.from(unpack(part.position,Int16Array),x=>x/8192),scanPositions=positions.slice();
        const normals=Float32Array.from(unpack(part.normal,Int16Array),x=>x/32767),uv=new Float32Array(positions.length/3*2);
        for(let i=0;i<positions.length;i+=3){uv[i/3*2]=positions[i]/3+0.5;uv[i/3*2+1]=positions[i+2]/3+0.5;positions[i+1]-=part.center;}
        const g=new T.BufferGeometry(),indices=unpack(part.index,Uint32Array);
        g.setAttribute('position',new T.BufferAttribute(positions,3));g.setAttribute('scanPosition',new T.BufferAttribute(scanPositions,3));
        g.setAttribute('normal',new T.BufferAttribute(normals,3));g.setAttribute('uv',new T.BufferAttribute(uv,2));
        g.setIndex(new T.BufferAttribute(indices,1));g.addGroup(0,part.surfaceCount,0);g.addGroup(part.surfaceCount,indices.length-part.surfaceCount,1);g.computeBoundingSphere();
        const mesh=new T.Mesh(g,[surface,core]);mesh.userData.center=part.center;sculpture.add(mesh);slices.push(mesh);
      });
      delete window.DAVID_MODEL_GZIP;
      host.appendChild(renderer.domElement);resize();progress=target;pose(progress);renderer.render(scene,camera);
      host.classList.add('is-ready');host.dataset.state='ready';
      ready=true;schedule();
      renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();ready=false;pauseRendering();host.classList.remove('is-ready');host.dataset.state='fallback';});
      renderer.domElement.addEventListener('webglcontextrestored',()=>{ready=true;host.classList.add('is-ready');host.dataset.state='ready';schedule();});
    } catch(error) {host.dataset.state='fallback';if(renderer)renderer.dispose();console.warn('David uses its static fallback:',error);}
  }
  window.addEventListener('david:progress',event=>{target=clamp(event.detail);schedule();});
  window.addEventListener('scroll',()=>{if(!window.ScrollTrigger){target=clamp(scrollY/(innerHeight*1.9));schedule();}},{passive:true});
  window.addEventListener('pointermove',followPointer,{passive:true});
  window.addEventListener('pointerout',event=>{if(!event.relatedTarget)resetPointer();});
  window.addEventListener('blur',resetPointer);
  window.addEventListener('resize',resize,{passive:true});document.addEventListener('visibilitychange',()=>{if(document.hidden){resetPointer();pauseRendering();}else schedule();});motion.addEventListener('change',()=>{resetPointer();schedule();});
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)schedule();else pauseRendering();},{rootMargin:'100px'});observer.observe(host);
  window.addEventListener('pagehide',event=>{if(event.persisted){pauseRendering();return;}disposed=true;pauseRendering();observer.disconnect();slices.forEach(s=>s.geometry.dispose());surface.dispose();core.dispose();texture.dispose();if(renderer)renderer.dispose();});
  window.addEventListener('pageshow',schedule);
  init();
})();
