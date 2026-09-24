const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("C:/Users/zhang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.addInitScript(() => {
      window.__audioEvents = [];
      window.__userGesture = false;
      window.addEventListener("pointerdown", () => { window.__userGesture = true; }, true);
      window.addEventListener("keydown", () => { window.__userGesture = true; }, true);
      const NativeContext = window.AudioContext;
      window.AudioContext = class extends NativeContext {
        resume() {
          if (!window.__userGesture) return Promise.reject(new Error("Autoplay blocked"));
          return super.resume();
        }
        createOscillator() {
          const oscillator = super.createOscillator();
          const start = oscillator.start.bind(oscillator);
          oscillator.start = time => {
            window.__audioEvents.push({ type: oscillator.type, time });
            start(time);
          };
          return oscillator;
        }
      };
    });

    const file = path.resolve(__dirname, "..", "Projects.html");
    await page.goto(pathToFileURL(file).href, { waitUntil: "domcontentloaded", timeout: 30000 });
    const rows = page.locator("#project-list .project-row");
    assert.strictEqual(await rows.count(), 8);
    assert.strictEqual(await page.locator(".ai-disclosure-list > div").count(), 4);
    assert.strictEqual(await page.locator("#project-sound-toggle").count(), 0);

    await rows.nth(0).dispatchEvent("mouseenter");
    assert.strictEqual(await page.evaluate(() => window.__audioEvents.length), 0);
    await page.locator('[data-filter="all"]').click();
    await page.waitForTimeout(100);
    await rows.nth(1).dispatchEvent("mouseenter");
    await page.waitForTimeout(100);
    const firstCount = await page.evaluate(() => window.__audioEvents.length);
    assert(firstCount > 0, "Hover should play after a gesture");
    await rows.nth(2).dispatchEvent("mouseenter");
    await page.waitForTimeout(30);
    const secondCount = await page.evaluate(() => window.__audioEvents.length);
    assert(secondCount > firstCount, "Selecting another row should play a new cue");
    await rows.nth(2).dispatchEvent("pointerdown");
    await page.waitForTimeout(30);
    const events = await page.evaluate(() => window.__audioEvents);
    assert(events.length > secondCount, "Press should have its own cue");
    await rows.nth(2).dispatchEvent("pointerdown");
    await page.waitForTimeout(30);
    assert.strictEqual(await page.evaluate(() => window.__audioEvents.length), events.length, "Duplicate presses should be throttled");

    const rendered = await page.evaluate(async () => {
      const rate = 48000;
      const context = new OfflineAudioContext(2, rate * 2, rate);
      const synth = window.createProjectSoundSynth(context);
      synth.hover(0.05, 1);
      synth.hover(0.55, 3);
      synth.press(1.1, 2);
      const buffer = await context.startRendering();
      const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
      let peak = 0, energy = 0, stereo = 0, tail = 0;
      const wav = new ArrayBuffer(44 + buffer.length * 4), view = new DataView(wav);
      const text = (offset, value) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
      text(0, 'RIFF'); view.setUint32(4, wav.byteLength - 8, true); text(8, 'WAVE');
      text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
      view.setUint16(22, 2, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 4, true);
      view.setUint16(32, 4, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, buffer.length * 4, true);
      for (let i = 0; i < left.length; i++) {
        if (!Number.isFinite(left[i]) || !Number.isFinite(right[i])) throw Error('Non-finite audio sample');
        peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
        energy += left[i] * left[i] + right[i] * right[i];
        stereo += Math.abs(left[i] - right[i]);
        if (i > rate * 1.7) tail = Math.max(tail, Math.abs(left[i]), Math.abs(right[i]));
        view.setInt16(44 + i * 4, Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), true);
        view.setInt16(46 + i * 4, Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), true);
      }
      const bytes = new Uint8Array(wav);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return { peak, rms: Math.sqrt(energy / (left.length * 2)), stereo: stereo / left.length, tail, wav: btoa(binary) };
    });
    assert(rendered.peak > 0.015 && rendered.peak < 0.5, `Unexpected peak: ${rendered.peak}`);
    assert(rendered.rms > 0.001 && rendered.stereo > 0.0001, "Cues should be audible with stereo reflections");
    assert(rendered.tail < 0.00001, "Short cues must return to silence");
    const audioDir = path.resolve(__dirname, '..', 'tmp', 'audio');
    fs.mkdirSync(audioDir, { recursive: true });
    fs.writeFileSync(path.join(audioDir, 'projects-sci-fi-preview.wav'), Buffer.from(rendered.wav, 'base64'));
    console.log('Audio render:', { peak: rendered.peak, rms: rendered.rms, tail: rendered.tail });

    const screenshots = path.resolve(__dirname, "..", "tmp", "screenshots");
    fs.mkdirSync(screenshots, { recursive: true });
    await page.waitForTimeout(1100);
    await page.screenshot({ path: path.join(screenshots, "projects_audio_desktop.png"), fullPage: true });
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobile.goto(pathToFileURL(file).href, { waitUntil: "domcontentloaded", timeout: 30000 });
    await mobile.waitForTimeout(1100);
    await mobile.screenshot({ path: path.join(screenshots, "projects_audio_mobile.png"), fullPage: true });
    const widths = await mobile.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      overflowing: [...document.querySelectorAll("body *")]
        .map((element) => ({ name: element.tagName + (element.id ? "#" + element.id : "") + "." + String(element.className).slice(0, 80), right: element.getBoundingClientRect().right }))
        .filter((element) => element.right > window.innerWidth + 2)
        .slice(0, 12),
    }));
    assert(widths.page <= widths.viewport + 2, JSON.stringify(widths));
    console.log("Projects audio and disclosure checks passed; screenshots in", screenshots);
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
