(() => {
  'use strict';
  const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const root = document.documentElement;
  const quietTargets = 'input, textarea, [contenteditable]:not([contenteditable="false"]), :disabled, [aria-disabled="true"], audio, video';
  let releaseTimer, context, clickBuffer;

  function release() {
    clearTimeout(releaseTimer);
    root.classList.remove('fps-cursor-pressed');
  }

  function playClick() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      // Construct and unlock audio only inside a deliberate mouse gesture.
      if (!context || context.state === 'closed') {
        context = new AudioContext({ latencyHint: 'interactive' });
        const duration = .085;
        const length = Math.ceil(context.sampleRate * duration);
        clickBuffer = context.createBuffer(1, length, context.sampleRate);
        const samples = clickBuffer.getChannelData(0);
        let noiseSeed = 0x7a31e9, previousNoise = 0;
        for (let i = 0; i < length; i++) {
          const t = i / context.sampleRate;
          // A dry impact followed by a short, inharmonic metallic confirmation.
          // Seeded noise keeps each hit consistent rather than varying clicks.
          noiseSeed ^= noiseSeed << 13;
          noiseSeed ^= noiseSeed >>> 17;
          noiseSeed ^= noiseSeed << 5;
          const noise = (noiseSeed >>> 0) / 2147483648 - 1;
          const transient = (noise - previousNoise) * .15 * Math.exp(-t * 360);
          previousNoise = noise;
          const metal = (
            Math.sin(2 * Math.PI * 1850 * t) * .14 +
            Math.sin(2 * Math.PI * 3130 * t) * .07 +
            Math.sin(2 * Math.PI * 4720 * t) * .035
          ) * Math.exp(-t * 75);
          const body = Math.sin(2 * Math.PI * (760 * t - 3200 * t * t)) * .085 * Math.exp(-t * 115);
          const attack = 1 - Math.exp(-t * 4200);
          const tail = Math.min(1, (duration - t) / .012);
          samples[i] = (transient + metal + body) * attack * tail;
        }
      }
      const start = () => {
        if (context.state !== 'running' || document.hidden) return;
        const source = context.createBufferSource();
        source.buffer = clickBuffer;
        source.connect(context.destination);
        source.onended = () => source.disconnect();
        source.start();
      };
      if (context.state === 'suspended') context.resume().then(start).catch(() => {});
      else start();
    } catch (_) {
      // Cursor feedback remains available if audio is unsupported or blocked.
    }
  }

  document.addEventListener('pointerdown', event => {
    if (!pointer.matches || event.pointerType !== 'mouse' || event.button !== 0) return;
    if (event.target.closest(quietTargets)) return;
    clearTimeout(releaseTimer);
    root.classList.add('fps-cursor-pressed');
    releaseTimer = setTimeout(release, 140);
    playClick();
  }, { capture: true, passive: true });
  document.addEventListener('pointerup', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !root.classList.contains('fps-cursor-pressed')) return;
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(release, 80);
  }, { passive: true });
  document.addEventListener('pointercancel', release, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });
  window.addEventListener('blur', release);
  window.addEventListener('pagehide', () => {
    release();
    if (context?.state === 'running') context.suspend().catch(() => {});
  });
  pointer.addEventListener('change', release);
})();
