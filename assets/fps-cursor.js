(() => {
  'use strict';
  const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const root = document.documentElement;
  const quietTargets = 'input, textarea, [contenteditable]:not([contenteditable="false"]), :disabled, [aria-disabled="true"], audio, video';
  let releaseTimer, context, clickBuffer, scrollBuffer;
  let lastScrollTick = -Infinity;
  let resumePromise = null, scrollVersion = 0;

  function ensureContext() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!context || context.state === 'closed') {
      context = new AudioContext({ latencyHint: 'interactive' });
      clickBuffer = scrollBuffer = null;
      resumePromise = null;
    }
    return context;
  }

  function prepareScroll() {
    // Warm the buffer during activation so a wheel tick needs no synthesis work.
    if (document.hidden || !window.navigator?.userActivation?.hasBeenActive) return;
    try {
      const audio = ensureContext();
      if (!audio) return;
      prepareScrollBuffer();
      if (audio.state === 'running') return Promise.resolve();
      if (!resumePromise) {
        resumePromise = audio.resume().catch(() => {}).finally(() => { resumePromise = null; });
      }
      return resumePromise;
    } catch (_) {}
  }

  function prepareScrollBuffer() {
    if (!scrollBuffer) {
      const duration = .065;
      const length = Math.ceil(context.sampleRate * duration);
      scrollBuffer = context.createBuffer(1, length, context.sampleRate);
      const samples = scrollBuffer.getChannelData(0);
      let seed = 0x39af21, previousNoise = 0;
      for (let i = 0; i < length; i++) {
        const t = i / context.sampleRate;
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        const noise = (seed >>> 0) / 2147483648 - 1;
        // Soft mechanical contact, a brushed edge and a restrained metal tail.
        const contact = Math.sin(2 * Math.PI * 640 * t) * .055 * Math.exp(-t * 160);
        const brush = (noise - previousNoise) * .025 * Math.exp(-t * 210);
        const metal = (Math.sin(2 * Math.PI * 1850 * t) * .023 +
          Math.sin(2 * Math.PI * 3130 * t) * .009) * Math.exp(-t * 100);
        previousNoise = noise;
        samples[i] = (contact + brush + metal) * (1 - Math.exp(-t * 3000)) *
          Math.min(1, (duration - t) / .012);
      }
    }
  }

  function playScrollTick(direction) {
    const requestedAt = performance.now();
    if (document.hidden || requestedAt - lastScrollTick < 100) return;
    const version = ++scrollVersion;
    const start = () => {
      const now = performance.now();
      if (version !== scrollVersion || document.hidden || context?.state !== 'running' ||
          now - requestedAt > 180 || now - lastScrollTick < 100) return;
      prepareScrollBuffer();
      const source = context.createBufferSource();
      source.buffer = scrollBuffer;
      source.playbackRate.value = direction < 0 ? .97 : 1.03;
      source.connect(context.destination);
      source.onended = () => source.disconnect();
      source.start();
      lastScrollTick = now;
    };
    try {
      // Running contexts start synchronously. Only a fresh wake-up waits, keeping
      // the latest tick briefly instead of dropping it or replaying a backlog.
      if (context?.state === 'running') start();
      else prepareScroll()?.then(start).catch(() => {});
    } catch (_) {}
  }

  window.portfolioAudio = Object.freeze({ prepareScroll, playScrollTick });

  function release() {
    clearTimeout(releaseTimer);
    root.classList.remove('fps-cursor-pressed');
  }

  function playClick() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      // Construct and unlock audio only inside a deliberate mouse gesture.
      ensureContext();
      if (!clickBuffer) {
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
      if (context.state !== 'running') (resumePromise || context.resume()).then(start).catch(() => {});
      else start();
    } catch (_) {
      // Cursor feedback remains available if audio is unsupported or blocked.
    }
  }

  document.addEventListener('pointerdown', event => {
    if (!pointer.matches || event.pointerType !== 'mouse' || event.button !== 0) return;
    scrollVersion++;
    prepareScroll();
    if (event.target.closest(quietTargets)) return;
    clearTimeout(releaseTimer);
    root.classList.add('fps-cursor-pressed');
    releaseTimer = setTimeout(release, 140);
    playClick();
  }, { capture: true, passive: true });
  document.addEventListener('keydown', event => {
    if (!event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) prepareScroll();
  }, { capture: true });
  document.addEventListener('pointerup', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !root.classList.contains('fps-cursor-pressed')) return;
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(release, 80);
  }, { passive: true });
  document.addEventListener('pointercancel', release, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { release(); scrollVersion++; }
  });
  window.addEventListener('blur', release);
  window.addEventListener('pagehide', () => {
    release();
    scrollVersion++;
    if (context?.state === 'running') context.suspend().catch(() => {});
  });
  pointer.addEventListener('change', release);
})();
