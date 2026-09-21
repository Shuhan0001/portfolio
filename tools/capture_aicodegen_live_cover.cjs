const { chromium } = require("C:/Users/zhang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const { pathToFileURL } = require("url");
const path = require("path");

async function main() {
  const root = path.resolve(__dirname, "..");
  const mode = process.argv[2] === "gameplay" ? "gameplay" : "cover";
  const browser = await chromium.launch({
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
    await page.goto(pathToFileURL(path.join(root, "v6_scene_music_system.html")).href, { waitUntil: "load" });
    await page.locator("#gameCanvas").waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const canvas = document.querySelector("#gameCanvas");
      return canvas && canvas.getContext("2d").getImageData(160, 100, 1, 1).data[3] > 0;
    });
    if (mode === "gameplay") {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(350);
    }
    await page.locator("#gameCanvas").screenshot({
      path: path.join(root, "Image", mode === "gameplay" ? "AICodeGen_Gameplay.png" : "AICodeGen_LiveCover.png"),
      animations: "disabled",
    });
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
