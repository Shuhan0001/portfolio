/* The same scan travels between chapters. This overlay never owns input or layout. */
(() => {
  'use strict';
  const T = window.THREE;
  if (!T) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = x => Math.max(0, Math.min(1, x));
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const settle = x => { x = clamp(x); return x*x*x*(x*(x*6-15)+10); };
  const host = document.getElementById('hero-david');
  const target = document.querySelector('.logic-david');
  if (!host || !target) return;
  let renderer, scene, camera, layer, snapshot, pieces = [], frame = 0, disposed = false;
  let width = 0, height = 0, lastSourceWidth = 0;
  const vertexHeader = `uniform mat4 journeyFrom; uniform mat4 journeyTo;
    uniform vec2 journeyOrigin; uniform vec2 journeyRail;
    uniform float journeyScale; uniform float journeyDepart; uniform float journeyArrive;
    uniform float journeyAngle; uniform float journeyAspect; uniform float journeyTilt;
    uniform float journeyGap; uniform float journeyLightMix; uniform mat4 journeyLighting; uniform mat3 journeyNormal; uniform vec2 journeyPaperOffset; uniform float journeyOpacity;`;
  const project = `vec4 ja=journeyFrom*vec4(position,1.0); vec4 jb=journeyTo*vec4(position,1.0);
    vec3 jp=ja.xyz/ja.w; vec3 jq=jb.xyz/jb.w;
    vec2 delta=(jp.xy-journeyOrigin)*vec2(journeyAspect,1.0);
    float cs=cos(journeyAngle),sn=sin(journeyAngle);
    delta.y*=cos(journeyTilt);
    delta=mat2(cs,sn,-sn,cs)*delta;
    vec3 jr=vec3(journeyRail+delta/vec2(journeyAspect,1.0)*journeyScale,jp.z);
    vec3 assembled=mix(mix(jp,jr,journeyDepart),jq,journeyArrive);
    float arch=sin(journeyArrive*3.14159265);
    assembled.y+=arch*arch*0.045+journeyGap;
    gl_Position=vec4(assembled,1.0);`;
  function screenMatrix(cam, rect) {
    // Convert a canvas camera into the full-window clip space without changing the model.
    const viewport = new T.Matrix4().set(rect.width / innerWidth,0,0,(rect.left * 2 + rect.width) / innerWidth - 1,
      0,rect.height / innerHeight,0,1-(rect.top * 2 + rect.height) / innerHeight, 0,0,1,0, 0,0,0,1);
    return viewport.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
  }
  function releasePieces() {
    pieces.forEach(piece => { scene.remove(piece.mesh); piece.mesh.material.forEach(material => material.dispose()); });
    pieces = [];
  }
  function setup() {
    const source = window.portfolioDavidSource?.sample(.52);
    if (!source) return false;
    if (!renderer) {
      try { renderer = new T.WebGLRenderer({ alpha:true, antialias:true, powerPreference:'low-power' }); }
      catch (_) { return false; }
      renderer.setClearColor(0,0); renderer.outputColorSpace = T.SRGBColorSpace;
      layer = document.createElement('div'); layer.className = 'david-journey'; layer.setAttribute('aria-hidden','true');
      layer.append(renderer.domElement); document.body.append(layer); scene = new T.Scene();
      renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); restore(); });
    }
    releasePieces(); snapshot = source; camera = source.camera;
    // At departure the hero is pinned to the viewport, regardless of its later document position.
    const rect = { left:0, top:0, width:innerWidth, height:innerHeight };
    const view = screenMatrix(camera,rect);
    for (const part of source.meshes) {
      const from = view.clone().multiply(part.matrix);
      const origin = new T.Vector3().applyMatrix4(from);
      const uniforms = {
        journeyFrom:{value:from}, journeyTo:{value:from.clone()}, journeyOrigin:{value:new T.Vector2(origin.x,origin.y)},
        journeyRail:{value:new T.Vector2()}, journeyScale:{value:.1}, journeyDepart:{value:0}, journeyArrive:{value:0},
        journeyAngle:{value:0}, journeyAspect:{value:innerWidth/innerHeight}, journeyTilt:{value:0}, journeyGap:{value:0}, journeyLightMix:{value:0}, journeyLighting:{value:new T.Matrix4()}, journeyNormal:{value:new T.Matrix3()}, journeyPaperOffset:{value:new T.Vector2()}, journeyOpacity:{value:1}
      };
      const materials = part.material.map(original => {
        const material = original.clone();
        material.transparent = true;
        material.onBeforeCompile = shader => {
          Object.assign(shader.uniforms,uniforms);
          shader.vertexShader = vertexHeader + '\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace('surfaceNormal = normalize(normalMatrix * normal);', 'surfaceNormal = normalize(mix(normalMatrix * normal, journeyNormal * normal, journeyLightMix));').replace('eye = normalize(-view.xyz);', 'eye = normalize(mix(-view.xyz, -(journeyLighting * vec4(position,1.0)).xyz, journeyLightMix));');
          shader.fragmentShader = vertexHeader + '\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('gl_FragCoord.xy / pixelRatio', '(gl_FragCoord.xy / pixelRatio - journeyPaperOffset * journeyLightMix)').replace('silver *= 0.91+hash(floor(paper))*0.09;', 'silver *= (0.91+hash(floor(paper))*0.09) * mix(1.0,0.835,journeyLightMix);');
          shader.fragmentShader = shader.fragmentShader.replace(/}\s*$/, 'gl_FragColor.a *= journeyOpacity; }');
          shader.vertexShader = shader.vertexShader.replace('gl_Position = projectionMatrix * view;',project)
            .replace('#include <project_vertex>',project);
        };
        material.customProgramCacheKey = () => 'david-journey-v10';
        return material;
      });
      const mesh = new T.Mesh(part.geometry,materials); mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(part.matrix); mesh.frustumCulled = false; scene.add(mesh);
      part.geometry.computeBoundingBox();
      const box = part.geometry.boundingBox;
      let min = Infinity, max = -Infinity;
      for (const x of [box.min.x,box.max.x]) for (const y of [box.min.y,box.max.y]) for (const z of [box.min.z,box.max.z]) {
        const v = new T.Vector3(x,y,z).applyMatrix4(from); min = Math.min(min,v.x); max = Math.max(max,v.x);
      }
      pieces.push({mesh,uniforms,span:Math.max(.01,max-min)});
    }
    lastSourceWidth = innerWidth; return true;
  }
  function restore() {
    host.style.removeProperty('visibility');
    host.querySelector('canvas')?.style.removeProperty('opacity');
    const destination = window.portfolioDavidDestination?.read();
    destination?.canvas.style.removeProperty('opacity');
    target.parentElement.style.removeProperty('--journey-guides');
    if (layer) layer.hidden = true;
  }
  function draw() {
    frame = 0;
    if (disposed || document.hidden || reduced.matches) { restore(); return; }
    const phase = window.davidScrollProgress || 0;
    const rect = target.getBoundingClientRect();
    // Let the original camera pass through the actual slices first. The narrow
    // stream emerges only after the camera has crossed the sculpture's centre.
    if (phase < .86 || rect.bottom < 0 || rect.top < -innerHeight) { restore(); return; }
    const arrival = clamp((innerHeight * 1.08 - rect.top) / (innerHeight * .94));
    const destination = window.portfolioDavidDestination?.read();
    if (arrival >= 1 || destination?.active >= 0) { restore(); return; }
    if (!snapshot || lastSourceWidth !== innerWidth) { if (!setup()) { restore(); return; } }
    if (rect.top < innerHeight * 2) window.portfolioDavidDestination?.prepare();
    if (width !== innerWidth || height !== innerHeight) {
      width = innerWidth; height = innerHeight;
      renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); renderer.setSize(width,height,false);
    }
    layer.hidden = false;
    // The original scene retains its camera, lens distortion and exit fade.
    // The travelling fragments never replace or hide that render.
    const emergence = smooth((phase-.86)/.13);
    const merge = destination ? arrival : 0;
    const quiet = 1-settle(merge/.24);
    const gather = settle((merge-.12)/.76);
    const close = settle((merge-.72)/.24);
    const sliceOrder = Math.sign(pieces[0].uniforms.journeyOrigin.value.y-pieces[pieces.length-1].uniforms.journeyOrigin.value.y) || 1;
    const targetView = destination && screenMatrix(destination.camera,rect);
    const progress = clamp((scrollY - (window.ScrollTrigger?.getById('home-sculpture')?.end || 0)) /
      Math.max(1,rect.top + scrollY - innerHeight * .94));
    const flow = scrollY / Math.max(1,innerHeight) * .55;
    // Fixed, uneven timing keeps the entrance organic and reversible on scroll.
    const entranceOffsets = [0,.024,.008,.049,.037,.067,.056];
    const entranceDurations = [.071,.062,.083,.068,.079,.061,.074];
    pieces.forEach((piece,i) => {
      const u = piece.uniforms;
      const mobile = innerWidth < 640;
      const gutter = mobile ? 25 : Math.min(58,innerWidth*.045);
      // Equal visual widths keep the left-hand stream quiet and consistent.
      const wave = flow-i*.64;
      const revealed = settle((phase-.86-(entranceOffsets[i] ?? .06))/(entranceDurations[i] ?? .074));
      u.journeyOpacity.value = revealed;
      const x = gutter + Math.sin(wave)*(mobile?7:19)*quiet
        - (1-revealed)*(mobile?55:150);
      const y = height * (.07+i*.11+progress*.13+Math.sin(wave*.7+i)*.025*quiet);
      const size = mobile ? 34 : 76;
      const angle = Math.sin(wave*.65+i*.4)*.22 + Math.sin(i*2)*.06;
      // Each slice eases to its exact resting position before the final handoff.
      u.journeyRail.value.set(x/width*2-1,1-y/height*2);
      u.journeyScale.value = size/width*2/piece.span;
      u.journeyAngle.value = angle*quiet;
      u.journeyTilt.value = 0;
      u.journeyAspect.value = width/height;
      u.journeyDepart.value = 1;
      u.journeyArrive.value = gather;
      u.journeyGap.value = sliceOrder*((pieces.length-1)/2-i)*(mobile?5:9)/height*2*gather*(1-close);
      if (targetView && destination.meshes[i]) {
        u.journeyTo.value.copy(targetView).multiply(destination.meshes[i].matrixWorld);
        u.journeyLighting.value.multiplyMatrices(destination.camera.matrixWorldInverse,destination.meshes[i].matrixWorld);
        u.journeyNormal.value.getNormalMatrix(u.journeyLighting.value);
      }
      u.journeyLightMix.value = gather;
      u.journeyPaperOffset.value.set(rect.left,height-rect.bottom);
      piece.mesh.material.forEach(material => {
        if (material.uniforms?.pixelRatio) material.uniforms.pixelRatio.value = renderer.getPixelRatio();
        if (material.uniforms?.dotPitch) material.uniforms.dotPitch.value = (innerWidth<640?2.6:3.2)*(1-gather)+2.4*gather;
      });
    });
    const handoff = settle((merge-.96)/.04);
    target.parentElement.style.setProperty('--journey-guides',String(settle((merge-.94)/.06)));
    layer.style.opacity = String(1-handoff);
    if (destination) destination.canvas.style.opacity = merge >= .96 ? '1' : '0';
    renderer.render(scene,camera);
    // During assembly the destination also eases into its resting pose.
    if (merge > 0) schedule();
  }
  function schedule() { if (!frame && !disposed) frame = requestAnimationFrame(draw); }
  addEventListener('scroll',schedule,{passive:true}); addEventListener('resize',() => { snapshot = null; schedule(); },{passive:true});
  addEventListener('david:progress',schedule);
  reduced.addEventListener('change',schedule);
  document.addEventListener('visibilitychange',schedule);
  addEventListener('pageshow',schedule);
  addEventListener('pagehide',event => {
    cancelAnimationFrame(frame); frame = 0; restore();
    if (event.persisted) return;
    disposed = true; if (scene) releasePieces(); renderer?.dispose(); layer?.remove();
  });
  schedule();
})();
