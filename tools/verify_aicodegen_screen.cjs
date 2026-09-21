const { chromium } = require("C:/Users/zhang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const { pathToFileURL } = require("url");
const path = require("path");

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, "..", "AICodeGen_Profilo.html")).href);
    await page.evaluate(() => document.fonts.ready);
    const result = await page.evaluate(() => ({
      fullPageCount: document.querySelectorAll(".aicodegen-full-page").length,
      visibleFullPages: [...document.querySelectorAll(".aicodegen-full-page")].filter(
        (node) => getComputedStyle(node).display !== "none"
      ).length,
      heroDisplay: getComputedStyle(document.querySelector(".hero")).display,
      primaryButtonDisplay: getComputedStyle(document.querySelector(".gameplay-btn")).display,
      coverAssetComplete: document.querySelector('img[src="Image/AICodeGen_LiveCover.png"]').complete,
    }));
    console.log(JSON.stringify({ ...result, pageErrors }, null, 2));
    if (
      result.fullPageCount !== 11 ||
      result.visibleFullPages !== 0 ||
      result.heroDisplay === "none" ||
      result.primaryButtonDisplay === "none" ||
      !result.coverAssetComplete ||
      pageErrors.length
    ) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
