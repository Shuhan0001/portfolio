const { chromium } = require("C:/Users/zhang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const { pathToFileURL } = require("url");
const path = require("path");
const fs = require("fs");

async function main() {
  const root = path.resolve(__dirname, "..");
  const inputPath = path.join(root, "HauntedSchool_Profilo.html");
  const outputPath = process.argv[2] || path.join(root, "output", "pdf", "HauntedSchool_Full_Portfolio.pdf");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const browser = await chromium.launch({
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(pathToFileURL(inputPath).href, { waitUntil: "load" });
    const screenState = await page.evaluate(() => ({
      originalHeroVisible: !!document.querySelector(".hero") && getComputedStyle(document.querySelector(".hero")).display !== "none",
      fullPagesHidden: [...document.querySelectorAll(".haunted-page")].every((el) => getComputedStyle(el).display === "none"),
    }));
    if (!screenState.originalHeroVisible || !screenState.fullPagesHidden) {
      throw new Error(`Screen layout changed: ${JSON.stringify(screenState)}`);
    }
    await page.evaluate(() => document.body.classList.add("haunted-full-portfolio"));
    await page.emulateMedia({ media: "print" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      for (const img of document.images) img.loading = "eager";
      await Promise.race([
        Promise.all([...document.images].map((img) => img.decode().catch(() => undefined))),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    });
    const layout = await page.evaluate(() => [...document.querySelectorAll(".haunted-page")].map((el, index) => {
      const rect = el.getBoundingClientRect();
      const inner = el.querySelector(".hs-inner").getBoundingClientRect();
      return { index: index + 1, width: rect.width, height: rect.height, innerBottom: inner.bottom - rect.top, scrollHeight: el.scrollHeight };
    }));
    if (layout.length !== 8 || layout.some((item) => item.width !== 1280 || item.height !== 720 || item.scrollHeight > 720)) {
      throw new Error(`Unexpected page layout: ${JSON.stringify(layout)}`);
    }
    if (errors.length) throw new Error(`Page errors: ${errors.join(" | ")}`);
    await page.pdf({ path: outputPath, printBackground: true, preferCSSPageSize: true, tagged: true });
    console.log(JSON.stringify({ outputPath, screenState, layout }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
