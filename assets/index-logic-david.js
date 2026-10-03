/* One shared David head. Its three middle pieces are the discipline controls. */
(() => {
  const capturedModel = window.DAVID_MODEL_GZIP;
  const start = () => {
  const host = document.querySelector('.logic-head-study .logic-david');
  const controls = [...document.querySelectorAll('#zone-1 .logic-toggle')];
  // This script runs between model.js and the hero scene, which releases the global.
  let compressed = capturedModel || window.DAVID_MODEL_GZIP;
  if (!host) return;
  if (controls.length !== 3 || !window.THREE) {
    host.hidden = true; host.parentElement.classList.remove('logic-head-study'); return;
  }
  host.dataset.state = 'waiting';
  const T = window.THREE, accordion = host.parentElement;
  const buttons = [...host.querySelectorAll('button')];
  const panels = controls.map(control => control.parentElement.querySelector('.accordion-panel'));
  controls.forEach((control, i) => {
    const preview = document.createElement('span');
    preview.className = 'logic-toggle__preview';
    preview.setAttribute('aria-hidden', 'true');
    preview.textContent = [...panels[i].querySelectorAll('.group\\/spec > div > span:first-child')]
      .slice(0, 2).map(item => item.textContent.trim()).join(' / ');
    control.append(preview);
  });
  const svgNS = 'http://www.w3.org/2000/svg';
  const guides = document.createElementNS(svgNS, 'svg');
  guides.classList.add('logic-david-guides'); guides.setAttribute('aria-hidden', 'true');
  const guideParts = controls.map(() => {
    const group = document.createElementNS(svgNS, 'g'); group.classList.add('logic-david-guide');
    const line = document.createElementNS(svgNS, 'line'), dot = document.createElementNS(svgNS, 'circle');
    dot.setAttribute('r', '2'); group.append(line, dot); guides.append(group);
    return { group, line, dot };
  });
  accordion.append(guides);
  let titleLeft = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const scene = new T.Scene(), sculpture = new T.Group();
  const camera = new T.OrthographicCamera(-4, 4, 4, -4, .1, 40);
  sculpture.rotation.set(.035, .22, -.035); scene.add(sculpture);
  const meshes = [], materials = [], middle = [4, 3, 2];
  let renderer, texture, cap, ready = false, loading = false, visible = false;
  let frame = 0, last = 0, active = -1, hover = -1, disposed = false;
  let fitPoints, fitCenter;
  let baseHeight = 700, canvasHeight = 700, pixelsPerUnit = 140;
  let panelHeights = [], fitSize, fittedPixels = 140, rest = 1;
  const reveal = [0, 0, 0], labelY = [null, null, null];
  const vertex = `attribute vec3 scanPosition;
    varying vec3 point; varying vec3 surfaceNormal; varying vec3 eye;
    void main(){point=scanPosition;vec4 view=modelViewMatrix*vec4(position,1.);
      surfaceNormal=normalize(normalMatrix*normal);eye=normalize(-view.xyz);
      gl_Position=projectionMatrix*view;}`;
  const fragment = `uniform float pixelRatio;uniform float emphasis;
    varying vec3 point;varying vec3 surfaceNormal;varying vec3 eye;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    void main(){vec3 n=normalize(surfaceNormal);
      float key=max(0.,dot(n,normalize(vec3(-.85,.65,1.1))));
      float fill=max(0.,dot(n,normalize(vec3(.6,.15,.8))));
      float rim=pow(1.-abs(dot(n,normalize(eye))),3.);
      float value=smoothstep(.10,.93,key*.76+fill*.08+rim*.20);
      vec2 paper=gl_FragCoord.xy/pixelRatio;
      vec2 grid=mat2(.94,-.342,.342,.94)*paper/2.4;
      float grain=hash(floor(grid));
      float tone=floor(clamp(value+(grain-.5)*.16,0.,.999)*4.)/3.;
      vec2 cell=fract(grid)-.5;float radius=mix(.07,.62,tone);
      float ink=(1.-smoothstep(radius-.065,radius+.065,length(cell)))*step(.025,value);
      ink*=mix(step(.025,hash(floor(paper/vec2(9.,3.)))),1.,.35);
      float band=step(-.44,point.y)*(1.-step(-.37,point.y));
      band+=step(.66,point.y)*(1.-step(.70,point.y));
      ink*=1.-band*(1.-step(.42,fract(paper.y/3.)))*.82;
      float silver=.006+ink*(.50+tone*.45);
      silver*=.91+hash(floor(paper))*.09;
      silver*=.70+emphasis*.30;
      gl_FragColor=vec4(vec3(silver)*vec3(.96,.985,.97),1.);}`;
  const unpack = (text, Ctor) => {
    const bytes = Uint8Array.from(atob(text), c => c.charCodeAt(0));
    return new Ctor(bytes.buffer);
  };
  function pause() { cancelAnimationFrame(frame); frame = 0; last = 0; }
  function schedule() {
    if (!frame && visible && ready && !disposed && !document.hidden) frame = requestAnimationFrame(render);
  }
  function sync() {
    active = controls.findIndex(control => control.getAttribute('aria-expanded') === 'true');
    buttons.forEach((button, i) => button.setAttribute('aria-expanded', String(i === active)));
    schedule();
  }
  buttons.forEach((button, i) => {
    button.setAttribute('aria-controls', controls[i].getAttribute('aria-controls'));
    button.addEventListener('click', () => controls[i].click());
    [button, controls[i]].forEach(target => {
      target.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') { hover = i; schedule(); } });
      target.addEventListener('pointerleave', () => { hover = -1; schedule(); });
      target.addEventListener('focus', () => { hover = i; schedule(); });
      target.addEventListener('blur', () => { hover = -1; schedule(); });
    });
  });
  accordion.addEventListener('keydown', event => {
    if (event.key === 'Escape' && active >= 0) {
      const control = controls[active]; control.click(); control.focus({ preventScroll: true });
    }
    const index = controls.indexOf(document.activeElement);
    if (index < 0 || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowDown' ? 1 : 2)) % 3;
    controls[next].focus({ preventScroll: true });
  });
  const stateObserver = new MutationObserver(sync);
  controls.forEach(control => stateObserver.observe(control, { attributes: true, attributeFilter: ['aria-expanded'] }));
  sync();
  function resize() {
    if (!ready || !renderer || !host.clientWidth || !host.clientHeight) return;
    // Preserve the reading composition; the closed view has a slightly fuller silhouette.
    baseHeight = innerWidth < 640 ? Math.min(440, Math.max(340, innerHeight * .45)) : Math.min(780, Math.max(600, innerHeight * .92));
    panelHeights = panels.map(panel => panel.offsetHeight);
    titleLeft = controls[0].offsetLeft;
    canvasHeight = baseHeight;
    host.style.height = canvasHeight + 'px';
    const ratio = Math.min(devicePixelRatio, 1.5);
    renderer.setPixelRatio(ratio); renderer.setSize(host.clientWidth, canvasHeight, false);
    materials.forEach(material => material.uniforms.pixelRatio.value = ratio);
    if (!fitPoints) {
      const neutral = new T.Group(); neutral.rotation.copy(sculpture.rotation);
      meshes.forEach(mesh => { const copy = new T.Mesh(mesh.geometry, mesh.material); copy.position.y = mesh.userData.homeY; neutral.add(copy); });
      neutral.updateMatrixWorld(true);
      const bounds = new T.Box3(), point = new T.Vector3(); fitPoints = [];
      neutral.children.forEach(mesh => {
        const positions = mesh.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) {
          point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
          bounds.expandByPoint(point); fitPoints.push(point.x, point.y, point.z);
        }
      });
      fitCenter = bounds.getCenter(new T.Vector3());
      fitSize = bounds.getSize(new T.Vector3());
    }
    pixelsPerUnit = fittedPixels = Math.min(host.clientWidth / (fitSize.x + .55), baseHeight / fitSize.y) * .9;
    camera.left = -host.clientWidth / (2 * pixelsPerUnit); camera.right = -camera.left;
    camera.top = canvasHeight / (2 * pixelsPerUnit); camera.bottom = -camera.top;
    camera.updateProjectionMatrix(); sync(); schedule();
  }
  function render(now) {
    frame = 0;
    if (!visible || !ready || disposed || document.hidden) { last = 0; return; }
    const delta = last ? Math.min((now - last) / 1000, .08) : 1 / 60;
    last = now;
    const blend = reduced.matches ? 1 : 1 - Math.exp(-7 * delta);
    let moving = false;
    const settle = (value, target) => {
      if (Math.abs(value - target) < .0006) return target;
      moving = true; return value + (target - value) * blend;
    };
    const mobile = innerWidth < 640;
    rest = settle(rest, active < 0 ? 1 : 0);
    accordion.style.setProperty('--logic-rest', rest);
    pixelsPerUnit = fittedPixels * (1 + (mobile ? 0 : .045) * rest);
    camera.left = -host.clientWidth / (2 * pixelsPerUnit); camera.right = -camera.left;
    camera.top = canvasHeight / (2 * pixelsPerUnit); camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    camera.position.set(fitCenter.x, fitCenter.y, 10);
    camera.lookAt(fitCenter.x, fitCenter.y, 0);
    meshes.forEach((mesh, i) => {
      const discipline = middle.indexOf(i), selected = discipline >= 0 && discipline === active;
      const lit = discipline >= 0 && discipline === hover;
      // A restrained sideways extraction, with just enough tilt to reveal the cut face.
      mesh.position.x = settle(mesh.position.x, selected ? .48 : 0);
      mesh.position.z = settle(mesh.position.z, selected ? .24 : 0);
      mesh.rotation.z = settle(mesh.rotation.z, selected ? -.035 : 0);
      mesh.rotation.y = settle(mesh.rotation.y, selected ? -.09 : 0);
      materials[i].uniforms.emphasis.value = settle(materials[i].uniforms.emphasis.value, selected ? 1 : lit ? .85 : .45);
    });
    renderer.render(scene, camera);
    // At rest, labels follow their layers; selection makes room for the reading column.
    const points = middle.map(i => {
      const bounds = meshes[i].geometry.boundingBox;
      return meshes[i].localToWorld(new T.Vector3(bounds.max.x, 0, (bounds.min.z + bounds.max.z) / 2)).project(camera);
    });
    const y = points.map(point => (1 - point.y) * host.clientHeight / 2);
    let nextLabel = baseHeight * .23;
    const labelStep = Math.max(68, baseHeight * .115);
    let lastBottom = baseHeight;
    buttons.forEach((button, i) => {
      const hitHeight = Math.max(28, pixelsPerUnit * .52);
      button.style.top = (y[i] - hitHeight / 2) + 'px'; button.style.height = hitHeight + 'px';
      reveal[i] = settle(reveal[i], active === i ? 1 : 0);
      const restingY = y[1] + (i - 1) * Math.max(94, y[1] - y[0]);
      const targetY = mobile ? y[1] + (i - 1) * 44 : nextLabel * (1 - rest) + restingY * rest;
      labelY[i] = labelY[i] === null ? targetY : settle(labelY[i], targetY);
      controls[i].style.top = labelY[i] + 'px';
      const guide = guideParts[i];
      const endX = titleLeft - 12;
      const startX = Math.min(endX - 8, host.offsetLeft + (points[i].x + 1) * host.clientWidth / 2 + 5);
      guide.line.setAttribute('x1', startX); guide.line.setAttribute('x2', endX);
      guide.line.setAttribute('y1', y[i]); guide.line.setAttribute('y2', labelY[i]);
      guide.dot.setAttribute('cx', startX); guide.dot.setAttribute('cy', y[i]);
      guide.group.classList.toggle('is-active', active === i || hover === i);
      const panel = panels[i];
      const panelTop = mobile ? baseHeight + 16 : labelY[i] + 36;
      panel.style.top = panelTop + 'px';
      panel.style.opacity = String(Math.max(0, (reveal[i] - .12) / .88));
      panel.style.transform = 'translateY(' + (1 - reveal[i]) * 10 + 'px)';
      panel.style.clipPath = 'inset(0 0 ' + (1 - reveal[i]) * 100 + '% 0)';
      if (mobile) lastBottom = Math.max(lastBottom, baseHeight + reveal[i] * (panelHeights[i] + 40));
      else {
        nextLabel += labelStep + reveal[i] * (panelHeights[i] + 20);
        lastBottom = Math.max(lastBottom, labelY[i] + 40 + reveal[i] * (panelHeights[i] + 24));
      }
    });
    accordion.style.height = Math.ceil(lastBottom) + 'px';
    if (moving) schedule(); else last = 0;
  }
  async function init() {
    loading = true;
    try {
      host.dataset.state = 'loading';
      // Reuse the existing local model if another scene has already released its global.
      if (!compressed) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = new URL('assets/david/model.js', document.baseURI).href;
          script.onload = () => { compressed = window.DAVID_MODEL_GZIP; script.remove(); resolve(); };
          script.onerror = () => { script.remove(); reject(new Error('David model unavailable')); };
          document.head.appendChild(script);
        });
        if (document.querySelector('#hero-david')?.dataset.state === 'ready') delete window.DAVID_MODEL_GZIP;
      }
      if (disposed) return;
      const stream = new Blob([unpack(compressed, Uint8Array)]).stream().pipeThrough(new DecompressionStream('gzip'));
      compressed = null;
      const parts = JSON.parse(await new Response(stream).text());
      if (disposed) return;
      renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setClearColor(0, 0); renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.domElement.setAttribute('aria-hidden', 'true');
      const paper = document.createElement('canvas'); paper.width = paper.height = 512;
      const ink = paper.getContext('2d'); ink.fillStyle = '#080b09'; ink.fillRect(0, 0, 512, 512);
      ink.font = '12px monospace'; ink.fillStyle = '#6b716c';
      for (let y = 12; y < 512; y += 18) ink.fillText('position · input · response    { x, y, z }', 8, y);
      texture = new T.CanvasTexture(paper); texture.colorSpace = T.SRGBColorSpace;
      cap = new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide });
      parts.forEach((part, i) => {
        const positions = Float32Array.from(unpack(part.position, Int16Array), x => x / 8192);
        const original = positions.slice(), uv = new Float32Array(positions.length / 3 * 2);
        for (let n = 0; n < positions.length; n += 3) {
          uv[n / 3 * 2] = positions[n] / 3 + .5; uv[n / 3 * 2 + 1] = positions[n + 2] / 3 + .5;
          positions[n + 1] -= part.center;
        }
        const geometry = new T.BufferGeometry(), indices = unpack(part.index, Uint32Array);
        geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
        geometry.setAttribute('scanPosition', new T.BufferAttribute(original, 3));
        geometry.setAttribute('normal', new T.BufferAttribute(Float32Array.from(unpack(part.normal, Int16Array), x => x / 32767), 3));
        geometry.setAttribute('uv', new T.BufferAttribute(uv, 2)); geometry.setIndex(new T.BufferAttribute(indices, 1));
        geometry.addGroup(0, part.surfaceCount, 0); geometry.addGroup(part.surfaceCount, indices.length - part.surfaceCount, 1);
        geometry.computeBoundingSphere(); geometry.computeBoundingBox();
        const surface = new T.ShaderMaterial({ uniforms: { pixelRatio: { value: 1 }, emphasis: { value: .45 } }, vertexShader: vertex, fragmentShader: fragment });
        const mesh = new T.Mesh(geometry, [surface, cap]);
        mesh.userData.homeY = part.center + (i >= 4 ? .018 : i <= 2 ? -.018 : 0);
        mesh.position.y = mesh.userData.homeY;
        sculpture.add(mesh); meshes.push(mesh); materials.push(surface);
      });
      host.appendChild(renderer.domElement); ready = true; resize();
      host.dataset.state = 'ready'; host.classList.add('is-ready'); accordion.classList.add('is-david-ready'); schedule();
      renderer.domElement.addEventListener('webglcontextlost', event => {
        event.preventDefault(); ready = false; pause(); host.classList.remove('is-ready');
      });
      renderer.domElement.addEventListener('webglcontextrestored', () => { ready = true; host.classList.add('is-ready'); resize(); });
    } catch (error) {
      ready = false; host.dataset.state = 'unavailable'; host.hidden = true;
      accordion.classList.remove('logic-head-study'); guides.remove(); pause(); disposeResources();
      console.warn('Logic sculpture unavailable:', error);
    }
  }
  const checkVisibility = () => {
    const rect = accordion.getBoundingClientRect();
    visible = rect.bottom > -240 && rect.top < innerHeight + 240;
    if (visible) { if (!loading) init(); else schedule(); } else pause();
  };
  const observer = new IntersectionObserver(checkVisibility, { rootMargin: '240px' });
  observer.observe(accordion);
  window.addEventListener('scroll', checkVisibility, { passive: true });
  checkVisibility();
  // Observe width only; unfolding changes height on every animation frame.
  let measuredWidth = 0;
  const sizeObserver = new ResizeObserver(() => {
    if (accordion.clientWidth === measuredWidth) return;
    measuredWidth = accordion.clientWidth; resize();
  }); sizeObserver.observe(accordion);
  window.addEventListener('resize', resize, { passive: true });
  reduced.addEventListener('change', schedule);
  document.addEventListener('visibilitychange', () => document.hidden ? pause() : schedule());
  window.addEventListener('pageshow', schedule);
  function disposeResources() {
    meshes.forEach(mesh => mesh.geometry.dispose()); materials.forEach(material => material.dispose());
    if (cap) cap.dispose(); if (texture) texture.dispose(); if (renderer) renderer.dispose();
  }
  window.addEventListener('pagehide', event => {
    pause(); if (event.persisted) return;
    disposed = true; compressed = null; observer.disconnect(); sizeObserver.disconnect(); stateObserver.disconnect(); window.removeEventListener('resize', resize); window.removeEventListener('scroll', checkVisibility); disposeResources();
  });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
