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
    [...panels[i].querySelectorAll('.group\\/spec > div > span:first-child')].slice(0, 2).forEach((item, index) => {
      if (index) preview.append(document.createTextNode(' / '));
      const phrase = document.createElement('span');
      phrase.textContent = item.textContent.trim(); preview.append(phrase);
    });
    control.append(preview);
  });
  const svgNS = 'http://www.w3.org/2000/svg';
  const guides = document.createElementNS(svgNS, 'svg');
  guides.classList.add('logic-david-guides'); guides.setAttribute('aria-hidden', 'true');
  const guideParts = controls.map(() => {
    const group = document.createElementNS(svgNS, 'g'); group.classList.add('logic-david-guide');
    const line = document.createElementNS(svgNS, 'line'), dot = document.createElementNS(svgNS, 'circle');
    const trace = document.createElementNS(svgNS, 'line');
    trace.classList.add('logic-david-guide__trace'); trace.setAttribute('pathLength', '1');
    dot.setAttribute('r', '2'); group.append(line, trace, dot); guides.append(group);
    return { group, line, trace, dot };
  });
  const trackingConnector = document.createElementNS(svgNS, 'line');
  trackingConnector.classList.add('logic-tracking-connector');
  trackingConnector.style.opacity = '0';
  guides.append(trackingConnector);
  accordion.append(guides);
  // Two non-interactive tracking boxes share the sculpture's render clock.
  const trackingBoxes = ['slice', 'content'].map(kind => {
    const box = document.createElement('div');
    box.className = 'logic-tracking-box logic-tracking-box--' + kind;
    box.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'logic-tracking-box__label';
    label.textContent = '???';
    box.append(label); accordion.append(box);
    return box;
  });
  let trackedLayer = -1;
  const trackingPoint = new T.Vector3();
  function placeTrackingBox(box, x, y, width, height, opacity) {
    box.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    box.style.width = Math.max(0, width) + 'px';
    box.style.height = Math.max(0, height) + 'px';
    box.style.opacity = String(opacity);
  }
  let titleLeft = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const scene = new T.Scene(), sculpture = new T.Group();
  const camera = new T.OrthographicCamera(-4, 4, 4, -4, .1, 40);
  sculpture.rotation.set(.035, .22, -.035); scene.add(sculpture);
  const meshes = [], materials = [], middle = [4, 3, 2];
  const contours = [], pointer = { x: 0, y: 0 }, neutralRotation = sculpture.rotation.clone();
  const guideReveal = [0, 0, 0];
  let restingAnchors;
  accordion.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || reduced.matches) return;
    const rect = accordion.getBoundingClientRect();
    pointer.x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
    pointer.y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / baseHeight * 2 - 1));
    schedule();
  }, { passive: true });
  accordion.addEventListener('pointerleave', () => { pointer.x = pointer.y = 0; schedule(); });
  let renderer, texture, cap, ready = false, loading = false, visible = false;
  let frame = 0, last = 0, active = -1, hover = -1, disposed = false;
  let fitPoints, fitCenter;
  const focusPoint = new T.Vector3();
  let focusX = null, focusY = null;
  const focusStrength = .5;
  let baseHeight = 700, canvasHeight = 700, pixelsPerUnit = 140;
  let panelHeights = [], panelBounds = [], fitSize, fittedPixels = 140, rest = 1;
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
  const titleObserver = new ResizeObserver(entries => {
    entries.forEach(entry => {
      const control = entry.target.closest('.logic-toggle');
      control.style.setProperty('--logic-title-width', entry.target.offsetWidth + 'px');
    });
  });
  controls.forEach(control => titleObserver.observe(control.querySelector('h4')));
  controls.forEach(control => stateObserver.observe(control, { attributes: true, attributeFilter: ['aria-expanded'] }));
  sync();
  function resize() {
    if (!ready || !renderer || !host.clientWidth || !host.clientHeight) return;
    // Preserve the reading composition; the closed view has a slightly fuller silhouette.
    baseHeight = innerWidth < 640 ? Math.min(440, Math.max(340, innerHeight * .45)) : Math.min(780, Math.max(600, innerHeight * .92));
    panelHeights = panels.map(panel => panel.offsetHeight);
    panelBounds = panels.map(panel => ({ left: panel.offsetLeft, width: panel.offsetWidth }));
    titleLeft = controls[0].offsetLeft;
    controls.forEach(control => control.style.setProperty('--logic-title-width', control.querySelector('h4').offsetWidth + 'px'));
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
    restingAnchors = null;
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

    sculpture.rotation.x = settle(sculpture.rotation.x, neutralRotation.x + (reduced.matches || mobile ? 0 : pointer.y * .018));
    sculpture.rotation.y = settle(sculpture.rotation.y, neutralRotation.y + (reduced.matches || mobile ? 0 : pointer.x * .035));
    meshes.forEach((mesh, i) => {
      const discipline = middle.indexOf(i), selected = discipline >= 0 && discipline === active;
      const lit = discipline >= 0 && discipline === hover;
      // A restrained sideways extraction, with just enough tilt to reveal the cut face.
      mesh.position.x = settle(mesh.position.x, selected ? .48 : lit ? .075 : 0);
      mesh.position.z = settle(mesh.position.z, selected ? .24 : lit ? .045 : 0);
      mesh.rotation.z = settle(mesh.rotation.z, selected ? -.035 : lit ? -.006 : 0);
      mesh.rotation.y = settle(mesh.rotation.y, selected ? -.09 : lit ? -.015 : 0);
      materials[i].uniforms.emphasis.value = settle(materials[i].uniforms.emphasis.value, selected ? 1 : lit ? .85 : .45);
      if (contours[i]) contours[i].material.opacity = settle(contours[i].material.opacity, selected ? .65 : lit ? .42 : .12);
    });
    // Halfway between the full-head composition and the selected fragment.
    // Project guides and tracking boxes with this same camera below.
    sculpture.updateMatrixWorld(true);
    let targetX = fitCenter.x, targetY = fitCenter.y;
    const restingZoom = mobile ? 1 : 1.045;
    if (active >= 0) {
      const selectedMesh = meshes[middle[active]];
      selectedMesh.geometry.boundingBox.getCenter(focusPoint);
      selectedMesh.localToWorld(focusPoint);
      targetX += (focusPoint.x - fitCenter.x) * focusStrength;
      targetY += (focusPoint.y - fitCenter.y) * focusStrength;
    }
    focusX = focusX === null ? fitCenter.x : focusX;
    focusY = focusY === null ? fitCenter.y : focusY;
    focusX = settle(focusX, targetX);
    focusY = settle(focusY, targetY);
    // Focus is a framing shift only: opening never changes the sculpture scale.
    pixelsPerUnit = fittedPixels * restingZoom;
    camera.left = -host.clientWidth / (2 * pixelsPerUnit); camera.right = -camera.left;
    camera.top = canvasHeight / (2 * pixelsPerUnit); camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    camera.position.set(focusX, focusY, 10);
    camera.lookAt(focusX, focusY, 0);
    renderer.render(scene, camera);
    // At rest, labels follow their layers; selection makes room for the reading column.
    const points = middle.map(i => {
      const bounds = meshes[i].geometry.boundingBox;
      return meshes[i].localToWorld(new T.Vector3(bounds.max.x, 0, (bounds.min.z + bounds.max.z) / 2)).project(camera);
    });
    const y = points.map(point => (1 - point.y) * host.clientHeight / 2);
    if (!restingAnchors) restingAnchors = y.slice();
    let nextLabel = baseHeight * .23;
    const labelStep = Math.max(80, baseHeight * .125);
    let lastBottom = baseHeight;
    buttons.forEach((button, i) => {
      const hitHeight = Math.max(28, pixelsPerUnit * .52);
      button.style.top = (y[i] - hitHeight / 2) + 'px'; button.style.height = hitHeight + 'px';
      reveal[i] = settle(reveal[i], active === i ? 1 : 0);
      const restingY = restingAnchors[1] + (i - 1) * Math.max(112, baseHeight * .17, restingAnchors[1] - restingAnchors[0]);
      const targetY = mobile ? restingAnchors[1] + (i - 1) * 44 : nextLabel * (1 - rest) + restingY * rest;
      labelY[i] = labelY[i] === null ? targetY : settle(labelY[i], targetY);
      controls[i].style.top = labelY[i] + 'px';
      const guide = guideParts[i];
      const endX = titleLeft - 12;
      const startX = Math.min(endX - 8, host.offsetLeft + (points[i].x + 1) * host.clientWidth / 2 + 5);
      guide.line.setAttribute('x1', startX); guide.line.setAttribute('x2', endX);
      guide.line.setAttribute('y1', y[i]); guide.line.setAttribute('y2', labelY[i]);
      ['x1', 'x2', 'y1', 'y2'].forEach(name => guide.trace.setAttribute(name, guide.line.getAttribute(name)));
      guideReveal[i] = settle(guideReveal[i], active === i || hover === i ? 1 : 0);
      guide.trace.style.strokeDashoffset = String(1 - guideReveal[i]);
      guide.trace.style.opacity = String(guideReveal[i]);
      guide.dot.setAttribute('cx', startX); guide.dot.setAttribute('cy', y[i]);
      guide.group.classList.toggle('is-active', active === i || hover === i);
      guide.group.style.opacity = String(1 - Math.max(0, Math.min(1, (reveal[i] - .16) / .84)));
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
    if (active >= 0) trackedLayer = active;
    if (trackedLayer >= 0) {
      const amount = Math.max(0, Math.min(1, (reveal[trackedLayer] - .16) / .84));
      const mesh = meshes[middle[trackedLayer]], bounds = mesh.geometry.boundingBox;
      let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
      // Project all eight corners so the box follows extraction and head rotation.
      for (const x of [bounds.min.x, bounds.max.x]) {
        for (const y of [bounds.min.y, bounds.max.y]) {
          for (const z of [bounds.min.z, bounds.max.z]) {
            trackingPoint.set(x, y, z).applyMatrix4(mesh.matrixWorld).project(camera);
            const px = host.offsetLeft + (trackingPoint.x + 1) * host.clientWidth / 2;
            const py = host.offsetTop + (1 - trackingPoint.y) * canvasHeight / 2;
            left = Math.min(left, px); right = Math.max(right, px);
            top = Math.min(top, py); bottom = Math.max(bottom, py);
          }
        }
      }
      const padding = mobile ? 5 : 9;
      left = Math.max(padding, left - padding);
      right = Math.min(accordion.clientWidth - padding, right + padding);
      top = Math.max(22, top - padding);
      placeTrackingBox(trackingBoxes[0], left, top, right - left, bottom + padding - top, amount);
      const contentTop = mobile ? baseHeight + 16 : labelY[trackedLayer] + 36;
      const contentBounds = panelBounds[trackedLayer];
      placeTrackingBox(trackingBoxes[1], contentBounds.left, contentTop + (1 - reveal[trackedLayer]) * 10,
        contentBounds.width, panelHeights[trackedLayer], amount);
      const boxTop = contentTop + (1 - reveal[trackedLayer]) * 10;
      // Attach to the actual borders, not the title or a point inside the mesh.
      const fromX = mobile ? (left + right) / 2 : right;
      const fromY = mobile ? bottom + padding : top;
      const toX = mobile ? Math.max(contentBounds.left, Math.min(contentBounds.left + contentBounds.width, fromX)) : contentBounds.left;
      const toY = boxTop;
      trackingConnector.setAttribute('x1', fromX);
      trackingConnector.setAttribute('y1', fromY);
      trackingConnector.setAttribute('x2', toX);
      trackingConnector.setAttribute('y2', toY);
      trackingConnector.style.opacity = String(amount);
    }
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
        if (middle.includes(i)) {
          // Weld cap edges by position so the outline follows only the real cut perimeter.
          const edges = new Map();
          const key = index => [0, 1, 2].map(axis => Math.round(positions[index * 3 + axis] * 8192)).join(',');
          for (let n = part.surfaceCount; n < indices.length; n += 3) {
            for (let edge = 0; edge < 3; edge++) {
              const a = indices[n + edge], b = indices[n + (edge + 1) % 3];
              const ka = key(a), kb = key(b), id = ka < kb ? ka + ':' + kb : kb + ':' + ka;
              const entry = edges.get(id);
              if (entry) entry.count++; else edges.set(id, { a, b, count: 1 });
            }
          }
          const vertices = [];
          edges.forEach(({ a, b, count }) => {
            if (count === 1) vertices.push(...positions.slice(a * 3, a * 3 + 3), ...positions.slice(b * 3, b * 3 + 3));
          });
          const outline = new T.BufferGeometry();
          outline.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
          const contour = new T.LineSegments(outline, new T.LineBasicMaterial({ color: 0xd9dedb, transparent: true, opacity: .12, depthWrite: false }));
          contour.renderOrder = 1; mesh.add(contour); contours[i] = contour;
        }
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
  // Wrapped copy and font changes can alter a panel without changing rail width.
  const panelObserver = new ResizeObserver(() => {
    if (!ready || disposed) return;
    panelHeights = panels.map(panel => panel.offsetHeight);
    panelBounds = panels.map(panel => ({ left: panel.offsetLeft, width: panel.offsetWidth }));
    schedule();
  });
  panels.forEach(panel => panelObserver.observe(panel));
  window.addEventListener('resize', resize, { passive: true });
  if (document.fonts) document.fonts.ready.then(() => { if (!disposed) resize(); });
  reduced.addEventListener('change', schedule);
  document.addEventListener('visibilitychange', () => document.hidden ? pause() : schedule());
  window.addEventListener('pageshow', schedule);
  function disposeResources() {
    meshes.forEach(mesh => mesh.geometry.dispose()); materials.forEach(material => material.dispose());
    if (cap) cap.dispose(); if (texture) texture.dispose(); if (renderer) renderer.dispose();
  }
  window.addEventListener('pagehide', event => {
    pause(); if (event.persisted) return;
    disposed = true; compressed = null; observer.disconnect(); sizeObserver.disconnect(); panelObserver.disconnect(); stateObserver.disconnect(); titleObserver.disconnect(); window.removeEventListener('resize', resize); window.removeEventListener('scroll', checkVisibility); disposeResources();
  });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
