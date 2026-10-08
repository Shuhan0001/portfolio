(() => {
  const scene = document.querySelector('.contact-title-scene');
  if (!scene || !matchMedia('(hover: hover) and (pointer: fine)').matches ||
      matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let frame = 0, active = false;
  const current = { x: 0, y: 0 }, target = { x: 0, y: 0 };
  const draw = () => {
    current.x += (target.x - current.x) * .11;
    current.y += (target.y - current.y) * .11;
    scene.style.setProperty('--contact-parallax-x', `${current.x.toFixed(2)}px`);
    scene.style.setProperty('--contact-parallax-y', `${current.y.toFixed(2)}px`);
    frame = active && (Math.abs(target.x - current.x) + Math.abs(target.y - current.y) > .03)
      ? requestAnimationFrame(draw) : 0;
  };
  const update = () => { if (!frame && active) frame = requestAnimationFrame(draw); };
  const move = event => {
    if (!active) return;
    const bounds = scene.getBoundingClientRect();
    target.x = ((event.clientX - bounds.left) / bounds.width - .5) * 22;
    target.y = ((event.clientY - bounds.top) / bounds.height - .5) * 14;
    update();
  };
  const reset = () => { target.x = target.y = 0; update(); };
  scene.addEventListener('pointermove', move);
  scene.addEventListener('pointerleave', reset);
  const observer = new IntersectionObserver(entries => {
    active = entries[0].isIntersecting;
    if (active) update();
    else { cancelAnimationFrame(frame); frame = 0; }
  });
  observer.observe(scene);
  window.addEventListener('pageshow', event => {
    if (event.persisted) observer.observe(scene);
  });
  window.addEventListener('pagehide', event => {
    cancelAnimationFrame(frame);
    frame = 0;
    observer.disconnect();
    if (!event.persisted) {
      scene.removeEventListener('pointermove', move);
      scene.removeEventListener('pointerleave', reset);
    }
  });
})();
