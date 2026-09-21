const { chromium } = require("C:/Users/zhang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const { pathToFileURL } = require("url");
const path = require("path");

async function main() {
  const root = path.resolve(__dirname, "..");
  const browser = await chromium.launch({
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    await page.route(/^https?:/, (route) => {
      if (route.request().url().startsWith("https://cdn.tailwindcss.com")) {
        return route.fulfill({ contentType: "application/javascript", body: "window.tailwind = { config: {} };" });
      }
      return route.abort();
    });
    await page.goto(pathToFileURL(path.join(root, "index.html")).href, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ path: path.join(root, "tools", "assets", "index_tailwind_snapshot.css") });
    await page.addStyleTag({ content: `
      #page-enter, #site-search-fixed,
      #hero-content-wrapper header a[href="Shuhan_Zhang_CV.pdf"],
      #hero-content-wrapper header a[href="#contact-section"] {
        display: none !important;
      }
    ` });
    await page.evaluate(async () => document.fonts.ready);
    await page.hover("#hero-center .text-outline");
    await page.waitForTimeout(3000);
    const state = await page.evaluate(() => {
      const title = document.querySelector("#hero-center .text-outline");
      return {
        size: [innerWidth, innerHeight],
        titleWhite: getComputedStyle(title).color === "rgb(255, 255, 255)",
        titleHovered: title.matches(":hover"),
        artworkVisible: getComputedStyle(document.getElementById("hero-david")).display !== "none",
        searchHidden: getComputedStyle(document.getElementById("site-search-fixed")).display === "none",
      };
    });
    if (state.size[0] !== 1280 || state.size[1] !== 720 || !state.titleWhite || !state.titleHovered || !state.artworkVisible || !state.searchHidden) {
      throw new Error(`Unexpected screenshot state: ${JSON.stringify(state)}`);
    }
    const output = path.join(root, "tools", "assets", "index_home_clean_hover.png");
    await page.screenshot({ path: output, fullPage: false });
    console.log(JSON.stringify({ output, state }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
