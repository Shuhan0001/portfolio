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
      class TestAudioContext {
        state = "suspended";
        currentTime = 1;
        destination = {};
        resume() {
          if (!window.__userGesture) return Promise.reject(new Error("Autoplay blocked"));
          this.state = "running";
          return Promise.resolve();
        }
        suspend() { this.state = "suspended"; return Promise.resolve(); }
        createOscillator() {
          const entry = { type: "", frequencies: [] };
          window.__audioEvents.push(entry);
          return {
            set type(value) { entry.type = value; },
            frequency: {
              setValueAtTime(value) { entry.frequencies.push(value); },
              exponentialRampToValueAtTime(value) { entry.frequencies.push(value); },
            },
            connect(node) { return node; },
            start() {},
            stop() {},
          };
        }
        createGain() {
          return {
            gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
            connect(node) { return node; },
          };
        }
      }
      Object.defineProperty(window, "AudioContext", { value: TestAudioContext, configurable: true });
    });

    const file = path.resolve(__dirname, "..", "Projects.html");
    await page.goto(pathToFileURL(file).href, { waitUntil: "domcontentloaded", timeout: 30000 });
    const rows = page.locator("#project-list .project-row");
    assert.strictEqual(await rows.count(), 8);
    assert.strictEqual(await page.locator(".ai-disclosure-list > div").count(), 4);
    assert.strictEqual(await page.locator("#project-sound-toggle").count(), 0);

    await rows.nth(0).dispatchEvent("mouseenter");
    assert.strictEqual(await page.evaluate(() => window.__audioEvents.length), 0);
    await page.locator('[data-filter="all"]').dispatchEvent("pointerdown");
    await page.waitForTimeout(100);
    await rows.nth(1).dispatchEvent("mouseenter");
    await page.waitForTimeout(100);
    await rows.nth(2).dispatchEvent("mouseenter");
    await rows.nth(2).dispatchEvent("pointerdown");
    const events = await page.evaluate(() => window.__audioEvents);
    assert.strictEqual(events.length, 16, JSON.stringify(events));
    assert(events[5].frequencies[0] > events[10].frequencies[0]);

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
